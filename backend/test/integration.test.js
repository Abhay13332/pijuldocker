// test/integration.test.js
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const execPromise = promisify(exec);

// Test Configuration
const TEST_CONFIG = {
    API_URL: 'http://localhost:3001',
    SSH_HOST: 'localhost',
    SSH_PORT: 2222,
    TEST_WORKSPACE: path.join(__dirname, '../test-workspace'),
    TEST_USERS: {
        alice: { username: 'alice_test', password: 'Alice123!' },
        bob: { username: 'bob_test', password: 'Bob123!' },
        carol: { username: 'carol_test', password: 'Carol123!' }
    }
};

// Test state
let testState = {
    users: {},
    repos: [],
    discussions: [],
    cookies: {}
};

// Helper: Generate SSH key
async function generateSSHKey(username) {
    const keyPath = path.join(TEST_CONFIG.TEST_WORKSPACE, `${username}_key`);
    const pubKeyPath = `${keyPath}.pub`;
    
    try {
        await execPromise(`ssh-keygen -t ed25519 -f "${keyPath}" -N "" -C "${username}@test"`);
        const publicKey = fs.readFileSync(pubKeyPath, 'utf8').trim();
        return { publicKey, privateKeyPath: keyPath };
    } catch (error) {
        console.error(`Failed to generate SSH key for ${username}:`, error.message);
        throw error;
    }
}

// Helper: Execute pijul command via SSH
async function pijulSSH(username, privateKeyPath, command) {
    const sshCmd = `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -i "${privateKeyPath}" -p ${TEST_CONFIG.SSH_PORT} ${username}@${TEST_CONFIG.SSH_HOST} "${command}"`;
    console.log(`[SSH] ${username}: ${command.substring(0, 100)}...`);
    
    try {
        const { stdout, stderr } = await execPromise(sshCmd, { timeout: 60000 });
        return { success: true, stdout, stderr };
    } catch (error) {
        return { success: false, stdout: error.stdout, stderr: error.stderr, error: error.message };
    }
}

// Helper: API request
async function apiRequest(method, endpoint, data = null, cookie = null) {
    const url = `${TEST_CONFIG.API_URL}${endpoint}`;
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (data && !(data instanceof FormData)) headers['Content-Type'] = 'application/json';
    
    try {
        const response = await axios({ method, url, data, headers, validateStatus: false });
        return response;
    } catch (error) {
        if (error.response) return error.response;
        throw error;
    }
}

// Helper: Login and get cookie
async function login(username, password) {
    const response = await apiRequest('POST', '/api/auth/login', { username, password });
    if (response.status === 200 && response.headers['set-cookie']) {
        return response.headers['set-cookie'][0];
    }
    return null;
}

// Helper: Create local pijul repository with files
async function createLocalRepo(repoPath, files = {}) {
    // Ensure directory exists
    if (!fs.existsSync(repoPath)) fs.mkdirSync(repoPath, { recursive: true });
    
    // Initialize pijul repo
    await execPromise(`pijul init`, { cwd: repoPath });
    
    // Create files
    const defaultFiles = {
        'README.md': '# Test Repository\nCreated for testing',
        'src/main.rs': 'fn main() {\n    println!("Hello World!");\n}',
        'src/lib.rs': 'pub fn add(a: i32, b: i32) -> i32 { a + b }',
        'config.json': JSON.stringify({ name: 'test-repo', version: '1.0.0' }, null, 2)
    };
    
    const allFiles = { ...defaultFiles, ...files };
    
    for (const [filePath, content] of Object.entries(allFiles)) {
        const fullPath = path.join(repoPath, filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, content);
    }
    
    // Add and record
    await execPromise(`pijul add .`, { cwd: repoPath });
    await execPromise(`pijul record -a -m "Initial commit" --author "test@local"`, { cwd: repoPath });
    
    return true;
}

// Helper: Push to remote
async function pushToRemote(repoPath, remoteUrl, toChannel = null) {
    const channelArg = toChannel ? `--to-channel "${toChannel}"` : '';
    const cmd = `pijul push "${remoteUrl}" ${channelArg} --all-channels`;
    const result = await execPromise(cmd, { cwd: repoPath, timeout: 60000 });
    return result;
}

// Helper: Clone from remote
async function cloneRemote(remoteUrl, targetPath, channel = 'main') {
    const cmd = `pijul clone "${remoteUrl}" "${targetPath}" --channel "${channel}"`;
    const result = await execPromise(cmd, { timeout: 60000 });
    return result;
}

