const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.POSTGRES_USER || "pijulserv",
  host: process.env.POSTGRES_HOST || "postgres",
  database: process.env.POSTGRES_DB || "pijulDB",
  password: process.env.POSTGRES_PASSWORD || "mysecretpassword",
  port: 5432,
});

// Test connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Initialize database tables
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Create tables if they don't exist
    await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
               
            )
        `);
    await client.query(`
     CREATE TABLE IF NOT EXISTS user_tokens (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(255) NOT NULL,
        git_enc_token VARCHAR(255),
        git_refresh_token VARCHAR(255),
        installation_id VARCHAR(255),
        expired_at TIMESTAMP NOT NULL
     );
   
    `);

    await client.query(`
            CREATE TABLE IF NOT EXISTS ssh_keys (
                id UUID PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                name VARCHAR(255),
                key TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await client.query(`
            CREATE TABLE IF NOT EXISTS repositories (
                id VARCHAR(20) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                owner VARCHAR(255) NOT NULL,
                is_private BOOLEAN DEFAULT false,
                discussion_counter INTEGER DEFAULT 0,
                protected_channels TEXT[] DEFAULT ARRAY['main'],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(owner, name)
            )
        `);

    await client.query(`
            CREATE TABLE IF NOT EXISTS collaborators (
                repository_id VARCHAR(20) REFERENCES repositories(id) ON DELETE CASCADE,
                username VARCHAR(255) NOT NULL,
                role VARCHAR(50) CHECK (role IN ('developer', 'maintainer')),
                PRIMARY KEY (repository_id, username)
            )
        `);

    await client.query(`
            CREATE TABLE IF NOT EXISTS discussions (
                id VARCHAR(50) PRIMARY KEY,
                owner VARCHAR(255) NOT NULL,
                repo_name VARCHAR(255) NOT NULL,
                title VARCHAR(255),
                description TEXT,
                author VARCHAR(255) NOT NULL,
                source_channel VARCHAR(255) NOT NULL,
                target_channel VARCHAR(255) NOT NULL,
                status VARCHAR(50) CHECK (status IN ('open', 'merged', 'closed')),
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

    await client.query(`
            CREATE TABLE IF NOT EXISTS comments (
                id VARCHAR(50) PRIMARY KEY,
                discussion_id VARCHAR(50) REFERENCES discussions(id) ON DELETE CASCADE,
                author VARCHAR(255) NOT NULL,
                text TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL
            )
        `);

    // Create indexes
    await client.query(`
            CREATE INDEX IF NOT EXISTS idx_user_tokens_username ON user_tokens(username);
            CREATE INDEX IF NOT EXISTS idx_repositories_owner ON repositories(owner);
            CREATE INDEX IF NOT EXISTS idx_repositories_name ON repositories(name);
            CREATE INDEX IF NOT EXISTS idx_discussions_owner_repo ON discussions(owner, repo_name);
            CREATE INDEX IF NOT EXISTS idx_discussions_author ON discussions(author);
            CREATE INDEX IF NOT EXISTS idx_discussions_status ON discussions(status);
            CREATE INDEX IF NOT EXISTS idx_comments_discussion ON comments(discussion_id);
            CREATE INDEX IF NOT EXISTS idx_ssh_keys_user ON ssh_keys(user_id);
        `);

    console.log("Database tables initialized");
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDatabase,
};
