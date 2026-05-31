import { 
  createPatchSession, 
  listSessionDirectory, 
  getSessionRecursiveTree, 
  getSessionFileContent, 
  dropSession 
} from './index.js'; // adjust path if needed

// === CONFIGURATION ===
const REPO_PATH = '/home/abhay/tmptasks/pijultest/siuuu_test';   // absolute path to a Pijul repo
const BASE_CHANNEL = 'main';
// Use patch hashes from your earlier test (or any valid hashes in this repo)
const PATCH_HASHES = [
  '6OXYOAORLMQ2BRTPBIZ3PJMZX43S5WHGPKAJOF3K62LKZEQNASDQC',
  '4R7HKMXSAW74C7OK27VPPU5FCBHUHNP2N2F7FXMXMDLDNUWNK37QC',
  'IAU2CTW2UGQ7FXFGDEUXSYC2Y7QEQZYPVC432WXX6535EHSSNJ6QC'
];

async function test() {
  let sessionId;
  try {
    // 1. Create session
    console.log('Creating patch session...');
    sessionId = createPatchSession(REPO_PATH, BASE_CHANNEL, PATCH_HASHES);
    console.log(`✅ Session created: ${sessionId}\n`);

    // 2. List root directory (one level)
    console.log('Listing root directory (listSessionDirectory):');
    const rootEntries = listSessionDirectory(sessionId, '');
    rootEntries.forEach(entry => {
      console.log(`  ${entry.is_dir ? '📁' : '📄'} ${entry.path}`);
    });
    console.log(`  (${rootEntries.length} entries)\n`);

    // 3. Get recursive tree with limit (max 50 files)
    console.log('Getting recursive tree (maxFiles=50, start at ""):');
    const recursive = getSessionRecursiveTree(sessionId, 50, '');
    console.log(`  Truncated: ${recursive.truncated}`);
    if (recursive.limitReachedAtDepth) {
      console.log(`  Limit reached at depth: ${recursive.limitReachedAtDepth}`);
    }
    console.log(`  Total entries returned: ${recursive.entries.length}`);
    // Show first 10 entries as preview
    const preview = recursive.entries.slice(0, 10);
    preview.forEach(entry => {
      console.log(`    ${entry.is_dir ? '📁' : '📄'} ${entry.path}`);
    });
    if (recursive.entries.length > 10) console.log('    ...');
    console.log('');

    // 4. Read a file (choose one from the listing)
    const firstFile = recursive.entries.find(e => !e.is_dir);
    if (firstFile) {
      console.log(`Reading file: ${firstFile.path}`);
      const contentBuf = getSessionFileContent(sessionId, firstFile.path);
      const content = Buffer.from(contentBuf).toString('utf-8');
      console.log(`  Content preview (first 200 chars):`);
      console.log(`  ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}\n`);
    } else {
      console.log('No file found in the tree to preview.\n');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    // 5. Clean up
    if (sessionId) {
      console.log('Dropping session...');
      dropSession(sessionId);
      console.log('✅ Session dropped.');
    }
  }
}

test();