use napi_derive::napi;
use std::collections::HashSet;
use std::path::Path;
use libpijul::{
    changestore::{filesystem::FileSystem, ChangeStore},
    pristine::{sanakirja::Pristine, Base32, Hash, TxnT},
    TxnTExt,
};

#[napi(object)]
pub struct PatchInfo {
    pub hash: String,
    pub message: String,
    pub timestamp: String,
    pub authors: Vec<String>,
}

#[napi]
pub fn get_channel_patch_diff(
    repo_path: String,
    source_channel: String,
    target_channel: String,
) -> napi::Result<Vec<PatchInfo>> {
    let repo_path = Path::new(&repo_path);
    let pristine_path = repo_path.join(libpijul::DOT_DIR).join("pristine").join("db");
    
    let pristine = Pristine::new(&pristine_path)
        .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine at {:?}: {}", pristine_path, e)))?;
    let txn = pristine.txn_begin()
        .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;

    // Load Target Channel
    let target_ref = txn.load_channel(&target_channel)
        .map_err(|e| napi::Error::from_reason(format!("DB error loading target channel: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Target channel '{}' not found", target_channel)))?;
    
    let mut target_hashes = HashSet::new();
    let target_guard = target_ref.read();
    let target_log = txn.log(&*target_guard, 0)
        .map_err(|e| napi::Error::from_reason(format!("Error reading target channel log: {}", e)))?;
    
    for item_res in target_log {
        let item = item_res.map_err(|e| napi::Error::from_reason(format!("Target channel log iteration error: {}", e)))?;
        let h: Hash = item.1.0.into();
        target_hashes.insert(h);
    }
    drop(target_guard);

    // Load Source Channel
    let source_ref = txn.load_channel(&source_channel)
        .map_err(|e| napi::Error::from_reason(format!("DB error loading source channel: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Source channel '{}' not found", source_channel)))?;
    
    let source_guard = source_ref.read();
    let source_log = txn.log(&*source_guard, 0)
        .map_err(|e| napi::Error::from_reason(format!("Error reading source channel log: {}", e)))?;

    let changes = FileSystem::from_root(repo_path, 256);
    let mut diff_patches = Vec::new();

    for item_res in source_log {
        let item = item_res.map_err(|e| napi::Error::from_reason(format!("Source channel log iteration error: {}", e)))?;
        let h: Hash = item.1.0.into();
        
        if !target_hashes.contains(&h) {
            // This patch is in source but not in target!
            let change = changes.get_change(&h)
                .map_err(|e| napi::Error::from_reason(format!("Error loading change {}: {:?}", h.to_base32(), e)))?;
            
            let header = &change.hashed.header;
            let authors = header.authors.iter().map(|a| {
                a.0.values().cloned().collect::<Vec<_>>().join(" ")
            }).collect();
            
            diff_patches.push(PatchInfo {
                hash: h.to_base32(),
                message: header.message.clone(),
                timestamp: header.timestamp.to_string(),
                authors,
            });
        }
    }

    Ok(diff_patches)
}
