/**
 * Shared in-memory fixture data used by both mock API clones.
 * Edit values here to test different UI states.
 */
import type {
  RepoMeta, Repo, PaginatedRepos, Channel, Patch, PatchContent,
  Collaborator, Discussion, SshKey, ConflictItem, TreeEntry, Organization, OrgMember
} from '../types';

export const MOCK_USER = 'devuser';

export const MOCK_REPO_META: RepoMeta = {
  id: 'aabbccdd-1122-3344-5566-778899aabbcc',
  name: 'my-project',
  owner: MOCK_USER,
  isPrivate: false,
  isGithubSynced: true,
  role: 'owner',
};

export const MOCK_CHANNELS: Channel[] = [
  { name: 'main', isCurrent: true },
  { name: 'feature/auth', isCurrent: false },
  { name: 'fix/typo', isCurrent: false },
];

export const MOCK_PATCHES: Patch[] = [
  { hash: 'abcdef12345678901234567890', message: 'Initial commit', date: '2024-05-01', author: 'devuser@example.com' },
  { hash: 'bbcdef12345678901234567891', message: 'Add README', date: '2024-05-02', author: 'devuser@example.com' },
  { hash: 'ccdef123456789012345678912', message: 'Fix typo in README', date: '2024-05-03', author: 'alice@example.com' },
  { hash: 'dddef123456789012345678913', message: 'Add license file', date: '2024-05-04', author: 'devuser@example.com' },
  { hash: 'eedef123456789012345678914', message: 'Setup CI workflow', date: '2024-05-05', author: 'bob@example.com' },
];

export const MOCK_PATCH_CONTENT: PatchContent = {
  message: 'Add README',
  timestamp: new Date('2024-05-02T10:30:00Z').toISOString(),
  authors: ['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'],
  hunks: [
    {
      hunkType: 'FileAdd',
      path: 'README.md',
      line: 1,
      lines: [
        { lineType: 'addition', lineNumber: 1, content: '# my-project' },
        { lineType: 'addition', lineNumber: 2, content: '' },
        { lineType: 'addition', lineNumber: 3, content: 'A demo project for local testing.' },
      ],
    },
    {
      hunkType: 'Edit',
      path: 'src/main.ts',
      line: 5,
      previous: 'const x = 1;',
      remove: 'const x = 1;',
      newData: 'const x = 42;',
      lines: [
        { lineType: 'deletion', lineNumber: 5, content: 'const x = 1;' },
        { lineType: 'addition', lineNumber: 5, content: 'const x = 42;' },
      ],
    },
  ],
};

export const MOCK_TREE: TreeEntry[] = [
  { path: 'src', isDir: true },
  { path: 'README.md', isDir: false },
  { path: 'LICENSE', isDir: false },
  { path: '.gitignore', isDir: false },
  { path: 'package.json', isDir: false },
];

export const MOCK_FILE_CONTENT = `# my-project

A demo project for local testing.

## Usage

\`\`\`bash
npm install
npm run dev
\`\`\`
`;

