import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { DiscussionsTabExtraProps } from './types';
import type { Discussion, ConflictItem } from '../../types';
import {
  fetchDiscussions, fetchDiscussion, createDiscussion, addComment,
  mergeDiscussion, closeDiscussion, deleteDiscussion, getMergeConflicts,
} from '../../api';
import {
  ArrowLeft, MessageSquare, Terminal, Copy, CheckCircle2,
  ArrowUpCircle, Loader2, Trash2, XCircle, Github, Pin, AlertTriangle,
  ArrowDown, Minus, ArrowUp,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import ConflictsBox from '../../components/repo/conflicts';

const DiscussionsTab = ({
  owner, name, repoMeta, channels, currentUsername, displayHost,
  canManage, refreshChannels,
}: DiscussionsTabExtraProps) => {
  const { discussionId: urlDiscussionId } = useParams<{ discussionId?: string }>();
  const navigate = useNavigate();
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [conflicts, setConflicts] = useState<ConflictItem[] | null>(null);
  const [selectedPR, setSelectedPR] = useState<Discussion | null>(null);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [newPR, setNewPR] = useState({ title: '', description: '', sourceChannel: '', targetChannel: 'main' });
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');

  const [loadingMore, setLoadingMore] = useState(false);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const hasConflicts = conflicts != null && conflicts.length > 0;

  useEffect(() => {

    if (urlDiscussionId) return;
    setLoading(true);
    setPage(1);
    setDiscussions([]);
    fetchDiscussions(owner, name, 1, 10, priorityFilter === 'all' ? undefined : priorityFilter)
      .then(data => setDiscussions(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [priorityFilter, urlDiscussionId]);

  const loadMore = async () => {
    if (loadingMore || isLastPage) return;
    setLoadingMore(true);
    const next = page + 1;

    try {
      const data = await fetchDiscussions(owner, name, next, 10, priorityFilter === 'all' ? undefined : priorityFilter);
      const arr = Array.isArray(data) ? data : [];
      setPage(next);
      setDiscussions(prev => [...prev, ...arr]);
      setIsLastPage(arr.length === 0);
    } catch (err) { console.error(err); }
    finally { setLoadingMore(false); }
  };

  const lastRef = useCallback((node: Element | null) => {
    if (loadingMore || isLastPage) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !isLastPage) loadMore();
    });
    if (node) observerRef.current.observe(node);
  }, [loadingMore, isLastPage,page,owner,name,priorityFilter]);

  const showSelectedPR = async (id: string) => {
    setLoading(true);
    try { setSelectedPR(await fetchDiscussion(owner, repoMeta?.name ?? name, id)); }
    catch { alert('Failed to show selected PR'); }
    setLoading(false);
  };

  const showConflicts = async (prId: string) => {
    setLoading(true);
    try {
      const res = await getMergeConflicts(owner, name, prId);
      if (res.error) { alert('Error: ' + res.error); return; }
      setConflicts(res.isconflicts ? (res.conflicts ?? null) : null);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  // Auto-open a specific discussion when :discussionId is in the URL.
  // Both showSelectedPR and showConflicts are defined above, so this is safe.
  useEffect(() => {
    if (!urlDiscussionId) return;
    showSelectedPR(urlDiscussionId);
    showConflicts(urlDiscussionId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlDiscussionId]);

  const handleCreatePR = async () => {
    try {
      const pr = await createDiscussion(owner, name, {
        title: newPR.title, description: newPR.description,
        targetChannel: newPR.targetChannel || 'main',
      });
      if (pr.error) { alert('Failed: ' + pr.error); return; }
      setPage(1);
      setDiscussions(await fetchDiscussions(owner, name));
      setIsCreatingPR(false);
      setNewPR({ title: '', description: '', sourceChannel: '', targetChannel: 'main' });
      await refreshChannels();
    } catch { alert('Failed to create discussion'); }
  };

  const handleAddComment = async (prId: string) => {
    if (!commentText.trim()) return;
    try {
      const updated = await addComment(owner, name, prId, commentText);
      if (selectedPR?.id === prId) setSelectedPR(updated);
      setDiscussions(prev => prev.map(d => d.id === prId ? updated : d));
      setCommentText('');
    } catch { alert('Failed to add comment'); }
  };

  const handleMergePR = async (prId: string) => {
    if (hasConflicts && !confirm('There are merge conflicts. Merge anyway?')) return;
    try {
      await mergeDiscussion(owner, name, prId);
      setPage(1);
      setDiscussions(await fetchDiscussions(owner, name));
      if (selectedPR?.id === prId) setSelectedPR({ ...selectedPR, status: 'merged' as const });
      alert('Merged successfully');
    } catch (err) { alert('Failed to merge: ' + String(err)); }
  };

  const handleClosePR = async (prId: string) => {
    if (!confirm('Close this discussion? The branch will be permanently deleted.')) return;
    try {
      const res = await closeDiscussion(owner, name, prId);
      if (res.error) { alert('Error: ' + res.error); return; }
      setPage(1);
      setDiscussions(await fetchDiscussions(owner, name));
      if (selectedPR?.id === prId) setSelectedPR({ ...selectedPR, status: 'closed' as const });
    } catch (err) { alert('Close failed: ' + String(err)); }
  };

  const handleDeletePR = async (prId: string) => {
    if (!confirm('Permanently delete this discussion?')) return;
    try {
      const res = await deleteDiscussion(owner, name, prId);
      if (res.error) { alert('Error: ' + res.error); return; }
      setSelectedPR(null);
      setPage(1);
      setDiscussions(await fetchDiscussions(owner, name));
    } catch (err) { alert('Delete failed: ' + String(err)); }
  };

  if (selectedPR) return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Button variant="ghost" size="sm" onClick={() => { setSelectedPR(null); setCommentText(''); setConflicts(null);navigate(`/repos/${owner}/${name}/discussions`); }} className="gap-2 hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> Back to discussions
      </Button>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">{selectedPR.title}</h2>
          <span className={`px-2 py-0.5 rounded-sm text-xs font-bold uppercase border ${
            selectedPR.status === 'merged' ? 'bg-accent/10 text-accent border-accent/20' :
            selectedPR.status === 'open' ? 'bg-primary/10 text-primary border-primary/20' :
            'bg-muted text-muted-foreground border-border'
          }`}>{selectedPR.status}</span>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {selectedPR.status === 'open' && (<>
              <Button onClick={() => handleMergePR(selectedPR.id)} className={`bg-primary text-primary-foreground ${hasConflicts ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Merge Discussion
              </Button>
              <Button variant="outline" onClick={() => handleClosePR(selectedPR.id)} className="border-primary text-primary hover:bg-orange-500/10">
                <XCircle className="w-4 h-4 mr-2" /> Close Discussion
              </Button>
            </>)}
            <Button variant="outline" onClick={() => handleDeletePR(selectedPR.id)} className="border-destructive/50 text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground border-b pb-4">
        <span className="font-bold text-primary">{selectedPR.author}</span>
        <span>wants to merge</span>
        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{selectedPR.sourceChannel}</span>
        <span>into</span>
        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{selectedPR.targetChannel}</span>
      </div>
      {selectedPR.description && selectedPR.description.length > 0 && (
        <Card className="border-border/50 rounded"><CardContent className="pt-6"><p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedPR.description}</p></CardContent></Card>
      )}
      {selectedPR.status === 'open' && (
        <div className="bg-primary/5 border border-primary/20 rounded p-4 space-y-3">
          <h4 className="text-sm font-bold flex items-center gap-2"><Terminal className="w-4 h-4" /> How to contribute</h4>
          <div className="bg-background border rounded p-2 flex items-center justify-between">
            <code className="text-[10px] font-mono text-primary">
              pijul push {currentUsername}@{displayHost}:/{repoMeta?.owner}/{name} --to-channel {selectedPR.sourceChannel}
            </code>
            <Button variant="ghost" size="icon" className="h-6 w-6"
              onClick={() => navigator.clipboard.writeText(`pijul push ${currentUsername}@${displayHost}:/${repoMeta?.owner}/${name} --to-channel ${selectedPR.sourceChannel}`)}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
      {conflicts && <ConflictsBox conflicts={conflicts} source={selectedPR.sourceChannel} target={selectedPR.targetChannel} />}
      <div className="space-y-4 ">
        <h3 className="font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Comments</h3>
        <div className="space-y-3">
          {selectedPR.comments.map(c => (
            <div key={c.id} className="bg-muted/30 border rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{c.author}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm">{c.text}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3 pt-4">
          <textarea className="w-full bg-background border rounded p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-25"
            placeholder="Leave a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} />
          <div className="flex justify-end">
            <Button onClick={() => handleAddComment(selectedPR.id)} disabled={!commentText.trim()} size="sm">Comment</Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isCreatingPR) return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-300">
      <h2 className="text-2xl font-bold">New Discussion / PR</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input placeholder="e.g. Add authentication feature" value={newPR.title} onChange={e => setNewPR({ ...newPR, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <textarea className="w-full bg-background border rounded-none p-3 text-sm min-h-37.5 focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="What changes are you proposing?" value={newPR.description} onChange={e => setNewPR({ ...newPR, description: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Merge into (Target Branch)</label>
          <select className="w-full h-10 bg-background border rounded-none px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
            value={newPR.targetChannel} onChange={e => setNewPR({ ...newPR, targetChannel: e.target.value })}>
            {channels.map(c => <option key={c.name} value={c.name}>{c.name}{c.isCurrent ? ' (current)' : ''}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">The branch your changes will be merged into.</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setIsCreatingPR(false)}>Cancel</Button>
          <Button onClick={handleCreatePR} disabled={!newPR.title}>Create Discussion</Button>
        </div>
      </div>
    </div>
  );
  console.log("here");
  console.log(discussions);
  // Sort: critical pinned to top, then rest
  const sortedDiscussions = [
    ...discussions.filter(d => d.priority === 'critical'),
    ...discussions.filter(d => d.priority !== 'critical'),
  ];

  // ── Priority styling helpers ──
  const PRIORITY_COLORS: Record<string, string> = {
    low:      'text-[hsl(var(--chart-2))] border-[hsl(var(--chart-2)/0.3)] bg-[hsl(var(--chart-2)/0.08)]',
    medium:   'text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3)/0.3)] bg-[hsl(var(--chart-3)/0.08)]',
    high:     'text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4)/0.3)] bg-[hsl(var(--chart-4)/0.08)]',
    critical: 'text-destructive border-destructive/30 bg-destructive/8',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Discussions</h2>
        <Button size="sm" onClick={() => setIsCreatingPR(true)}>New Discussion</Button>
      </div>

      {/* ── Priority Filter Bar ── */}
      <div className="grid grid-cols-4 gap-2">
        {(['low', 'medium', 'high', 'critical'] as const).map(p => {
          const Icon = p === 'low' ? ArrowDown : p === 'medium' ? Minus : p === 'high' ? ArrowUp : AlertTriangle;
          const isSelected = priorityFilter === p;
          return (
            <button
              key={p}
              onClick={() => setPriorityFilter(isSelected ? 'all' : p)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold uppercase rounded-lg border transition-all ${
                isSelected
                  ? PRIORITY_COLORS[p] + ' ring-1 ring-current shadow-sm'
                  : PRIORITY_COLORS[p] + ' opacity-60 hover:opacity-100 hover:bg-opacity-20'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {p}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : sortedDiscussions.length === 0 ? (
        <div className="p-20 text-center border-2 border-dashed rounded-none space-y-3">
          <MessageSquare className="w-12 h-12 mx-auto opacity-20 text-primary" />
          <h3 className="text-lg font-semibold">No discussions yet</h3>
          <p className="text-sm text-muted-foreground">Submit your first PR to request changes.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sortedDiscussions.map((disc, idx) => {
            const isCritical = disc.priority === 'critical';
            const isGitpull  = disc.type === 'gitpull';
            return (
              <Card key={disc.id} ref={(sortedDiscussions.length - 1 === idx) ? lastRef : null}
                className={`hover:border-primary/50 transition-all hover:translate-x-1 cursor-pointer ${
                  isCritical ? 'border-l-4 border-l-destructive' : ''
                } ${
                  isGitpull  ? 'border-r-4 border-r-[hsl(var(--chart-1))]' : ''
                }`}
                onClick={() => navigate(`/repos/${owner}/${name}/discussions/${disc.id}`)}>
                <CardHeader className="p-4 flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    {/* Icon: gitpull vs regular */}
                    <div className={`w-8 h-8 rounded-none flex items-center justify-center ${
                      isGitpull
                        ? 'bg-[hsl(var(--chart-1)/0.15)] text-[hsl(var(--chart-1))]'
                        : disc.status === 'merged'
                          ? 'bg-accent/10 text-accent'
                          : 'bg-primary/10 text-primary'
                    }`}>
                      {isGitpull
                        ? <Github className="w-4 h-4" />
                        : disc.status === 'merged'
                          ? <ArrowUpCircle className="w-4 h-4" />
                          : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {isCritical && <Pin className="w-3 h-3 text-destructive" />}
                        <span className="font-bold text-sm">{disc.title}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        #{disc.id.slice(-4)} · {disc.author}
                        {isGitpull && <span className="ml-2 text-[hsl(var(--chart-1))] font-semibold">github sync</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {disc.priority && (
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 border rounded-none ${PRIORITY_COLORS[disc.priority] ?? ''}`}>
                        {disc.priority}
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 border rounded-none">{disc.status}</span>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
          {loadingMore && <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
          {isLastPage && <div className="text-center py-4 text-muted-foreground text-sm">You've reached the end of Discussions</div>}
        </div>
      )}
    </div>
  );
};

export default DiscussionsTab;
