import type { RepoMeta, Repo, PaginatedRepos, Channel, Patch, PatchContent, Collaborator, Discussion, SshKey, ConflictItem, CreateRepoOptions, GitRepo, Organization, OrgMember, RepoGitInfo, RepoSyncInfo } from '../types';

const API_BASE = import.meta.env.DEV
  ? `http://${window.location.hostname}:${window.location.port}/api`
  : `https://${window.location.hostname}:${window.location.port}/api`;

const getHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const login = async (username: string, password: string) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data) {
    localStorage.setItem('username', data.username);
    localStorage.setItem('isLoggedIn', 'true');
  }
  return data as { token?: string; username: string };
};

export const register = async (username: string, password: string) => {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('username', data.username);
  }
  return data as { token?: string; username: string };
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
};

// ── User ──────────────────────────────────────────────────────────────────────

export interface UserProfile {
  username: string;
  sshKeys: SshKey[];
  gitConnected?: boolean;
}

export const fetchProfile = async (): Promise<UserProfile> => {
  const res = await fetch(`${API_BASE}/user/profile?t=${Date.now()}`, { headers: getHeaders() });
  return res.json();
};

export const addSshKey = async (name: string, key: string) => {
  const res = await fetch(`${API_BASE}/user/keys`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name, key }),
  });
  return res.json();
};

export const deleteSshKey = async (id: string) => {
  const res = await fetch(`${API_BASE}/user/keys/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return res.json();
};

// ── Repo helpers ──────────────────────────────────────────────────────────────

const repoPath = (owner: string, name: string) => `${owner}/${name}`;

export const fetchRepos = async (): Promise<Repo[]> => {
  const res = await fetch(`${API_BASE}/repos`, { headers: getHeaders() });
  return res.json();
};

export const fetchPersonalRepos = async (page = 1, limit = 4): Promise<PaginatedRepos> => {
  const res = await fetch(`${API_BASE}/repos/personal?page=${page}&limit=${limit}`, { headers: getHeaders() });
  return res.json();
};

export const fetchCollabRepos = async (page = 1, limit = 4): Promise<PaginatedRepos> => {
  const res = await fetch(`${API_BASE}/repos/collaborators?page=${page}&limit=${limit}`, { headers: getHeaders() });
  return res.json();
};

export const fetchPublicRepos = async (page = 1, limit = 4): Promise<PaginatedRepos> => {
  const res = await fetch(`${API_BASE}/repos/public?page=${page}&limit=${limit}`, { headers: getHeaders() });
  return res.json();
};

export const searchRepos = async (type: string, search: string): Promise<Repo[]> => {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  const typePath = type || 'all';
  const res = await fetch(`${API_BASE}/search/${typePath}?${params.toString()}`, { headers: getHeaders() });
  if (!res.ok) return [];
  return res.json();
};

export const fetchRepoMeta = async (owner: string, name: string): Promise<RepoMeta | null> => {
  const res = await fetch(`${API_BASE}/repo/${repoPath(owner, name)}/meta`, { headers: getHeaders() });
  if (!res.ok) return null;
  return res.json();
};

export const createRepo = async (options: CreateRepoOptions) => {
  const res = await fetch(`${API_BASE}/repos`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(options),
  });
  return res.json() as Promise<Repo & { error?: string }>;
};

export const fetchGitRepos = async (search: string, page = 1, limit = 10): Promise<{ repos: GitRepo[] }> => {
  const params = new URLSearchParams({ search, page: String(page), limit: String(limit) });
  const res = await fetch(`${API_BASE}/gitrepos?${params.toString()}`, { headers: getHeaders() });
  if (!res.ok) return { repos: [] };
  return res.json();
};

// ── Repo content ──────────────────────────────────────────────────────────────

export interface RepoLogResponse {
  patches: Patch[];
  isLastPage: boolean;
}

export const fetchRepoLog = async (
  owner: string,
  name: string,
  channel = 'main',
  page = 1,
  limit = 10,
): Promise<RepoLogResponse> => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, name)}/log?channel=${encodeURIComponent(channel)}&page=${page}&limit=${limit}`,
    { headers: getHeaders() },
  );
  return res.json();
};

