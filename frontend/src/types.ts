// ─── Domain types derived from API usage across the app ───────────────────────

export interface RepoMeta {
  id: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  isGithubSynced?: boolean;
  /** Role of the currently-logged-in user in this repo */
  role: 'owner' | 'maintainer' | 'developer' | string;
}

export interface Channel {
  name: string;
  isCurrent: boolean;
}

export interface Patch {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export interface DiffLine {
  lineType: 'addition' | 'deletion' | 'context';
  lineNumber: number;
  content: string;
}

export interface Hunk {
  hunkType: string;
  path: string;
  newPath?: string;
  line: number;
  previous?: string;
  remove?: string;
  newData?: string;
  lines?: DiffLine[];
  /** Binary / raw buffer contents (Replacement-type hunks) */
  contents?: { toString(enc: string): string; length: number };
  replacementContents?: { toString(enc: string): string; length: number };
}

export interface PatchContent {
  message: string;
  timestamp: string;
  authors?: string[];
  hunks?: Hunk[];
}

export interface PatchDetail {
  hash: string;
  /** Structured diff object or raw string for simple patches */
  content: PatchContent | string;
}

// ─── SSH Keys (Settings page) ─────────────────────────────────────────────────

export interface SshKey {
  id: string;
  name: string;
  key: string;
}

// ─── Discussions / PRs ────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  author: string;
  createdAt: string;
  text: string;
}

export interface Discussion {
  id: string;
  title: string;
  status: 'open' | 'merged' | 'closed';
  author: string;
  sourceChannel: string;
  targetChannel: string;
  description?: string;
  comments: Comment[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  type?: 'regular' | 'gitpull';
}

export interface Collaborator {
  username: string;
  role: 'developer' | 'maintainer' | string;
}

// ─── Organizations ────────────────────────────────────────────────────────────

export interface Organization {
  name: string;
  description?: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
  repoCount?: number;
  memberCount?: number;
  isGithubSynced?: boolean;
  isPrivate?: boolean;
  lastActive?: string;
  totalStars?: number;
  totalForks?: number;
  updatedAt?: string;
}

export interface OrgMember {
  username: string;
  role: string;
  customPermissions?: string[];
  joinedAt: string;
}
// ─── Merge conflicts (ConflictsBox) ──────────────────────────────────────────

export interface ConflictItem {
  conflictType: 'Name' | 'ZombieFile' | 'MultipleNames' | 'Zombie' | 'Cyclic' | 'Order' | string;
  path: string;
  line?: number;
  contentA?: string;
  contentB?: string;
  content?: string;
  changes?: string[];
}

// ─── Repository tree ──────────────────────────────────────────────────────────

export interface TreeEntry {
  path: string;
  isDir: boolean;
}

/** The tree API can return plain strings or structured objects */
export type TreeItem = string | TreeEntry;

// ─── Repo listing (reposScroll / Dashboard) ───────────────────────────────────

export interface Repo {
  id?: string;
  name: string;
  owner: string;
  isPrivate: boolean;
  isCollaborated?: boolean;
  isGithubSynced?: boolean;
  role?: 'developer' | 'maintainer' | 'owner' | string;
  createdAt: string;
}

export interface PaginatedRepos {
  repositories: Repo[];
  pagination: {
    totalItems: number;
    hasNext: boolean;
    page: number;
    limit: number;
  };
}

export interface RepoType {
  personal?: boolean;
  contributions?: boolean;
  public?: boolean;
}

export interface GitRepo {
  repoName: string;
  access: 'private' | 'public';
  owner: string;
}

export interface CreateRepoOptions {
  name: string;
  isPrivate: boolean;
  isGitSync?: boolean;
  iscreateNewGitRepo?: boolean;
  newGitRepoName?: string;
  syncMethod?: 'direct' | 'pr';
  gitRepoName?: string;
  autoSync?: boolean;
}
export interface RepoGitInfo{
   remoteName:string,
   isremotePrivate:boolean
   syncMethod: 'direct' | 'pr';
   autoSync:boolean,
   syncedchannels:string[],
  
}

export interface RepoSyncInfo {
  success: boolean;
  runAt: string;
  localChannel: string;
  remoteBranch: string;
  /** 'merged' always for direct; 'merged'|'waiting' for pr mode */
  status: 'merged' | 'waiting';
}
