const fs = require('fs');
const path = require('path');
const pool = require('./db');

const REPOS_PATH = path.join(__dirname,process.env.PIJUL_REPO_PATH || '../repos/pijul_repos');

const repoStore = {
    async getByOwnerAndName(owner, name) {
    const result = await pool.query(
        `SELECT id, name, owner, is_private, created_at 
         FROM repositories 
         WHERE owner = $1 AND name = $2`,
        [owner, name]
    );
    
    if (result.rows.length === 0) {
        return null;
    }
    
    const repo = result.rows[0];
    
    // Get collaborators for this repository
    
    // Format to match the old structure
    return {
        id: repo.id,
        name: repo.name,
        owner: repo.owner,
        isPrivate: repo.is_private,
        createdAt: repo.created_at
    };
},
 
    async create(name, owner, isPrivate = false,isGitsyncEnabled = false) {
    const repoId = Math.random().toString(36).substring(2, 10);
    // Insert the repository
    await pool.query(
        `INSERT INTO repositories (id, name, owner, is_private, is_gitsync_enabled, protected_channels, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [repoId, name, owner, isPrivate, isGitsyncEnabled, ['main'], new Date().toISOString()]
    );
    
    // Return the created repository (matching old format)
    return {
        id: repoId,
        name: name,
        owner: owner,
        isPrivate: isPrivate,
        isGitsyncEnabled: isGitsyncEnabled,
        collaborators: [],
        protectedChannels: ['main'],
        createdAt: new Date().toISOString()
    };
   },

    async getUserRole(owner, name, username,repoId=null) {
    // First, get the repository
     ;
       let isPrivate=null;
      if (!repoId){
        // Get the repository from database
        const repoResult = await pool.query(
            'SELECT id,is_private as "isPrivate" FROM repositories WHERE owner = $1 AND name = $2',
            [owner, name]
        );
        
        if (repoResult.rows.length === 0) {
            return null; // Repository not found
        }

        repoId = repoResult.rows[0].id;
        isPrivate=repoResult.rows[0].isPrivate;
      }
      
      if(owner === username) {
          return 'owner';
        }
 const collabResult = await pool.query(
    'SELECT role FROM collaborators WHERE repository_id = $1 AND user_id = (SELECT id FROM users WHERE username = $2)',
    [repoId, username]
);    
         if(collabResult.rows.length!=0){
           return collabResult.rows[0].role
         }
    

    // Default for public repos
         return isPrivate ? null : 'viewer';
},

// Get dashboard repositories (4 personal + 4 collaborated + 4 public)
async getVisible(username) {
    // Get 4 personal repositories (owned by user)
    const personalResult = await pool.query(
        `SELECT 
            id,
            name, 
            owner, 
            is_private as "isPrivate", 
            created_at as "createdAt",
            'personal' as "type",
            false as "isCollaborated"
         FROM repositories
         WHERE owner = $1
         ORDER BY created_at DESC
         LIMIT 4`,
        [username]
    );
    
    // Get 4 collaborated repositories (user has access to but doesn't own)
const collabResult = await pool.query(
    `SELECT 
        r.id,
        r.name, 
        r.owner, 
        r.is_private as "isPrivate", 
        r.created_at as "createdAt",
        'collaborated' as "type",
        true as "isCollaborated",
        c.role
     FROM repositories r
     JOIN collaborators c ON r.id = c.repository_id
     JOIN users u ON c.user_id = u.id
     WHERE u.username = $1 AND r.owner != $1
     ORDER BY r.created_at DESC
     LIMIT 4`,
    [username]
);
    // Get 4 public repositories (not owned by user, not collaborated)
 const publicResult = await pool.query(
    `SELECT 
        r.id,
        r.name, 
        r.owner, 
        r.is_private as "isPrivate", 
        r.created_at as "createdAt",
        'public' as "type",
        false as "isCollaborated"
     FROM repositories r
     WHERE 
        r.is_private = false 
        AND r.owner != $1
        AND NOT EXISTS (
            SELECT 1 FROM collaborators c
            JOIN users u ON c.user_id = u.id
            WHERE c.repository_id = r.id 
            AND u.username = $1
        )
     ORDER BY r.created_at DESC
     LIMIT 4`,
    [username]
);
    // Combine all results
    const allRepos = [
        ...personalResult.rows,
        ...collabResult.rows,
        ...publicResult.rows
    ];
    
    return allRepos;
}
,async getPersonalRepos(username, page = 1, limit = 4) {
    const offset = (page - 1) * limit;
    
    const countResult = await pool.query(
        `SELECT COUNT(*) as total
         FROM repositories
         WHERE owner = $1`,
        [username]
    );
    
    const total = parseInt(countResult.rows[0].total);
    
    const result = await pool.query(
        `SELECT 
            id,
            name, 
            owner, 
            is_private as "isPrivate", 
            created_at as "createdAt"
         FROM repositories
         WHERE owner = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [username, limit, offset]
    );
    
    return {
        repositories: result.rows,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit,
            hasNext: offset + limit < total,
            hasPrev: page > 1
        }
    };
},
async getCollabRepos(username, page = 1, limit = 4) {
    const offset = (page - 1) * limit;
   const countResult = await pool.query(
    `SELECT COUNT(*) as total
     FROM repositories r
     JOIN collaborators c ON r.id = c.repository_id
     JOIN users u ON c.user_id = u.id
     WHERE u.username = $1 AND r.owner != $1`,
    [username]
);
    
    const total = parseInt(countResult.rows[0].total);
    
   const result = await pool.query(
    `SELECT 
        r.id,
        r.name, 
        r.owner, 
        r.is_private as "isPrivate", 
        r.created_at as "createdAt",
        c.role
     FROM repositories r
     JOIN collaborators c ON r.id = c.repository_id
     JOIN users u ON c.user_id = u.id
     WHERE u.username = $1 AND r.owner != $1
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [username, limit, offset]
);
    return {
        repositories: result.rows,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit,
            hasNext: offset + limit < total,
            hasPrev: page > 1
        }
    };
},
async getPublicRepos(username, page = 1, limit = 4) {
    const offset = (page - 1) * limit;
    const countResult = await pool.query(
    `SELECT COUNT(*) as total
     FROM repositories r
     WHERE 
        r.is_private = false 
        AND r.owner != $1
        AND NOT EXISTS (
            SELECT 1 FROM collaborators c
            JOIN users u ON c.user_id = u.id
            WHERE c.repository_id = r.id 
            AND u.username = $1
        )`,
    [username]
);
    
    const total = parseInt(countResult.rows[0].total);
    
   const result = await pool.query(
    `SELECT 
        r.id,
        r.name, 
        r.owner, 
        r.is_private as "isPrivate", 
        r.created_at as "createdAt"
     FROM repositories r
     WHERE 
        r.is_private = false 
        AND r.owner != $1
        AND NOT EXISTS (
            SELECT 1 FROM collaborators c
            JOIN users u ON c.user_id = u.id
            WHERE c.repository_id = r.id 
            AND u.username = $1
        )
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [username, limit, offset]
);
    
    return {
        repositories: result.rows,
        pagination: {
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalItems: total,
            itemsPerPage: limit,
            hasNext: offset + limit < total,
            hasPrev: page > 1
        }
    };
},

    async canAccess(owner, name, username, requiredLevel = 'read',repoId) {
        const role =await  this.getUserRole(owner, name, username,repoId);
       
        if (!role) return false;

        const levels = {
            'read': ['owner', 'maintainer', 'developer', 'viewer'],
            'unprotectedwrite':['owner', 'maintainer', 'developer'],
            'allwrite': ['owner', 'maintainer'],
            'manage': ['owner', 'maintainer'],
            'delete': ['owner']
        };

        return levels[requiredLevel].includes(role);
    },

    async  addCollaborator(owner, name, username, role = 'developer', repoId = null) {
   
    
    // Use existing repo if provided, otherwise fetch it
    if(!repoId){
        const repoResult = await pool.query(
            'SELECT id FROM repositories WHERE owner = $1 AND name = $2',
            [owner, name]
        );
        
        if (repoResult.rows.length === 0) {
            throw new Error('Repository not found');
        }
        repoId = repoResult.rows[0].id;
    }
    
     
    
    // Check if collaborator already exists
 const existingCollab = await pool.query(
    'SELECT role FROM collaborators WHERE repository_id = $1 AND user_id = (SELECT id FROM users WHERE username = $2)',
    [repoId, username]
);
    
    if (existingCollab.rows.length > 0) {
        // Update existing collaborator's role
       await pool.query(
    'UPDATE collaborators SET role = $1 WHERE repository_id = $2 AND user_id = (SELECT id FROM users WHERE username = $3)',
    [role, repoId, username]
);
    } else {
        // Add new collaborator
      await pool.query(
    'INSERT INTO collaborators (repository_id, user_id, role) VALUES ($1, (SELECT id FROM users WHERE username = $2), $3)',
    [repoId, username, role]
);
    }
    
    }
