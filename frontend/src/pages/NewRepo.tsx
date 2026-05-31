import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRepo, fetchGitRepos } from '../api';
import type { GitRepo } from '../types';
import {
  Lock, Globe, Info, Github, GitMerge, GitPullRequest,
  Search, Check, ChevronDown, Loader2, Plus, Link2
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';

// ── GitRepo search dropdown ──────────────────────────────────────────────────

interface GitRepoDropdownProps {
  value: string;
  onSelect: (repo: GitRepo) => void;
}

const GitRepoDropdown = ({ value, onSelect }: GitRepoDropdownProps) => {
  const [search, setSearch] = useState('');
  const [repos, setRepos] = useState<GitRepo[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<string>('');
  const LIMIT = 10;

  const loadRepos = useCallback(async (q: string, pg: number, reset: boolean) => {
    setLoading(true);
    try {
      const data = await fetchGitRepos(q, pg, LIMIT);
      const items = data.repos ?? [];
      setRepos(prev => reset ? items : [...prev, ...items]);
      setHasMore(items.length === LIMIT);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    searchRef.current = search;
    const t = setTimeout(() => {
      setPage(1);
      setRepos([]);
      loadRepos(search, 1, true);
    }, 300);
    return () => clearTimeout(t);
  }, [search, loadRepos]);

  // Open → load initial
  useEffect(() => {
    if (open) loadRepos('', 1, true);
  }, [open, loadRepos]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadRepos(searchRef.current, nextPage, false);
    }
  }, [loading, hasMore, page, loadRepos]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 border border-border rounded-md bg-background text-sm hover:bg-accent/30 transition-colors"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || 'Search GitHub repositories…'}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-xl overflow-hidden">
          {/* search input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              placeholder="Search repos…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* results list */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-64 overflow-y-auto"
          >
            {repos.length === 0 && !loading && (
              <div className="text-center py-6 text-sm text-muted-foreground">No repositories found</div>
            )}
            {repos.map(r => (
              <button
                key={`${r.owner}/${r.repoName}`}
                type="button"
                onClick={() => { onSelect(r); setOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent/40 transition-colors text-sm"
              >
                <div className="flex items-center gap-2 text-left">
                  <Github className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">{r.owner}/</span>
                  <span className="font-medium">{r.repoName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-2xs px-1.5 py-0.5 rounded border uppercase ${
                    r.access === 'private'
                      ? 'border-border text-muted-foreground'
                      : 'border-primary/40 text-primary/80'
                  }`}>
                    {r.access}
                  </span>
                  {value === `${r.owner}/${r.repoName}` && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
              </button>
            ))}
            {loading && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main page ────────────────────────────────────────────────────────────────

const NewRepo = () => {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // GitHub Sync state
  const [isGitSync, setIsGitSync] = useState(false);
  const [iscreateNewGitRepo, setIscreateNewGitRepo] = useState(true);
  const [newGitRepoName, setNewGitRepoName] = useState('');
  const [selectedGitRepo, setSelectedGitRepo] = useState('');
  const [syncMethod, setSyncMethod] = useState<'direct' | 'pr'>('direct');
  const [autoSync, setAutoSync] = useState(false);

  const navigate = useNavigate();

  const prevCreateMode = useRef(iscreateNewGitRepo);

  // Only auto-fill when SWITCHING TO "create new" mode, not on every render
  useEffect(() => {
    if (iscreateNewGitRepo && !prevCreateMode.current) {
      // Just toggled to create-new: seed with project name only if field is empty
      if (!newGitRepoName && name) {
        setNewGitRepoName(name);
      }
    }
    prevCreateMode.current = iscreateNewGitRepo;
  }, [iscreateNewGitRepo]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name) return;
    setLoading(true);
    setError('');
    try {
      const data = await createRepo({
        name,
        isPrivate,
        ...(isGitSync ? {
          isGitSync: true,
          iscreateNewGitRepo,
          syncMethod,
          autoSync,
          ...(iscreateNewGitRepo
            ? { newGitRepoName: newGitRepoName || name }
            : { gitRepoName: selectedGitRepo }),
        } : {}),
      });
      if (data.error) throw new Error(data.error);
      navigate(`/repos/${data.owner}/${data.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Create a new project</h1>
          <p className="text-muted-foreground text-sm">
            Projects are where you keep your code (patches), files, and history.
          </p>
        </div>

        <Card className="border-border/50">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-lg">Project details</CardTitle>
              <CardDescription>Enter a unique name for your project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Project Name */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-primary">Project name</label>
                <Input
                  placeholder="my-awesome-project"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-10"
                />
                <p className="text-2xs text-muted-foreground italic">
                  Project URL: {window.location.host}/repos/{localStorage.getItem('username') || 'user'}/{name || '...'}
                </p>
              </div>

              {/* Visibility */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-primary">Visibility Level</label>
                <div className="grid gap-3">
                  {[false, true].map(priv => (
                    <div
                      key={String(priv)}
                      className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                        isPrivate === priv
                          ? 'bg-primary/5 border-primary/50 shadow-sm'
                          : 'hover:bg-accent/50 border-border/50'
                      }`}
                      onClick={() => setIsPrivate(priv)}
                    >
                      <div className="mt-1">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isPrivate === priv ? 'border-primary' : 'border-muted-foreground'}`}>
                          {isPrivate === priv && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                          {priv ? <Lock className="w-4 h-4 text-muted-foreground" /> : <Globe className="w-4 h-4 text-muted-foreground" />}
                          {priv ? 'Private' : 'Public'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {priv ? 'Project access must be granted explicitly to each user.' : 'Anyone can see the project. You choose who can record patches.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── GitHub Sync Toggle ── */}
              <div className="space-y-4">
                <div
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    isGitSync ? 'bg-primary/5 border-primary/50' : 'border-border/50 hover:bg-accent/30'
                  }`}
                  onClick={() => setIsGitSync(v => !v)}
                >
                  <div className="flex items-center gap-3">
                    <Github className={`w-5 h-5 ${isGitSync ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <p className="text-sm font-semibold">Enable GitHub Sync</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Mirror this project with a GitHub repository
                      </p>
                    </div>
                  </div>
                  {/* Toggle pill */}
                  <div className={`relative w-11 h-6 rounded-full transition-colors ${isGitSync ? 'bg-primary' : 'bg-muted'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${isGitSync ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                {/* ── GitHub sub-form ── */}
                {isGitSync && (
                  <div className="ml-4 pl-4 border-l-2 border-primary/30 space-y-5">

                    {/* Sync Method */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-primary">Sync method</label>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { value: 'direct', label: 'Direct Push', desc: 'Patches sync directly to the GitHub branch', icon: GitMerge },
                          { value: 'pr', label: 'Pull Request', desc: 'Each sync opens a PR for review', icon: GitPullRequest },
                        ] as const).map(opt => (
                          <div
                            key={opt.value}
                            onClick={() => setSyncMethod(opt.value)}
                            className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                              syncMethod === opt.value
                                ? 'bg-primary/5 border-primary/50 shadow-sm'
                                : 'border-border/50 hover:bg-accent/30'
                            }`}
                          >
                            <opt.icon className={`w-4 h-4 mt-0.5 shrink-0 ${syncMethod === opt.value ? 'text-primary' : 'text-muted-foreground'}`} />
                            <div>
                              <p className="text-sm font-medium">{opt.label}</p>
                              <p className="text-2xs text-muted-foreground mt-0.5 leading-tight">{opt.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Auto Sync Toggle */}
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        autoSync ? 'bg-primary/5 border-primary/50 shadow-sm' : 'border-border/50 hover:bg-accent/30'
                      }`}
                      onClick={() => setAutoSync(v => !v)}
                    >
                      <div>
                        <p className="text-sm font-medium">Auto Sync (on no conflict)</p>
                        <p className="text-2xs text-muted-foreground mt-0.5 leading-tight">
                          Auto push when GitHub pull discussions are merged
                        </p>
                      </div>
                      <div className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${autoSync ? 'bg-primary' : 'bg-muted'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${autoSync ? 'left-6' : 'left-1'}`} />
                      </div>
                    </div>

                    {/* Create new / Link existing */}
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-primary">GitHub repository</label>
                      <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                        <button
                          type="button"
                          onClick={() => setIscreateNewGitRepo(true)}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 transition-colors ${
                            iscreateNewGitRepo ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent/40 text-muted-foreground'
                          }`}
                        >
                          <Plus className="w-4 h-4" /> Create new
                        </button>
                        <button
                          type="button"
                          onClick={() => setIscreateNewGitRepo(false)}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 transition-colors border-l border-border ${
                            !iscreateNewGitRepo ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent/40 text-muted-foreground'
                          }`}
                        >
                          <Link2 className="w-4 h-4" /> Link existing
                        </button>
                      </div>
                    </div>

                    {/* Conditional: new name input OR existing repo search */}
                    {iscreateNewGitRepo ? (
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">New GitHub repo name</label>
                        <Input
                          placeholder={name || 'repo-name'}
                          value={newGitRepoName}
                          onChange={e => setNewGitRepoName(e.target.value)}
                          className="h-9"
                        />
                        <p className="text-2xs text-muted-foreground italic">
                          Will create <span className="text-foreground font-mono">{localStorage.getItem('username') || 'you'}/{newGitRepoName || name || '...'}</span> on GitHub
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Search GitHub repositories</label>
                        <GitRepoDropdown
                          value={selectedGitRepo}
                          onSelect={r => setSelectedGitRepo(`${r.owner}/${r.repoName}`)}
                        />
                        {selectedGitRepo && (
                          <p className="text-2xs text-muted-foreground">
                            Linked to: <span className="text-primary font-mono">{selectedGitRepo}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  {error}
                </div>
              )}
            </CardContent>

            <CardFooter className="bg-muted/30 border-t p-4 px-6 flex justify-between items-center">
              <Button variant="ghost" type="button" onClick={() => navigate('/')}>Cancel</Button>
              <Button
                type="submit"
                disabled={loading || !name || (isGitSync && iscreateNewGitRepo && !newGitRepoName) || (isGitSync && !iscreateNewGitRepo && !selectedGitRepo)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[140px]"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
                ) : 'Create Project'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </Layout>
  );
};

export default NewRepo;
