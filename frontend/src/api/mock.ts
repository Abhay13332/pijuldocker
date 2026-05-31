/**
 * mock.ts — Drop-in replacement for src/api/index.ts
 *
 * Returns fixture data INSTANTLY (no network, no server needed).
 * To use: change the import in any tab file from
 *   import { ... } from '../../api';
 * to
 *   import { ... } from '../../api/mock';
 */
import type {
  RepoMeta, Repo, PaginatedRepos, Channel, Patch, PatchContent,
  Collaborator, Discussion, SshKey, CreateRepoOptions, GitRepo, RepoGitInfo, RepoSyncInfo
} from '../types';
import type { MergeConflictsResponse, RepoLogResponse, UserProfile } from './real';
import {
  MOCK_USER, MOCK_REPO_META, MOCK_CHANNELS, MOCK_PATCHES, MOCK_PATCH_CONTENT,
  MOCK_DISCUSSIONS, MOCK_COLLABORATORS,
  MOCK_PROTECTED_CHANNELS, MOCK_CONFLICTS, MOCK_REPOS, MOCK_PAGINATED,
  MOCK_SSH_KEYS, MOCK_ORGS, MOCK_ORG_MEMBERS,
} from './__fixtures__';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const login = async (_u: string, _p: string) => {
  localStorage.setItem('username', MOCK_USER);
  localStorage.setItem('isLoggedIn', 'true');
  return { token: 'mock-token', username: MOCK_USER };
};

export const register = async (_u: string, _p: string) => {
  localStorage.setItem('username', MOCK_USER);
  localStorage.setItem('isLoggedIn', 'true');
  return { token: 'mock-token', username: MOCK_USER };
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
};

// ── User ──────────────────────────────────────────────────────────────────────

export const fetchProfile = async (): Promise<UserProfile> => ({
  username: MOCK_USER,
  sshKeys: MOCK_SSH_KEYS,
  gitConnected: localStorage.getItem('gitConnected') === 'true',
});

export const addSshKey = async (_name: string, _key: string) =>
  ({ id: `key-${Date.now()}`, name: _name, key: _key } as SshKey);

export const deleteSshKey = async (_id: string) => ({ ok: true });

// ── Repos ─────────────────────────────────────────────────────────────────────

export const fetchRepos = async (): Promise<Repo[]> => MOCK_REPOS;

export const fetchPersonalRepos = async (_p = 1, _l = 4): Promise<PaginatedRepos> => MOCK_PAGINATED;
export const fetchCollabRepos   = async (_p = 1, _l = 4): Promise<PaginatedRepos> => MOCK_PAGINATED;
export const fetchPublicRepos   = async (_p = 1, _l = 4): Promise<PaginatedRepos> => MOCK_PAGINATED;

export const searchRepos = async (_type: string, search: string): Promise<Repo[]> => {
  return MOCK_REPOS.filter(r => r.name.includes(search));
};

export const fetchRepoMeta = async (_owner: string, name: string): Promise<RepoMeta | null> => {
  // Look up isGithubSynced from the per-repo list so unsyced repos don't show GitHub UI
  const repoEntry = MOCK_REPOS.find(r => r.name === name);
  return {
    ...MOCK_REPO_META,
    name,
    isGithubSynced: repoEntry?.isGithubSynced ?? false,
  };
};

export const createRepo = async (options: CreateRepoOptions) =>
  ({ id: `repo-${Date.now()}`, name: options.name, owner: MOCK_USER, isPrivate: options.isPrivate, createdAt: new Date().toISOString(), error: undefined } as Repo & { error?: string });

export const fetchGitRepos = async (search: string, _page = 1, _limit = 10): Promise<{ repos: GitRepo[] }> => {
  const dummyRepos: GitRepo[] = [
    { repoName: 'pijul-frontend', access: 'public', owner: 'devuser' },
    { repoName: 'secret-backend', access: 'private', owner: 'devuser' },
    { repoName: 'linux', access: 'public', owner: 'torvalds' },
    { repoName: 'react', access: 'public', owner: 'facebook' },
  ];
  return { repos: dummyRepos.filter(r => r.repoName.includes(search) || r.owner.includes(search)) };
};

export const deleteRepo = async (_owner: string, _name: string) => ({ ok: true });

export const forkRepo = async (_owner: string, name: string, newName: string) =>
  ({ id: `repo-${Date.now()}`, name: newName || name, owner: MOCK_USER, isPrivate: false, createdAt: new Date().toISOString(), error: undefined } as Repo & { error?: string });

