import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Repo } from '../types';
import { 
  Book, 
  Lock, 
  Globe, 
  User, 
  GitBranch, 
  Compass, 
  Plus, 
  Search,
  Filter,
  ChevronRight,
  ArrowLeft,
  GitPullRequest,
  Shield,
  Wrench,
  Github,
  Loader2
} from 'lucide-react';

import Layout from '../components/Layout';
import { Button, buttonVariants } from '../components/ui/button';
import { Card, CardHeader } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '../components/ui/dropdown-menu';
import ReposScroll from './reposScroll';

interface RepoCardProps {
  repo: Repo;
}

const RepoCard = ({ repo }: RepoCardProps) => (
  <Card className="hover:border-primary/50 transition-colors group cursor-pointer overflow-hidden">
    <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary/80 group-hover:text-primary group-hover:bg-primary/20 transition-all">
          <Book className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Link 
              to={`/repos/${repo.owner}/${repo.name}`} 
              className="font-semibold text-foreground hover:text-primary transition-colors"
            >
              <span className="text-muted-foreground font-normal">{repo.owner}/</span>{repo.name}
            </Link>
            {repo.isPrivate ? (
              <Lock className="w-3 h-3 text-muted-foreground/60" />
            ) : (
              <Globe className="w-3 h-3 text-muted-foreground/60" />
            )}
            {repo.isCollaborated && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                <GitPullRequest className="w-3 h-3" />
                {repo.role === 'developer' && (
                  <Wrench className="w-3 h-3" />
                )}
                {repo.role === 'maintainer' && (
                  <Shield className="w-3 h-3" />
                )}
              </div>
            )}
            {repo.isGithubSynced && (
              <Github className="w-4 h-4 text-primary/80 ml-2 drop-shadow-sm" />
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span>Created {new Date(repo.createdAt).toLocaleDateString()}</span>
            {repo.role === 'developer' && (
              <span className="text-2xs text-primary/70">developer</span>
            )}
            {repo.role === 'maintainer' && (
              <span className="text-2xs text-primary/70">maintainer</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <div className="text-xs text-muted-foreground">Last updated</div>
          <div className="text-xs font-medium">2 days ago</div>
        </div>
      </div>
    </CardHeader>
  </Card>
);

type SectionKey = 'personal' | 'contributions' | 'public';

const Dashboard = () => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [seeMoreStates, setSeeMoreStates] = useState<Record<SectionKey, boolean>>({
    personal: false,
    contributions: false,
    public: false
  });
  const [loadingMore] = useState<Record<SectionKey, boolean>>({
    personal: false,
    contributions: false,
    public: false
  });
  const currentUsername = localStorage.getItem('username');
  
  useEffect(() => {
    setIsSearching(true);
    const handler = setTimeout(() => {
      import('../api').then(({ searchRepos }) => {
        searchRepos(searchType, search).then(data => {
          const reposData = Array.isArray(data) ? data : [];
          const processedRepos: Repo[] = reposData.map(repo => ({
            ...repo,
            isCollaborated: repo.isCollaborated || false
          }));
          setRepos(processedRepos);
          setIsSearching(false);
          setInitialLoading(false);
        });
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [search, searchType]);

  const filteredRepos = repos;

  const allMyRepos = filteredRepos.filter(r => r.owner === currentUsername);
  const myRepos = seeMoreStates.personal ? allMyRepos : allMyRepos.slice(0, 4);

  const allContributionsRepos = filteredRepos.filter(r => 
    r.isCollaborated === true && r.owner !== currentUsername
  );
  const contributionsRepos = seeMoreStates.contributions ? allContributionsRepos : allContributionsRepos.slice(0, 4);

  const allPublicRepos = filteredRepos.filter(r => 
    !r.isPrivate && r.owner !== currentUsername && !r.isCollaborated
  );
  const publicRepos = seeMoreStates.public ? allPublicRepos : allPublicRepos.slice(0, 4);

  const toggleSeeMore = (section: SectionKey) => {
    setSeeMoreStates(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const setclearMoreStates = () => {
    setSeeMoreStates({ personal: false, contributions: false, public: false });
  };

  if (initialLoading) return (
    <Layout>
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <GitBranch className="w-8 h-8 mb-4 opacity-20 animate-pulse" />
        <p>Fetching repositories...</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl mx-auto">
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage your version control repositories and collaborations.
            </p>
          </div>
          <Link to="/new" className={buttonVariants({ variant: 'default' })}>
            <Plus className="w-4 h-4 mr-2" /> New Project
          </Link>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filter by name or owner..." 
              className="pl-9 pr-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin absolute right-3 top-2.5" />
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" /> 
                {searchType === 'all' ? 'All Projects' : searchType === 'personal' ? 'My Projects' : searchType === 'collaborated' ? 'Contributions' : 'Public Projects'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSearchType('all')}>All Projects</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchType('personal')}>My Projects</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchType('collaborated')}>Contributions</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSearchType('public')}>Public Projects</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Project Lists */}
        {(seeMoreStates.personal || seeMoreStates.contributions || seeMoreStates.public) ? <>
          <Button variant="ghost" size="sm" onClick={setclearMoreStates} className="gap-2 hover:text-primary">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
          <ReposScroll repoType={seeMoreStates} />
        </> : <div className="space-y-12">
          {/* My Projects Section */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> My Projects
                <span className="bg-muted text-muted-foreground text-2xs px-2 py-0.5 rounded-full">
                  {allMyRepos.length}
                </span>
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => toggleSeeMore('personal')}
                className="text-muted-foreground hover:text-primary"
                disabled={loadingMore.personal}
              >
                <>
                  See All
                  <ChevronRight className="w-4 h-4 ml-1 transition-transform" />
                </>
              </Button>
            </div>
            {myRepos.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl border-border text-muted-foreground">
                <User className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>No personal projects found.</p>
                <Link to="/new" className={buttonVariants({ variant: 'link' })}>Create your first project</Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {myRepos.map(repo => <RepoCard key={repo.id || repo.name} repo={repo} />)}
              </div>
            )}
          </section>

          {/* Contributions Section */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-primary" /> Contributions
                <span className="bg-muted text-muted-foreground text-2xs px-2 py-0.5 rounded-full">
                  {allContributionsRepos.length}
                </span>
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => toggleSeeMore('contributions')}
                className="text-muted-foreground hover:text-primary"
                disabled={loadingMore.contributions}
              >
                <>
                  See All
                  <ChevronRight className="w-4 h-4 ml-1 transition-transform" />
                </>
              </Button>
            </div>
            {contributionsRepos.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl border-border text-muted-foreground">
                <GitPullRequest className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>No contributions yet.</p>
                <p className="text-xs mt-1">Projects you collaborate on will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {contributionsRepos.map(repo => <RepoCard key={repo.id || repo.name} repo={repo} />)}
              </div>
            )}
          </section>

          {/* Explore Section */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary" /> Explore
                <span className="bg-muted text-muted-foreground text-2xs px-2 py-0.5 rounded-full">
                  {allPublicRepos.length}
                </span>
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => toggleSeeMore('public')}
                className="text-muted-foreground hover:text-primary"
                disabled={loadingMore.public}
              >
                <>
                  See All
                  <ChevronRight className="w-4 h-4 ml-1 transition-transform" />
                </>
              </Button>
            </div>
            {publicRepos.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl border-border text-muted-foreground">
                <Compass className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>No public projects to discover.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {publicRepos.map(repo => <RepoCard key={repo.id || repo.name} repo={repo} />)}
              </div>
            )}
          </section>
        </div>}
      </div>
    </Layout>
  );
};

export default Dashboard;