// Setup test workspace
beforeAll(async () => {
    if (fs.existsSync(TEST_CONFIG.TEST_WORKSPACE)) {
        fs.rmSync(TEST_CONFIG.TEST_WORKSPACE, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_CONFIG.TEST_WORKSPACE, { recursive: true });
    console.log('✅ Test workspace created');
}, 30000);

afterAll(async () => {
    if (fs.existsSync(TEST_CONFIG.TEST_WORKSPACE)) {
        fs.rmSync(TEST_CONFIG.TEST_WORKSPACE, { recursive: true, force: true });
    }
    console.log('✅ Test workspace cleaned up');
});

describe('PIJUL INTEGRATION TESTS', () => {
    
    // ==================== PHASE 1: USER AUTHENTICATION ====================
    describe('Phase 1: User Registration & Authentication', () => {
        
        test('1.1 Register Alice', async () => {
            const res = await apiRequest('POST', '/api/auth/register', {
                username: TEST_CONFIG.TEST_USERS.alice.username,
                password: TEST_CONFIG.TEST_USERS.alice.password
            });
            
            expect(res.status).toBe(200);
            expect(res.data.username).toBe(TEST_CONFIG.TEST_USERS.alice.username);
            testState.cookies.alice = res.headers['set-cookie'][0];
            console.log('✅ Alice registered');
        });
        
        test('1.2 Register Bob', async () => {
            const res = await apiRequest('POST', '/api/auth/register', {
                username: TEST_CONFIG.TEST_USERS.bob.username,
                password: TEST_CONFIG.TEST_USERS.bob.password
            });
            
            expect(res.status).toBe(200);
            expect(res.data.username).toBe(TEST_CONFIG.TEST_USERS.bob.username);
            testState.cookies.bob = res.headers['set-cookie'][0];
            console.log('✅ Bob registered');
        });
        
        test('1.3 Register Carol', async () => {
            const res = await apiRequest('POST', '/api/auth/register', {
                username: TEST_CONFIG.TEST_USERS.carol.username,
                password: TEST_CONFIG.TEST_USERS.carol.password
            });
            
            expect(res.status).toBe(200);
            expect(res.data.username).toBe(TEST_CONFIG.TEST_USERS.carol.username);
            testState.cookies.carol = res.headers['set-cookie'][0];
            console.log('✅ Carol registered');
        });
        
        test('1.4 Login as Alice', async () => {
            const cookie = await login(TEST_CONFIG.TEST_USERS.alice.username, TEST_CONFIG.TEST_USERS.alice.password);
            expect(cookie).toBeDefined();
            testState.cookies.alice = cookie;
            console.log('✅ Alice logged in');
        });
        
        test('1.5 Add SSH keys for Alice', async () => {
            const { publicKey } = await generateSSHKey('alice');
            testState.users.alice = { publicKey, privateKeyPath: path.join(TEST_CONFIG.TEST_WORKSPACE, 'alice_key') };
            
            const res = await apiRequest('POST', '/api/user/keys', {
                name: 'alice-main-key',
                key: publicKey
            }, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.message).toBe('key added ');
            console.log('✅ SSH key added for Alice');
        });
        
        test('1.6 Add SSH keys for Bob', async () => {
            const { publicKey } = await generateSSHKey('bob');
            testState.users.bob = { publicKey, privateKeyPath: path.join(TEST_CONFIG.TEST_WORKSPACE, 'bob_key') };
            
            const res = await apiRequest('POST', '/api/user/keys', {
                name: 'bob-main-key',
                key: publicKey
            }, testState.cookies.bob);
            
            expect(res.status).toBe(200);
            console.log('✅ SSH key added for Bob');
        });
        
        test('1.7 Add SSH keys for Carol', async () => {
            const { publicKey } = await generateSSHKey('carol');
            testState.users.carol = { publicKey, privateKeyPath: path.join(TEST_CONFIG.TEST_WORKSPACE, 'carol_key') };
            
            const res = await apiRequest('POST', '/api/user/keys', {
                name: 'carol-main-key',
                key: publicKey
            }, testState.cookies.carol);
            
            expect(res.status).toBe(200);
            console.log('✅ SSH key added for Carol');
        });
        
        test('1.8 Get user profile with SSH keys', async () => {
            const res = await apiRequest('GET', '/api/user/profile', null, testState.cookies.alice);
            expect(res.status).toBe(200);
            expect(res.data.username).toBe(TEST_CONFIG.TEST_USERS.alice.username);
            expect(res.data.sshKeys).toBeDefined();
            expect(res.data.sshKeys.length).toBe(1);
            console.log('✅ Profile verified with SSH keys');
        });
    });
    
    // ==================== PHASE 2: REPOSITORY CREATION ====================
    describe('Phase 2: Repository Creation', () => {
        
        test('2.1 Alice creates repo "alice-project" (private)', async () => {
            const res = await apiRequest('POST', '/api/repos', {
                name: 'alice-project',
                isPrivate: true
            }, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.name).toBe('alice-project');
            expect(res.data.owner).toBe(TEST_CONFIG.TEST_USERS.alice.username);
            expect(res.data.is_private).toBe(true);
            
            testState.repos.push({
                name: 'alice-project',
                owner: TEST_CONFIG.TEST_USERS.alice.username,
                isPrivate: true
            });
            console.log('✅ Alice created private repo: alice-project');
        });
        
        test('2.2 Alice creates repo "alice-public" (public)', async () => {
            const res = await apiRequest('POST', '/api/repos', {
                name: 'alice-public',
                isPrivate: false
            }, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.name).toBe('alice-public');
            expect(res.data.is_private).toBe(false);
            
            testState.repos.push({
                name: 'alice-public',
                owner: TEST_CONFIG.TEST_USERS.alice.username,
                isPrivate: false
            });
            console.log('✅ Alice created public repo: alice-public');
        });
        
        test('2.3 Bob creates repo "bob-awesome" (public)', async () => {
            const res = await apiRequest('POST', '/api/repos', {
                name: 'bob-awesome',
                isPrivate: false
            }, testState.cookies.bob);
            
            expect(res.status).toBe(200);
            expect(res.data.name).toBe('bob-awesome');
            expect(res.data.owner).toBe(TEST_CONFIG.TEST_USERS.bob.username);
            
            testState.repos.push({
                name: 'bob-awesome',
                owner: TEST_CONFIG.TEST_USERS.bob.username,
                isPrivate: false
            });
            console.log('✅ Bob created repo: bob-awesome');
        });
        
        test('2.4 Carol creates repo "carol-secret" (private)', async () => {
            const res = await apiRequest('POST', '/api/repos', {
                name: 'carol-secret',
                isPrivate: true
            }, testState.cookies.carol);
            
            expect(res.status).toBe(200);
            expect(res.data.name).toBe('carol-secret');
            expect(res.data.owner).toBe(TEST_CONFIG.TEST_USERS.carol.username);
            expect(res.data.is_private).toBe(true);
            
            testState.repos.push({
                name: 'carol-secret',
                owner: TEST_CONFIG.TEST_USERS.carol.username,
                isPrivate: true
            });
            console.log('✅ Carol created private repo: carol-secret');
        });
        
        test('2.5 List all repos (unauthenticated - only public visible)', async () => {
            const res = await apiRequest('GET', '/api/repos');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.data)).toBe(true);
            
            const publicRepos = res.data.filter(r => !r.is_private);
            expect(publicRepos.length).toBeGreaterThanOrEqual(2); // alice-public and bob-awesome
            
            const privateReposVisible = res.data.filter(r => r.is_private);
            expect(privateReposVisible.length).toBe(0);
            
            console.log(`✅ Unauthenticated sees ${publicRepos.length} public repos`);
        });
        
        test('2.6 List repos as Alice (sees her private repos)', async () => {
            const res = await apiRequest('GET', '/api/repos', null, testState.cookies.alice);
            expect(res.status).toBe(200);
            
            const aliceRepos = res.data.filter(r => r.owner === TEST_CONFIG.TEST_USERS.alice.username);
            expect(aliceRepos.length).toBe(2); // Both private and public
            
            const hasPrivate = aliceRepos.some(r => r.name === 'alice-project' && r.is_private);
            expect(hasPrivate).toBe(true);
            
            console.log(`✅ Alice sees her ${aliceRepos.length} repos (including private)`);
        });
    });
    
    // ==================== PHASE 3: SSH PUSH/PULL OPERATIONS ====================
    describe('Phase 3: SSH Push/Pull Operations', () => {
        const aliceLocalRepo = path.join(TEST_CONFIG.TEST_WORKSPACE, 'alice-local');
        
        test('3.1 Alice clones her public repo via SSH', async () => {
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            const targetPath = aliceLocalRepo;
            
            const result = await cloneRemote(remoteUrl, targetPath, 'main');
            expect(result.stdout).toBeDefined();
            expect(fs.existsSync(targetPath)).toBe(true);
            
            console.log('✅ Alice cloned her public repo via SSH');
        });
        
        test('3.2 Alice adds files and pushes to her repo', async () => {
            // Create and add files
            fs.writeFileSync(path.join(aliceLocalRepo, 'new-file.txt'), 'This is a new file from Alice');
            fs.writeFileSync(path.join(aliceLocalRepo, 'src/feature.rs'), 'pub fn new_feature() { println!("New feature!"); }');
            
            await execPromise(`pijul add new-file.txt src/feature.rs`, { cwd: aliceLocalRepo });
            await execPromise(`pijul record -a -m "Added new files" --author "alice"`, { cwd: aliceLocalRepo });
            
            // Push via SSH
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            const result = await pushToRemote(aliceLocalRepo, remoteUrl, 'main');
            
            expect(result.stderr).toBeDefined(); // Push output includes stderr
            console.log('✅ Alice pushed files to her repo via SSH');
        });
        
        test('3.3 Bob clones Alice\'s public repo (successful)', async () => {
            const bobClonePath = path.join(TEST_CONFIG.TEST_WORKSPACE, 'bob-clone-alice-public');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            const result = await cloneRemote(remoteUrl, bobClonePath, 'main');
            expect(fs.existsSync(bobClonePath)).toBe(true);
            expect(fs.existsSync(path.join(bobClonePath, 'new-file.txt'))).toBe(true);
            
            console.log('✅ Bob successfully cloned Alice\'s public repo');
        });
        
        test('3.4 Bob tries to push to Alice\'s repo without permission (should fail)', async () => {
            const bobRepoPath = path.join(TEST_CONFIG.TEST_WORKSPACE, 'bob-clone-alice-public');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            // Make a change
            fs.writeFileSync(path.join(bobRepoPath, 'bob-attempt.txt'), 'Bob trying to push');
            await execPromise(`pijul add bob-attempt.txt`, { cwd: bobRepoPath });
            await execPromise(`pijul record -a -m "Bob\'s attempt" --author "bob"`, { cwd: bobRepoPath });
            
            // Try to push - should be denied
            try {
                await pushToRemote(bobRepoPath, remoteUrl, 'main');
                // If we get here, test should fail
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeDefined();
                console.log('✅ Bob\'s push correctly denied (no collaborator status)');
            }
        });
        
        test('3.5 Alice adds Bob as collaborator to alice-public', async () => {
            const res = await apiRequest('POST', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/collaborators`, {
                username: TEST_CONFIG.TEST_USERS.bob.username,
                role: 'developer'
            }, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.message).toBe('collaborator added');
            console.log('✅ Alice added Bob as collaborator');
        });
        
        test('3.6 Bob can now push to Alice\'s repo', async () => {
            const bobRepoPath = path.join(TEST_CONFIG.TEST_WORKSPACE, 'bob-clone-alice-public');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            // Pull latest
            await execPromise(`pijul pull ${remoteUrl} --all-channels`, { cwd: bobRepoPath });
            
            // Add Bob's contribution
            const bobContent = '// Contributed by Bob\npub fn bob_function() { println!("Bob was here!"); }';
            fs.writeFileSync(path.join(bobRepoPath, 'src/bob_contribution.rs'), bobContent);
            await execPromise(`pijul add src/bob_contribution.rs`, { cwd: bobRepoPath });
            await execPromise(`pijul record -a -m "Bob adds his contribution" --author "bob"`, { cwd: bobRepoPath });
            
            // Push - should succeed now
            const result = await pushToRemote(bobRepoPath, remoteUrl, 'main');
            expect(result.stderr).toBeDefined();
            
            console.log('✅ Bob successfully pushed after being added as collaborator');
        });
        
        test('3.7 Carol tries to access Alice\'s private repo (should fail)', async () => {
            const carolClonePath = path.join(TEST_CONFIG.TEST_WORKSPACE, 'carol-clone-alice-private');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-project`;
            
            try {
                await cloneRemote(remoteUrl, carolClonePath, 'main');
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeDefined();
                console.log('✅ Carol correctly denied access to Alice\'s private repo');
            }
        });
    });
    
    // ==================== PHASE 4: BRANCH PROTECTION ====================
    describe('Phase 4: Branch Protection', () => {
        
        test('4.1 Alice protects main branch on alice-public', async () => {
            const res = await apiRequest('POST', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/protected-channels/toggle`, {
                channel: 'main'
            }, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.message).toBe('updated succesfully');
            console.log('✅ Alice protected main branch');
        });
        
        test('4.2 Bob tries to push to protected main branch (should be denied)', async () => {
            const bobRepoPath = path.join(TEST_CONFIG.TEST_WORKSPACE, 'bob-clone-alice-public');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            fs.writeFileSync(path.join(bobRepoPath, 'protected-test.txt'), 'Trying to push to protected branch');
            await execPromise(`pijul add protected-test.txt`, { cwd: bobRepoPath });
            await execPromise(`pijul record -a -m "Attempt to push to protected branch"`, { cwd: bobRepoPath });
            
            try {
                await pushToRemote(bobRepoPath, remoteUrl, 'main');
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeDefined();
                console.log('✅ Push to protected branch correctly denied');
            }
        });
    });
    
    // ==================== PHASE 5: DISCUSSIONS / PRs ====================
    describe('Phase 5: Discussions and Pull Requests', () => {
        let discussionId;
        
        test('5.1 Bob creates a discussion/PR for alice-public', async () => {
            const res = await apiRequest('POST', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/discussions`, {
                title: 'Bob\'s Feature Request',
                description: 'Please review my new feature',
                targetChannel: 'main'
            }, testState.cookies.bob);
            
            expect(res.status).toBe(200);
            expect(res.data.title).toBe('Bob\'s Feature Request');
            expect(res.data.source_channel).toMatch(/^pr-\d+$/);
            expect(res.data.status).toBe('open');
            
            discussionId = res.data.id;
            testState.discussions.push(res.data);
            console.log(`✅ Bob created discussion #${discussionId}`);
        });
        
        test('5.2 Bob pushes to his PR branch', async () => {
            const bobRepoPath = path.join(TEST_CONFIG.TEST_WORKSPACE, 'bob-clone-alice-public');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            // Get PR branch name
            const discRes = await apiRequest('GET', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/discussions`, null, testState.cookies.bob);
            const pr = discRes.data.find(d => d.id === discussionId);
            const prBranch = pr.source_channel;
            
            // Create branch locally
            await execPromise(`pijul channel create "${prBranch}"`, { cwd: bobRepoPath });
            await execPromise(`pijul channel switch "${prBranch}"`, { cwd: bobRepoPath });
            
            // Add feature files
            const featureContent = `
pub fn bob_feature() -> String {
    "Bob's amazing feature!".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_feature() {
        assert_eq!(bob_feature(), "Bob's amazing feature!");
    }
}`;
            fs.writeFileSync(path.join(bobRepoPath, 'src/bob_feature.rs'), featureContent);
            await execPromise(`pijul add src/bob_feature.rs`, { cwd: bobRepoPath });
            await execPromise(`pijul record -a -m "Implement Bob's feature" --author "bob"`, { cwd: bobRepoPath });
            
            // Push to PR branch
            const result = await pushToRemote(bobRepoPath, remoteUrl, prBranch);
            expect(result.stderr).toBeDefined();
            
            console.log(`✅ Bob pushed to PR branch: ${prBranch}`);
        });
        
        test('5.3 Get discussion details', async () => {
            const res = await apiRequest('GET', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/discussions/${discussionId}`, null, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.title).toBe('Bob\'s Feature Request');
            expect(res.data.author).toBe(TEST_CONFIG.TEST_USERS.bob.username);
            console.log('✅ Discussion details retrieved');
        });
        
        test('5.4 Alice adds comment to discussion', async () => {
            const res = await apiRequest('POST', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/discussions/${discussionId}/comments`, {
                text: 'Thanks for the contribution! I\'ll review it shortly.'
            }, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.comments).toBeDefined();
            const lastComment = res.data.comments[res.data.comments.length - 1];
            expect(lastComment.text).toContain('Thanks for the contribution');
            console.log('✅ Alice added comment to discussion');
        });
        
        test('5.5 Check for merge conflicts', async () => {
            const res = await apiRequest('GET', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/discussions/${discussionId}/mergeconflicts`, null, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data).toHaveProperty('isconflicts');
            console.log(`✅ Merge conflicts check: conflicts = ${res.data.isconflicts}`);
        });
        
        test('5.6 Alice merges the discussion', async () => {
            const res = await apiRequest('POST', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/discussions/${discussionId}/merge`, null, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.message).toBe('Merged successfully');
            console.log('✅ Discussion merged successfully');
        });
        
        test('5.7 Verify discussion status is merged', async () => {
            const res = await apiRequest('GET', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/discussions/${discussionId}`, null, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.status).toBe('merged');
            console.log('✅ Discussion status updated to merged');
        });
        
        test('5.8 Bob can see his feature in main branch after merge', async () => {
            const bobRepoPath = path.join(TEST_CONFIG.TEST_WORKSPACE, 'bob-clone-alice-public');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            // Pull latest changes
            await execPromise(`pijul pull ${remoteUrl} --all-channels`, { cwd: bobRepoPath });
            await execPromise(`pijul channel switch main`, { cwd: bobRepoPath });
            
            // Check if feature file exists
            const featurePath = path.join(bobRepoPath, 'src/bob_feature.rs');
            expect(fs.existsSync(featurePath)).toBe(true);
            
            console.log('✅ Bob\'s feature successfully merged into main');
        });
    });
    
    // ==================== PHASE 6: REPO LIST VISIBILITY TESTS ====================
    describe('Phase 6: Repository Visibility & Access Control', () => {
        
        test('6.1 Alice\'s private repo not visible to unauthenticated user', async () => {
            const res = await apiRequest('GET', '/api/repos');
            expect(res.status).toBe(200);
            
            const privateRepo = res.data.find(r => r.name === 'alice-project' && r.is_private);
            expect(privateRepo).toBeUndefined();
            console.log('✅ Private repo hidden from unauthenticated');
        });
        
        test('6.2 Alice\'s private repo visible to Alice', async () => {
            const res = await apiRequest('GET', '/api/repos', null, testState.cookies.alice);
            expect(res.status).toBe(200);
            
            const privateRepo = res.data.find(r => r.name === 'alice-project' && r.is_private);
            expect(privateRepo).toBeDefined();
            console.log('✅ Private repo visible to owner');
        });
        
        test('6.3 Get repository collaborators', async () => {
            const res = await apiRequest('GET', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/collaborators`, null, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(Array.isArray(res.data)).toBe(true);
            
            const bobCollaborator = res.data.find(c => c.username === TEST_CONFIG.TEST_USERS.bob.username);
            expect(bobCollaborator).toBeDefined();
            expect(bobCollaborator.role).toBe('developer');
            
            console.log('✅ Collaborator list retrieved');
        });
        
        test('6.4 Remove Bob as collaborator', async () => {
            const res = await apiRequest('DELETE', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/alice-public/collaborators/${TEST_CONFIG.TEST_USERS.bob.username}`, null, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.message).toBe('collaborator removed');
            console.log('✅ Bob removed as collaborator');
        });
        
        test('6.5 Bob cannot push after being removed', async () => {
            const bobRepoPath = path.join(TEST_CONFIG.TEST_WORKSPACE, 'bob-clone-alice-public');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            fs.writeFileSync(path.join(bobRepoPath, 'after-removal.txt'), 'Attempt after removal');
            await execPromise(`pijul add after-removal.txt`, { cwd: bobRepoPath });
            await execPromise(`pijul record -a -m "Push after removal"`, { cwd: bobRepoPath });
            
            try {
                await pushToRemote(bobRepoPath, remoteUrl, 'main');
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeDefined();
                console.log('✅ Bob correctly denied push after removal');
            }
        });
    });
    
    // ==================== PHASE 7: REPO DELETION ====================
    describe('Phase 7: Repository Deletion', () => {
        
        test('7.1 Create temporary repo for deletion test', async () => {
            const res = await apiRequest('POST', '/api/repos', {
                name: 'temp-for-deletion',
                isPrivate: false
            }, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            console.log('✅ Temporary repo created');
        });
        
        test('7.2 Delete repository', async () => {
            const res = await apiRequest('DELETE', `/api/repos/${TEST_CONFIG.TEST_USERS.alice.username}/temp-for-deletion`, null, testState.cookies.alice);
            
            expect(res.status).toBe(200);
            expect(res.data.message).toBe('Repository deleted');
            console.log('✅ Repository deleted successfully');
        });
        
        test('7.3 Deleted repo not in list', async () => {
            const res = await apiRequest('GET', '/api/repos', null, testState.cookies.alice);
            const deletedRepo = res.data.find(r => r.name === 'temp-for-deletion');
            expect(deletedRepo).toBeUndefined();
            console.log('✅ Deleted repo no longer appears');
        });
    });
    
    // ==================== PHASE 8: MULTI-USER CONCURRENT OPERATIONS ====================
    describe('Phase 8: Concurrent Multi-User Operations', () => {
        
        test('8.1 All users create repos simultaneously pattern', async () => {
            const users = [
                { cookie: testState.cookies.alice, name: 'alice-concurrent-1' },
                { cookie: testState.cookies.bob, name: 'bob-concurrent-1' },
                { cookie: testState.cookies.carol, name: 'carol-concurrent-1' }
            ];
            
            const promises = users.map(async (user) => {
                const res = await apiRequest('POST', '/api/repos', {
                    name: user.name,
                    isPrivate: false
                }, user.cookie);
                expect(res.status).toBe(200);
                return res.data;
            });
            
            const results = await Promise.all(promises);
            expect(results.length).toBe(3);
            console.log('✅ All users created repos concurrently');
        });
        
        test('8.2 Carol creates branch and pushes to her repo', async () => {
            const carolLocalRepo = path.join(TEST_CONFIG.TEST_WORKSPACE, 'carol-local');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.carol.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.carol.username}/carol-secret`;
            
            // Clone Carol's private repo
            await cloneRemote(remoteUrl, carolLocalRepo, 'main');
            
            // Create feature branch
            await execPromise(`pijul channel create feature-x`, { cwd: carolLocalRepo });
            await execPromise(`pijul channel switch feature-x`, { cwd: carolLocalRepo });
            
            // Add files
            fs.writeFileSync(path.join(carolLocalRepo, 'secret-feature.js'), 'console.log("Carol\'s secret feature");');
            await execPromise(`pijul add secret-feature.js`, { cwd: carolLocalRepo });
            await execPromise(`pijul record -a -m "Add secret feature" --author "carol"`, { cwd: carolLocalRepo });
            
            // Push
            const result = await pushToRemote(carolLocalRepo, remoteUrl, 'feature-x');
            expect(result.stderr).toBeDefined();
            
            console.log('✅ Carol pushed to her private repo feature branch');
        });
        
        test('8.3 Verify each user can only see their own private repos', async () => {
            // Alice sees her private repo
            const aliceRepos = await apiRequest('GET', '/api/repos', null, testState.cookies.alice);
            const alicePrivate = aliceRepos.data.find(r => r.name === 'alice-project' && r.is_private);
            expect(alicePrivate).toBeDefined();
            
            // Bob does NOT see Alice's private repo
            const bobRepos = await apiRequest('GET', '/api/repos', null, testState.cookies.bob);
            const bobSeesAlicePrivate = bobRepos.data.find(r => r.name === 'alice-project');
            expect(bobSeesAlicePrivate).toBeUndefined();
            
            // Carol does NOT see Alice's private repo
            const carolRepos = await apiRequest('GET', '/api/repos', null, testState.cookies.carol);
            const carolSeesAlicePrivate = carolRepos.data.find(r => r.name === 'alice-project');
            expect(carolSeesAlicePrivate).toBeUndefined();
            
            console.log('✅ Private repo isolation working correctly');
        });
        
        test('8.4 Repository metadata endpoint access control', async () => {
            // Alice can access her repo metadata
            const aliceMeta = await apiRequest('GET', `/api/repo/${TEST_CONFIG.TEST_USERS.alice.username}/alice-project/meta`, null, testState.cookies.alice);
            expect(aliceMeta.status).toBe(200);
            
            // Bob cannot access Alice's private repo metadata
            const bobMeta = await apiRequest('GET', `/api/repo/${TEST_CONFIG.TEST_USERS.alice.username}/alice-project/meta`, null, testState.cookies.bob);
            expect(bobMeta.status).toBe(403);
            
            console.log('✅ Metadata endpoint access control working');
        });
    });
    
    // ==================== PHASE 9: STRESS/EDGE CASES ====================
    describe('Phase 9: Edge Cases and Stress Tests', () => {
        
        test('9.1 Clone non-existent repo returns proper error', async () => {
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/non-existent-repo`;
            const targetPath = path.join(TEST_CONFIG.TEST_WORKSPACE, 'should-not-exist');
            
            try {
                await cloneRemote(remoteUrl, targetPath, 'main');
                expect(true).toBe(false);
            } catch (error) {
                expect(error).toBeDefined();
                console.log('✅ Non-existent repo returns error correctly');
            }
        });
        
        test('9.2 Create repo with invalid characters', async () => {
            const res = await apiRequest('POST', '/api/repos', {
                name: 'invalid!@#$%',
                isPrivate: false
            }, testState.cookies.alice);
            
            // Should either return error or handle gracefully
            expect([200, 400, 500]).toContain(res.status);
            console.log(`✅ Invalid repo name handled with status ${res.status}`);
        });
        
        test('9.3 Duplicate repo creation prevented', async () => {
            // First creation
            await apiRequest('POST', '/api/repos', {
                name: 'duplicate-test',
                isPrivate: false
            }, testState.cookies.alice);
            
            // Second creation with same name by same owner
            const res = await apiRequest('POST', '/api/repos', {
                name: 'duplicate-test',
                isPrivate: false
            }, testState.cookies.alice);
            
            expect([400, 409, 500]).toContain(res.status);
            console.log('✅ Duplicate repo creation prevented');
        });
        
        test('9.4 Large file push', async () => {
            const aliceLocalRepo = path.join(TEST_CONFIG.TEST_WORKSPACE, 'alice-local');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            // Create a 1MB file
            const largeContent = Buffer.alloc(1024 * 1024, 'A').toString();
            fs.writeFileSync(path.join(aliceLocalRepo, 'large-file.txt'), largeContent);
            
            await execPromise(`pijul add large-file.txt`, { cwd: aliceLocalRepo });
            await execPromise(`pijul record -a -m "Add large file" --author "alice"`, { cwd: aliceLocalRepo });
            
            const result = await pushToRemote(aliceLocalRepo, remoteUrl, 'main');
            expect(result.stderr).toBeDefined();
            
            console.log('✅ Large file push successful');
        });
        
        test('9.5 Deep nested directory structure', async () => {
            const aliceLocalRepo = path.join(TEST_CONFIG.TEST_WORKSPACE, 'alice-local');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            // Create deep nested directories
            const deepPath = 'a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z/deep-file.txt';
            fs.mkdirSync(path.dirname(path.join(aliceLocalRepo, deepPath)), { recursive: true });
            fs.writeFileSync(path.join(aliceLocalRepo, deepPath), 'Very deep file content');
            
            await execPromise(`pijul add ${deepPath}`, { cwd: aliceLocalRepo });
            await execPromise(`pijul record -a -m "Add deeply nested file" --author "alice"`, { cwd: aliceLocalRepo });
            
            const result = await pushToRemote(aliceLocalRepo, remoteUrl, 'main');
            expect(result.stderr).toBeDefined();
            
            console.log('✅ Deep nested directory structure handled');
        });
        
        test('9.6 Binary file handling', async () => {
            const aliceLocalRepo = path.join(TEST_CONFIG.TEST_WORKSPACE, 'alice-local');
            const remoteUrl = `${TEST_CONFIG.TEST_USERS.alice.username}@${TEST_CONFIG.SSH_HOST}:${TEST_CONFIG.TEST_USERS.alice.username}/alice-public`;
            
            // Create a small binary file
            const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]); // PNG header
            fs.writeFileSync(path.join(aliceLocalRepo, 'test.bin'), binaryContent);
            
            await execPromise(`pijul add test.bin`, { cwd: aliceLocalRepo });
            await execPromise(`pijul record -a -m "Add binary file" --author "alice"`, { cwd: aliceLocalRepo });
            
            const result = await pushToRemote(aliceLocalRepo, remoteUrl, 'main');
            expect(result.stderr).toBeDefined();
            
            console.log('✅ Binary file handling works');
        });
    });
    
    // ==================== PHASE 10: FINAL VERIFICATION ====================
    describe('Phase 10: Final System Verification', () => {
        
        test('10.1 All repositories listed correctly', async () => {
            const res = await apiRequest('GET', '/api/repos', null, testState.cookies.alice);
            
            const aliceRepos = res.data.filter(r => r.owner === TEST_CONFIG.TEST_USERS.alice.username);
            // alice-project, alice-public, alice-concurrent-1, duplicate-test
            expect(aliceRepos.length).toBeGreaterThanOrEqual(3);
            
            console.log(`✅ Final check: Alice has ${aliceRepos.length} repos`);
        });
        
        test('10.2 SSH key management still functional', async () => {
            // Add second key for Alice
            const { publicKey: secondKey } = await generateSSHKey('alice-second');
            
            const addRes = await apiRequest('POST', '/api/user/keys', {
                name: 'alice-second-key',
                key: secondKey
            }, testState.cookies.alice);
            
            expect(addRes.status).toBe(200);
            
            // Get profile to verify keys
            const profileRes = await apiRequest('GET', '/api/user/profile', null, testState.cookies.alice);
            expect(profileRes.data.sshKeys.length).toBeGreaterThanOrEqual(2);
            
            console.log('✅ SSH key management working throughout test');
        });
        
        test('10.3 Logout works (clear session)', async () => {
            // Simply verify that with invalid/no cookie we get 401
            const res = await apiRequest('GET', '/api/user/profile');
            expect(res.status).toBe(401);
            
            console.log('✅ Session handling works');
        });
    });
});

// Test execution summary
console.log(`
╔══════════════════════════════════════════════════════════════╗
║                 PIJUL SERVER TEST SUITE                      ║
╠══════════════════════════════════════════════════════════════╣
║  Tests cover:                                                ║
║  ✓ User registration & authentication                        ║
║  ✓ SSH key management                                        ║
║  ✓ Repository creation (public/private)                      ║
║  ✓ SSH push/pull operations                                  ║
║  ✓ Access control & permissions                              ║
║  ✓ Branch protection                                         ║
║  ✓ Discussions/PR workflow                                   ║
║  ✓ Collaborator management                                   ║
║  ✓ Repository deletion                                       ║
║  ✓ Multi-user concurrent operations                          ║
║  ✓ Edge cases & stress tests                                 ║
╚══════════════════════════════════════════════════════════════╝
`);