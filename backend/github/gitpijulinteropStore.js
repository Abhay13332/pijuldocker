const {gitStore} = require('./gitStore');
const pijul  = require('../pijul');
const  { execSync,exec } =require( 'child_process');
const fs = require('fs');
const util = require('util');
const path = require('path');
const execPromise = util.promisify(exec);
const crypto = require('crypto');
const discussionStore = require('../discussionStore');
const GIT_REPO_PATH = process.env.GIT_REPO_PATH || "/repos/git_repos";
const PIJUL_REPO_PATH = process.env.PIJUL_REPO_PATH || "/repos/pijul_repos";
function rethrowGitError(result) {
  if(!result.success) {
    throw new Error(`Git operation failed: ${result.error}`);
  }
  return result;
}
const gitPijulInteropStore = {
    //github repos to pijul repo info build already exists in gitStore, we just need to retrieve it and use it for interop
    
/**
 * Check if a GitHub repository branch is commitable
 * Returns true if there are NO discussions with 'github_only_fetched' state for the given repo/branch
 * 
 * @param {string} githubUsername - GitHub username/organization
 * @param {string} githubRepoName - GitHub repository name
 * @param {string} gitBranch - Git branch name
 * @returns {Promise<boolean>} - True if commitable (no github_only_fetched discussions)
 */
async isGithubCommitable({pijulUsername, githubUsername, githubRepoName, pijulRepoName, gitBranch = "main"}) {
  try {
    if (!githubUsername && !pijulUsername) {
      throw new Error("Either githubUsername or pijulUsername must be provided");
    }
    if (!githubRepoName && !pijulRepoName) {
      throw new Error("Either githubRepoName or pijulRepoName must be provided");
    }
    
    const username = pijulUsername || await gitStore.retrievepijulUsername(githubUsername);
    
    // Find the repository
    let repoQuery;
    let queryParams;
    
    if (pijulRepoName) {
      repoQuery = `
        SELECT r.id
        FROM repositories r
        WHERE r.name = $1 
          AND r.owner = $2
          AND r.is_archived = false
        LIMIT 1
      `;
      queryParams = [pijulRepoName, username];
    } else {
      repoQuery = `
        SELECT r.id
        FROM repositories r
        WHERE r.github_repo_name = $1 
          AND r.owner = $2
          AND r.is_archived = false
        LIMIT 1
      `;
      queryParams = [githubRepoName, username];
    }
    
    const repoResult = await pool.query(repoQuery, queryParams);
    const repoId = repoResult.rows[0].id;
    
    // Check if all github_only_fetched commits are now github_pijul_synced
    const checkQuery = `
      SELECT NOT EXISTS (
        SELECT 1
        FROM discussions d
        INNER JOIN discussion_commits dc ON d.id = dc.discussion_id
        WHERE d.repository_id = $1
          AND d.target_channel_id = $2
          AND dc.state = 'github_only_fetched'
        LIMIT 1
      ) as is_commitable
    `;
    
    const result = await pool.query(checkQuery, [repoId, gitBranch]);
    
    return result.rows[0].is_commitable;
    
  } catch (error) {
    console.error('Error in isGithubCommitable:', error);
    return false;
  }
},
async isAvaililbeToCommitable({pijulUsername, githubUsername, githubRepoName, pijulRepoName, gitBranch = "main"}) {
  try {
    if (!githubUsername && !pijulUsername) {
      throw new Error("Either githubUsername or pijulUsername must be provided");
    }
    if (!githubRepoName && !pijulRepoName) {
      throw new Error("Either githubRepoName or pijulRepoName must be provided");
    }
    
    const username = pijulUsername || await gitStore.retrievepijulUsername(githubUsername);
    
    // Find the repository
    let repoQuery;
    let queryParams;
    
    if (pijulRepoName) {
      repoQuery = `
        SELECT r.id
        FROM repositories r
        WHERE r.name = $1 
          AND r.owner = $2
          AND r.is_archived = false
        LIMIT 1
      `;
      queryParams = [pijulRepoName, username];
    } else {
      repoQuery = `
        SELECT r.id
        FROM repositories r
        WHERE r.github_repo_name = $1 
          AND r.owner = $2
          AND r.is_archived = false
        LIMIT 1
      `;
      queryParams = [githubRepoName, username];
    }
    
    const repoResult = await pool.query(repoQuery, queryParams);
    const repoId = repoResult.rows[0].id;
    
    // Check if there are patches with pijul_only_fetched state
    // Removed status check - all discussions eligible for pijul_only_fetched
    const checkQuery = `
      SELECT EXISTS (
        SELECT 1
        FROM discussions d
        INNER JOIN discussion_commits dc ON d.id = dc.discussion_id
        INNER JOIN discussion_commit_patches dcp ON dc.id = dcp.discussion_commit_id
        WHERE d.repository_id = $1
          AND d.target_channel_id = $2
          AND dc.state = 'pijul_only_fetched'
        LIMIT 1
      ) as has_patches
    `;
    
    const result = await pool.query(checkQuery, [repoId, gitBranch]);
    
    return result.rows[0].has_patches;
    
  } catch (error) {
    console.error('Error in isAvaililbeToCommitable:', error);
    return false;
  }
},
async getPijulPatches(pijulUsername, pijulRepoName, {pijulpatchSourceBranch = "main"} = {}) {
  try {
    const result = await pool.query(
      `SELECT 
        dcp.id as patch_id,
        dcp.pijul_patch_hash,
        dcp.created_at,
        u.id as author_user_id,
        u.username as author_username
      FROM discussion_commit_patches dcp
      INNER JOIN discussion_commits dc ON dcp.discussion_commit_id = dc.id
      INNER JOIN discussions d ON dc.discussion_id = d.id
      INNER JOIN users u ON d.author_id = u.id
      WHERE d.repository_id = (
        SELECT id FROM repositories WHERE owner = $1 AND name = $2
      )
      AND d.target_channel_id = $3
      AND dc.state = 'pijul_only_fetched'
      ORDER BY dcp.created_at ASC`,
      [pijulUsername, pijulRepoName, pijulpatchSourceBranch]
    );

    return result.rows;
  } catch (error) {
    console.error("Error retrieving pijul patches:", error);
    throw new Error(`Failed to retrieve pijul patches: ${error.message}`);
  }
},
async updatePatchesStatus({pijulUsername, pijulRepoName}) {
  try {
    const result = await pool.query(
      `UPDATE discussion_commits dc
       SET state = 'pijul_github_synced',
           updated_at = CURRENT_TIMESTAMP
       FROM discussions d
       WHERE dc.discussion_id = d.id
         AND d.repository_id = (
           SELECT id FROM repositories WHERE owner = $1 AND name = $2
         )
         AND dc.state = 'pijul_only_fetched'
       RETURNING dc.id, dc.discussion_id, dc.state, dc.updated_at`,
      [pijulUsername, pijulRepoName]
    );

    return {
      success: true,
      updatedCount: result.rows.length,
      updatedCommits: result.rows,
      message: `${result.rows.length} discussion commits updated to pijul_github_synced`
    };
  } catch (error) {
    console.error("Error updating patches status:", error);
    throw new Error(`Failed to update patches status: ${error.message}`);
  }
},
async PijulToGit({pijulUsername, githubUsername, gitTargetBranch,githubRepoName,pijulRepoName, pijulpatchSourceBranch="main", pijulRepoLocalPath,gitRepoLocalPath}){
try{
    const patches = await this.getPijulPatches(pijulUsername, pijulRepoName, { pijulpatchSourceBranch});
  this.cleanDirectoryKeepGit(gitRepoLocalPath);
  this.PijulFetch(gitRepoLocalPath, pijulRepoLocalPath, { gitSourceChannel: gitTargetBranch });
    for(const patchInfo of patches) {
      
        await this.pijulToGitOne({pijulUsername
            ,githubUsername,
            githubRepoName,
            PijulHash: patchInfo.pijul_patch_hash,
            contributorPijulUsername: patchInfo.author_username, 
            pijulRepoPath: pijulRepoLocalPath, gitRepoLocalPath,
            gitbranch: gitTargetBranch,
            pijulpatchSourceBranch
        });
        await this.PijulPushtoLocalSync(gitRepoLocalPath, pijulRepoLocalPath, { gitSourceChannel: gitTargetBranch });
        await this.updatePatchesStatus({pijulUsername, pijulRepoName });
    }
  this.cleanDirectoryKeepGit(gitRepoLocalPath);

  return {
        success: true,
        message: `Successfully synced ${patches.length} Pijul patches to Git repository ${githubRepoName} on branch ${gitTargetBranch}`,
                
    };
}catch(error) {
    console.error(`Error in PijulToGit: ${error.message}`);
    return {
        success: false,
        error: error.message,
    };
}
         
}


  ,  
async PijulFetch(gitRepoPath,pijulRepoPath,{gitSourceChannel }){
const pijulLocalSyncedChannel = `git-pijul-${gitSourceChannel}`;
    
    try {
        // Initialize Pijul repository in gitRepoPath
        await execPromise('pijul init', { cwd: gitRepoPath });
        console.log(`Initialized Pijul repository in ${gitRepoPath}`);
        
        // Add remote to the Pijul repository
        await execPromise(`pijul remote add origin ${pijulRepoPath}`, { cwd: gitRepoPath });
        console.log(`Added remote origin: ${pijulRepoPath}`);
        
        // Pull from the specified channel
        await execPromise(`pijul pull --from-channel ${pijulLocalSyncedChannel} ${pijulRepoPath}`, { cwd: gitRepoPath });
        console.log(`Pulled from channel '${pijulLocalSyncedChannel}' successfully`);
        
        return {
            success: true,
            message: `Successfully initialized Pijul in ${gitRepoPath} and pulled from ${pijulLocalSyncedChannel}`,
            path: gitRepoPath,
            pijulLocalSyncedChannel: pijulLocalSyncedChannel
        };
        
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return {
            success: false,
            error: error.message,
            path: gitRepoPath,
            pijulLocalSyncedChannel: pijulLocalSyncedChannel
        };
    }

},
async PijulRecord(gitRepoPath, recordMessage) {
  try {
   
    
    // Run pijul record command in the repository path
    const command = `cd ${gitRepoPath} && pijul record --message "${recordMessage}"`;
    
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr) {
      console.warn('Pijul record warning:', stderr);
    }
    
    console.log('Pijul record output:', stdout);
    
    return {
      success: true,
      message: 'Pijul record created successfully',
      output: stdout
    };
    
  } catch (error) {
    console.error('Error creating pijul record:', error);
    throw new Error(`Failed to create pijul record: ${error.message}`);
  }
},
async  PijulPushtoLocalSync(gitRepoPath, pijulRepoPath, { gitSourceChannel }) {
    const pijulLocalSyncedChannel = `git-pijul-${gitSourceChannel}`;
    
    try {
        // Push to the specified channel using --to-channel
        execSync(`pijul push --to-channel ${pijulLocalSyncedChannel} ${pijulRepoPath}`, { cwd: gitRepoPath, stdio: 'pipe' });
        console.log(`Pushed to channel '${pijulLocalSyncedChannel}' successfully`);
        
        return {
            success: true,
            message: `Successfully pushed to ${pijulRepoPath} on channel ${pijulLocalSyncedChannel}`,
            path: gitRepoPath,
            pijulLocalSyncedChannel: pijulLocalSyncedChannel,
            remote: pijulRepoPath
        };
        
    } catch (error) {
        console.error(`Error in PijulPush: ${error.message}`);
        return {
            success: false,
            error: error.message,
            path: gitRepoPath,
            pijulLocalSyncedChannel: pijulLocalSyncedChannel,
            remote: pijulRepoPath
        };
    }
},async  PijulPushPatch(gitRepoPath, pijulRepoPath, { pijulTargetChannel ,pijulHash}) {
    
    try {
        // Push to the specified channel using --to-channel
        execSync(`pijul push --to-channel ${pijulTargetChannel} ${pijulRepoPath} -- ${Array.isArray(pijulHash) ? pijulHash.join(' ') : pijulHash}`, { cwd: gitRepoPath, stdio: 'pipe' });
        console.log(`Pushed to channel '${pijulTargetChannel}' successfully`);
        
        return {
            success: true,
            message: `Successfully pushed to ${pijulRepoPath} on channel ${pijulTargetChannel}`,
            path: gitRepoPath,
            pijulTargetChannel: pijulTargetChannel,
            remote: pijulRepoPath
        };
        
    } catch (error) {
        console.error(`Error in PijulPush: ${error.message}`);
        return {
            success: false,
            error: error.message,
            path: gitRepoPath,
            pijulTargetChannel: pijulTargetChannel,
            remote: pijulRepoPath
        };
    }
},
async pijulPullPatch(gitRepoPath, pijulRepoPath, {   pijulpatchSourceBranch,  PijulHash }) {
    try {
        // Pull specific hash from pijulRepoPath to gitRepoPath
        // Using -- for hash disambiguation
        const command = `pijul pull ${pijulRepoPath} -- ${Array.isArray(PijulHash) ? PijulHash.join(' ') : PijulHash}`;
        
        execSync(command, { 
            cwd: gitRepoPath, 
            stdio: 'pipe' 
        });
        
        console.log(`Successfully pulled patch ${PijulHash} from ${pijulRepoPath}`);
        
        return {
            success: true,
            message: `Successfully pulled patch ${PijulHash}`,
            patch: PijulHash,
            remote: pijulRepoPath,
            path: gitRepoPath
        };
        
    } catch (error) {
        console.error(`Error pulling patch ${PijulHash}: ${error.message}`);
        return {
            success: false,
            error: error.message,
            patch: PijulHash,
            remote: pijulRepoPath,
            path: gitRepoPath
        };
    }
},
async  pijulHide(gitRepoPath) {
    const randomName = crypto.randomUUID();
    const tempPath = `/tmp/${randomName}`;
    const pijulFolderPath = `${gitRepoPath}/.pijul`;
    
    try {
        // Check if .pijul folder exists
        if (!fs.existsSync(pijulFolderPath)) {
            throw new Error(`.pijul folder not found at ${pijulFolderPath}`);
        }
        
        // Move the .pijul folder to temp location
        execSync(`mv ${pijulFolderPath} ${tempPath}`, { stdio: 'pipe' });
        console.log(`Moved .pijul folder to ${tempPath}`);
        
        return {
            success: true,
            originalPath: pijulFolderPath,
            hiddenPath: tempPath,
            randomId: randomName,
            message: `Successfully hid .pijul folder at ${tempPath}`
        };
        
    } catch (error) {
        console.error(`Error hiding .pijul folder: ${error.message}`);
        return {
            success: false,
            error: error.message,
            originalPath: pijulFolderPath,
            hiddenPath: tempPath,
            randomId: randomName
        };
    }
},
async  pijulUnhide(gitRepoPath, hiddenPath) {
    const targetPijulPath = `${gitRepoPath}/.pijul`;
    
    try {
        // Check if hidden folder exists
        if (!fs.existsSync(hiddenPath)) {
            throw new Error(`Hidden .pijul folder not found at ${hiddenPath}`);
        }
        
        // Check if target location already has a .pijul folder
        if (fs.existsSync(targetPijulPath)) {
            throw new Error(`.pijul folder already exists at ${targetPijulPath}`);
        }
        
        // Move the hidden folder back to original location
        execSync(`mv ${hiddenPath} ${targetPijulPath}`, { stdio: 'pipe' });
        console.log(`Moved .pijul folder from ${hiddenPath} to ${targetPijulPath}`);
        
        return {
            success: true,
            originalPath: targetPijulPath,
            hiddenPath: hiddenPath,
            message: `Successfully unhid .pijul folder to ${targetPijulPath}`
        };
        
    } catch (error) {
        console.error(`Error unhiding .pijul folder: ${error.message}`);
        return {
            success: false,
            error: error.message,
            originalPath: targetPijulPath,
            hiddenPath: hiddenPath
        };
    }
},
async  gitSwitchBranch(gitRepoPath, branchName) {
    try {
        // Switch the branch pointer
        execSync(`git checkout ${branchName}`, { cwd: gitRepoPath, stdio: 'pipe' });
        console.log(`Switched to branch ${branchName}`);
        
        // Restore all files from the branch into working directory
        execSync(`git restore .`, { cwd: gitRepoPath, stdio: 'pipe' });
        console.log(`Restored all files from branch ${branchName}`);
        
        return {
            success: true,
            branch: branchName,
            path: gitRepoPath,
            message: `Successfully switched to branch '${branchName}' and restored files`
        };
        
    } catch (error) {
        console.error(`Error switching branch: ${error.message}`);
        return {
            success: false,
            error: error.message,
            branch: branchName,
            path: gitRepoPath
        };
    }

},

