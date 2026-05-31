const fs = require('fs');
const path = require('path');
const pool = require('./db');
const crypto = require('crypto');
const DISCUSSIONS_FILE = path.join(__dirname, '../data/discussions.json');

if (!fs.existsSync(path.dirname(DISCUSSIONS_FILE))) {
    fs.mkdirSync(path.dirname(DISCUSSIONS_FILE), { recursive: true });
}

if (!fs.existsSync(DISCUSSIONS_FILE)) {
    fs.writeFileSync(DISCUSSIONS_FILE, JSON.stringify([]));
}

const discussionStore = {
    


async create(owner, repoName, title, description, author, sourceChannel, targetChannel, priority = 'medium') {
  await pool.query('BEGIN');
  
  const repoResult = await pool.query(
    `UPDATE repositories 
     SET discussion_counter = discussion_counter + 1 
     WHERE owner = $1 AND name = $2
     RETURNING discussion_counter`,
    [owner, repoName]
  );
  
  const nextId = repoResult.rows[0].discussion_counter;
  const prId = crypto.randomUUID();
  
  let finalSourceChannel;
  if (sourceChannel === 'git') {
    finalSourceChannel = `git-pr-${nextId}`;
  } else if (sourceChannel) {
    finalSourceChannel = sourceChannel;
  } else {
    finalSourceChannel = `pr-${nextId}`;
  }

  const finalTargetChannel = targetChannel || 'main';
  const now = new Date().toISOString();
  
  // Insert the new discussion with priority
  await pool.query(
    `INSERT INTO discussions 
     (id, repository_id, title, description, author_id, 
      source_channel_id, target_channel_id, status, priority, created_at, updated_at) 
     VALUES ($1, (SELECT id FROM repositories WHERE owner = $2 AND name = $3), $4, $5, (SELECT id FROM users WHERE username = $6), $7, $8, $9, $10, $11, $12)`,
    [prId, owner, repoName, title, description, author, 
     finalSourceChannel, finalTargetChannel, 'open', priority, now, now]
  );
  
  await pool.query('COMMIT');
  
  // Return the created discussion
  return {
    id: prId,
    title: title,
    author: author,
    status: 'open',
    sourceChannel: finalSourceChannel,
    targetChannel: finalTargetChannel,
    priority: priority
  };
},
async createDiscussionCommit({discussionId, state = 'github_only_fetched'}) {
  try {
    const result = await pool.query(
      `INSERT INTO discussion_commits 
       (id, discussion_id, state, created_at, updated_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, discussion_id, state, created_at`,
      [
        require('crypto').randomUUID(),
        discussionId,
        state
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating discussion commit:', error);
    throw new Error(`Failed to create discussion commit: ${error.message}`);
  }
},
async createDiscussionCommitPatch({discussionCommitId, pijulPatchHash, commitHash, commitMessage, commitAuthor, commitTimestamp}) {
  try {
    const result = await pool.query(
      `INSERT INTO discussion_commit_patches 
       (id, discussion_commit_id, pijul_patch_hash, commit_hash, commit_message, commit_author, commit_timestamp, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (discussion_commit_id, pijul_patch_hash) DO NOTHING
       RETURNING id, discussion_commit_id, pijul_patch_hash, commit_hash, created_at`,
      [
        require('crypto').randomUUID(),
        discussionCommitId,
        pijulPatchHash,
        commitHash || null,
        commitMessage || null,
        commitAuthor || null,
        commitTimestamp || null
      ]
    );
    
    return result.rows[0] || null; // Returns null if duplicate (DO NOTHING)
  } catch (error) {
    console.error('Error creating discussion commit patch:', error);
    throw new Error(`Failed to create discussion commit patch: ${error.message}`);
  }
},
async createDiscussionCommitPatch({discussionCommitId, pijulPatchHash, commitHash, commitMessage, commitAuthor, commitTimestamp}) {
  try {
    const result = await pool.query(
      `INSERT INTO discussion_commit_patches 
       (id, discussion_commit_id, pijul_patch_hash, commit_hash, commit_message, commit_author, commit_timestamp, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (discussion_commit_id, pijul_patch_hash) DO UPDATE SET
         commit_hash = EXCLUDED.commit_hash,
         commit_message = EXCLUDED.commit_message,
         commit_author = EXCLUDED.commit_author,
         commit_timestamp = EXCLUDED.commit_timestamp
       RETURNING id, discussion_commit_id, pijul_patch_hash, commit_hash, created_at`,
      [
        require('crypto').randomUUID(),
        discussionCommitId,
        pijulPatchHash,
        commitHash || null,
        commitMessage || null,
        commitAuthor || null,
        commitTimestamp || null
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating discussion commit patch:', error);
    throw new Error(`Failed to create discussion commit patch: ${error.message}`);
  }
},
    async getByRepo(owner, repoName,page,limit) {
        const offset=(page-1)*limit;
    const result = await pool.query(
    `SELECT d.id, d.status, d.title, u.username as author
     FROM discussions d
     JOIN users u ON d.author_id = u.id
     WHERE d.repository_id = (SELECT id FROM repositories WHERE owner = $1 AND name = $2)
     ORDER BY d.created_at DESC
     LIMIT $3 OFFSET $4`,
    [owner, repoName, limit, offset]
);
    return result.rows;
},

    

    async getById( id) {
   const result = await pool.query(
    `SELECT d.id, r.owner, r.name as "repoName", d.title, d.description, u.username as author, 
            d.source_channel_id as "sourceChannel", d.target_channel_id as "targetChannel", 
            d.status, d.created_at as "createdAt", d.updated_at as "updatedAt"
     FROM discussions d
     JOIN repositories r ON d.repository_id = r.id
     JOIN users u ON d.author_id = u.id
     WHERE d.id = $1`,
    [id]
);
    
    
    if (result.rows.length === 0) {
        return null;
    }
    
    const discussion = result.rows[0];
    
    // Get comments for this discussion
   const commentsResult = await pool.query(
    `SELECT c.id, u.username as author, c.text, c.created_at as "createdAt"
     FROM comments c
     JOIN users u ON c.author_id = u.id
     WHERE c.discussion_id = $1 
     ORDER BY c.created_at ASC`,
    [id]
);
    
    // Return discussion with comments
    return {
        id: discussion.id,
        owner: discussion.owner,
        repoName: discussion.repoName,
        title: discussion.title,
        description: discussion.description,
        author: discussion.author,
        sourceChannel: discussion.sourceChannel,
        targetChannel: discussion.targetChannel,
        status: discussion.status,
        comments: commentsResult.rows.map(comment => ({
            id: comment.id,
            author: comment.author,
            text: comment.text,
            createdAt: comment.createdAt
        })),
        createdAt: discussion.createdAt,
        updatedAt: discussion.updatedAt
    };
},

    async addComment( id, author, text) {
    // First, check if discussion exists
    const discussionResult = await pool.query(
        'SELECT id FROM discussions WHERE  id = $1',
        [ id]
    );
    
    if (discussionResult.rows.length === 0) {
        throw new Error('Discussion not found');
    }
    
    const commentId = Date.now().toString();
    const now = new Date().toISOString();
    
    // Insert the comment
  await pool.query(
    `INSERT INTO comments (id, discussion_id, author_id, text, created_at) 
     VALUES ($1, $2, (SELECT id FROM users WHERE username = $3), $4, $5)`,
    [commentId, id, author, text, now]
);
    
    // Update the discussion's updated_at timestamp
    await pool.query(
        'UPDATE discussions SET updated_at = $1 WHERE id = $2',
        [now, id]
    );
    
    // Return the updated discussion with all comments
    return await this.getById( id);
},

    async updateStatus(id, status) {
    await pool.query(
        `UPDATE discussions 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE  id = $2`,
        [status, id]
    );
},
   async removedCompletely( id) {

    await pool.query(
        'DELETE FROM discussions WHERE  id = $1',
        [ id]
    );
    
    return { success: true, message: `Discussion ${id} removed completely` };
}
};

module.exports = discussionStore;
