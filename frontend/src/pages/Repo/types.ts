import type { RepoMeta, Channel, RepoGitInfo } from '../../types';

/** Minimal shared props passed to every tab */
export interface TabBaseProps {
  owner: string;
  name: string;
  repoMeta: RepoMeta | null;
  channels: Channel[];
  selectedChannel: string;
  setSelectedChannel: (ch: string) => void;
  userRole: string | null;
  canManage: boolean;
  currentUsername: string | null;
  displayHost: string;
  navigate: (to: string) => void;
  gitInfo: RepoGitInfo | null;
  setGitInfo: (info: RepoGitInfo | null) => void;
}

/** DiscussionsTab also needs to refresh channels after creating a PR */
export interface DiscussionsTabExtraProps extends TabBaseProps {
  refreshChannels: () => Promise<void>;
}