async pijulToGitOne({pijulUsername,
    githubUsername,
    githubRepoName,
    PijulHash, 
    contributorGithubUsername,
    contributorPijulUsername,
    pijulRepoPath,
    gitRepoLocalPath,
    gitbranch = "main" , pijulpatchSourceBranch = "main"}) {
   const pijulHideInfo;
    try {
        
        // Extract commit message from Pijul change
        await this.pijulPullPatch(gitRepoLocalPath, pijulRepoPath, {  pijulpatchSourceBranch,  PijulHash });
        pijulHideInfo= (await this.pijulHide(gitRepoLocalPath));
        const changeResult = rethrowGitError(pijul.extractPijulChangeMessage(pijulRepoPath, PijulHash));
        
        if (!changeResult.success) {
            throw new Error(`Failed to extract Pijul change message: ${changeResult.error}`);
        }
        
        const commitMessage = changeResult.message;
        
        if (!commitMessage || commitMessage.trim() === '') {
            console.warn(`Warning: Pijul change ${PijulHash} has empty commit message`);
        }
        
        // Push to Git repository
        const pushResult = await gitStore.pushToRepo({pijulUsername,githubUsername, githubRepoName,gitRepoLocalPath, branch: gitbranch, commitMessage, contributorGithubUsername, contributorPijulUsername });
        
        if (!pushResult.success) {
            throw new Error(pushResult.error || "Failed to push to Git repository");
        }
        
        return {
            success: true,
            message: `Successfully synced Pijul change ${PijulHash} to Git`,
            pijulHash: PijulHash,
            commitMessage: commitMessage,
            branch: gitbranch,
            contributor: contributorUsername
        };
        
    } catch (error) {
        console.error(`Error in pijulToGitOne: ${error.message}`);
        return {
            success: false,
            error: error.message,
            pijulHash: PijulHash,
            branch: gitbranch,
            contributor: contributorUsername
        };
    }finally{
        if(pijulHideInfo && pijulHideInfo.hiddenPath) {
         rethrowGitError(await this.pijulUnhide(gitRepoPath, pijulHideInfo.hiddenPath));
        }
    }
},

