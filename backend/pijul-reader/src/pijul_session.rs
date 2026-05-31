use std::collections::VecDeque;
use std::path::Path;
use std::time::{Duration, Instant};

use dashmap::DashMap;
use lazy_static::lazy_static;
use napi::bindgen_prelude::Buffer;
use napi_derive::napi;
use uuid::Uuid;

use libpijul::{
    changestore::filesystem::FileSystem,
    pristine::{sanakirja::Pristine, ArcTxn, Base32, ChannelTxnT, MutTxnT, Position, TxnT},
    ApplyWorkspace, DOT_DIR, MutTxnTExt, // ← TxnTExt here
};
use crate::{get_patch_dependency_graph, read_file_content, FileEntry};

// ---------- Session data ----------
struct Session {
    repo_path: String,
    channel_name: String,
    last_accessed: Instant,
}

lazy_static! {
    static ref SESSIONS: DashMap<String, Session> = DashMap::new();
}

const SESSION_TIMEOUT_SECS: u64 = 600;
const MAX_SESSIONS: usize = 20;

fn cleanup_expired_sessions() {
    let now = Instant::now();
    SESSIONS.retain(|_, session| {
        now.duration_since(session.last_accessed) < Duration::from_secs(SESSION_TIMEOUT_SECS)
    });
}

fn enforce_session_limit() {
    if SESSIONS.len() > MAX_SESSIONS {
        let oldest = SESSIONS
            .iter()
            .min_by_key(|entry| entry.last_accessed)
            .map(|entry| entry.key().clone());
        if let Some(id) = oldest {
            SESSIONS.remove(&id);
        }
    }
}

// ---------- API functions ----------

#[napi]
pub fn create_patch_session(
    repo_path: String,
    base_channel: String,
    patch_hashes: Vec<String>,
) -> napi::Result<String> {
    cleanup_expired_sessions();
    enforce_session_limit();

    let repo_path_obj = Path::new(&repo_path);
    let pristine_path = repo_path_obj
        .join(DOT_DIR)
        .join("pristine")
        .join("db");
    let pristine = Pristine::new(&pristine_path)
        .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine: {}", e)))?;
    let mut txn = pristine
        .mut_txn_begin()
        .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;
    let changes = FileSystem::from_root(repo_path_obj, 256);

    let base_channel_ref = txn
        .load_channel(&base_channel)
        .map_err(|e| napi::Error::from_reason(format!("Error loading base channel: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Channel '{}' not found", base_channel)))?;

    let graph = get_patch_dependency_graph(repo_path.clone(), base_channel.clone(), patch_hashes)?;
    let apply_order = graph.topological_order;

    if apply_order.is_empty() {
        return Err(napi::Error::from_reason("No patches to apply"));
    }

    let session_id = Uuid::new_v4().to_string();
    let tmp_channel_name = format!("_session_{}", session_id);
    let tmp_channel = MutTxnT::fork(&mut txn, &base_channel_ref, &tmp_channel_name)
        .map_err(|e| napi::Error::from_reason(format!("Error forking channel: {}", e)))?;

    let mut workspace = ApplyWorkspace::new();
    for hash_str in apply_order {
        let hash = libpijul::pristine::Hash::from_base32(hash_str.as_bytes())
            .ok_or_else(|| napi::Error::from_reason(format!("Invalid hash: {}", hash_str)))?;
        txn.apply_change_ws(&changes, &mut *tmp_channel.write(), &hash, &mut workspace)
            .map_err(|e| napi::Error::from_reason(format!("Error applying change {}: {:?}", hash_str, e)))?;
    }

    txn.commit()
        .map_err(|e| napi::Error::from_reason(format!("Failed to commit session: {:?}", e)))?;

    SESSIONS.insert(
        session_id.clone(),
        Session {
            repo_path,
            channel_name: tmp_channel_name,
            last_accessed: Instant::now(),
        },
    );

    Ok(session_id)
}

