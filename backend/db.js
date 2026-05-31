const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.POSTGRES_USER || "pijulserv",
  host: process.env.POSTGRES_HOST || "postgres",
  database: process.env.POSTGRES_DB || "pijulDB",
  password: process.env.POSTGRES_PASSWORD || "mysecretpassword",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

// Add these indexes and views inside the initDatabase function,
// after the existing indexes and before the COMMIT

async function createOptimizedIndexesAndViews(client) {
  // ============================================
  // SPECIALIZED INDEXES FOR REPOSITORY -> PATCHES QUERIES
  // ============================================

  // Composite index for fast lookup by repository and state
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_discussions_repo_state 
    ON discussions(repository_id, status)
    WHERE status IN ('open', 'in_review')
  `);

  // Index for joining discussions to commits with specific states
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_discussion_commits_state_repo 
    ON discussion_commits(discussion_id, state)
    WHERE state IN ('pijul_only_fetched', 'github_pijul_synced', 'github_only_fetched')
  `);

  // Critical index: Fast path from repository -> discussions -> commits -> patches
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_discussions_repo_status_created 
    ON discussions(repository_id, status, created_at DESC)
  `);

  // Composite index for patches lookup
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_patches_commit_hash 
    ON discussion_commit_patches(discussion_commit_id, pijul_patch_hash)
  `);

  // Index for repository name/ID lookups
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_repositories_name_id_active 
    ON repositories(name, id, is_archived) 
    WHERE is_archived = false
  `);

  // Full-text search index for repository names
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_repositories_name_trgm 
    ON repositories USING gin (name gin_trgm_ops)
  `);

  // ============================================
  // MATERIALIZED VIEW: Repository Patch Summary
  // ============================================
  await client.query(`
  CREATE MATERIALIZED VIEW IF NOT EXISTS mv_repo_patch_summary AS
  SELECT 
    r.id AS repository_id,
    r.name AS repository_name,
    r.owner_id,
    u.username AS owner_username,
    d.id AS discussion_id,
    d.title AS discussion_title,
    d.status AS discussion_status,
    dc.id AS commit_id,
    dc.state AS commit_state,
    dcp.commit_hash,
    COUNT(dcp.id) AS patch_count,
    ARRAY_AGG(DISTINCT dcp.pijul_patch_hash) AS patch_hashes,
    MAX(dcp.created_at) AS last_patch_at
  FROM repositories r
  INNER JOIN discussions d ON r.id = d.repository_id
  INNER JOIN discussion_commits dc ON d.id = dc.discussion_id
  LEFT JOIN discussion_commit_patches dcp ON dc.id = dcp.discussion_commit_id
  LEFT JOIN users u ON r.owner_id = u.id
  WHERE dc.state IN ('pijul_only_fetched', 'github_pijul_synced', 'github_only_fetched')
  GROUP BY r.id, r.name, r.owner_id, u.username, d.id, d.title, d.status, dc.id, dc.state, dcp.commit_hash
`);
  // Indexes on materialized view
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_repo_patch_summary_unique 
    ON mv_repo_patch_summary(repository_id, discussion_id, commit_id)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_repo_patch_repo_state 
    ON mv_repo_patch_summary(repository_id, commit_state)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_repo_patch_repo_name 
    ON mv_repo_patch_summary(repository_name, commit_state)
  `);

  // ============================================
  // MATERIALIZED VIEW: Fast Repository + Patches Lookup
  // ============================================
  await client.query(`
  CREATE MATERIALIZED VIEW IF NOT EXISTS mv_repo_patches_fast AS
  SELECT 
    r.id AS repo_id,
    r.name AS repo_name,
    r.owner_id AS repo_owner_id,
    dc.state AS commit_state,
    dc.id AS commit_id,
    dcp.commit_hash,
    dcp.id AS patch_id,
    dcp.pijul_patch_hash,
    dcp.created_at AS patch_created_at
  FROM repositories r
  INNER JOIN discussions d ON r.id = d.repository_id
  INNER JOIN discussion_commits dc ON d.id = dc.discussion_id
  INNER JOIN discussion_commit_patches dcp ON dc.id = dcp.discussion_commit_id
  WHERE dc.state IN ('pijul_only_fetched', 'github_pijul_synced')
    AND r.is_archived = false