// ── Repo content ──────────────────────────────────────────────────────────────

export const fetchRepoLog = async (
  _owner: string, _name: string, _channel = 'main', _page = 1, _limit = 10,
): Promise<RepoLogResponse> => ({
  patches: MOCK_PATCHES.slice(0, _limit) as Patch[],
  isLastPage: true,
});

const MOCK_FILES_TREE: Record<string, { path: string; isDir: boolean }[]> = {
  '': [
    { path: 'src', isDir: true },
    { path: 'public', isDir: true },
    { path: 'tests', isDir: true },
    { path: 'README.md', isDir: false },
    { path: 'package.json', isDir: false },
    { path: 'vite.config.ts', isDir: false },
    { path: '.gitignore', isDir: false },
    { path: 'tsconfig.json', isDir: false },
  ],
  'src': [
    { path: 'components', isDir: true },
    { path: 'hooks', isDir: true },
    { path: 'pages', isDir: true },
    { path: 'main.tsx', isDir: false },
    { path: 'App.tsx', isDir: false },
    { path: 'index.css', isDir: false },
  ],
  'src/components': [
    { path: 'ui', isDir: true },
    { path: 'Navbar.tsx', isDir: false },
    { path: 'Layout.tsx', isDir: false },
  ],
  'src/components/ui': [
    { path: 'button.tsx', isDir: false },
    { path: 'card.tsx', isDir: false },
    { path: 'dropdown-menu.tsx', isDir: false },
    { path: 'tabs.tsx', isDir: false },
  ],
  'src/hooks': [
    { path: 'useTheme.ts', isDir: false },
    { path: 'useColorTheme.ts', isDir: false },
  ],
  'src/pages': [
    { path: 'Repo', isDir: true },
    { path: 'Dashboard.tsx', isDir: false },
    { path: 'Login.tsx', isDir: false },
    { path: 'Settings.tsx', isDir: false },
    { path: 'Guide.tsx', isDir: false },
  ],
  'src/pages/Repo': [
    { path: 'FilesTab.tsx', isDir: false },
    { path: 'PatchesTab.tsx', isDir: false },
    { path: 'DiscussionsTab.tsx', isDir: false },
    { path: 'RepoSettingsTab.tsx', isDir: false },
    { path: 'index.tsx', isDir: false },
  ],
  'public': [
    { path: 'favicon.ico', isDir: false },
    { path: 'logo.png', isDir: false },
  ],
  'tests': [
    { path: 'app.spec.ts', isDir: false },
    { path: 'auth.spec.ts', isDir: false },
  ]
};

export const fetchRepoTree = async (_owner: string, _name: string, path = '', _ch = 'main') => {
  const cleanPath = path.replace(/\/+$/, '');
  return MOCK_FILES_TREE[cleanPath] || [];
};

export const fetchFileContent = async (_o: string, _n: string, path: string, _ch = 'main'): Promise<string> => {
  const filename = path.split('/').pop() || '';
  if (filename.endsWith('.md')) {
    return `# ${filename}\n\nThis is a mocked markdown file content for **${path}** under branch **${_ch}**.`;
  }
  if (filename.endsWith('.json')) {
    return `{\n  "name": "${filename}",\n  "version": "1.0.0",\n  "description": "Mocked JSON file content for ${path}",\n  "dependencies": {\n    "react": "^18.2.0"\n  }\n}`;
  }
  if (filename.endsWith('.css')) {
    return `/* Mocked styles for ${filename} */\n:root {\n  --mock-primary: oklch(0.6 0.2 30);\n}\n\nbody {\n  background-color: var(--background);\n}`;
  }
  return `// Mocked file content for ${filename}\nimport React from 'react';\n\nexport const ${filename.split('.')[0].charAt(0).toUpperCase() + filename.split('.')[0].slice(1)} = () => {\n  console.log("Rendering ${path} on channel ${_ch}");\n  return (\n    <div>\n      <h1>Hello from ${filename}</h1>\n    </div>\n  );\n};`;
};

export const fetchPatchDetail = async (
  _o: string, _n: string, hash: string, _ch?: string,
): Promise<{ patch: PatchContent | string }> => ({
  patch: { ...MOCK_PATCH_CONTENT, message: `Patch ${hash.slice(0, 8)}` },
});

// ── Channels ──────────────────────────────────────────────────────────────────

const mockChannelsList: Channel[] = [
  ...MOCK_CHANNELS,
  { name: 'dev', isCurrent: false }
];