#[napi]
pub fn get_session_recursive_tree(
    session_id: String,
    max_files: u32,
    start_path: Option<String>,
) -> napi::Result<RecursiveTreeResult> {
    let mut session = SESSIONS.get_mut(&session_id).ok_or_else(|| {
        napi::Error::from_reason(format!("Session '{}' not found or expired", session_id))
    })?;
    session.last_accessed = Instant::now();
    let repo_path = session.repo_path.clone();
    let channel_name = session.channel_name.clone();
    drop(session);

    // Open transaction and load channel
    let repo_path_obj = Path::new(&repo_path);
    let pristine_path = repo_path_obj
        .join(DOT_DIR)
        .join("pristine")
        .join("db");
    let pristine = Pristine::new(&pristine_path)
        .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine: {}", e)))?;
    let txn = pristine
        .txn_begin()
        .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;
    let channel = txn
        .load_channel(&channel_name)
        .map_err(|e| napi::Error::from_reason(format!("DB error: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Channel '{}' not found", channel_name)))?;
    let changes = FileSystem::from_root(repo_path_obj, 256);
    let arc_txn = ArcTxn::new(txn);

    // Helper to resolve path (inline)
    let resolve_path = |path: &str| -> napi::Result<Option<Position<libpijul::pristine::ChangeId>>> {
        if path.is_empty() {
            return Ok(Some(Position::ROOT));
        }
        let txn_guard = arc_txn.read();
        let channel_guard = channel.read();
        let graph = txn_guard.graph(&*channel_guard);
        let mut current_pos = Position::ROOT;
        for component in path.split('/').filter(|s| !s.is_empty()) {
            let iter = libpijul::fs::iter_graph_children(&*txn_guard, &changes, graph, current_pos)
                .map_err(|e| napi::Error::from_reason(format!("Error iterating children: {:?}", e)))?;
            let mut found = false;
            for child_res in iter {
                let (child_pos, _, _, basename) = child_res
                    .map_err(|e| napi::Error::from_reason(format!("Error reading child: {:?}", e)))?;
                if basename == component {
                    current_pos = child_pos;
                    found = true;
                    break;
                }
            }
            if !found {
                return Ok(None);
            }
        }
        Ok(Some(current_pos))
    };

    // Helper to count files in subtree (inline)
    let count_files = |pos: Position<libpijul::pristine::ChangeId>| -> napi::Result<usize> {
        let mut count = 0;
        let mut stack = vec![pos];
        let txn_guard = arc_txn.read();
        let channel_guard = channel.read();
        let graph = txn_guard.graph(&*channel_guard);
        while let Some(current) = stack.pop() {
            let iter = libpijul::fs::iter_graph_children(&*txn_guard, &changes, graph, current)
                .map_err(|e| napi::Error::from_reason(format!("Error iterating children: {:?}", e)))?;
            for child_res in iter {
                let (child_pos, _, metadata, _) = child_res
                    .map_err(|e| napi::Error::from_reason(format!("Error reading child: {:?}", e)))?;
                if metadata.is_file() {
                    count += 1;
                } else {
                    stack.push(child_pos);
                }
            }
        }
        Ok(count)
    };

    let start_path = start_path.unwrap_or_default();
    let start_pos = match resolve_path(&start_path)? {
        Some(p) => p,
        None => {
            return Ok(RecursiveTreeResult {
                entries: Vec::new(),
                truncated: false,
                limit_reached_at_depth: None,
            });
        }
    };

    let mut queue: VecDeque<(Position<libpijul::pristine::ChangeId>, u32, String)> = VecDeque::new();
    queue.push_back((start_pos, 0, start_path));

    let mut entries = Vec::new();
    let mut file_count = 0;
    let mut truncated = false;
    let mut limit_depth = None;

    while let Some((pos, depth, current_path)) = queue.pop_front() {
        let txn_guard = arc_txn.read();
        let channel_guard = channel.read();
        let graph = txn_guard.graph(&*channel_guard);
        let iter = libpijul::fs::iter_graph_children(&*txn_guard, &changes, graph, pos)
            .map_err(|e| napi::Error::from_reason(format!("Error iterating children: {:?}", e)))?;

        for child_res in iter {
            let (child_pos, _, metadata, basename) = child_res
                .map_err(|e| napi::Error::from_reason(format!("Error reading child: {:?}", e)))?;
            let child_path = if current_path.is_empty() {
                basename.clone()
            } else {
                format!("{}/{}", current_path, basename)
            };
            let is_dir = metadata.is_dir();
            let entry = FileEntry { path: child_path.clone(), is_dir };

            if depth < 2 {
                entries.push(entry);
                if is_dir {
                    queue.push_back((child_pos, depth + 1, child_path));
                }
                continue;
            }

            if is_dir {
                let total_files_in_dir = count_files(child_pos)?;
                if file_count + total_files_in_dir > max_files as usize {
                    truncated = true;
                    limit_depth = Some(depth + 1);
                    break;
                } else {
                    entries.push(entry);
                    queue.push_back((child_pos, depth + 1, child_path));
                }
            } else {
                if file_count + 1 > max_files as usize {
                    truncated = true;
                    limit_depth = Some(depth);
                    break;
                } else {
                    entries.push(entry);
                    file_count += 1;
                }
            }
        }
        if truncated {
            break;
        }
    }

    Ok(RecursiveTreeResult {
        entries,
        truncated,
        limit_reached_at_depth: limit_depth,
    })
}

