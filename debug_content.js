import { getRepositoryFiles, getFileContent } from './backend/pijul-reader/index.js';
const repoPath = '/app/repos/root/new4';
try {
    console.log("FILES in pr-3:");
    const files = getRepositoryFiles(repoPath, 'pr-3', '');
    console.log(files);
    
    const target = 'src/new';
    console.log(`\nCONTENT of ${target}:`);
    const content = getFileContent(repoPath, 'pr-3', target);
    console.log("LENGTH:", content.length);
    console.log("CONTENT:\n", content.toString('utf8'));
} catch (e) {
    console.error(e);
}