,
    async getCollaborators(owner,name,repoId){
        if(!repoId){
            repoId=(await this.getByOwnerAndName(owner,name)).id
        }
const collabResult = await pool.query(
    'SELECT u.username, c.role FROM collaborators c JOIN users u ON c.user_id = u.id WHERE c.repository_id = $1',
    [repoId]
);
        return collabResult.rows;

    },
    async removeCollaborator(owner, name, username, repoId = null) {
    
    try {
        // Use existing repo if provided, otherwise fetch it
        if (!repoId) {
            const repoResult = await pool.query(
                'SELECT id, owner FROM repositories WHERE owner = $1 AND name = $2',
                [owner, name]
            );
            
            if (repoResult.rows.length === 0) {
                throw new Error(`Repository '${owner}/${name}' not found`);
            }
            repoId = repoResult.rows[0].id;
        }
        
        // Prevent removing the owner
        if (username === owner) {
            throw new Error('Cannot remove repository owner as collaborator');
        }
        
        // Delete the collaborator
      const result = await pool.query(
    'DELETE FROM collaborators WHERE repository_id = $1 AND user_id = (SELECT id FROM users WHERE username = $2) RETURNING user_id, role',
    [repoId, username]
);
        
        if (result.rows.length === 0) {
            console.log(`Collaborator '${username}' was not a collaborator of '${owner}/${name}'`);
        } else {
            console.log(`Removed collaborator '${username}' with role '${result.rows[0].role}' from '${owner}/${name}'`);
        }
        
    } catch (error) {
        console.error('Error removing collaborator:', error);
        throw error;
    }
    

},
    async getProtectedCh(repoId) {
           const result = await pool.query(
               'SELECT protected_channels FROM repositories WHERE id = $1',
               [repoId]
           );
           
           if (result.rows.length === 0) {
               throw new Error('Repository not found');
           }
           
           return result.rows[0].protected_channels || [];
     }
