import { getChannelPatchDiff } from './index.js';
import path from 'path';

const repoPath = path.resolve('/home/abhay/tmptasks/pijultest/testnew');

console.log("Testing getChannelPatchDiff...");
console.log(`Repo: ${repoPath}`);
console.log("Source: feature");
console.log("Target: main");

try {
    const diff = getChannelPatchDiff(repoPath, 'main', 'pr-1');
    console.log(`Found ${diff.length} patches in 'feature' but not in 'main':`);
    
    diff.forEach((patch, idx) => {
        console.log(`\nPatch ${idx + 1}:`);
        console.log(`  Hash: ${patch.hash}`);
        console.log(`  Message: ${patch.message}`);
        console.log(`  Timestamp: ${patch.timestamp}`);
        console.log(`  Authors: ${patch.authors.join(', ')}`);
    });

    if (diff.length === 1 && diff[0].message.includes("commit 2 on feature")) {
        console.log("\n✅ Test Passed!");
    } else {
        console.error("\n❌ Test Failed! Expected exactly 1 patch with message 'commit 2 on feature'.");
        process.exit(1);
    }
} catch (error) {
    console.error("Error occurred while getting channel patch diff:", error);
    process.exit(1);
}
