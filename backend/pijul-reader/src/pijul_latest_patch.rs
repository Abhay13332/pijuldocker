use napi_derive::napi;
use std::path::Path;
use libpijul::{
    pristine::{sanakirja::Pristine, TxnT, Base32},
    TxnTExt,
};



#[napi]
pub fn get_latest_patches(
    repo_path: String,
    channel_name: Option<String>,
    limit: Option<u32>,
    since_hash: Option<String>,
) -> napi::Result<Vec<String>> {
    let repo_path_obj = Path::new(&repo_path);
    let channel_name_str = channel_name.as_deref().unwrap_or(libpijul::DEFAULT_CHANNEL);

    // ── Open pristine ──────────────────────────────────────────────────────
    let pristine_path = repo_path_obj.join(libpijul::DOT_DIR).join("pristine").join("db");
    let pristine = Pristine::new(&pristine_path)
        .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine at {:?}: {}", pristine_path, e)))?;
    let txn = pristine.txn_begin()
        .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;

    // ── Resolve channel ────────────────────────────────────────────────────
    let channel_ref = txn.load_channel(channel_name_str)
        .map_err(|e| napi::Error::from_reason(format!("DB error: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Channel '{}' not found", channel_name_str)))?;

    let channel_guard = channel_ref.read();

    let max_count = if since_hash.is_some() {
        limit.unwrap_or(u32::MAX) as usize
    } else {
        limit.unwrap_or(1) as usize
    };
    
    let mut hashes = Vec::new();

    let iter = txn.reverse_log(&*channel_guard, None)
        .map_err(|e| napi::Error::from_reason(format!("DB error reading log: {}", e)))?;

    for res in iter.take(max_count) {
        if let Ok((_n, (hash, _merkle))) = res {
            let real_hash: libpijul::Hash = (*hash).into();
            let hash_str = real_hash.to_base32();
            
            if let Some(ref target) = since_hash {
                if target == &hash_str {
                    break;
                }
            }
            
            hashes.push(hash_str);
        }
    }

    Ok(hashes)
}
