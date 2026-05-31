import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import type { RepoMeta, Channel, RepoGitInfo } from '../../types';
import { fetchRepoMeta, fetchChannels, forkRepo, fetchRepoGitInfo } from '../../api';
import { Code, Box, GitFork, Copy, History, MessageSquare, Settings, Github } from 'lucide-react';
import Layout from '../../components/Layout';
import { Button, buttonVariants } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

import FilesTab from './FilesTab';
import PatchesTab from './PatchesTab';
import DiscussionsTab from './DiscussionsTab';
import RepoSettingsTab from './RepoSettingsTab';

const RepoDetail = () => {
  const { owner = '', name = '', tab: urlTab, channel: urlChannel } = useParams<{ owner: string; name: string; tab?: string; channel?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Derive active tab from :tab param OR from the 4th URL segment
  // Works for both /repos/u/n/patches  AND  /repos/u/n/patches/:hash
  const VALID_TABS = ['files', 'patches', 'discussions', 'settings', 'tree', 'blob'];
  const pathParts = location.pathname.split('/').filter(Boolean);
  // pathParts: ['repos', owner, name, tab?, id?]
  const tabFromPath = pathParts[3] && VALID_TABS.includes(pathParts[3]) ? pathParts[3] : undefined;
  
  const getTabValue = (rawTab?: string) => {
    if (rawTab === 'tree' || rawTab === 'blob') return 'files';
    return rawTab || 'files';
  };

  const initialTab = getTabValue(urlTab || tabFromPath);

  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const active = getTabValue(urlTab || tabFromPath);
    if (active !== tab) setTab(active);
  }, [urlTab, location.pathname]);

  // ── Shared repo state ─────────────────────────────────────────────
  const [repoMeta, setRepoMeta] = useState<RepoMeta | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [forkLoading, setForkLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(urlChannel || 'main');
  const [gitInfo, setGitInfo] = useState<RepoGitInfo | null>(null);

  useEffect(() => {
    if (urlChannel && urlChannel !== selectedChannel) {
      setSelectedChannel(urlChannel);
    }
  }, [urlChannel]);

  const currentUsername = localStorage.getItem('username');
  const hostname = window.location.hostname;
  const displayHost = import.meta.env.VITE_PUBLIC_IP || hostname;

  const userRole = repoMeta?.role ?? null;
  const canManage = ['owner', 'maintainer'].includes(userRole ?? '');

  // ── Initial load ──────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchRepoMeta(owner, name),
      fetchChannels(owner, name),
      fetchRepoGitInfo(owner, name).catch(() => ({ success: false, gitInfo: null }))
    ])
      .then(([repoData, channelsData, gitData]) => {
        setRepoMeta(repoData);
        setChannels(Array.isArray(channelsData) ? channelsData : []);
        setGitInfo(gitData?.success ? (gitData.gitInfo ?? null) : null);
      })
      .catch(err => console.error('Failed to load repo:', err))
      .finally(() => setLoading(false));
  }, [name]);

  // Called by DiscussionsTab after creating a PR (which creates a new channel)
  const refreshChannels = async () => {
    const ch = await fetchChannels(owner, name);
    setChannels(Array.isArray(ch) ? ch : []);
  };

  const handleTabChange = (t: string) => { setTab(t); navigate(`/repos/${owner}/${name}/${t}`); };

  const handleFork = async () => {
    setForkLoading(true);
    try {
      const r = await forkRepo(owner, name, name);
      if (r.error) alert('Failed to fork: ' + r.error);
      else navigate(`/repos/${r.owner}/${r.name}`);
    } catch (err) { alert('Failed to fork: ' + String(err)); }
    setForkLoading(false);
  };

  // ── Shared props passed to every tab ──────────────────────────────
  const base = {
    owner, name, repoMeta, channels,
    selectedChannel, setSelectedChannel,
    userRole, canManage, currentUsername, displayHost, navigate,
    gitInfo, setGitInfo,
  };

  if (!repoMeta && !loading) return (
    <Layout>
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Repository not found</h2>
        <Link to="/" className={cn(buttonVariants({ variant: "outline" }), "mt-4 hover:text-primary")}>
          Back to Dashboard
        </Link>
      </div>
    </Layout>
  );

  return (
    <Layout repoName={name} owner={owner}>
      <div className="space-y-6">

        {/* ── Repo Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-none bg-primary/10 flex items-center justify-center text-primary">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-muted-foreground font-normal text-lg">{owner}/</span>{name}
                <span className={`text-2xs px-2 py-0.5 rounded-none border uppercase ${
                  repoMeta?.isPrivate
                    ? 'bg-muted text-muted-foreground border-border'
                    : 'bg-primary/5 text-muted-foreground border-border/50'
                }`}>
                  {repoMeta?.isPrivate ? 'Private' : 'Public'}
                </span>
                {repoMeta?.isGithubSynced && (
                  <Github className="w-5 h-5 text-primary ml-2 drop-shadow-sm" />
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Project ID: <span className="font-mono text-2xs">{repoMeta?.id?.slice(0, 8)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleFork}
              disabled={forkLoading || repoMeta?.owner === currentUsername}>
              <GitFork className="w-4 h-4 mr-2" />
              {forkLoading ? 'Forking...' : 'Fork'}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" size="sm">
                  <Code className="w-4 h-4 mr-2" /> Clone
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Clone with SSH</DropdownMenuLabel>
                <div className="p-2">
                  <div className="flex items-center gap-2 bg-muted p-2 rounded-none border">
                    <code className="text-xs truncate flex-1">
                      pijul clone {currentUsername}@{displayHost}:/{repoMeta?.owner}/{name} --channel {selectedChannel}
                    </code>
                    <Button variant="ghost" size="icon" className="h-6 w-6"
                      onClick={() => navigator.clipboard.writeText(
                        `pijul clone ${currentUsername}@${displayHost}:/${repoMeta?.owner}/${name}  --channel ${selectedChannel}`
                      )}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={tab} onValueChange={handleTabChange} className="">
          <div className="border-b w-full">
            <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6 ">
            <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent  data-[state=active]:text-primary hover:text-foreground px-1 py-2 h-auto">
              <Code className="w-4 h-4 mr-2" /> Code
            </TabsTrigger>
            <TabsTrigger value="patches" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary  hover:text-foreground px-1 py-2 h-auto">
              <History className="w-4 h-4 mr-2" /> Patches
            </TabsTrigger>
            <TabsTrigger value="discussions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary  hover:text-foreground px-1 py-2 h-auto">
              <MessageSquare className="w-4 h-4 mr-2" /> Discussions
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary  hover:text-foreground  px-1 py-2 h-auto">
                <Settings className="w-4 h-4 mr-2" /> Settings
              </TabsTrigger>
            )}
          </TabsList>
          </div>

        </Tabs>
          <div className="mt-6">
            {tab === 'files'       && <FilesTab        {...base} />}
            {tab === 'patches'     && <PatchesTab       {...base} />}
            {tab === 'discussions' && <DiscussionsTab   {...base} refreshChannels={refreshChannels} />}
            {tab === 'settings'    && <RepoSettingsTab  {...base} />}
          </div>
      </div>
    </Layout>
  );
};

export default RepoDetail;