export const MOCK_DISCUSSIONS: Discussion[] = [
  {
    id: 'disc-0001',
    title: 'Add OAuth support',
    status: 'open',
    author: 'alice',
    sourceChannel: 'feature/auth',
    targetChannel: 'main',
    description: 'This PR adds OAuth2 login via GitHub.',
    priority: 'critical',
    type: 'gitpull',
    comments: [
      { id: 'c1', author: 'devuser', createdAt: '2024-05-10T08:00:00Z', text: 'Looks good, needs tests.' },
      { id: 'c2', author: 'alice', createdAt: '2024-05-10T09:00:00Z', text: 'Added unit tests in the last commit.' },
    ],
  },
  {
    id: 'disc-0002',
    title: 'Fix typo in README',
    status: 'merged',
    author: 'bob',
    sourceChannel: 'fix/typo',
    targetChannel: 'main',
    description: '',
    priority: 'low',
    type: 'regular',
    comments: [],
  },
  {
    id: 'disc-0003',
    title: 'Refactor database layer',
    status: 'closed',
    author: 'devuser',
    sourceChannel: 'refactor/db',
    targetChannel: 'main',
    description: 'Splits the monolithic DB module into smaller services.',
    priority: 'high',
    type: 'regular',
    comments: [],
  },
  {
    id: 'disc-0004',
    title: 'Sync upstream GitHub changes',
    status: 'open',
    author: 'devuser',
    sourceChannel: 'github/sync-upstream',
    targetChannel: 'main',
    description: 'Pull latest changes from the mirrored GitHub repo.',
    priority: 'medium',
    type: 'gitpull',
    comments: [],
  },
  {
    id: 'disc-0005',
    title: 'CRITICAL: Fix security vulnerability in auth',
    status: 'open',
    author: 'alice',
    sourceChannel: 'hotfix/security',
    targetChannel: 'main',
    description: 'Patches a critical XSS vulnerability in the login form.',
    priority: 'critical',
    type: 'regular',
    comments: [],
  },
  {
    id: 'disc-0006',
    title: 'Update CI pipeline for Node 20',
    status: 'merged',
    author: 'carol',
    sourceChannel: 'ci/node20',
    targetChannel: 'main',
    description: 'Upgrades GitHub Actions to use Node.js 20 and npm 10.',
    priority: 'high',
    type: 'gitpull',
    comments: [
      { id: 'c3', author: 'devuser', createdAt: '2024-06-01T10:00:00Z', text: 'LGTM, but please pin the action versions.' },
      { id: 'c4', author: 'carol', createdAt: '2024-06-01T11:30:00Z', text: 'Pinned all versions in the latest push.' },
    ],
  },
  {
    id: 'disc-0007',
    title: 'Add rate limiting to API endpoints',
    status: 'open',
    author: 'david',
    sourceChannel: 'feature/rate-limit',
    targetChannel: 'main',
    description: 'Implements token bucket rate limiting for all /api/* routes.',
    priority: 'high',
    type: 'regular',
    comments: [
      { id: 'c5', author: 'alice', createdAt: '2024-06-05T09:15:00Z', text: 'What happens after the limit is exceeded? 429?' },
      { id: 'c6', author: 'david', createdAt: '2024-06-05T10:00:00Z', text: 'Yes, returns 429 with Retry-After header.' },
    ],
  },
  {
    id: 'disc-0008',
    title: 'Migrate from Jest to Vitest',
    status: 'closed',
    author: 'eve',
    sourceChannel: 'test/vitest',
    targetChannel: 'main',
    description: 'Speeds up test execution by migrating to Vitest and Vite.',
    priority: 'medium',
    type: 'gitpull',
    comments: [],
  },
  {
    id: 'disc-0009',
    title: 'Design system: Button component variants',
    status: 'open',
    author: 'carol',
    sourceChannel: 'ui/button-variants',
    targetChannel: 'develop',
    description: 'Adds primary, secondary, danger, and ghost button variants with proper styling.',
    priority: 'medium',
    type: 'regular',
    comments: [
      { id: 'c7', author: 'devuser', createdAt: '2024-06-10T14:00:00Z', text: 'Please add Storybook stories for all variants.' },
    ],
  },
  {
    id: 'disc-0010',
    title: 'Hotfix: Broken session logout on mobile',
    status: 'merged',
    author: 'bob',
    sourceChannel: 'hotfix/session-logout',
    targetChannel: 'main',
    description: 'Fixes issue where logout button did not clear session cookie on iOS Safari.',
    priority: 'critical',
    type: 'regular',
    comments: [
      { id: 'c8', author: 'alice', createdAt: '2024-06-12T08:00:00Z', text: 'Confirmed fixed on simulator, merging now.' },
    ],
  },
];

export const MOCK_COLLABORATORS: Collaborator[] = [
  { username: 'alice', role: 'maintainer' },
  { username: 'bob', role: 'developer' },
];

export const MOCK_PROTECTED_CHANNELS: string[] = ['main'];

export const MOCK_CONFLICTS: ConflictItem[] = [
  {
    conflictType: 'Order',
    path: 'src/index.ts',
    line: 12,
    contentA: 'const PORT = 3000;',
    contentB: 'const PORT = 8080;',
  },
];

export const MOCK_REPOS: Repo[] = [
  { id: '1', name: 'my-project', owner: MOCK_USER, isPrivate: false, isGithubSynced: true, role: 'owner', createdAt: '2024-01-01' },
  { id: '2', name: 'private-lib', owner: MOCK_USER, isPrivate: true, role: 'owner', createdAt: '2024-02-15' },
  { id: '3', name: 'shared-tools', owner: 'alice', isPrivate: false, isCollaborated: true, role: 'developer', createdAt: '2024-03-20' },
];

export const MOCK_PAGINATED: PaginatedRepos = {
  repositories: MOCK_REPOS,
  pagination: { totalItems: 3, hasNext: false, page: 1, limit: 10 },
};

export const MOCK_SSH_KEYS: SshKey[] = [
  { id: 'key-1', name: 'Laptop', key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest laptop key' },
  { id: 'key-2', name: 'CI Runner', key: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAATest ci key' },
];

export const MOCK_ORGS: Organization[] = [
  { 
    name: 'acme-corp', 
    description: 'Acme Corporation', 
    role: 'owner', 
    createdAt: '2024-01-01T00:00:00Z',
    repoCount: 12,
    memberCount: 5,
    isGithubSynced: true,
    isPrivate: true,
    lastActive: '2024-05-28T10:00:00Z',
    totalStars: 42,
    totalForks: 10,
    updatedAt: '2024-05-29T08:00:00Z'
  },
  { 
    name: 'open-source-collective', 
    description: 'OSS Projects', 
    role: 'member', 
    createdAt: '2024-02-01T00:00:00Z',
    repoCount: 34,
    memberCount: 128,
    isGithubSynced: false,
    isPrivate: false,
    lastActive: '2024-05-27T15:30:00Z',
    totalStars: 1024,
    totalForks: 256,
    updatedAt: '2024-05-28T14:00:00Z'
  },
];

export const MOCK_ORG_MEMBERS: OrgMember[] = [
  { username: 'devuser', role: 'owner', joinedAt: '2024-01-01T00:00:00Z' },
  { username: 'alice', role: 'member', joinedAt: '2024-01-02T00:00:00Z' },
  { username: 'bob', role: 'member', joinedAt: '2024-01-03T00:00:00Z' },
];
