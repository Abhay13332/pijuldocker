// test-patch-graph.mjs
import { getPatchDependencyGraph } from './index.js'; // adjust path as needed

// --- Configuration (replace with actual values) ---
const REPO_PATH = '/home/abhay/tmptasks/pijultest/siuuu_test';   // absolute path to your test repo
const CHANNEL = 'main';
const PATCH_HASHES = [
'IAU2CTW2UGQ7FXFGDEUXSYC2Y7QEQZYPVC432WXX6535EHSSNJ6QC',
'4R7HKMXSAW74C7OK27VPPU5FCBHUHNP2N2F7FXMXMDLDNUWNK37QC',
'6OXYOAORLMQ2BRTPBIZ3PJMZX43S5WHGPKAJOF3K62LKZEQNASDQC'
];

try {
    console.log('Fetching dependency graph...');
    const graph = getPatchDependencyGraph(REPO_PATH, CHANNEL, PATCH_HASHES);

    console.log('\n=== Graph Summary ===');
    console.log(`Total nodes: ${Object.keys(graph.nodes).length}`);
    console.log(`Roots (no dependencies): ${graph.roots.join(', ') || '(none)'}`);
    console.log(`Leaves (no dependents): ${graph.leaves.join(', ') || '(none)'}`);
    console.log(`Topological order (apply first → last):`);
    console.log(`  ${graph.topologicalOrder.join(' → ')}`); 
    console.log('Graph keys:', Object.keys(graph));
// Should output: [ 'nodes', 'roots', 'leaves', 'topologicalOrder' ]   // Quick O(1) lookup example
    const sampleHash = PATCH_HASHES[0];
    const node = graph.nodes[sampleHash];
    if (node) {
        console.log(`\n=== Details for ${sampleHash.slice(0, 8)}... ===`);
        console.log(`  Message: ${node.message}`);
        console.log(`  Timestamp: ${node.timestamp}`);
        console.log(`  Authors: ${node.authors.join(', ')}`);
        console.log(`  Dependencies: ${node.dependencies.length} → ${node.dependencies.map(h => h.slice(0, 8)).join(', ')}`);
        console.log(`  Dependents: ${node.dependents.length} → ${node.dependents.map(h => h.slice(0, 8)).join(', ')}`);
    }

    // Validate that all dependencies are present in the graph
    let missingDeps = [];
    for (const [hash, n] of Object.entries(graph.nodes)) {
        for (const dep of n.dependencies) {
            if (!graph.nodes[dep]) {
                missingDeps.push(`${hash.slice(0,8)} → ${dep.slice(0,8)}`);
            }
        }
    }
    if (missingDeps.length === 0) {
        console.log('\n✓ All dependencies are inside the graph (no external missing).');
    } else {
        console.log('\n⚠️ Some dependencies refer to patches outside the collected set:');
        missingDeps.forEach(m => console.log(`  ${m}`));
    }
} catch (err) {
    console.error('Error:', err);
}