async gitToPijulGenerateDiscussion({
  pijulUsername,
  pijulRepoName,
  commitMessage,
  commitDescription,
  commitHash,
  commitAuthor,
  commitTimestamp,
  pijulHash,
  pijulpatchCorrespondingBranch
}) {
  try {
    // Step 1: Create discussion with 'git' source channel
    const discussion = await discussionStore.create(
      pijulUsername,
      pijulRepoName,
      commitMessage,
      commitDescription || `This discussion is Corresponding to Git commit ${commitHash}`,
      pijulUsername,
      'git',
      pijulpatchCorrespondingBranch || 'main',
      'medium'
    );
    
    // Step 2: Create discussion commit with github_only_fetched state
    const discussionCommit = await discussionStore.createDiscussionCommit({
      discussionId: discussion.id,
      state: 'github_only_fetched'
    });
    
    // Step 3: Create discussion commit patch with commit info
    await discussionStore.createDiscussionCommitPatch({
      discussionCommitId: discussionCommit.id,
      pijulPatchHash: pijulHash,
      commitHash: commitHash,
      commitMessage: commitMessage,
      commitAuthor: commitAuthor,
      commitTimestamp: commitTimestamp
    });
    
    // Step 4: Push patch to pijul
    const pijulTargetChannel = discussion.sourceChannel;
    await this.PijulPushPatch(gitRepoPath, pijulRepoPath, {
      PijulTargetChannel,
      pijulHash
    });
    
    return {
      success: true,
      discussion: discussion,
      message: 'Discussion created and patch pushed successfully'
    };
    
  } catch (error) {
    console.error('Error in gitToPijulGenerateDiscussion:', error);
    return {
      success: false,
      message: 'Discussion creation or patch push failed',
      error: error.message
    };
  }
},
async  gitToPijul({pijulUsername,pijulRepoName,githubUsername,githubRepoName, gitBranch = 'main',pijulpatchCorrespondingBranch='main',gitRepoPath,commitDescription}) {
      try {
        const pijulRepoPath = path.join(PIJUL_REPO_PATH, pijulUsername, pijulRepoName);
        const pijulLocalSyncedChannel = `git-pijul-${gitBranch}`;
        rethrowGitError(await this.cleanDirectoryKeepGit(gitRepoPath));
        rethrowGitError(await this.gitSwitchBranch(gitRepoPath, gitBranch));
        rethrowGitError(await this.cleanDirectoryKeepGit(gitRepoPath));
        rethrowGitError(await this.PijulFetch(gitRepoPath,pijulRepoPath,{gitSourceChannel:gitBranch }));
         let hiddenPathInfo =rethrowGitError(await this.pijulHide(gitRepoPath));
        await gitStore.pullFromRepo({pijulUsername,githubUsername,githubRepoName,gitRepoPath,gitBranch});
        rethrowGitError(await this.pijulUnhide(gitRepoPath, hiddenPathInfo.hiddenPath));
        const {commitMessage,commitHash,commitAuthor,commitTimestamp} = await gitStore.gitLatestCommitInfo(gitRepoPath);
        rethrowGitError(await this.PijulRecord(gitRepoPath, commitMessage));
        rethrowGitError(await this.PijulPushtoLocalSync(gitRepoPath, pijulRepoPath, { gitSourceChannel: gitBranch }));
        const pijulHashes=pijul.getLog(pijulUsername, pijulRepoName,pijulLocalSyncedChannel,1,1 );
        if(!pijulHash || pijulHash.length === 0) {
            throw new Error('Failed to retrieve Pijul hash after push');
        }

        rethrowGitError(await this.gitToPijulGenerateDiscussion({
          pijulUsername,
          pijulRepoName,
          commitMessage,
          commitDescription,
          commitHash,
          commitAuthor,
          commitTimestamp,
          pijulHash:pijulHashes[0].patches.hash,
          pijulpatchCorrespondingBranch
        }));
      }catch (error) {
        console.error(`Error pulling from Git: ${error.message}`);
        return {
            success: false,
            error: error.message,
            branch: gitBranch,
        }
    }finally{
       rethrowGitError(await this.cleanDirectoryKeepGit(gitRepoPath));
    }
},
/**
 * Symlinks files from a Pijul channel repository to a target directory.
 * @param {string} repoPath - The root path of the Pijul repository.
 * @param {string} targetPath - The destination path where symlinks will be created.
 * @param {Object} channel - Additional options for the symlinking process.
 */
 linkChannelFiles(repoPath, targetPath) {
    try {
        // Run Pijul list in the repository directory
        const stdout = execSync('pijul list', { cwd: repoPath, encoding: 'utf8' });
        
        // Split output into individual file and directory lines
        const trackedItems = stdout.split('\n').map(line => line.trim()).filter(Boolean);

        for (const item of trackedItems) {
            const sourceItemPath = path.join(repoPath, item);
            const targetItemPath = path.join(targetPath, item);

            // Get stats to check if the item is a directory or file
            if (!fs.existsSync(sourceItemPath)) continue;
            const stats = fs.statSync(sourceItemPath);

            if (stats.isDirectory()) {
                // Generate folders only, do not symlink directories
                if (!fs.existsSync(targetItemPath)) {
                    fs.mkdirSync(targetItemPath, { recursive: true });
                }
            } else if (stats.isFile()) {
                // Ensure the parent directory for the target file exists
                const targetDir = path.dirname(targetItemPath);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                // Remove existing file/symlink at target to avoid collision errors
                try {
                    if (fs.existsSync(targetItemPath) || fs.lstatSync(targetItemPath).isSymbolicLink()) {
                        fs.unlinkSync(targetItemPath);
                    }
                } catch (e) {
                    // Ignore if target path does not exist
                }

                // Create the file hardlink
                fs.linkSync(sourceItemPath, targetItemPath); // <-- CHANGED THIS LINE
            }
        }
        console.log('Hardlink generation completed successfully.');
    } catch (error) {
        console.error('Error generating hardlinks:', error.message);
    }
}
,

async  cleanDirectoryKeepGit(targetDir) {
  try {
    // Read all items in the directory, including hidden ones
    const items = await fs.readdir(targetDir);

    for (const item of items) {
      // Skip the .git folder
      if (item === '.git') continue;

      const itemPath = path.join(targetDir, item);
      
      // rm() with recursive & force handles both files and folders safely
      await fs.rm(itemPath, { recursive: true, force: true });
    }
    return {
        success: true,
        message: 'Directory cleaned successfully, .git folder preserved.',
    }
    
    console.log('Directory cleaned successfully. .git folder preserved.');
  } catch (error) {
    console.error('Error cleaning directory:', error);
    return {
        success: false,
        error: error.message,
    }
  }
}
,



}