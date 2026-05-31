//! pijul-list-files
//!
//! List all files tracked in a Pijul repository for a given channel and
//! optional path prefix.
//!
//! Usage:
//!   pijul-list-files <repo_path> [channel_name] [path_prefix]
//!
//! Examples:
//!   pijul-list-files /my/repo
//!   pijul-list-files /my/repo main
//!   pijul-list-files /my/repo main src/
//!
//! The function `list_files` is fully re-usable as a library function.
use napi_derive::napi;
use std::path::Path;

mod merge_conflicts;
pub use merge_conflicts::*;

pub mod pijul_diff_patch;
pub use pijul_diff_patch::*;

pub mod pijul_latest_patch;
pub use pijul_latest_patch::*;

pub mod pijul_patch_graph;
pub use pijul_patch_graph::*;

pub mod pijul_session;
pub use pijul_session::*;
use libpijul::{
    change::get_change_contents,
    changestore::{filesystem::FileSystem, ChangeStore},
    fs,
    output::output_file,
    pristine::{
        sanakirja::Pristine, ArcTxn, Base32, ChangeId, ChannelRef, ChannelTxnT, GraphTxnT,
        Inode, Position, TreeTxnT, TxnT,
    },
    vertex_buffer::Writer as VBWriter,
    Encoding, TxnTExt,
};
use napi::bindgen_prelude::Buffer;

// ─────────────────────────────────────────────────────────────────────────────
// Public type
// ─────────────────────────────────────────────────────────────────────────────