export const fetchChannels = async (_o: string, _n: string): Promise<Channel[]> => mockChannelsList;

export const switchChannel = async (_o: string, _n: string, _ch: string) => ({ ok: true });

// ── Git Sync and Standard Channels ───────────────────────────────────────────

let mockStandardChannels = ['main', 'dev', 'release'];
let mockSyncedChannels = ['main'];

export const fetchRepoGitInfo = async (_owner: string, name: string): Promise<{ success: boolean; error?: string; gitInfo?: RepoGitInfo | null }> => {
  if (name === 'asdf' || name === 'pijulserv') {
    return {
      success: true,
      gitInfo: {
        remoteName: 'origin',
        isremotePrivate: false,
        syncMethod: 'direct',
        autoSync: true,
        syncedchannels: mockSyncedChannels,
      }
    };
  }
  return { success: true, gitInfo: null };
};

export const fetchStandardChannels = async (_o: string, _n: string): Promise<{ success: boolean; error?: string; channels?: string[] }> => {
  return { success: true, channels: mockStandardChannels };
};

export const fetchGitRemoteBranches = async (_o: string, _n: string): Promise<{ success: boolean; error?: string; branches?: string[] }> => {
  return { success: true, branches: ['main', 'develop', 'feature/git-sync', 'release-v1.0'] };
};

export const syncChannelToGit = async (
  _owner: string,
  _name: string,
  branch: string,
  _targetBranch?: string
): Promise<{ success: boolean; error?: string }> => {
  if (!mockSyncedChannels.includes(branch)) {
    mockSyncedChannels.push(branch);
  }
  return { success: true };
};

export const addStandardChannel = async (_owner: string, _name: string, channel: string): Promise<{ success: boolean; error?: string }> => {
  if (!mockStandardChannels.includes(channel)) {
    mockStandardChannels.push(channel);
  }
  return { success: true };
};

export const removeStandardChannel = async (_owner: string, _name: string, channel: string): Promise<{ success: boolean; error?: string }> => {
  mockStandardChannels = mockStandardChannels.filter(c => c !== channel);
  return { success: true };
};

const MOCK_SYNC_HISTORY: RepoSyncInfo[] = [
  { success: true,  runAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),  localChannel: 'main',    remoteBranch: 'main',    status: 'merged'  },
  { success: true,  runAt: new Date(Date.now() - 1000 * 60 * 62).toISOString(), localChannel: 'dev',     remoteBranch: 'develop', status: 'waiting' },
  { success: false, runAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(), localChannel: 'main',    remoteBranch: 'main',    status: 'merged'  },
  { success: true,  runAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),localChannel: 'release', remoteBranch: 'release', status: 'merged'  },
];

export const fetchSyncHistory = async (
  _owner: string,
  _name: string,
  page = 1,
  limit = 10,
): Promise<{ success: boolean; error?: string; history?: RepoSyncInfo[] }> => {
  const start = (page - 1) * limit;
  return { success: true, history: MOCK_SYNC_HISTORY.slice(start, start + limit) };
};

// ── Collaborators ─────────────────────────────────────────────────────────────

export const fetchCollaborators = async (_o: string, _n: string): Promise<Collaborator[]> =>
  MOCK_COLLABORATORS;

export const addCollaborator = async (_o: string, _n: string, username: string, role = 'developer'): Promise<{ error?: string }> =>
  ({ username, role, error: undefined } as { username: string; role: string; error?: string });

export const removeCollaborator = async (_o: string, _n: string, _u: string): Promise<{ error?: string }> => ({});

// ── Discussions ───────────────────────────────────────────────────────────────
export const fetchDiscussions = async (_o: string, _n: string, _p = 1, _l = 10, priority?: string): Promise<Discussion[]> => {
  let list = MOCK_DISCUSSIONS;
  if (priority && priority !== 'all') {
    list = list.filter(d => d.priority === priority);
  }
  
  // Append page number to ids to avoid duplicate keys when same discussion appears on different pages
  return list.map(discussion => ({
    ...discussion,
    id: `${discussion.id}-page-${_p}`
  }));
};
export const fetchDiscussion = async (_o: string, _n: string, id: string): Promise<Discussion> => {
  // Extract the original ID by removing the page suffix (e.g., "disc-0001-page-1" -> "disc-0001")
  const originalId = id.replace(/-page-\d+$/, '');
  
  const disc = MOCK_DISCUSSIONS.find(d => d.id === originalId);
  if (!disc) throw new Error(`Discussion ${id} not found`);
  return disc;
};
export const createDiscussion = async (
  _o: string, _n: string,
  data: { title: string; description?: string; targetChannel?: string },
): Promise<Discussion & { error?: string }> => ({
  id: `disc-${Date.now()}`,
  title: data.title,
  description: data.description ?? '',
  status: 'open' as const,
  author: MOCK_USER,
  sourceChannel: `pr/${data.title.toLowerCase().replace(/\s+/g, '-')}`,
  targetChannel: data.targetChannel ?? 'main',
  comments: [],
});

