# Database Context: PijulDB (PostgreSQL)

## Overview
A PostgreSQL database for a Git/Pijul hybrid code review platform. Users create repositories, open discussions (like pull requests), and commits are tracked with their corresponding Pijul patch hashes.

---

## Core Tables

### `users`
User accounts. Fields: `id` (UUID PK), `username` (unique), `email`, `password_hash`, `full_name`, `avatar_url`, `is_active`, `last_login_at`, `created_at`, `updated_at`.

### `git_info`
OAuth/token info linking users to Git providers (github/gitlab/bitbucket). Fields: `id`, `user_id` (FK→users), `username`, `provider` (github/gitlab/bitbucket, default `'github'`), `provider_username`, `access_token`, `refresh_token`, `installation_id`, `token_expires_at`, `created_at`, `updated_at`. Unique on `(user_id, provider)`.

### `ssh_keys`
SSH public keys per user. Fields: `id`, `user_id` (FK→users), `name`, `public_key`, `fingerprint`, `last_used_at`, `is_active`, `created_at`, `updated_at`.

### `repositories`
Code repositories. Fields: `id`, `name`, `owner` (string), `owner_id` (FK→users), `description`, `is_private`, `default_branch` (default `'main'`), `discussion_counter` (default `0`), `protected_channels` (text[], default `ARRAY['main']`), `github_repo_name`, `github_repo_id`, `is_archived`, `created_at`, `updated_at`. Unique on `(owner_id, name)`.

### `collaborators`
Repository access control. Fields: `id`, `repository_id` (FK→repositories), `user_id` (FK→users), `role` (owner/maintainer/developer/viewer, default `'developer'`), `permissions` (JSONB), `added_by` (FK→users, nullable), `created_at`, `updated_at`. Unique on `(repository_id, user_id)`.

### `standard_channels`
Long-lived branches/channels (e.g. main, dev). Fields: `id`, `repository_id` (FK→repositories), `channel_name`, `description`, `channel_type` (standard/protected/archived), `is_default`, `created_by` (FK→users, nullable), `created_at`, `updated_at`. Unique on `(repository_id, channel_name)`.

### `channel_git_map`
Maps standard channels to Git branch names. Fields: `id`, `channel_id` (FK→standard_channels), `repository_id` (FK→repositories), `git_branch_name`, `sync_enabled`, `last_synced_at`, `created_at`, `updated_at`. Unique on `channel_id` and on `(repository_id, git_branch_name)`.

### `discussions`
Pull-request-like discussions. Fields: `id`, `repository_id` (FK→repositories), `title`, `description`, `author_id` (FK→users), `source_channel_id`, `target_channel_id`, `status` (draft/open/in_review/merged/closed/archived, default `'open'`), `priority` (low/medium/high/critical, default `'medium'`), `created_at`, `updated_at`.

### `discussion_commits`
Commits associated with a discussion. Fields: `id`, `discussion_id` (FK→discussions), `commit_hash`, `commit_message`, `commit_author`, `commit_timestamp`, `parent_commit_id` (self-ref, nullable), `state` (local_draft / github_only_fetched / github_pijul_synced / pijul_only_fetched / pijul_github_synced / conflict_detected / failed, default `'github_only_fetched'`), `created_at`, `updated_at`.

### `discussion_commit_patches`
Pijul patch hashes tied to a commit. Fields: `id`, `discussion_commit_id` (FK→discussion_commits), `pijul_patch_hash` (unique), `created_at`. (No `updated_at` — rows are insert-only.)

### `comments`
Threaded comments on discussions. Fields: `id`, `discussion_id` (FK→discussions), `author_id` (FK→users), `parent_comment_id` (self-ref, nullable), `text`, `is_edited`, `is_resolved`, `resolved_by` (FK→users, nullable), `resolved_at`, `created_at`, `updated_at`.

### `activity_log`
Audit trail for all actions. Fields: `id`, `user_id` (FK→users, nullable), `action_type`, `entity_type`, `entity_id` (UUID), `old_data` (JSONB), `new_data` (JSONB), `ip_address` (INET), `user_agent`, `created_at`. (No `updated_at` — rows are insert-only.)

---

## Key Relationships
```
users ──< repositories (owner_id)
users ──< collaborators >── repositories
repositories ──< standard_channels ──< channel_git_map
repositories ──< discussions
discussions ──< discussion_commits ──< discussion_commit_patches
discussions ──< comments (threaded via parent_comment_id)
users ──< git_info
users ──< ssh_keys
```

---

## Commit States (important enum)
| State | Meaning |
|---|---|
| `local_draft` | Not yet pushed anywhere |
| `github_only_fetched` | Exists on GitHub, not yet in Pijul |
| `github_pijul_synced` | Synced to both GitHub and Pijul |
| `pijul_only_fetched` | Exists in Pijul, not yet on GitHub |
| `pijul_github_synced` | Synced from Pijul to GitHub |
| `conflict_detected` | Sync conflict |
| `failed` | Sync failed |

---

## Materialized Views

| View | Description |
|---|---|
| `mv_repository_stats` | Per-repo counts: total/open/merged discussions, collaborators, channels, last activity |
| `mv_repo_patch_summary` | Per-(repo, discussion, commit): patch count, patch hashes array, last patch timestamp |
| `mv_repo_patches_fast` | Flat denormalized rows: repo → patch (only active states, non-archived repos) |
| `mv_repo_dashboard` | Rich activity dashboard: commit counts by state, patch counts by state, activity timestamps |

All views must be refreshed manually via `REFRESH MATERIALIZED VIEW CONCURRENTLY <view_name>` (a `refreshMaterializedViews()` helper is available).

---

## Stored Functions

### `get_repo_patches(p_repo_id, p_repo_name, p_state, p_limit, p_offset)`
Returns paginated patch rows across repo→discussion→commit→patch chain. All params optional. Filters by repo ID or name (ILIKE), commit state, and excludes archived repos.

### `get_repo_patch_stats(p_repo_id UUID)`
Returns a summary grouped by commit state: commit count, patch count, and latest patch timestamp for a given repository.

---

## Extensions Used
- `uuid-ossp` — UUID primary key generation
- `pg_trgm` — trigram-based full-text search on repository names

---

## Notes
- All tables with `updated_at` have an auto-update trigger.
- `updated_at` triggers fire on: users, git_info, ssh_keys, repositories, collaborators, standard_channels, channel_git_map, discussions, discussion_commits, comments.
- Connection pool: max 20 connections, 30s idle timeout, 2s connection timeout.
- Query helper includes retry logic (3 attempts, exponential backoff).