export const fetchRepoTree = async (
  owner: string,
  name: string,
  path = '',
  channel = 'main',
) => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, name)}/tree?path=${encodeURIComponent(path)}&channel=${encodeURIComponent(channel)}`,
    { headers: getHeaders() },
  );
  return res.json();
};

export const fetchFileContent = async (
  owner: string,
  name: string,
  path: string,
  channel = 'main',
): Promise<string> => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, name)}/blob?path=${encodeURIComponent(path)}&channel=${encodeURIComponent(channel)}`,
    { headers: getHeaders() },
  );
  return res.text();
};

export const fetchPatchDetail = async (
  owner: string,
  name: string,
  hash: string,
  channel?: string,
): Promise<{ patch: PatchContent | string }> => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, name)}/patches/${hash}?channel=${channel || ''}`,
    { headers: getHeaders() },
  );
  return res.json();
};

// ── Collaborators ─────────────────────────────────────────────────────────────

export const fetchCollaborators = async (owner: string, repoName: string): Promise<Collaborator[]> => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/collaborators`);
  return res.json();
};

export const addCollaborator = async (
  owner: string,
  repoName: string,
  username: string,
  role = 'developer',
) => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/collaborators`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, role }),
  });
  return res.json() as Promise<{ error?: string }>;
};

export const removeCollaborator = async (owner: string, repoName: string, username: string) => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/collaborators/${username}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return res.json() as Promise<{ error?: string }>;
};

export const deleteRepo = async (owner: string, name: string) => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return res.json();
};

// ── Channels ──────────────────────────────────────────────────────────────────

export const fetchChannels = async (owner: string, name: string): Promise<Channel[]> => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/channels`, { headers: getHeaders() });
  return res.json();
};

export const switchChannel = async (owner: string, name: string, channel: string) => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/channels/switch`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ channel }),
  });
  return res.json();
};

export const forkRepo = async (owner: string, name: string, newName: string) => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/fork`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ newName }),
  });
  return res.json() as Promise<Repo & { error?: string }>;
};

// ── Git Sync and Standard Channels ───────────────────────────────────────────

export const fetchRepoGitInfo = async (owner: string, name: string): Promise<{ success: boolean; error?: string; gitInfo?: RepoGitInfo | null }> => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/git/`, { headers: getHeaders() });
  return res.json();
};

export const fetchStandardChannels = async (owner: string, name: string): Promise<{ success: boolean; error?: string; channels?: string[] }> => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/standardchannels`, { headers: getHeaders() });
  return res.json();
};

export const fetchGitRemoteBranches = async (owner: string, name: string): Promise<{ success: boolean; error?: string; branches?: string[] }> => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/git/remotebranch`, { headers: getHeaders() });
  return res.json();
};

export const syncChannelToGit = async (
  owner: string,
  name: string,
  branch: string,
  targetBranch?: string
): Promise<{ success: boolean; error?: string }> => {
  const options: RequestInit = {
    method: 'POST',
    headers: getHeaders(),
  };
  if (targetBranch) {
    options.body = JSON.stringify({ targetBranch });
  }
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/git/sync/${branch}/`, options);
  return res.json();
};

export const addStandardChannel = async (owner: string, name: string, channel: string): Promise<{ success: boolean; error?: string }> => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/standardchannels`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ channel }),
  });
  return res.json();
};

export const removeStandardChannel = async (owner: string, name: string, channel: string): Promise<{ success: boolean; error?: string }> => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/standardchannels`, {
    method: 'DELETE',
    headers: getHeaders(),
    body: JSON.stringify({ channel }),
  });
  return res.json();
};

export const fetchSyncHistory = async (
  owner: string,
  name: string,
  page = 1,
  limit = 10,
): Promise<{ success: boolean; error?: string; history?: RepoSyncInfo[] }> => {
  const params = new URLSearchParams({ limit: String(limit), page: String(page) });
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, name)}/git/sync/history?${params.toString()}`,
    { headers: getHeaders() },
  );
  return res.json();
};



// ── Discussions ───────────────────────────────────────────────────────────────

export const fetchDiscussions = async (
  owner: string,
  repoName: string,
  page = 1,
  limit = 10,
  priority?: string,
): Promise<Discussion[]> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (priority && priority !== 'all') params.append('priority', priority);
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, repoName)}/discussions?${params.toString()}`,
    { headers: getHeaders() },
  );
  return res.json();
};