,

    async toggleProtectedChannel(owner, name, channel, repoId = null) {
    
    // Use existing repo if provided, otherwise fetch it
    if(!repoId) {
        const repoResult = await pool.query(
            'SELECT id, protected_channels FROM repositories WHERE owner = $1 AND name = $2',
            [owner, name]
        );
        
        if (repoResult.rows.length === 0) {
            throw new Error('Repository not found');
        }
        repoId = repoResult.rows[0].id;
    }
    
    
    let protectedChannels = this.getProtectedCh(repoId);
    
    // Toggle the channel
    const idx = protectedChannels.indexOf(channel);
    if (idx === -1) {
        protectedChannels.push(channel);
    } else {
        protectedChannels.splice(idx, 1);
    }
    
    // Update the database
    await pool.query(
        'UPDATE repositories SET protected_channels = $1 WHERE id = $2',
        [protectedChannels, repoId]
    );
    
   
    return ;
},

    

    async delete(owner, repoName) {
    // First, get the repository to ensure it exists and get its ID
    const repoResult = await pool.query(
        'SELECT id FROM repositories WHERE owner = $1 AND name = $2',
        [owner, repoName]
    );
    
    if (repoResult.rows.length === 0) {
        throw new Error(`Repository '${owner}/${repoName}' not found`);
    }
    
    const repoId = repoResult.rows[0].id;
    
    // Delete from database (cascading will delete collaborators automatically)
    await pool.query(
        'DELETE FROM repositories WHERE id = $1',
        [repoId]
    );
    
    // Delete the physical repository files
    const fullPath = path.join(REPOS_PATH, owner, repoName);
    if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`SSH: Deleted repository files at ${fullPath}`);
    }
    
    // Clear any cached data for this repository
    if (clearRepoCache) {
        clearRepoCache(owner, repoName);
    }
    
    return { success: true, message: `Repository '${owner}/${repoName}' deleted successfully` };
}
};

module.exports = repoStore;
