import { getRepositoryFiles, getFileContent, getChangeDetails } from './index.js';

const repoPath = '/home/abhay/tmptasks/pijultest/new7';

// console.log("Listing files:");
// const files = getRepositoryFiles(repoPath, 'main', '');
// console.log(files);

console.log("\nReading 'README.md' (if exists):");
try {
    const content = getFileContent(repoPath, 'pr-3', 'src/new');
    console.log(content.toString('utf-8'));
} catch (e) {
    console.log("README.md not found or error:", e.message);
}

console.log("\nGetting Change Details:");
const hash = '5CKTZS4MXYDMHOTQD2JBVIEE6NWN5JBLKOUFCQNP46VXEYZDUZ3QC';
try {
    const details = getChangeDetails(repoPath, hash, 'pr-3');
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