export const fetchDiscussion = async (
  owner: string,
  repoName: string,
  id: string,
): Promise<Discussion> => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}`,
    { headers: getHeaders() },
  );
  return res.json();
};

interface CreateDiscussionData {
  title: string;
  description?: string;
  targetChannel?: string;
}

export const createDiscussion = async (
  owner: string,
  repoName: string,
  data: CreateDiscussionData,
): Promise<Discussion & { error?: string }> => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/discussions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const addComment = async (
  owner: string,
  repoName: string,
  id: string,
  text: string,
): Promise<Discussion> => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}/comments`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    },
  );
  return res.json();
};

export const mergeDiscussion = async (owner: string, repoName: string, id: string) => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}/merge`,
    { method: 'POST', headers: getHeaders() },
  );
  return res.json();
};

export interface MergeConflictsResponse {
  isconflicts: boolean;
  conflicts?: ConflictItem[];
  error?: string;
}

export const getMergeConflicts = async (
  owner: string,
  repoName: string,
  id: string,
): Promise<MergeConflictsResponse> => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}/mergeconflicts`,
    { headers: getHeaders() },
  );
  return res.json();
};

export const closeDiscussion = async (
  owner: string,
  repoName: string,
  id: string,
): Promise<{ error?: string }> => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}/close`,
    { method: 'POST', headers: getHeaders() },
  );
  return res.json();
};

export const deleteDiscussion = async (
  owner: string,
  repoName: string,
  id: string,
): Promise<{ error?: string }> => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}`,
    { method: 'DELETE', headers: getHeaders() },
  );
  return res.json();
};

// ── Branch protection ─────────────────────────────────────────────────────────

export const toggleProtection = async (owner: string, repoName: string, channel: string) => {
  const res = await fetch(
    `${API_BASE}/repos/${repoPath(owner, repoName)}/protected-channels/toggle`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ channel }),
    },
  );
  return res.json();
};

export const fetchProtectedCh = async (owner: string, name: string): Promise<string[]> => {
  const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/protected-channels`);
  return res.json();
};

// ── Organizations ─────────────────────────────────────────────────────────────

export const fetchOrgs = async (page = 1, limit = 10): Promise<{ orgs: Organization[]; total: number }> => {
  const res = await fetch(`${API_BASE}/org?page=${page}&limit=${limit}`, { headers: getHeaders() });
  return res.json();
};

export const fetchOrgRepos = async (orgName: string, page = 1, limit = 10): Promise<PaginatedRepos> => {
  const res = await fetch(`${API_BASE}/org/repos/${orgName}?page=${page}&limit=${limit}`, { headers: getHeaders() });
  return res.json();
};

export const createOrg = async (data: any, description?: string): Promise<Organization & { error?: string }> => {
  const payload = typeof data === 'string' ? { name: data, description } : data;
  const res = await fetch(`${API_BASE}/org`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const checkOrgNameAvailability = async (name: string): Promise<{ available: boolean }> => {
  const res = await fetch(`${API_BASE}/org/check-name?name=${encodeURIComponent(name)}`, { headers: getHeaders() });
  return res.json();
};

export const fetchOrgMembers = async (orgName: string): Promise<{ members: OrgMember[] }> => {
  const res = await fetch(`${API_BASE}/org/${orgName}/members`, { headers: getHeaders() });
  return res.json();
};

export const addOrgMember = async (orgName: string, username: string, role: string): Promise<{ ok: boolean; error?: string }> => {
  const res = await fetch(`${API_BASE}/org/${orgName}/members`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ username, role }),
  });
  return res.json();
};

export const updateMemberRole = async (orgName: string, username: string, role: string): Promise<{ ok: boolean; error?: string }> => {
  const res = await fetch(`${API_BASE}/org/${orgName}/members/${username}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ role }),
  });
  return res.json();
};

export const updateMemberPermissions = async (orgName: string, username: string, permissions: string[]): Promise<{ ok: boolean; error?: string }> => {
  const res = await fetch(`${API_BASE}/org/${orgName}/members/${username}/permissions`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ permissions }),
  });
  return res.json();
};

export const removeOrgMember = async (orgName: string, username: string): Promise<{ ok: boolean; error?: string }> => {
  const res = await fetch(`${API_BASE}/org/${orgName}/members/${username}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  return res.json();
};
