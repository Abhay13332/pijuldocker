const { pool } = require("../db");
const { gitStore } = require("./gitStore");

// ---------------------------------------------------------------------------
// Status mapping
//
// GitHub only has two native issue states: "open" and "closed".
// Our richer local statuses map to GitHub via labels on push,
// and we derive our local status from those labels on pull.
// ---------------------------------------------------------------------------
const STATUS_TO_GITHUB_LABEL = {
  in_progress: "in progress",
  wont_fix:    "wont fix",
  duplicate:   "duplicate",
  // 'open' and 'closed' are native GitHub states, not labels
};

const GITHUB_LABEL_TO_STATUS = Object.fromEntries(
  Object.entries(STATUS_TO_GITHUB_LABEL).map(([k, v]) => [v, k])
);

// Derive our local status from a GitHub issue payload.
// GitHub state is "open" or "closed"; our extra statuses live in labels.
function deriveLocalStatus(githubState, githubLabels = []) {
  if (githubState === "closed") return "closed";
  const labelNames = githubLabels.map((l) => l.name.toLowerCase());
  for (const [label, localStatus] of Object.entries(GITHUB_LABEL_TO_STATUS)) {
    if (labelNames.includes(label)) return localStatus;
  }
  return "open";
}

// Map our local status back to the GitHub state + any label we need to apply.
// Returns { githubState: "open"|"closed", labelToAdd: string|null, labelsToRemove: string[] }
function deriveGithubState(localStatus) {
  if (localStatus === "closed") {
    return { githubState: "closed", labelToAdd: null, labelsToRemove: [] };
  }
  const labelToAdd = STATUS_TO_GITHUB_LABEL[localStatus] || null;
  // Remove all managed labels except the one we're adding
  const labelsToRemove = Object.values(STATUS_TO_GITHUB_LABEL).filter(
    (l) => l !== labelToAdd
  );
  return { githubState: "open", labelToAdd, labelsToRemove };
}

