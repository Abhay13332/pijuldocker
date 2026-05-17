use std::path::Path;
use std::collections::{HashSet, HashMap};
use napi_derive::napi;
use libpijul::{
    changestore::filesystem::FileSystem,
    pristine::{
        sanakirja::Pristine, ArcTxn, Base32, GraphTxnT,
        TxnT, MutTxnT,
    },
    working_copy::{Memory, WorkingCopyRead},
    MutTxnTExt,
};
use libpijul::pristine::changeid_log;
use std::sync::{Arc, Mutex, OnceLock};

// ── Per-repo write serialization ─────────────────────────────────────────────
// Sanakirja permits only one mutable transaction per environment at a time.
// This map holds one Mutex per canonical repo path so concurrent conflict
// checks against the same repo are serialized without blocking unrelated repos.
static REPO_LOCKS: OnceLock<Mutex<HashMap<String, Arc<Mutex<()>>>>> = OnceLock::new();

fn repo_lock(repo_path: &str) -> Arc<Mutex<()>> {
    let global = REPO_LOCKS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut map = global.lock().expect("REPO_LOCKS poisoned");
    map.entry(repo_path.to_string())
        .or_insert_with(|| Arc::new(Mutex::new(())))
        .clone()
}

#[napi(object)]
pub struct ConflictInfo {
    pub conflict_type: String,
    pub path: String,
    pub line: Option<u32>,
    pub changes: Vec<String>,
    /// Merged file content after applying branch_a changes onto branch_b.
    pub content: Option<String>,
    /// File content as it exists in branch_a before the merge.
    pub content_a: Option<String>,
    /// File content as it exists in branch_b before the merge.
    pub content_b: Option<String>,
}