`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_repo_patches_repo_state 
    ON mv_repo_patches_fast(repo_id, commit_state)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_repo_patches_repo_name 
    ON mv_repo_patches_fast(repo_name, commit_state)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_repo_patches_hash 
    ON mv_repo_patches_fast(pijul_patch_hash)
  `);

  // ============================================
  // MATERIALIZED VIEW: Repository Activity Dashboard
  // ============================================
  await client.query(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS mv_repo_dashboard AS
    SELECT 
      r.id AS repository_id,
      r.name AS repository_name,
      r.description,
      r.github_repo_name,
      u.username AS owner_username,
      COUNT(DISTINCT d.id) AS total_discussions,
      COUNT(DISTINCT CASE WHEN d.status = 'open' THEN d.id END) AS open_discussions,
      COUNT(DISTINCT CASE WHEN d.status = 'merged' THEN d.id END) AS merged_discussions,
      COUNT(DISTINCT dc.id) FILTER (WHERE dc.state = 'pijul_only_fetched') AS pijul_only_commits,
      COUNT(DISTINCT dc.id) FILTER (WHERE dc.state = 'github_pijul_synced') AS github_pijul_synced_commits,
      COUNT(DISTINCT dc.id) FILTER (WHERE dc.state = 'github_only_fetched') AS github_only_commits,
      COUNT(DISTINCT dcp.id) AS total_patches,
      COUNT(DISTINCT CASE WHEN dc.state = 'pijul_only_fetched' THEN dcp.id END) AS pijul_only_patches,
      COUNT(DISTINCT CASE WHEN dc.state = 'github_pijul_synced' THEN dcp.id END) AS github_pijul_synced_patches,
      MAX(d.updated_at) AS last_discussion_activity,
      MAX(dc.updated_at) AS last_commit_activity,
      MAX(dcp.created_at) AS last_patch_activity
    FROM repositories r
    LEFT JOIN users u ON r.owner_id = u.id
    LEFT JOIN discussions d ON r.id = d.repository_id
    LEFT JOIN discussion_commits dc ON d.id = dc.discussion_id
    LEFT JOIN discussion_commit_patches dcp ON dc.id = dcp.discussion_commit_id
    WHERE r.is_archived = false
    GROUP BY r.id, r.name, r.description, r.github_repo_name, u.username
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_repo_dashboard_id 
    ON mv_repo_dashboard(repository_id)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_repo_dashboard_name 
    ON mv_repo_dashboard(repository_name)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_mv_repo_dashboard_activity 
    ON mv_repo_dashboard(last_patch_activity DESC)
  `);

  // ============================================
  // FUNCTION: Fast repository patch lookup
  // ============================================
  await client.query(`
  CREATE OR REPLACE FUNCTION get_repo_patches(
    p_repo_id UUID DEFAULT NULL,
    p_repo_name VARCHAR DEFAULT NULL,
    p_state VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
  )
  RETURNS TABLE (
    repository_id UUID,
    repository_name VARCHAR,
    discussion_id UUID,
    discussion_title VARCHAR,
    commit_id UUID,
    commit_state VARCHAR,
    commit_hash VARCHAR,
    patch_id UUID,
    pijul_patch_hash VARCHAR,
    patch_created_at TIMESTAMPTZ
  ) AS $$
  BEGIN
    RETURN QUERY
    SELECT 
      r.id AS repository_id,
      r.name AS repository_name,
      d.id AS discussion_id,
      d.title AS discussion_title,
      dc.id AS commit_id,
      dc.state AS commit_state,
      dcp.commit_hash,
      dcp.id AS patch_id,
      dcp.pijul_patch_hash,
      dcp.created_at AS patch_created_at
    FROM repositories r
    INNER JOIN discussions d ON r.id = d.repository_id
    INNER JOIN discussion_commits dc ON d.id = dc.discussion_id
    INNER JOIN discussion_commit_patches dcp ON dc.id = dcp.discussion_commit_id
    WHERE (p_repo_id IS NULL OR r.id = p_repo_id)
      AND (p_repo_name IS NULL OR r.name ILIKE '%' || p_repo_name || '%')
      AND (p_state IS NULL OR dc.state = p_state)
      AND r.is_archived = false
    ORDER BY dcp.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
  END;
  $$ LANGUAGE plpgsql STABLE;
`);

  // ============================================
  // FUNCTION: Get repository stats with patch details
  // ============================================
  await client.query(`
    CREATE OR REPLACE FUNCTION get_repo_patch_stats(p_repo_id UUID)
    RETURNS TABLE (
      state VARCHAR,
      commit_count BIGINT,
      patch_count BIGINT,
      latest_patch_at TIMESTAMPTZ
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        dc.state,
        COUNT(DISTINCT dc.id) AS commit_count,
        COUNT(dcp.id) AS patch_count,
        MAX(dcp.created_at) AS latest_patch_at
      FROM discussions d
      INNER JOIN discussion_commits dc ON d.id = dc.discussion_id
      LEFT JOIN discussion_commit_patches dcp ON dc.id = dcp.discussion_commit_id
      WHERE d.repository_id = p_repo_id
        AND dc.state IN ('pijul_only_fetched', 'github_pijul_synced', 'github_only_fetched')
      GROUP BY dc.state
      ORDER BY dc.state;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `);
}

// Initialize database tables with callback pattern
async function initDatabase(callback) {
  const client = await pool.connect();

  try {
    // Execute all queries in a single transaction
    await client.query("BEGIN");

    // Enable extensions
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await client.query('CREATE EXTENSION IF NOT EXISTS "pg_trgm"');

    // ============================================
    // CREATE TABLES
    // ============================================
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        avatar_url TEXT,
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Organization table
    await client.query(`
       CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_name VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
   `);
    //organization members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
        PRIMARY KEY (organization_id, user_id)
      )
    `);
    
    // Git info table
  await client.query(`
  CREATE TABLE IF NOT EXISTS git_user_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pijul_username VARCHAR(255) UNIQUE NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'github' CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
    provider_username VARCHAR(255),
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_username)
  )
`);
     
        //Git organization identity
        await client.query(`
          CREATE TABLE IF NOT EXISTS git_organization_info (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            organization_name VARCHAR(255) UNIQUE NOT NULL,
            provider VARCHAR(50) NOT NULL DEFAULT 'github' CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
            provider_organization_username VARCHAR(255),
            installation_id VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(provider, provider_organization_username)


          )
        `);
    // SSH keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ssh_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        public_key TEXT NOT NULL,
        fingerprint VARCHAR(255),
        last_used_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Repositories table
 await client.query(`
  CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    description TEXT,
    discussion_counter INTEGER DEFAULT 0,
    default_branch VARCHAR(255) DEFAULT 'main',
    is_private BOOLEAN DEFAULT false,
    protected_channels TEXT[] DEFAULT ARRAY['main'],
    is_gitsync_enabled BOOLEAN DEFAULT false,
    github_repo_name VARCHAR(255),
    github_repo_id VARCHAR(255),
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT repo_owner_check CHECK (
      (owner_id IS NOT NULL AND organization_id IS NULL) OR
      (owner_id IS NULL AND organization_id IS NOT NULL)
    ),
    UNIQUE(owner, name)
  )
`);
    // Collaborators table
    await client.query(`
      CREATE TABLE IF NOT EXISTS collaborators (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL DEFAULT 'developer' CHECK (role IN ('owner', 'maintainer', 'developer', 'viewer')),
        permissions JSONB DEFAULT '{}',
        added_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(repository_id, user_id)
      )
    `);

    // Standard channels table (only long-term channels like main, dev)
    await client.query(`
      CREATE TABLE IF NOT EXISTS standard_channels (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        channel_name VARCHAR(255) NOT NULL,
        description TEXT,
        channel_type VARCHAR(50) NOT NULL DEFAULT 'standard' CHECK (channel_type IN ('standard', 'protected', 'archived')),
        is_default BOOLEAN DEFAULT false,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(repository_id, channel_name)
      )
    `);

    // Channel git map table (maps standard channels to git branches)
    await client.query(`
      CREATE TABLE IF NOT EXISTS channel_git_map (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        channel_id UUID NOT NULL REFERENCES standard_channels(id) ON DELETE CASCADE,
        repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        git_branch_name VARCHAR(255) NOT NULL,
        sync_enabled BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel_id),
        UNIQUE(repository_id, git_branch_name)
      )
    `);

    // Discussions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discussions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        author_id UUID NOT NULL REFERENCES users(id),
        source_channel_id VARCHAR(255) NOT NULL,
        target_channel_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'in_review', 'merged', 'closed', 'archived')),
        priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Discussion commits table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discussion_commits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
       
        state VARCHAR(50) NOT NULL DEFAULT 'github_only_fetched' CHECK (
          state IN (
            'local_draft',
            'github_only_fetched',
            'github_pijul_synced',
            'pijul_only_fetched',
            'pijul_github_synced',
            'conflict_detected',
            'failed'
          )
        ),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Discussion commit patches table
    await client.query(`
      CREATE TABLE IF NOT EXISTS discussion_commit_patches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        discussion_commit_id UUID NOT NULL REFERENCES discussion_commits(id) ON DELETE CASCADE,
        pijul_patch_hash VARCHAR(255) NOT NULL ,
        commit_hash VARCHAR(255),
        commit_message TEXT,
        commit_author VARCHAR(255),
        commit_timestamp TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(discussion_commit_id, pijul_patch_hash)
      )
    `);

    // Comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        discussion_id UUID NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id),
        parent_comment_id UUID REFERENCES comments(id),
        text TEXT NOT NULL,
        is_edited BOOLEAN DEFAULT false,
        is_resolved BOOLEAN DEFAULT false,
        resolved_by UUID REFERENCES users(id),
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // issues table
    await client.query(`
      CREATE TABLE IF NOT EXISTS issues (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        repository_id       UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        github_issue_id     BIGINT UNIQUE,
        github_issue_number INTEGER,
        discussion_id       UUID REFERENCES discussions(id) ON DELETE SET NULL,
        title               VARCHAR(500) NOT NULL,
        body                TEXT,
        author_id           UUID REFERENCES users(id),
        github_author_login VARCHAR(255),
        status              VARCHAR(50) NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','closed','in_progress','wont_fix','duplicate')),
        assignees           TEXT[] DEFAULT ARRAY[]::TEXT[],
        labels              TEXT[] DEFAULT ARRAY[]::TEXT[],
        github_url          TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // issue_comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS issue_comments (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        issue_id            UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
        github_comment_id   BIGINT UNIQUE,
        author_id           UUID REFERENCES users(id),
        github_author_login VARCHAR(255),
        body                TEXT NOT NULL,
        is_edited           BOOLEAN DEFAULT false,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    
    // Activity log table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        action_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID NOT NULL,
        old_data JSONB,
        new_data JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
        DO $$
        DECLARE
          tbl RECORD;
        BEGIN
          FOR tbl IN 
            SELECT table_name 
            FROM information_schema.columns 
            WHERE column_name = 'updated_at' 
              AND table_schema = 'public'
          LOOP
            EXECUTE format('
              DROP TRIGGER IF EXISTS update_%s_updated_at ON %I;
              CREATE TRIGGER update_%s_updated_at
              BEFORE UPDATE ON %I
              FOR EACH ROW
              EXECUTE FUNCTION update_updated_at_column();
            ', tbl.table_name, tbl.table_name, tbl.table_name, tbl.table_name);
          END LOOP;
        END;
        $$;
      `);
    // ============================================
    // CREATE BASIC INDEXES
    // ============================================
    
    const indexes = [
      // Users indexes
      `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = true`,
      
      // Organization indexes
      `CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(organization_name)`,
      `CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_org_members_org_role ON organization_members(organization_id, role)`,
      
      // Git user info indexes
      `CREATE INDEX IF NOT EXISTS idx_git_user_info_user_provider ON git_user_info(user_id, provider)`,
      `CREATE INDEX IF NOT EXISTS idx_git_user_info_pijul_username ON git_user_info(pijul_username)`,
      `CREATE INDEX IF NOT EXISTS idx_git_user_info_provider_username ON git_user_info(provider_username) WHERE provider_username IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_git_user_info_token_expires ON git_user_info(token_expires_at)`,
      
      // Git organization info indexes
      `CREATE INDEX IF NOT EXISTS idx_git_org_info_org ON git_organinzation_info(organization_id)`,
      `CREATE INDEX IF NOT EXISTS idx_git_org_info_org_name ON git_organinzation_info(organization_name)`,
      `CREATE INDEX IF NOT EXISTS idx_git_org_info_provider ON git_organinzation_info(provider, provider_organinzation_username)`,
      `CREATE INDEX IF NOT EXISTS idx_git_org_info_installation ON git_organinzation_info(installation_id) WHERE installation_id IS NOT NULL`,
      
      // SSH keys indexes
      `CREATE INDEX IF NOT EXISTS idx_ssh_keys_user_active ON ssh_keys(user_id, is_active) WHERE is_active = true`,
      `CREATE INDEX IF NOT EXISTS idx_ssh_keys_fingerprint ON ssh_keys(fingerprint) WHERE fingerprint IS NOT NULL`,
      
      // Repository indexes
      `CREATE INDEX IF NOT EXISTS idx_repositories_owner ON repositories(owner)`,
      `CREATE INDEX IF NOT EXISTS idx_repositories_owner_id ON repositories(owner_id) WHERE owner_id IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_repositories_org ON repositories(organization_id) WHERE organization_id IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_repositories_name ON repositories(name)`,
      `CREATE INDEX IF NOT EXISTS idx_repositories_github ON repositories(github_repo_name) WHERE github_repo_name IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_repositories_created ON repositories(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_repositories_gitsync ON repositories(is_gitsync_enabled) WHERE is_gitsync_enabled = true`,
      
      // Collaborator indexes
      `CREATE INDEX IF NOT EXISTS idx_collaborators_user ON collaborators(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_collaborators_repo_role ON collaborators(repository_id, role)`,
      
      // Standard channels indexes
      `CREATE INDEX IF NOT EXISTS idx_standard_channels_repo ON standard_channels(repository_id)`,
      `CREATE INDEX IF NOT EXISTS idx_standard_channels_repo_type ON standard_channels(repository_id, channel_type)`,
      `CREATE INDEX IF NOT EXISTS idx_standard_channels_name ON standard_channels(channel_name)`,
      
      // Channel git map indexes
      `CREATE INDEX IF NOT EXISTS idx_channel_git_map_channel ON channel_git_map(channel_id)`,
      `CREATE INDEX IF NOT EXISTS idx_channel_git_map_branch ON channel_git_map(git_branch_name)`,
      `CREATE INDEX IF NOT EXISTS idx_channel_git_map_repo_branch ON channel_git_map(repository_id, git_branch_name)`,
      
      // Discussion indexes
      `CREATE INDEX IF NOT EXISTS idx_discussions_repository ON discussions(repository_id)`,
      `CREATE INDEX IF NOT EXISTS idx_discussions_author ON discussions(author_id)`,
      `CREATE INDEX IF NOT EXISTS idx_discussions_status ON discussions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_discussions_status_created ON discussions(status, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_discussions_source_channel ON discussions(source_channel_id)`,
      `CREATE INDEX IF NOT EXISTS idx_discussions_target_channel ON discussions(target_channel_id)`,
      
      // Commit indexes
      `CREATE INDEX IF NOT EXISTS idx_discussion_commits_discussion ON discussion_commits(discussion_id)`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_commits_state ON discussion_commits(state)`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_commits_disc_state ON discussion_commits(discussion_id, state)`,
      
      // Patch indexes
      `CREATE INDEX IF NOT EXISTS idx_discussion_patches_commit ON discussion_commit_patches(discussion_commit_id)`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_patches_hash ON discussion_commit_patches(pijul_patch_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_patches_commit_hash ON discussion_commit_patches(commit_hash) WHERE commit_hash IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_patches_commit_author ON discussion_commit_patches(commit_author) WHERE commit_author IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_discussion_patches_commit_timestamp ON discussion_commit_patches(commit_timestamp DESC) WHERE commit_timestamp IS NOT NULL`,
      
      // Comment indexes
      `CREATE INDEX IF NOT EXISTS idx_comments_discussion_created ON comments(discussion_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL`,
      
      // Activity log indexes
      `CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC)`,
      
      // Issues and issue_comments indexes
      `CREATE INDEX IF NOT EXISTS idx_issues_repository    ON issues(repository_id)`,
      `CREATE INDEX IF NOT EXISTS idx_issues_github_id     ON issues(github_issue_id) WHERE github_issue_id IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_issues_discussion    ON issues(discussion_id)   WHERE discussion_id IS NOT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_issues_status        ON issues(status)`,
      `CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id)`,
      `CREATE INDEX IF NOT EXISTS idx_issue_comments_gh_id ON issue_comments(github_comment_id) WHERE github_comment_id IS NOT NULL`,
    ];

    for (const indexQuery of indexes) {
      await client.query(indexQuery);
    }

    // ============================================
    // CREATE OPTIMIZED INDEXES AND VIEWS
    // ============================================
    await createOptimizedIndexesAndViews(client);

    // ============================================
    // CREATE MATERIALIZED VIEW FOR REPOSITORY STATS
    // ============================================
    await client.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_repository_stats AS
      SELECT 
        r.id,
        r.name,
        r.description,
        r.owner,
        u.username as owner_username,
        COUNT(DISTINCT d.id) as total_discussions,
        COUNT(DISTINCT CASE WHEN d.status = 'open' THEN d.id END) as open_discussions,
        COUNT(DISTINCT CASE WHEN d.status = 'merged' THEN d.id END) as merged_discussions,
        COUNT(DISTINCT c.user_id) as collaborator_count,
        COUNT(DISTINCT sc.id) as standard_channel_count,
        MAX(d.updated_at) as last_activity_at
      FROM repositories r
      LEFT JOIN users u ON r.owner_id = u.id
      LEFT JOIN discussions d ON r.id = d.repository_id
      LEFT JOIN collaborators c ON r.id = c.repository_id
      LEFT JOIN standard_channels sc ON r.id = sc.repository_id
      GROUP BY r.id, r.name, r.description, r.owner, u.username
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_repository_stats_id ON mv_repository_stats(id)
    `);


    // const tablesWithTriggers = [
    //   'users', 'git_info', 'ssh_keys', 'repositories',
    //   'collaborators', 'standard_channels', 'channel_git_map',
    //   'discussions', 'discussion_commits', 'comments',
    //   'issues', 'issue_comments'   // <-- add these two
    // ];


    // Commit the transaction
    await client.query("COMMIT");

    console.log(
      "Database schema initialized successfully with standard_channels for long-term channels",
    );

    if (callback && typeof callback === "function") {
      callback(null, {
        success: true,
        message: "Database initialization completed successfully",
        timestamp: new Date().toISOString(),
      });
    }

    return { success: true, message: "Database initialized" };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error initializing database:", error);

    if (callback && typeof callback === "function") {
      callback(error, {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    throw error;
  } finally {
    client.release();
  }
}

// Enhanced query function with retry logic
async function query(text, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      if (i === retries - 1) throw error;
      console.warn(`Query attempt ${i + 1} failed, retrying...`, error.message);
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Helper function to refresh materialized views
async function refreshMaterializedViews(callback) {
  const client = await pool.connect();
  try {
    await client.query(
      "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_repository_stats",
    );
    await client.query(
      "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_repo_patch_summary",
    );
    await client.query(
      "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_repo_patches_fast",
    );
    await client.query(
      "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_repo_dashboard",
    );
    console.log("Materialized views refreshed");

    if (callback && typeof callback === "function") {
      callback(null, {
        success: true,
        message: "Materialized views refreshed",
      });
    }
  } catch (error) {
    console.error("Error refreshing materialized views:", error);
    if (callback && typeof callback === "function") {
      callback(error, { success: false, message: error.message });
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  query,
  pool,
  initDatabase,
  refreshMaterializedViews,
  dbUtils,
  queryHelpers,
};