/// A single file or directory entry returned by [`list_files`].
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct FileEntry {
    /// Repository-relative path using `/` as separator, e.g. `"src/main.rs"`.
    pub path: String,
    /// `true` when this entry is a directory.
    pub is_dir: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Core function
// ─────────────────────────────────────────────────────────────────────────────

/// Walk the FOLDER-edge graph of `channel` and return every file/directory
/// whose path starts with `path_prefix`.
///
/// Pass `""` (empty string) or `"."` as `path_prefix` to list **all** tracked
/// files.  The returned `Vec` is sorted lexicographically by path.
///
/// # How it works
///
/// Pijul stores the file-tree inside the channel graph using special
/// *FOLDER* edges.  [`fs::iter_graph_children`] reads one directory level at a
/// time, resolving names from the change store.  We do a depth-first traversal
/// from `Position::ROOT` (the graph root) while pruning branches that cannot
/// match the requested prefix.
///
/// # Errors
/// Returns a boxed error on any database or change-store I/O failure.
///
/// # Example
/// ```no_run
/// use std::path::Path;
/// use pijul_list_files::{list_files, FileEntry};
/// use libpijul::{changestore::filesystem::FileSystem, pristine::sanakirja::Pristine};
///
/// let root = Path::new("/my/repo");
/// let pristine = Pristine::new(root.join(".pijul/pristine")).unwrap();
/// let txn = pristine.txn_begin().unwrap();
/// let changes = FileSystem::from_root(root, 256);
/// let channel = txn.load_channel("main").unwrap().unwrap();
///
/// for entry in list_files(&txn, &changes, &channel, "").unwrap() {
///     println!("{}{}", entry.path, if entry.is_dir { "/" } else { "" });
/// }
/// ```
pub fn list_files<T, C>(
    txn: &T,
    changes: &C,
    channel: &ChannelRef<T>,
    path_prefix: String
) -> Result<Vec<FileEntry>, Box<dyn std::error::Error + Send + Sync>>
where
    T: TxnT + TxnTExt,
    C: ChangeStore,
    C::Error: Send + Sync + 'static,
    T::GraphError: Send + Sync + 'static,
{
    let prefix = normalize_prefix(path_prefix.as_str());
    let mut entries: Vec<FileEntry> = Vec::new();

    // Lock the channel just long enough to get the graph reference.
    let channel_guard = channel.read();
    let graph = txn.graph(&*channel_guard);

    // DFS stack: (graph position of the directory, accumulated path so far)
    let mut stack: Vec<(Position<ChangeId>, String)> = vec![(Position::ROOT, String::new())];

    while let Some((pos, cur_path)) = stack.pop() {
        // Iterate the direct children (files + sub-dirs) of this directory node.
        let iter = fs::iter_graph_children(txn, changes, graph, pos)
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

        for child_res in iter {
            let (child_pos, _introduced_by, metadata, basename) = child_res
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

            // Internal graph nodes have an empty basename; skip them.
            if basename.is_empty() {
                continue;
            }

            // Build the full path of this entry.
            let child_path = if cur_path.is_empty() {
                basename.clone()
            } else {
                format!("{}/{}", cur_path, basename)
            };

            let is_dir = metadata.is_dir();

            // Emit this entry if it falls under the requested prefix.
            if matches_prefix(&child_path, &prefix) {
                entries.push(FileEntry { path: child_path.clone(), is_dir });
            }

            // Recurse into sub-directories only when they can yield matches.
            if is_dir && could_contain_prefix(&child_path, &prefix) {
                stack.push((child_pos, child_path));
            }
        }
    }

    entries.sort();
    Ok(entries)
}

// ─────────────────────────────────────────────────────────────────────────────
// Working-copy variant (channel-independent, faster)
// ─────────────────────────────────────────────────────────────────────────────

/// List files from the **working-copy tree** (the `tree`/`revtree` tables).
///
/// This is channel-independent — it shows everything that has been
/// `pijul add`-ed regardless of which changes are applied.  Use [`list_files`]
/// for the canonical, channel-specific view.
pub fn list_files_working_copy<T>(
    txn: &T,
    path_prefix: &str,
) -> Result<Vec<FileEntry>, T::GraphError>
where
    T: TxnT<TreeError = <T as GraphTxnT>::GraphError>,
{
    let prefix = normalize_prefix(path_prefix);
    let mut entries: Vec<FileEntry> = Vec::new();

    for item in fs::iter_working_copy(txn, Inode::ROOT) {
        let (_inode, path, is_dir) = item?;
        if matches_prefix(&path, &prefix) {
            entries.push(FileEntry { path, is_dir });
        }
    }

    entries.sort();
    Ok(entries)
}

// ─────────────────────────────────────────────────────────────────────────────
// File content reader
// ─────────────────────────────────────────────────────────────────────────────

/// Read the contents of the file at `file_path` in `channel` and write them
/// into `out`.
///
/// `file_path` is a repository-relative path using `/` as separator
/// (e.g. `"src/main.rs"`).  The function uses the oldest-path resolution
/// strategy when there are conflicts.
///
/// Conflict markers (`>>>>>>> / ======= / <<<<<<<`) are included in the output
/// when the file has unresolved conflicts, exactly as `pijul cat` would show.
///
/// # Errors
/// Returns a boxed error on any database or change-store I/O failure, or if
/// `file_path` does not exist in the given channel.
///
/// # Example
/// ```no_run
/// let mut out = std::io::stdout();
/// read_file_content(&txn, &changes, &channel, "src/main.rs", &mut out).unwrap();
/// ```
pub fn read_file_content<T, C, W>(
    txn: &ArcTxn<T>,
    changes: &C,
    channel: &ChannelRef<T>,
    file_path: &str,
    out: &mut W,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>>
where
    T: TxnT + TxnTExt + ChannelTxnT + TreeTxnT<TreeError = <T as GraphTxnT>::GraphError> + Send + Sync + 'static,
    T::Channel: Send + Sync + 'static,
    C: ChangeStore + Send + Clone + 'static,
    C::Error: Send + Sync + std::fmt::Debug + 'static,
    T::GraphError: Send + Sync + std::fmt::Debug + 'static,
    W: std::io::Write,
{
    // Step 1: resolve path → Position<ChangeId>
    let mut file_pos = Position::ROOT;
    let components: Vec<&str> = file_path.split('/').filter(|s| !s.is_empty()).collect();
    
    let channel_guard = channel.read();
    let graph = txn.read().graph(&*channel_guard);
    
    for component in components {
        let mut found = false;
        let txn_guard = txn.read();
        let iter = fs::iter_graph_children(&*txn_guard, changes, graph, file_pos)
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
            
        for child_res in iter {
            let (child_pos, _introduced_by, _metadata, basename) = child_res
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
            if basename == component {
                file_pos = child_pos;
                found = true;
            }
        }
        if !found {
            return Err(format!("path component '{}' not found in {}", component, file_path).into());
        }
    }
    drop(channel_guard);

    // Step 2: Write out the content
    let mut vbuf = VBWriter::new(out);
    output_file(changes, txn, channel, file_pos, &mut vbuf)
        .map_err(|e| format!("output_file error: {:?}", e).into())
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Strip leading/trailing slashes and treat `"."` as "match all" (empty string).
fn normalize_prefix(raw: &str) -> String {
    let s = raw.trim_matches('/');
    if s == "." { String::new() } else { s.to_string() }
}

/// `true` when `path` should be included for the given normalized `prefix`.
fn matches_prefix(path: &str, prefix: &str) -> bool {
    prefix.is_empty()
        || path == prefix
        || path.starts_with(&format!("{}/", prefix))
}

/// `true` when descending into `dir_path` could still yield a match.
/// Used for early DFS pruning.
fn could_contain_prefix(dir_path: &str, prefix: &str) -> bool {
    prefix.is_empty()
        || prefix.starts_with(dir_path)
        || dir_path.starts_with(prefix)
}

// ─────────────────────────────────────────────────────────────────────────────
// Change Details (Diff) structs
// ─────────────────────────────────────────────────────────────────────────────

#[napi(object)]
pub struct DiffLine {
    pub line_number: u32,
    pub content: String,
    pub line_type: String, // "addition" or "deletion"
}

#[napi(object)]
pub struct HunkDetails {
    pub hunk_type: String,
    pub path: String,
    pub line: Option<u32>,
    pub contents: Option<Buffer>,
    pub replacement_contents: Option<Buffer>,
    pub new_path: Option<String>,
    pub lines: Vec<DiffLine>,
    pub old_data: Option<String>,
    pub new_data: Option<String>,
    pub previous: Option<String>, // Context lines before
    pub remove: Option<String>,   // Specifically deleted content
}

#[napi(object)]
pub struct ChangeDetails {
    pub message: String,
    pub description: Option<String>,
    pub timestamp: String,
    pub authors: Vec<String>,
    pub hunks: Vec<HunkDetails>,
}

// ─────────────────────────────────────────────────────────────────────────────
// High-Level Entry Points (for NAPI or FFI usage)
// ─────────────────────────────────────────────────────────────────────────────

/// High-level API: List files in a Pijul repository for a given channel and path prefix.
/// 
/// Returns a list of `FileEntry` structs.
#[napi]
pub fn get_repository_files(
    repo_path: String,
    channel_name: Option<String>,
    path_prefix: String,
) -> napi::Result<Vec<FileEntry>> {
    let repo_path = Path::new(&repo_path);
    let channel_name = channel_name.as_deref().unwrap_or(libpijul::DEFAULT_CHANNEL);

    // ── Open pristine ──────────────────────────────────────────────────────
    let pristine_path = repo_path.join(libpijul::DOT_DIR).join("pristine").join("db");
    let pristine = Pristine::new(&pristine_path)
        .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine at {:?}: {}", pristine_path, e)))?;
    let txn = pristine.txn_begin()
        .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;

    // ── Open change store ──────────────────────────────────────────────────
    let changes = FileSystem::from_root(repo_path, 256);

    // ── Resolve channel ────────────────────────────────────────────────────
    let channel_ref = txn.load_channel(channel_name)
        .map_err(|e| napi::Error::from_reason(format!("DB error: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Channel '{}' not found", channel_name)))?;

    list_files(&txn, &changes, &channel_ref, path_prefix)
        .map_err(|e| napi::Error::from_reason(format!("Error listing files: {}", e)))
}

/// High-level API: Read the raw byte content of a specific file in a channel.
/// 
/// Returns a `Buffer` containing the file contents (including any conflict markers).
#[napi]
pub fn get_file_content(
    repo_path: String,
    channel_name: Option<String>,
    file_path: String,
) -> napi::Result<Buffer> {
    let repo_path = Path::new(&repo_path);
    let channel_name = channel_name.as_deref().unwrap_or(libpijul::DEFAULT_CHANNEL);

    // ── Open pristine ──────────────────────────────────────────────────────
    let pristine_path = repo_path.join(libpijul::DOT_DIR).join("pristine").join("db");
    let pristine = Pristine::new(&pristine_path)
        .map_err(|e| napi::Error::from_reason(format!("Cannot open pristine at {:?}: {}", pristine_path, e)))?;
    let txn = pristine.txn_begin()
        .map_err(|e| napi::Error::from_reason(format!("Cannot begin transaction: {}", e)))?;

    // ── Open change store ──────────────────────────────────────────────────
    let changes = FileSystem::from_root(repo_path, 256);

    // ── Resolve channel ────────────────────────────────────────────────────
    let channel_ref = txn.load_channel(channel_name)
        .map_err(|e| napi::Error::from_reason(format!("DB error: {}", e)))?
        .ok_or_else(|| napi::Error::from_reason(format!("Channel '{}' not found", channel_name)))?;

    let arc_txn = ArcTxn::new(txn);
    let mut buf = Vec::new();
    
    read_file_content(&arc_txn, &changes, &channel_ref, &file_path, &mut buf)
        .map_err(|e| napi::Error::from_reason(format!("Error reading file: {}", e)))?;
        
    Ok(buf.into())
}

fn decode_bytes(
    contents: &[u8],
    encoding: &Option<Encoding>,
) -> String {
    if let Some(enc) = encoding {
        enc.decode(contents).into_owned()
    } else {
        String::from_utf8_lossy(contents).into_owned()
    }
}

fn bytes_to_diff_lines(
    contents: &[u8],
    start_line: u32,
    line_type: &str,
    encoding: &Option<Encoding>,
) -> Vec<DiffLine> {
    if contents.is_empty() {
        return Vec::new();
    }
    let text = decode_bytes(contents, encoding);

    text.split('\n')
        .enumerate()
        .map(|(i, line)| DiffLine {
            line_number: start_line + i as u32,
            content: line.to_string(),
            line_type: line_type.to_string(),
        })
        .collect()
}

/// High-level API: Get details and hunks of a specific change (patch).
/// 
/// Returns a `ChangeDetails` struct containing metadata and a list of hunks.
#[napi]
pub fn get_change_details(
    repo_path: String,
    change_hash: String,
    channel_name: Option<String>,
) -> napi::Result<ChangeDetails> {
    let repo_path_obj = Path::new(&repo_path);
    let hash = libpijul::pristine::Hash::from_base32(change_hash.as_bytes())
        .ok_or_else(|| napi::Error::from_reason(format!("Invalid hash: {}", change_hash)))?;

    let changes = FileSystem::from_root(repo_path_obj, 256);
    let change = changes.get_change(&hash)
        .map_err(|e| napi::Error::from_reason(format!("Error loading change: {:?}", e)))?;

    // ── Optional: Fetch context from a channel ──────────────────────────
    let mut file_cache: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    let channel_name_str = channel_name.as_deref().unwrap_or(libpijul::DEFAULT_CHANNEL);
    
    let pristine_path = repo_path_obj.join(libpijul::DOT_DIR).join("pristine").join("db");
    let pristine = Pristine::new(&pristine_path).ok();
    let txn = pristine.as_ref().and_then(|p| p.txn_begin().ok());
    let channel_ref = if let (Some(ref t), Some(_)) = (&txn, &pristine) {
        t.load_channel(channel_name_str).ok().flatten()
    } else {
        None
    };
    let arc_txn = txn.map(ArcTxn::new);

    let mut hunk_details = Vec::new();
    let change_contents = &change.contents;

    for hunk in change.hashed.changes.iter() {
        match hunk {
            libpijul::change::Hunk::Edit { change: atom, local, encoding, .. } => {
                let contents = get_change_contents(&changes, atom, change_contents)
                    .map_err(|e| napi::Error::from_reason(format!("Error getting hunk contents: {:?}", e)))?;
                
                let line_type = match atom {
                    libpijul::change::Atom::NewVertex(_) => "addition",
                    libpijul::change::Atom::EdgeMap(_) => "deletion",
                };
                
                let old_data = match atom {
                    libpijul::change::Atom::NewVertex(_) => None,
                    libpijul::change::Atom::EdgeMap(_) => Some(decode_bytes(&contents, encoding)),
                };
                let new_data = match atom {
                    libpijul::change::Atom::NewVertex(_) => Some(decode_bytes(&contents, encoding)),
                    libpijul::change::Atom::EdgeMap(_) => None,
                };

                // Context retrieval
                let mut previous_context = None;
                if let (Some(ref t), Some(ref c)) = (&arc_txn, &channel_ref) {
                    if !file_cache.contains_key(&local.path) {
                        let mut buf = Vec::new();
                        if read_file_content(t, &changes, c, &local.path, &mut buf).is_ok() {
                            let text = String::from_utf8_lossy(&buf).to_string();
                            file_cache.insert(local.path.clone(), text.lines().map(|s| s.to_string()).collect());
                        }
                    }
                    if let Some(lines) = file_cache.get(&local.path) {
                        let h_line = local.line as usize;
                        if h_line > 1 && h_line <= lines.len() + 1 {
                            let start = if h_line > 4 { h_line - 4 } else { 0 };
                            let end = h_line - 1;
                            previous_context = Some(lines[start..end].join("\n"));
                        }
                    }
                }

                let lines = bytes_to_diff_lines(&contents, local.line as u32, line_type, encoding);

                hunk_details.push(HunkDetails {
                    hunk_type: "Edit".to_string(),
                    path: local.path.clone(),
                    line: Some(local.line as u32),
                    contents: Some(contents.into()),
                    replacement_contents: None,
                    new_path: None,
                    lines,
                    old_data: old_data.clone(),
                    new_data,
                    previous: previous_context,
                    remove: old_data,
                });
            }
            libpijul::change::Hunk::Replacement { change: atom, replacement, local, encoding, .. } => {
                let old_contents = get_change_contents(&changes, atom, change_contents)
                    .map_err(|e| napi::Error::from_reason(format!("Error getting old hunk contents: {:?}", e)))?;
                let new_contents = get_change_contents(&changes, replacement, change_contents)
                    .map_err(|e| napi::Error::from_reason(format!("Error getting new hunk contents: {:?}", e)))?;
                
                let old_data_str = decode_bytes(&old_contents, encoding);
                let new_data_str = decode_bytes(&new_contents, encoding);

                // Context retrieval
                let mut previous_context = None;
                if let (Some(ref t), Some(ref c)) = (&arc_txn, &channel_ref) {
                    if !file_cache.contains_key(&local.path) {
                        let mut buf = Vec::new();
                        if read_file_content(t, &changes, c, &local.path, &mut buf).is_ok() {
                            let text = String::from_utf8_lossy(&buf).to_string();
                            file_cache.insert(local.path.clone(), text.lines().map(|s| s.to_string()).collect());
                        }
                    }
                    if let Some(lines) = file_cache.get(&local.path) {
                        let h_line = local.line as usize;
                        if h_line > 1 && h_line <= lines.len() + 1 {
                            let start = if h_line > 4 { h_line - 4 } else { 0 };
                            let end = h_line - 1;
                            previous_context = Some(lines[start..end].join("\n"));
                        }
                    }
                }

                let mut lines = bytes_to_diff_lines(&old_contents, local.line as u32, "deletion", encoding);
                lines.extend(bytes_to_diff_lines(&new_contents, local.line as u32, "addition", encoding));

                hunk_details.push(HunkDetails {
                    hunk_type: "Replacement".to_string(),
                    path: local.path.clone(),
                    line: Some(local.line as u32),
                    contents: Some(old_contents.into()),
                    replacement_contents: Some(new_contents.into()),
                    new_path: None,
                    lines,
                    old_data: Some(old_data_str.clone()),
                    new_data: Some(new_data_str),
                    previous: previous_context,
                    remove: Some(old_data_str),
                });
            }
            libpijul::change::Hunk::FileAdd { add_name: _, contents, path, encoding, .. } => {
                let path_str = path.clone();
                let (file_contents, lines, new_data) = if let Some(atom) = contents {
                    let c = get_change_contents(&changes, atom, change_contents)
                        .map_err(|e| napi::Error::from_reason(format!("Error getting added file contents: {:?}", e)))?;
                    let nd = Some(decode_bytes(&c, encoding));
                    let l = bytes_to_diff_lines(&c, 1, "addition", encoding);
                    (c, l, nd)
                } else {
                    (Vec::new(), Vec::new(), None)
                };
                
                hunk_details.push(HunkDetails {
                    hunk_type: "FileAddition".to_string(),
                    path: path_str,
                    line: None,
                    contents: Some(file_contents.into()),
                    replacement_contents: None,
                    new_path: None,
                    lines,
                    old_data: None,
                    new_data,
                    previous: None,
                    remove: None,
                });
            }
            libpijul::change::Hunk::FileDel { del: _, contents, path, encoding, .. } => {
                let (file_contents, lines, old_data) = if let Some(atom) = contents {
                    let c = get_change_contents(&changes, atom, change_contents)
                        .map_err(|e| napi::Error::from_reason(format!("Error getting deleted file contents: {:?}", e)))?;
                    let od = Some(decode_bytes(&c, encoding));
                    let l = bytes_to_diff_lines(&c, 1, "deletion", encoding);
                    (c, l, od)
                } else {
                    (Vec::new(), Vec::new(), None)
                };
                hunk_details.push(HunkDetails {
                    hunk_type: "FileDeletion".to_string(),
                    path: path.clone(),
                    line: None,
                    contents: Some(file_contents.into()),
                    replacement_contents: None,
                    new_path: None,
                    lines,
                    old_data: old_data.clone(),
                    new_data: None,
                    previous: None,
                    remove: old_data,
                });
            }
            libpijul::change::Hunk::FileMove { add, path, .. } => {
                let new_name = if let libpijul::change::Atom::NewVertex(ref n) = add {
                    if n.start == n.end {
                        "".to_string()
                    } else {
                        let meta = libpijul::changestore::FileMetadata::read(&change_contents[n.start.0.as_u64() as usize..n.end.0.as_u64() as usize]);
                        meta.basename.to_string()
                    }
                } else {
                    "unknown".to_string()
                };
                
                let parent = libpijul::path::parent(path).unwrap_or("");
                let new_path = if parent.is_empty() {
                    new_name
                } else {
                    format!("{}/{}", parent, new_name)
                };

                hunk_details.push(HunkDetails {
                    hunk_type: "FileMove".to_string(),
                    path: path.clone(),
                    line: None,
                    contents: None,
                    replacement_contents: None,
                    new_path: Some(new_path),
                    lines: Vec::new(),
                    old_data: None,
                    new_data: None,
                    previous: None,
                    remove: None,
                });
            }
            // Add other hunk types as needed (SolveNameConflict, etc.)
            _ => {
                // For now, skip unknown hunk types or add a generic entry
            }
        }
    }

    let header = &change.hashed.header;
    Ok(ChangeDetails {
        message: header.message.clone(),
        description: header.description.clone(),
        timestamp: header.timestamp.to_string(),
        authors: header.authors.iter().map(|a| {
            // Authors are BTreeMap<String, String>, typically with keys like "name", "full_name", "email"
            a.0.values().cloned().collect::<Vec<_>>().join(" ")
        }).collect(),
        hunks: hunk_details,
    })
}