#[napi]
pub fn list_session_directory(
    session_id: String,
    path_prefix: String,
) -> napi::Result<Vec<FileEntry>> {
    let mut session = SESSIONS.get_mut(&session_id).ok_or_else(|| {
        napi::Error::from_reason(format!("Session '{}' not found or expired", session_id))
    })?;
    session.last_accessed = Instant::now();
    let repo_path = session.repo_path.clone();
    let channel_name = session.channel_name.clone();
    drop(session);

    let repo_path_obj = Path::new(&repo_path);
    let pristine_path = repo_path_obj
        .join(DOT_DIR)
        .join("pristine")
        .join("db");
    let pristine = Pristine::new(&pristine_path)
        .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine: {}", e)))?;
    let txn = pristine
        .txn_begin()
        .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;
    let channel = txn
        .load_channel(&channel_name)
        .map_err(|e| napi::Error::from_reason(format!("DB error: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Channel '{}' not found", channel_name)))?;
    let changes = FileSystem::from_root(repo_path_obj, 256);
    let arc_txn = ArcTxn::new(txn);

    // Resolve path (inline)
    let resolve_path = |path: &str| -> napi::Result<Option<Position<libpijul::pristine::ChangeId>>> {
        if path.is_empty() {
            return Ok(Some(Position::ROOT));
        }
        let txn_guard = arc_txn.read();
        let channel_guard = channel.read();
        let graph = txn_guard.graph(&*channel_guard);
        let mut current_pos = Position::ROOT;
        for component in path.split('/').filter(|s| !s.is_empty()) {
            let iter = libpijul::fs::iter_graph_children(&*txn_guard, &changes, graph, current_pos)
                .map_err(|e| napi::Error::from_reason(format!("Error iterating children: {:?}", e)))?;
            let mut found = false;
            for child_res in iter {
                let (child_pos, _, _, basename) = child_res
                    .map_err(|e| napi::Error::from_reason(format!("Error reading child: {:?}", e)))?;
                if basename == component {
                    current_pos = child_pos;
                    found = true;
                    break;
                }
            }
            if !found {
                return Ok(None);
            }
        }
        Ok(Some(current_pos))
    };

    let pos = match resolve_path(&path_prefix)? {
        Some(p) => p,
        None => return Ok(Vec::new()),
    };

    let txn_guard = arc_txn.read();
    let channel_guard = channel.read();
    let graph = txn_guard.graph(&*channel_guard);
    let iter = libpijul::fs::iter_graph_children(&*txn_guard, &changes, graph, pos)
        .map_err(|e| napi::Error::from_reason(format!("Error listing children: {:?}", e)))?;

    let mut entries = Vec::new();
    for child_res in iter {
        let (_, _, metadata, basename) = child_res
            .map_err(|e| napi::Error::from_reason(format!("Error reading child: {:?}", e)))?;
        entries.push(FileEntry {
            path: basename,
            is_dir: metadata.is_dir(),
        });
    }
    entries.sort();
    Ok(entries)
}

#[napi]
pub fn get_session_file_content(
    session_id: String,
    file_path: String,
) -> napi::Result<Buffer> {
    let  mut session = SESSIONS.get_mut(&session_id).ok_or_else(|| {
        napi::Error::from_reason(format!("Session '{}' not found or expired", session_id))
    })?;
    session.last_accessed = Instant::now();
    let repo_path = session.repo_path.clone();
    let channel_name = session.channel_name.clone();
    drop(session);

    let repo_path_obj = Path::new(&repo_path);
    let pristine_path = repo_path_obj
        .join(DOT_DIR)
        .join("pristine")
        .join("db");
    let pristine = Pristine::new(&pristine_path)
        .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine: {}", e)))?;
    let txn = pristine
        .txn_begin()
        .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;
    let channel = txn
        .load_channel(&channel_name)
        .map_err(|e| napi::Error::from_reason(format!("DB error: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Channel '{}' not found", channel_name)))?;
    let changes = FileSystem::from_root(repo_path_obj, 256);
    let arc_txn = ArcTxn::new(txn);

    let mut buf = Vec::new();
    read_file_content(&arc_txn, &changes, &channel, &file_path, &mut buf)
        .map_err(|e| napi::Error::from_reason(format!("Error reading file: {}", e)))?;

    Ok(buf.into())
}

#[napi]
pub fn drop_session(session_id: String) -> napi::Result<()> {
    if let Some((_, session)) = SESSIONS.remove(&session_id) {
        let repo_path = session.repo_path;
        let channel_name = session.channel_name;

        let repo_path_obj = Path::new(&repo_path);
        let pristine_path = repo_path_obj
            .join(DOT_DIR)
            .join("pristine")
            .join("db");
        let pristine = Pristine::new(&pristine_path)
            .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine: {}", e)))?;
        let mut txn = pristine
            .mut_txn_begin()
            .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;
        let _ = txn.drop_channel(&channel_name);
        let _ = txn.commit();
    }
    Ok(())
}

#[napi(object)]
pub struct RecursiveTreeResult {
    pub entries: Vec<FileEntry>,
    pub truncated: bool,
    pub limit_reached_at_depth: Option<u32>,
}