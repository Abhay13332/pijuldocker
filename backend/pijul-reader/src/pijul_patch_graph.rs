// pijul_patch_graph.rs
//! Patch dependency graph utilities for the Pijul playground.
//!
//! This module provides functions to compute the transitive closure of patch
//! dependencies and return a graph structure optimized for fast UI traversal.

use napi_derive::napi;
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;

use libpijul::{
    changestore::{filesystem::FileSystem, ChangeStore},
    pristine::{Base32, Hash},
};

// ─────────────────────────────────────────────────────────────────────────────
// Public NAPI types
// ─────────────────────────────────────────────────────────────────────────────

/// A single node in the patch dependency graph.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct PatchGraphNode {
    /// The patch hash (base32 encoded).
    pub hash: String,
    /// The commit message.
    pub message: String,
    /// Timestamp of the patch.
    pub timestamp: String,
    /// List of author names/identifiers.
    pub authors: Vec<String>,
    /// Hashes of patches that this patch depends on (must be applied before).
    pub dependencies: Vec<String>,
    /// Hashes of patches that depend on this patch.
    pub dependents: Vec<String>,
}

/// The complete patch dependency graph.
#[napi(object)]
#[derive(Debug, Clone)]
pub struct PatchGraph {
    /// Map from patch hash to node information. O(1) lookup.
    pub nodes: HashMap<String, PatchGraphNode>,
    /// List of patches that have no dependencies (roots of the DAG).
    pub roots: Vec<String>,
    /// List of patches that have no dependents (leaves of the DAG).
    pub leaves: Vec<String>,
    /// Topological order: patches sorted so that dependencies come before
    /// dependents. This is the recommended order for applying patches.
    pub topological_order: Vec<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to load patch metadata and dependencies
// ─────────────────────────────────────────────────────────────────────────────

/// Loads patch info (dependencies and metadata) from the change store.
/// Returns a tuple of (dependencies, message, timestamp, authors).
fn load_patch_info(
    changes: &FileSystem,
    hash_str: &str,
) -> napi::Result<(Vec<String>, String, String, Vec<String>)> {
    let hash = Hash::from_base32(hash_str.as_bytes())
        .ok_or_else(|| napi::Error::from_reason(format!("Invalid hash: {}", hash_str)))?;

    let change = changes
        .get_change(&hash)
        .map_err(|e| napi::Error::from_reason(format!("Error loading change {}: {:?}", hash_str, e)))?;

    // Extract dependencies: they are stored in change.hashed.dependencies (Vec<Hash>)
    let dependencies: Vec<String> = change
        .hashed
        .dependencies
        .iter()
        .map(|h| h.to_base32())
        .collect();

    let header = &change.hashed.header;
    let authors: Vec<String> = header
        .authors
        .iter()
        .map(|a| a.0.values().cloned().collect::<Vec<_>>().join(" "))
        .collect();

    Ok((
        dependencies,
        header.message.clone(),
        header.timestamp.to_string(),
        authors,
    ))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported function
// ─────────────────────────────────────────────────────────────────────────────

/// Build a complete dependency graph for a set of patches, including all
/// transitive dependencies.
///
/// Given a list of patch hashes, this function recursively fetches all patches
/// they depend on, and returns a graph with metadata for each patch, as well
/// as the roots (patches with no dependencies) and leaves (patches with no
/// dependents) within the expanded set. The returned graph uses a hash map
/// for fast O(1) node lookups, suitable for UI traversal.
///
/// # Arguments
/// * `repo_path` - Path to the Pijul repository (must contain `.pijul/`)
/// * `_channel` - Channel name (not used for dependency resolution, kept for API consistency)
/// * `patch_hashes` - List of patch hashes (base32 strings)
#[napi]
pub fn get_patch_dependency_graph(
    repo_path: String,
    _channel: String,
    patch_hashes: Vec<String>,
) -> napi::Result<PatchGraph> {
    let repo_path_obj = Path::new(&repo_path);
    let changes = FileSystem::from_root(repo_path_obj, 256);

    // We'll collect all patches that are part of the transitive closure.
    let mut all_hashes = HashSet::new();
    let mut queue: VecDeque<String> = patch_hashes.into_iter().collect();

    // Map from hash string to its dependencies (as hash strings)
    let mut deps_map: HashMap<String, Vec<String>> = HashMap::new();
    // Map from hash string to patch metadata (message, timestamp, authors)
    let mut metadata_map: HashMap<String, (String, String, Vec<String>)> = HashMap::new();

    // BFS to collect all transitive dependencies
    while let Some(hash_str) = queue.pop_front() {
        if all_hashes.contains(&hash_str) {
            continue;
        }

        // Load patch info
        let (deps, message, timestamp, authors) = load_patch_info(&changes, &hash_str)?;

        // Store data
        deps_map.insert(hash_str.clone(), deps.clone());
        metadata_map.insert(hash_str.clone(), (message, timestamp, authors));
        all_hashes.insert(hash_str.clone());

        // Enqueue dependencies that haven't been processed yet
        for dep in deps {
            if !all_hashes.contains(&dep) && !queue.contains(&dep) {
                queue.push_back(dep);
            }
        }
    }

    // Build dependents map: for each patch, which patches depend on it.
    let mut dependents_map: HashMap<String, Vec<String>> = HashMap::new();
    for (patch, deps) in &deps_map {
        for dep in deps {
            dependents_map
                .entry(dep.clone())
                .or_insert_with(Vec::new)
                .push(patch.clone());
        }
    }

    // Build nodes map (hash -> PatchGraphNode)
    let mut nodes = HashMap::new();
    for hash in &all_hashes {
        let (message, timestamp, authors) = metadata_map
            .get(hash)
            .ok_or_else(|| napi::Error::from_reason(format!("Missing metadata for {}", hash)))?;
        let dependencies = deps_map.get(hash).cloned().unwrap_or_default();
        let dependents = dependents_map.get(hash).cloned().unwrap_or_default();
        nodes.insert(
            hash.clone(),
            PatchGraphNode {
                hash: hash.clone(),
                message: message.clone(),
                timestamp: timestamp.clone(),
                authors: authors.clone(),
                dependencies,
                dependents,
            },
        );
    }

    // Determine roots: patches with no dependencies within the set
    let roots: Vec<String> = nodes
        .values()
        .filter(|n| n.dependencies.is_empty())
        .map(|n| n.hash.clone())
        .collect();

    // Determine leaves: patches with no dependents within the set
    let leaves: Vec<String> = nodes
        .values()
        .filter(|n| n.dependents.is_empty())
        .map(|n| n.hash.clone())
        .collect();

    // Compute topological order (Kahn's algorithm)
 // Compute in-degree = number of dependents (incoming edges)
let mut in_degree: HashMap<String, usize> = HashMap::new();
for (_, dependents) in &dependents_map {
    for dep in dependents {
        *in_degree.entry(dep.clone()).or_insert(0) += 1;
    }
}
// Ensure every node has an entry (nodes with zero in-degree are roots)
for hash in &all_hashes {
    in_degree.entry(hash.clone()).or_insert(0);
}

let mut topo_queue: VecDeque<String> = in_degree
    .iter()
    .filter(|(_, &deg)| deg == 0)
    .map(|(h, _)| h.clone())
    .collect();

let mut topological_order = Vec::new();
while let Some(h) = topo_queue.pop_front() {
    topological_order.push(h.clone());
    // For each dependent of h (i.e., nodes that h points to), decrement their in-degree
    if let Some(dependents) = dependents_map.get(&h) {
        for dep in dependents {
            let entry = in_degree
                .get_mut(dep)
                .expect("in_degree entry should exist");
            *entry -= 1;
            if *entry == 0 {
                topo_queue.push_back(dep.clone());
            }
        }
    }
}

    // If the graph had cycles (shouldn't happen in Pijul), we still return what we have.
    // The topological_order might be incomplete, but we don't error.

    Ok(PatchGraph {
        nodes,
        roots,
        leaves,
        topological_order,
    })
}