/// Detect merge conflicts when applying changes from `branch_a` into `branch_b`.
///
/// Non-destructive: operates on a temporary forked channel that is always
/// cleaned up before returning, whether the call succeeds or fails.
/// Concurrent calls against the same `repo_path` are automatically serialized.
#[napi]
pub fn get_merge_conflicts(
    repo_path: String,
    branch_a: String,
    branch_b: String,
) -> napi::Result<Vec<ConflictInfo>> {

    // ── 1. Serialize writes for this repo ────────────────────────────────────
    let lock = repo_lock(&repo_path);
    let _guard = lock.lock().expect("repo lock poisoned"); // released when function returns

    let repo_path_obj = Path::new(&repo_path);

    // ── 2. Open pristine + change store ─────────────────────────────────────
    let pristine_path = repo_path_obj
        .join(libpijul::DOT_DIR)
        .join("pristine")
        .join("db");
    let pristine = Pristine::new(&pristine_path)
        .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine: {}", e)))?;
    let mut txn = pristine
        .mut_txn_begin()
        .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;

    let changes = FileSystem::from_root(repo_path_obj, 256);

    // ── 3. Load channels ─────────────────────────────────────────────────────
    let channel_a = txn
        .load_channel(&branch_a)
        .map_err(|e| napi::Error::from_reason(format!("Error loading branch_a: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Branch '{}' not found", branch_a)))?;

    let channel_b = txn
        .load_channel(&branch_b)
        .map_err(|e| napi::Error::from_reason(format!("Error loading branch_b: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Branch '{}' not found", branch_b)))?;

    // ── 4. Find changes in A that are missing from B ─────────────────────────
    let mut applied_in_b = HashSet::new();
    {
        let guard = channel_b.read();
        let mut cursor = changeid_log(&txn, &*guard, 0u64.into())
            .map_err(|e| napi::Error::from_reason(format!("Cursor error (branch_b): {}", e)))?;
        while let Some(pair) = cursor.next() {
            let (_, p) = pair
                .map_err(|e| napi::Error::from_reason(format!("Cursor read error: {}", e)))?;
            applied_in_b.insert(p.a);
        }
    }

    let mut to_apply = Vec::new();
    {
        let guard = channel_a.read();
        let mut cursor = changeid_log(&txn, &*guard, 0u64.into())
            .map_err(|e| napi::Error::from_reason(format!("Cursor error (branch_a): {}", e)))?;
        while let Some(pair) = cursor.next() {
            let (_, p) = pair
                .map_err(|e| napi::Error::from_reason(format!("Cursor read error: {}", e)))?;
            if !applied_in_b.contains(&p.a) {
                if let Some(hash) = txn
                    .get_external(&p.a)
                    .map_err(|e| napi::Error::from_reason(format!("DB error: {}", e)))?
                {
                    to_apply.push(hash.into());
                }
            }
        }
    }

    // Nothing to apply → no conflicts possible.
    if to_apply.is_empty() {
        return Ok(Vec::new());
    }

    // ── 5. Fork branch_b into a temporary channel ────────────────────────────
    // Nanosecond timestamp minimises name collision for concurrent calls
    // (the per-repo mutex already prevents true concurrency, but the name
    // must still be unique across successive calls within the same process).
    let tmp_name = format!(
        "_tmp_merge_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    );

    let tmp_channel = MutTxnT::fork(&mut txn, &channel_b, &tmp_name)
        .map_err(|e| napi::Error::from_reason(format!("Error forking channel: {}", e)))?;

    // ── 6. Apply changes — clean up temp channel on failure ──────────────────
    let mut workspace = libpijul::apply::Workspace::new();
    let apply_result: napi::Result<()> = (|| {
        for hash in &to_apply {
            txn.apply_change_ws(&changes, &mut *tmp_channel.write(), hash, &mut workspace)
                .map_err(|e| napi::Error::from_reason(
                    format!("Error applying change {}: {:?}", hash.to_base32(), e),
                ))?;
        }
        Ok(())
    })();

    if let Err(e) = apply_result {
        // txn is still a plain MutTxn here — we can drop the channel directly.
        let _ = txn.drop_channel(&tmp_name);
        return Err(e);
    }

    // ── 7. Detect conflicts via in-memory output ─────────────────────────────
    let memory_wc = Memory::new();
    let arc_txn = ArcTxn::new(txn); // txn ownership moves into ArcTxn

    // Do NOT use `?` here — cleanup must run whether output succeeds or fails.
    let output_result = libpijul::output::output_repository_no_pending(
        &memory_wc,
        &changes,
        &arc_txn,
        &tmp_channel,
        "",
        true,
        None,
        1,
        0,
    );

    // ── 8. Map conflicts to ConflictInfo (while channels still alive) ─────────
    let mut result = Vec::new();
    if let Ok(ref conflict_list) = output_result {
        for c in conflict_list {
            let (ctype, path, line, c_hashes) = match c {
                libpijul::Conflict::Name { path, changes, .. } =>
                    ("Name", path, None, changes),
                libpijul::Conflict::ZombieFile { path, changes, .. } =>
                    ("ZombieFile", path, None, changes),
                libpijul::Conflict::MultipleNames { path, changes, .. } =>
                    ("MultipleNames", path, None, changes),
                libpijul::Conflict::Zombie { path, line, changes, .. } =>
                    ("Zombie", path, Some(*line as u32), changes),
                libpijul::Conflict::Cyclic { path, line, changes, .. } =>
                    ("Cyclic", path, Some(*line as u32), changes),
                libpijul::Conflict::Order { path, line, changes, .. } =>
                    ("Order", path, Some(*line as u32), changes),
            };

            let mut buf = Vec::new();
            let content = if memory_wc.read_file(path, &mut buf).is_ok() {
                Some(String::from_utf8_lossy(&buf).to_string())
            } else {
                None
            };

            let mut buf_a = Vec::new();
            let content_a = if crate::read_file_content(
                &arc_txn, &changes, &channel_a, path, &mut buf_a,
            ).is_ok() {
                Some(String::from_utf8_lossy(&buf_a).to_string())
            } else {
                None
            };

            let mut buf_b = Vec::new();
            let content_b = if crate::read_file_content(
                &arc_txn, &changes, &channel_b, path, &mut buf_b,
            ).is_ok() {
                Some(String::from_utf8_lossy(&buf_b).to_string())
            } else {
                None
            };

            result.push(ConflictInfo {
                conflict_type: ctype.to_string(),
                path: path.clone(),
                line,
                changes: c_hashes.iter().map(|h| h.to_base32()).collect(),
                content,
                content_a,
                content_b,
            });
        }
    }

    // ── 9. Cleanup — always runs regardless of success or failure ────────────
    // Release channel refs before attempting Arc::try_unwrap so the ArcTxn
    // is the sole remaining owner of the inner transaction.
    drop(tmp_channel);
    drop(channel_a);
    drop(channel_b);

    match Arc::try_unwrap(arc_txn.0) {
        Ok(lock) => {
            // ArcTxn uses parking_lot::RwLock; into_inner() returns T directly.
            let mut txn = lock.into_inner();
            if let Err(e) = txn.drop_channel(&tmp_name) {
                eprintln!(
                    "[pijul-reader] Warning: failed to drop temp channel '{}': {:?}",
                    tmp_name, e
                );
            }
            // Intentionally NOT calling txn.commit() — read-only simulation;
            // the transaction rolls back automatically on drop.
        }
        Err(_) => {
            // Should never happen. Transaction rollback on drop is the fallback.
            eprintln!(
                "[pijul-reader] Warning: could not recover txn to drop temp channel '{}'. \
                 Relying on transaction rollback for cleanup.",
                tmp_name
            );
        }
    }

    // ── 10. Propagate any output error ───────────────────────────────────────
    output_result
        .map_err(|e| napi::Error::from_reason(format!("Error detecting conflicts: {:?}", e)))?;

    Ok(result)
}
