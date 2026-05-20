const fs = require('fs');
const path = require('path');
const pool = require('./db');

const DISCUSSIONS_FILE = path.join(__dirname, '../data/discussions.json');

if (!fs.existsSync(path.dirname(DISCUSSIONS_FILE))) {
    fs.mkdirSync(path.dirname(DISCUSSIONS_FILE), { recursive: true });
}

if (!fs.existsSync(DISCUSSIONS_FILE)) {
    fs.writeFileSync(DISCUSSIONS_FILE, JSON.stringify([]));
}

const discussionStore = {
    


  async create(owner, repoName, title, description, author, sourceChannel, targetChannel) {
            await pool.query('BEGIN');
    const repoResult = await pool.query(
            `UPDATE repositories 
             SET discussion_counter = discussion_counter + 1 
             WHERE owner = $1 AND name = $2
             RETURNING discussion_counter`,
            [owner, repoName]
        );
    const nextId =(repoResult.rows[0].discussion_counter) ;    
    const prId = crypto.randomUUID();
    const finalSourceChannel = sourceChannel || `pr-${nextId}`;
    const finalTargetChannel = targetChannel || 'main';
    const now = new Date().toISOString();
    
    // Insert the new discussion
    await pool.query(
        `INSERT INTO discussions 
         (id, owner, repo_name, title, description, author, 
          source_channel, target_channel, status, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [prId, owner, repoName, title, description, author, 
         finalSourceChannel, finalTargetChannel, 'open', now, now]
    );
    await pool.query('COMMIT')
    // Return the created discussion
    return {
        id: prId,
        title: title,
        author: author,
        status: 'open',
        sourceChannel:finalSourceChannel,
      
    };
},

    async getByRepo(owner, repoName) {
    const result = await pool.query(
        `SELECT id, status, title, author
         FROM discussions
         WHERE owner = $1 AND repo_name = $2
         ORDER BY created_at DESC`,
        [owner, repoName]
    );
    
    return result.rows;
},

    

    async getById( id) {
    const result = await pool.query(
        `SELECT id, owner, repo_name as "repoName", title, description, author, 
                source_channel as "sourceChannel", target_channel as "targetChannel", 
                status, created_at as "createdAt", updated_at as "updatedAt"
         FROM discussions 
         WHERE id = $1`,
        [ id]
    );
    
    if (result.rows.length === 0) {
        return null;
    }
    
    const discussion = result.rows[0];
    
    // Get comments for this discussion
    const commentsResult = await pool.query(
        `SELECT id, author, text, created_at as "createdAt"
         FROM comments 
         WHERE discussion_id = $1 
         ORDER BY created_at ASC`,
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
        `INSERT INTO comments (id, discussion_id, author, text, created_at) 
         VALUES ($1, $2, $3, $4, $5)`,
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