export const addComment = async (_o: string, _n: string, id: string, text: string): Promise<Discussion> => {
  const disc = MOCK_DISCUSSIONS.find(d => d.id === id) ?? MOCK_DISCUSSIONS[0];
  return {
    ...disc,
    comments: [
      ...disc.comments,
      { id: `c-${Date.now()}`, author: MOCK_USER, createdAt: new Date().toISOString(), text },
    ],
  };
};

export const mergeDiscussion  = async (_o: string, _n: string, _id: string) => ({ ok: true });
export const closeDiscussion  = async (_o: string, _n: string, _id: string): Promise<{ error?: string }> => ({});
export const deleteDiscussion = async (_o: string, _n: string, _id: string): Promise<{ error?: string }> => ({});

export const getMergeConflicts = async (
  _o: string, _n: string, _id: string,
): Promise<MergeConflictsResponse> => ({
  isconflicts: MOCK_CONFLICTS.length > 0,
  conflicts: MOCK_CONFLICTS,
});

// ── Branch protection ─────────────────────────────────────────────────────────

export const fetchProtectedCh = async (_o: string, _n: string): Promise<string[]> =>
  MOCK_PROTECTED_CHANNELS;

export const toggleProtection = async (_o: string, _n: string, _ch: string) => ({ ok: true });

// ── Organizations ─────────────────────────────────────────────────────────────

import { Organization, OrgMember } from '../types';

export const fetchOrgs = async (_p = 1, _l = 10): Promise<{ orgs: Organization[]; total: number }> => {
  return { orgs: MOCK_ORGS, total: MOCK_ORGS.length };
};

export const fetchOrgRepos = async (_org: string, _p = 1, _l = 10): Promise<PaginatedRepos> => {
  return MOCK_PAGINATED;
};

export const createOrg = async (data: any, description?: string): Promise<Organization & { error?: string }> => {
  const name = typeof data === 'string' ? data : data.name || 'unnamed';
  const desc = typeof data === 'string' ? description : data.description || '';
  
  const newOrg: Organization = { 
    name, 
    description: desc, 
    role: 'owner', 
    createdAt: new Date().toISOString(),
    repoCount: 0,
    memberCount: 1,
    isGithubSynced: false,
    isPrivate: true,
    lastActive: new Date().toISOString(),
    totalStars: 0,
    totalForks: 0,
    updatedAt: new Date().toISOString()
  };
  MOCK_ORGS.push(newOrg);
  return newOrg;
};

export const checkOrgNameAvailability = async (name: string): Promise<{ available: boolean }> => {
  const existingOrg = MOCK_ORGS.find(org => org.name === name);
  return { available: !existingOrg };
};

export const fetchOrgMembers = async (_org: string): Promise<{ members: OrgMember[] }> => {
  return { members: MOCK_ORG_MEMBERS };
};

export const addOrgMember = async (_org: string, username: string, role: string): Promise<{ ok: boolean; error?: string }> => {
  MOCK_ORG_MEMBERS.push({ username, role: role as any, joinedAt: new Date().toISOString() });
  return { ok: true };
};

export const updateMemberRole = async (_org: string, username: string, role: string): Promise<{ ok: boolean; error?: string }> => {
  const m = MOCK_ORG_MEMBERS.find(x => x.username === username);
  if (m) m.role = role as any;
  return { ok: true };
};

export const updateMemberPermissions = async (_org: string, username: string, permissions: string[]): Promise<{ ok: boolean; error?: string }> => {
  const m = MOCK_ORG_MEMBERS.find(x => x.username === username);
  if (m) m.customPermissions = permissions;
  return { ok: true };
};

export const removeOrgMember = async (_org: string, username: string): Promise<{ ok: boolean; error?: string }> => {
  const idx = MOCK_ORG_MEMBERS.findIndex(m => m.username === username);
  if (idx !== -1) MOCK_ORG_MEMBERS.splice(idx, 1);
  return { ok: true };
};
