import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Repo, RepoType } from '../types';
import { 
  Book, 
  Lock, 
  Globe, 
  GitBranch, 
  GitPullRequest,
  Shield,
  Wrench,
  Loader2
} from 'lucide-react';
import { Card, CardHeader } from '../components/ui/card';
import { fetchPersonalRepos, fetchCollabRepos, fetchPublicRepos } from '../api';

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

interface ReposScrollProps {
  repoType: RepoType;
}

const ReposScroll = ({ repoType }: ReposScrollProps) => {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastRepoRef = useCallback((node: Element | null) => {
    if (loadingMore) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreRepos();
      }
    });
    if (node) observerRef.current.observe(node);
  }, [loadingMore, hasMore]);

  function getFetchFunction() {
    if (repoType.personal) return fetchPersonalRepos;
    if (repoType.contributions) return fetchCollabRepos;
    if (repoType.public) return fetchPublicRepos;
    return fetchPersonalRepos;
  }

  function getRepoTypeName() {
    if (repoType.personal) return 'Personal';
    if (repoType.contributions) return 'Contributions';
    if (repoType.public) return 'Public';
    return 'Repositories';
  }

  async function loadMoreRepos() {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    const nextPage = page + 1;
    const fetchFn = getFetchFunction();
    
    try {
      const response = await fetchFn(nextPage, 10);
      if (response.repositories && response.repositories.length > 0) {
        setRepos(prev => [...prev, ...response.repositories]);
        setPage(nextPage);
        setHasMore(response.pagination.hasNext);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error(`Error loading more ${getRepoTypeName()} repos:`, error);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const loadInitialRepos = async () => {
      setLoading(true);
      const fetchFn = getFetchFunction();
      
      try {
        const response = await fetchFn(1, 10);
        if (response.repositories) {
          const processedRepos: Repo[] = response.repositories.map(repo => ({
            ...repo,
            isCollaborated: repo.isCollaborated || false
          }));
          setRepos(processedRepos);
          setTotalItems(response.pagination.totalItems);
          setHasMore(response.pagination.hasNext);
          setPage(1);
        }
      } catch (error) {
        console.error(`Error loading ${getRepoTypeName()} repos:`, error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialRepos();
  }, [repoType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-8 h-8 mb-4 animate-spin" />
        <p>Loading {getRepoTypeName()} repositories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{getRepoTypeName()} Repositories</h2>
          <p className="text-muted-foreground mt-1">
            Showing {repos.length} of {totalItems} repositories
          </p>
        </div>
      </div>

      {repos.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl border-border text-muted-foreground">
          <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p>No {getRepoTypeName().toLowerCase()} repositories found.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {repos.map((repo, index) => {
            if (index === repos.length - 1) {
              return (
                <div ref={lastRepoRef} key={repo.id || repo.name}>
                  <RepoCard repo={repo} />
                </div>
              );
            } else {
              return <RepoCard key={repo.id || repo.name} repo={repo} />;
            }
          })}
        </div>
      )}

      {loadingMore && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!hasMore && repos.length > 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          You've reached the end of {getRepoTypeName().toLowerCase()} repositories
        </div>
      )}
    </div>
  );
};

export default ReposScroll;