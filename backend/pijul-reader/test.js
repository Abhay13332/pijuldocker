import { getRepositoryFiles, getFileContent, getChangeDetails, getMergeConflicts } from './index.js';

const repoPath = '/home/abhay/tmptasks/pijultest/main_copy';

// console.log("Listing files:");
// const files = getRepositoryFiles(repoPath, 'main', '');
// console.log(files);

console.log("\nTesting Merge Conflicts (main vs pr-1):");
try {
    const conflicts = getMergeConflicts(repoPath, 'pr-1', 'main');
    console.log("Number of conflicts:", conflicts.length);
    conflicts.forEach((c, i) => {
        console.log(`Conflict ${i+1}: ${c.conflictType} at ${c.path} ${c.line ? '(line ' + c.line + ')' : ''}`);
        console.log("  Involved changes:", c.changes);
        if (c.content) {
            console.log("  Conflicting Content Preview:\n", c.content.slice(0, 100));
        }
        if (c.contentA) {
            console.log("  Content A Preview:\n", c.contentA.slice(0, 100));
        }
        if (c.contentB) {
            console.log("  Content B Preview:\n", c.contentB.slice(0, 100));
        }
    });
} catch (e) {
    console.error("Merge conflict detection failed:", e);
}
process.exit(0);
console.log("\nReading 'README.md' (if exists):");
try {
    const content = getFileContent(repoPath, 'main', 'new');
    console.log(content.toString('utf-8'));
} catch (e) {
    console.log("README.md not found or error:", e.message);
}

console.log("\nGetting Change Details:");
const hash = 'C3CU43BARC4NSPFVOYFWNZ3G3YD4YOQRGOA3FS22DFF5SPWUBC5AC';
try {
    const details = getChangeDetails(repoPath, hash, 'pr-1');
    console.log("Message:", details.message);
    console.log("Authors:", details.authors);
    console.log("Timestamp:", details.timestamp);
    console.log("Number of hunks:", details.hunks.length);

    details.hunks.forEach((h, i) => {
        console.log(`\nHunk ${i+1}: ${h.hunkType} - ${h.path} (Line: ${h.line})`);
        if (h.previous) console.log("Context (Previous):\n" + h.previous);
        if (h.remove) console.log("Removed Content:\n" + h.remove);
        if (h.newData) console.log("Added Content:\n" + h.newData);
        
        if (h.lines && h.lines.length > 0) {
            h.lines.forEach(l => {
                const prefix = l.lineType === 'addition' ? '+' : '-';
                console.log(`${l.lineNumber} ${prefix} ${l.content}`);
            });
        } else {
            if (h.contents) {
                console.log("Contents buffer length:", h.contents.length);
            }
        }
        if (h.newPath) {
            console.log("New path:", h.newPath);
        }
    });
} catch (e) {
    console.log("Error getting change details:", e.message);
}