// ---------------------------------------------------------------------------
// Schema helpers (idempotent — safe to call on every startup)
// ---------------------------------------------------------------------------
const gitIssueStore = {

  // -------------------------------------------------------------------------
  // DB helpers
  // -------------------------------------------------------------------------

  // Upsert an issue row keyed on github_issue_id.
  // Returns the full stored row.
  async storeIssue({
    repositoryId,
    githubIssueId,
    githubIssueNumber,
    discussionId = null,
    title,
    body = null,
    authorId = null,
    githubAuthorLogin = null,
    status = "open",
    assignees = [],
    labels = [],
    githubUrl = null,
  }) {
    const result = await pool.query(
      `
      INSERT INTO issues (
        repository_id, github_issue_id, github_issue_number,
        discussion_id, title, body,
        author_id, github_author_login,
        status, assignees, labels, github_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (github_issue_id) DO UPDATE SET
        title               = EXCLUDED.title,
        body                = EXCLUDED.body,
        status              = EXCLUDED.status,
        assignees           = EXCLUDED.assignees,
        labels              = EXCLUDED.labels,
        github_url          = EXCLUDED.github_url,
        discussion_id       = COALESCE(EXCLUDED.discussion_id, issues.discussion_id),
        updated_at          = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [
        repositoryId, githubIssueId, githubIssueNumber,
        discussionId, title, body,
        authorId, githubAuthorLogin,
        status, assignees, labels, githubUrl,
      ]
    );
    return result.rows[0];
  },

  async retrieveIssueByGithubId(githubIssueId) {
    const result = await pool.query(
      `SELECT * FROM issues WHERE github_issue_id = $1`,
      [githubIssueId]
    );
    return result.rows[0] || null;
  },

  async retrieveIssueById(issueId) {
    const result = await pool.query(
      `SELECT * FROM issues WHERE id = $1`,
      [issueId]
    );
    return result.rows[0] || null;
  },

  async updateIssueStatus(issueId, status) {
    const result = await pool.query(
      `UPDATE issues SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [status, issueId]
    );
    return result.rows[0] || null;
  },

  // Upsert an issue comment row keyed on github_comment_id.
  async storeIssueComment({
    issueId,
    githubCommentId,
    authorId = null,
    githubAuthorLogin = null,
    body,
    isEdited = false,
  }) {
    const result = await pool.query(
      `
      INSERT INTO issue_comments (
        issue_id, github_comment_id,
        author_id, github_author_login,
        body, is_edited
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (github_comment_id) DO UPDATE SET
        body        = EXCLUDED.body,
        is_edited   = EXCLUDED.is_edited,
        updated_at  = CURRENT_TIMESTAMP
      RETURNING *
      `,
      [issueId, githubCommentId, authorId, githubAuthorLogin, body, isEdited]
    );
    return result.rows[0];
  },

  async deleteIssueComment(githubCommentId) {
    await pool.query(
      `DELETE FROM issue_comments WHERE github_comment_id = $1`,
      [githubCommentId]
    );
  },

  // Resolve a pijul repo owner + name to a repository row.
  async resolveRepository(pijulUsername, pijulRepoName) {
    const result = await pool.query(
      `SELECT id, github_repo_name FROM repositories
       WHERE owner = $1 AND name = $2 AND is_archived = false`,
      [pijulUsername, pijulRepoName]
    );
    return result.rows[0] || null;
  },

  // Resolve a github owner/repo to a repository row (via github_repo_name + owner lookup).
  async resolveRepositoryByGithub(githubUsername, githubRepoName) {
    const result = await pool.query(
      `
      SELECT r.id, r.name, r.owner
      FROM repositories r
      INNER JOIN git_info gi ON gi.user_id = r.owner_id
      WHERE gi.provider_username = $1
        AND r.github_repo_name   = $2
        AND r.is_archived        = false
      LIMIT 1
      `,
      [githubUsername, githubRepoName]
    );
    return result.rows[0] || null;
  },

  // Resolve a github login to a local user id (may be null if no account).
  async resolveLocalUserId(githubLogin) {
    const result = await pool.query(
      `SELECT u.id FROM users u
       INNER JOIN git_info gi ON gi.user_id = u.id
       WHERE gi.provider_username = $1 AND gi.provider = 'github'`,
      [githubLogin]
    );
    return result.rows[0]?.id || null;
  },

  // -------------------------------------------------------------------------
  // Ensure GitHub labels exist on the repo (creates them if missing).
  // We don't want a push to fail just because a label doesn't exist yet.
  // -------------------------------------------------------------------------
  async ensureGithubLabels(octokit, owner, repo, labelNames) {
    for (const name of labelNames) {
      try {
        await octokit.request("GET /repos/{owner}/{repo}/labels/{name}", {
          owner, repo, name,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });
      } catch (err) {
        if (err.status === 404) {
          // Create it with a neutral color
          await octokit.request("POST /repos/{owner}/{repo}/labels", {
            owner, repo, name, color: "ededed",
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          });
        }
        // Any other error we let bubble up
      }
    }
  },

  // -------------------------------------------------------------------------
  // Pijul -> GitHub
  // Creates a new GitHub Issue from a locally-stored issue.
  // Call this when a user creates an issue on your pijul server.
  // -------------------------------------------------------------------------
  async pijulToGithubIssue(pijulUsername, pijulRepoName, issueId) {
    try {
      const repo = await this.resolveRepository(pijulUsername, pijulRepoName);
      if (!repo) throw new Error(`Repository ${pijulUsername}/${pijulRepoName} not found`);
      if (!repo.github_repo_name) throw new Error(`Repository has no linked GitHub repo`);

      const issue = await this.retrieveIssueById(issueId);
      if (!issue) throw new Error(`Issue ${issueId} not found`);

      const octokit = await gitStore.getUserOctokit(pijulUsername);
      const githubRepoName = repo.github_repo_name;

      // Build the label list: our managed status labels + any user labels
      const { githubState, labelToAdd } = deriveGithubState(issue.status);
      const allLabels = [...issue.labels];
      if (labelToAdd && !allLabels.includes(labelToAdd)) allLabels.push(labelToAdd);

      await this.ensureGithubLabels(octokit, pijulUsername, githubRepoName, allLabels);

      const response = await octokit.request("POST /repos/{owner}/{repo}/issues", {
        owner: pijulUsername,
        repo:  githubRepoName,
        title: issue.title,
        body:  issue.body || "",
        labels: allLabels,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });

      const gh = response.data;

      // If the issue should be closed immediately, close it
      if (githubState === "closed") {
        await octokit.request("PATCH /repos/{owner}/{repo}/issues/{issue_number}", {
          owner: pijulUsername,
          repo:  githubRepoName,
          issue_number: gh.number,
          state: "closed",
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });
      }

      // Write back the GitHub IDs so we can match future webhooks
      await pool.query(
        `UPDATE issues SET
           github_issue_id     = $1,
           github_issue_number = $2,
           github_url          = $3,
           updated_at          = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [gh.id, gh.number, gh.html_url, issueId]
      );

      return { success: true, githubIssueNumber: gh.number, githubUrl: gh.html_url };
    } catch (error) {
      console.error("Error in pijulToGithubIssue:", error);
      return { success: false, error: error.message };
    }
  },

  // -------------------------------------------------------------------------
  // Pijul -> GitHub: push a local comment to GitHub
  // Call this when a user adds a comment on your pijul server.
  // -------------------------------------------------------------------------
  async pijulToGithubComment(pijulUsername, pijulRepoName, localCommentId) {
    try {
      const repo = await this.resolveRepository(pijulUsername, pijulRepoName);
      if (!repo) throw new Error(`Repository not found`);

      const commentRow = await pool.query(
        `SELECT ic.*, i.github_issue_number, i.repository_id
         FROM issue_comments ic
         INNER JOIN issues i ON i.id = ic.issue_id
         WHERE ic.id = $1`,
        [localCommentId]
      );
      if (commentRow.rows.length === 0) throw new Error(`Comment ${localCommentId} not found`);
      const comment = commentRow.rows[0];
      if (!comment.github_issue_number) throw new Error(`Parent issue not yet synced to GitHub`);

      const octokit = await gitStore.getUserOctokit(pijulUsername);

      if (comment.github_comment_id) {
        // Comment already exists on GitHub — update it
        await octokit.request(
          "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
          {
            owner:      pijulUsername,
            repo:       repo.github_repo_name,
            comment_id: comment.github_comment_id,
            body:       comment.body,
            headers:    { "X-GitHub-Api-Version": "2022-11-28" },
          }
        );
        return { success: true, updated: true };
      } else {
        // New comment
        const response = await octokit.request(
          "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
          {
            owner:        pijulUsername,
            repo:         repo.github_repo_name,
            issue_number: comment.github_issue_number,
            body:         comment.body,
            headers:      { "X-GitHub-Api-Version": "2022-11-28" },
          }
        );
        const gh = response.data;
        await pool.query(
          `UPDATE issue_comments SET github_comment_id = $1 WHERE id = $2`,
          [gh.id, localCommentId]
        );
        return { success: true, githubCommentId: gh.id };
      }
    } catch (error) {
      console.error("Error in pijulToGithubComment:", error);
      return { success: false, error: error.message };
    }
  },

  // -------------------------------------------------------------------------
  // Sync an issue's status FROM our server TO GitHub.
  // Call this when a user changes an issue's status on the pijul server.
  // -------------------------------------------------------------------------
  async syncIssueStatusToGithub(pijulUsername, pijulRepoName, issueId, newStatus) {
    try {
      const repo = await this.resolveRepository(pijulUsername, pijulRepoName);
      if (!repo?.github_repo_name) throw new Error(`No linked GitHub repo`);

      const issue = await this.retrieveIssueById(issueId);
      if (!issue?.github_issue_number) throw new Error(`Issue not synced to GitHub yet`);

      const octokit = await gitStore.getUserOctokit(pijulUsername);
      const { githubState, labelToAdd, labelsToRemove } = deriveGithubState(newStatus);

      // 1. Remove stale managed labels
      for (const label of labelsToRemove) {
        try {
          await octokit.request(
            "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
            {
              owner: pijulUsername,
              repo:  repo.github_repo_name,
              issue_number: issue.github_issue_number,
              name:  label,
              headers: { "X-GitHub-Api-Version": "2022-11-28" },
            }
          );
        } catch (_) { /* label may not have been applied — ignore */ }
      }

      // 2. Add the new status label if needed
      if (labelToAdd) {
        await this.ensureGithubLabels(octokit, pijulUsername, repo.github_repo_name, [labelToAdd]);
        await octokit.request(
          "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
          {
            owner: pijulUsername,
            repo:  repo.github_repo_name,
            issue_number: issue.github_issue_number,
            labels: [labelToAdd],
            headers: { "X-GitHub-Api-Version": "2022-11-28" },
          }
        );
      }

      // 3. Update the open/closed state
      await octokit.request(
        "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
        {
          owner: pijulUsername,
          repo:  repo.github_repo_name,
          issue_number: issue.github_issue_number,
          state: githubState,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        }
      );

      // 4. Update locally
      await this.updateIssueStatus(issueId, newStatus);

      return { success: true };
    } catch (error) {
      console.error("Error in syncIssueStatusToGithub:", error);
      return { success: false, error: error.message };
    }
  },

  // -------------------------------------------------------------------------
  // Link / unlink an issue to a discussion (optional, post-hoc association)
  // -------------------------------------------------------------------------
  async linkIssueToDiscussion(issueId, discussionId) {
    try {
      // Verify the discussion actually belongs to the same repository
      const check = await pool.query(
        `SELECT i.id FROM issues i
         INNER JOIN discussions d ON d.repository_id = i.repository_id
         WHERE i.id = $1 AND d.id = $2`,
        [issueId, discussionId]
      );
      if (check.rows.length === 0) {
        throw new Error(`Discussion ${discussionId} is not in the same repository as issue ${issueId}`);
      }
      await pool.query(
        `UPDATE issues SET discussion_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [discussionId, issueId]
      );
      return { success: true };
    } catch (error) {
      console.error("Error in linkIssueToDiscussion:", error);
      return { success: false, error: error.message };
    }
  },

  async unlinkIssueFromDiscussion(issueId) {
    try {
      await pool.query(
        `UPDATE issues SET discussion_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [issueId]
      );
      return { success: true };
    } catch (error) {
      console.error("Error in unlinkIssueFromDiscussion:", error);
      return { success: false, error: error.message };
    }
  },

  // -------------------------------------------------------------------------
  // Convenience: get all issues for a repository with optional status filter
  // -------------------------------------------------------------------------
  async getRepositoryIssues(pijulUsername, pijulRepoName, { status = null } = {}) {
    try {
      const repo = await this.resolveRepository(pijulUsername, pijulRepoName);
      if (!repo) throw new Error(`Repository not found`);

      const result = await pool.query(
        `SELECT i.*, u.username AS author_username
         FROM issues i
         LEFT JOIN users u ON u.id = i.author_id
         WHERE i.repository_id = $1
           AND ($2::VARCHAR IS NULL OR i.status = $2)
         ORDER BY i.created_at DESC`,
        [repo.id, status]
      );
      return { success: true, issues: result.rows };
    } catch (error) {
      console.error("Error in getRepositoryIssues:", error);
      return { success: false, error: error.message };
    }
  },

  // -------------------------------------------------------------------------
  // Convenience: get all comments for a local issue
  // -------------------------------------------------------------------------
  async getIssueComments(issueId) {
    try {
      const result = await pool.query(
        `SELECT ic.*, u.username AS author_username
         FROM issue_comments ic
         LEFT JOIN users u ON u.id = ic.author_id
         WHERE ic.issue_id = $1
         ORDER BY ic.created_at ASC`,
        [issueId]
      );
      return { success: true, comments: result.rows };
    } catch (error) {
      console.error("Error in getIssueComments:", error);
      return { success: false, error: error.message };
    }
  },
};

module.exports = { gitIssueStore };
