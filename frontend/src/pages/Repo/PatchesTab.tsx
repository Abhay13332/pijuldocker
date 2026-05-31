import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { TabBaseProps } from './types';
import type { Patch, PatchDetail, Hunk, DiffLine } from '../../types';
import { fetchRepoLog, fetchPatchDetail } from '../../api';
import {
  History, ArrowLeft, Code, Clock, User, Users, Terminal,
  MessageSquare, Copy, CheckCircle2, Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

const PatchesTab = ({ owner, name, selectedChannel }: TabBaseProps) => {
  const { hash: urlHash } = useParams<{ hash?: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [log, setLog] = useState<Patch[]>([]);
  const [patchDetail, setPatchDetail] = useState<PatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isLastPage, setIsLastPage] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLog([]); setPage(1); setIsLastPage(false); setLoading(true);
    fetchRepoLog(owner, name, selectedChannel)
      .then(data => setLog(Array.isArray(data.patches) ? data.patches : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedChannel]);

  const loadMore = async () => {
    if (loadingMore || isLastPage) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      const res = await fetchRepoLog(owner, name, selectedChannel, next, 10);
      setLog(prev => [...prev, ...(Array.isArray(res.patches) ? res.patches : [])]);
      setIsLastPage(res.isLastPage);
      setPage(next);
    } catch (err) { console.error(err); }
    finally { setLoadingMore(false); }
  };

  const lastPatchRef = useCallback((node: Element | null) => {
    if (loadingMore || isLastPage) return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !isLastPage) loadMore();
    });
    if (node) observerRef.current.observe(node);
  }, [loadingMore, isLastPage]);

  // Auto-open detail view when :hash is in the URL
  useEffect(() => {
    if (urlHash) showPatch(urlHash);
  }, [urlHash]);

  const showPatch = async (hash: string) => {
    setLoading(true);
    try {
      const data = await fetchPatchDetail(owner, name, hash, selectedChannel);
      setPatchDetail({ content: data.patch, hash });
      setView('detail');
      navigate(`/repos/${owner}/${name}/patches/${hash}`, { replace: true });
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const copyHash = (text: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => { setCopiedHash(true); setTimeout(() => setCopiedHash(false), 2000); });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      setCopiedHash(true); setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  // ── Patch detail view ───────────────────────────────────────────
  if (view === 'detail' && patchDetail) return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Button variant="ghost" size="sm" onClick={() => { setView('list'); navigate(`/repos/${owner}/${name}/patches`); }} className="gap-2 hover:text-primary">
        <ArrowLeft className="w-4 h-4" /> Back to patches
      </Button>
      <Card className="border-border/50 shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Patch Details</CardTitle>
            {patchDetail.hash && (
              <div className="flex items-center gap-2 bg-accent px-2 py-1 rounded">
                <code className="text-2xs cursor-help" title={patchDetail.hash}>
                  Hash: {patchDetail.hash.slice(0, 8)}...
                </code>
                <Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-primary/20" onClick={() => copyHash(patchDetail.hash)}>
                  {copiedHash ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {patchDetail.content && typeof patchDetail.content === 'object' ? (
            <div className="bg-card p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" /> Message
                    </h3>
                    <p className="text-lg font-medium leading-snug">{patchDetail.content.message}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Timestamp
                    </h3>
                    <p className="text-sm text-muted-foreground">{new Date(patchDetail.content.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Users className="w-3 h-3" /> Author(s)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {patchDetail.content.authors?.map((a: string) => (
                      <code key={a} className="text-[10px] bg-accent/50 border border-border/50 px-2 py-1 rounded-none text-primary font-mono shadow-sm" title={a}>
                        {a.slice(0, 12)}...
                      </code>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Code className="w-3 h-3" /> Changes ({patchDetail.content.hunks?.length || 0})
                </h3>
                <div className="space-y-4">
                  {patchDetail.content.hunks?.map((hunk: Hunk, idx: number) => (
                    <div key={idx} className="border border-border/50 rounded-none overflow-hidden shadow-sm bg-background">
                      <div className="bg-muted/30 px-4 py-2.5 border-b border-border/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${
                            hunk.hunkType === 'Edit' ? 'bg-blue-500/10 text-blue-500' :
                            hunk.hunkType === 'Replacement' ? 'bg-orange-500/10 text-orange-500' :
                            'bg-primary/10 text-primary'
                          }`}>{hunk.hunkType}</span>
                          <span className="text-xs font-mono font-medium text-foreground/80">
                            {hunk.path}{hunk.newPath ? ` → ${hunk.newPath}` : ''}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Line {hunk.line}</span>
                      </div>
                      <div className="p-0 font-mono text-xs overflow-x-auto">
                        {hunk.previous && <div className="p-3 bg-muted/10 border-b border-border/5"><div className="text-[10px] uppercase font-bold text-muted-foreground/50 mb-1">Context</div><pre className="whitespace-pre-wrap opacity-60 italic">{hunk.previous}</pre></div>}
                        {hunk.remove && <div className="p-3 bg-red-500/5 border-b border-border/5"><div className="text-[10px] uppercase font-bold text-red-500/50 mb-1">Removed</div><pre className="whitespace-pre-wrap text-red-500/80">{hunk.remove}</pre></div>}
                        {hunk.newData && <div className="p-3 bg-green-500/5 border-b border-border/5"><div className="text-[10px] uppercase font-bold text-green-500/50 mb-1">Added</div><pre className="whitespace-pre-wrap text-green-500/80">{hunk.newData}</pre></div>}
                        {hunk.lines && hunk.lines.length > 0 ? (
                          <div className="min-w-full divide-y divide-border/5">
                            {hunk.lines.map((line: DiffLine, lIdx: number) => (
                              <div key={lIdx} className={`flex group ${
                                line.lineType === 'addition' ? 'bg-green-500/5 hover:bg-green-500/10' :
                                line.lineType === 'deletion' ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-accent/5'
                              }`}>
                                <div className="w-12 shrink-0 text-right pr-4 py-0.5 select-none text-[10px] border-r border-border/10 text-muted-foreground/40 font-light bg-muted/10">{line.lineNumber}</div>
                                <div className={`w-6 shrink-0 flex justify-center py-0.5 select-none font-bold ${line.lineType === 'addition' ? 'text-green-500' : line.lineType === 'deletion' ? 'text-red-500' : 'text-muted-foreground/20'}`}>
                                  {line.lineType === 'addition' ? '+' : line.lineType === 'deletion' ? '-' : ' '}
                                </div>
                                <pre className="px-4 py-0.5 text-foreground/90 whitespace-pre leading-relaxed">{line.content}</pre>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center">
                            {hunk.contents || hunk.replacementContents ? (
                              <div className="space-y-4">
                                <div className="text-xs text-muted-foreground italic flex items-center justify-center gap-2"><Terminal className="w-3 h-3" /> Binary or large block change</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {hunk.contents && <div className="space-y-2"><div className="text-[10px] uppercase font-bold text-red-500/50 text-center">Original</div><pre className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-[10px] overflow-auto max-h-40">{hunk.contents.toString('utf-8').slice(0, 500)}{hunk.contents.length > 500 ? '...' : ''}</pre></div>}
                                  {hunk.replacementContents && <div className="space-y-2"><div className="text-[10px] uppercase font-bold text-green-500/50 text-center">Replacement</div><pre className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg text-[10px] overflow-auto max-h-40">{hunk.replacementContents.toString('utf-8').slice(0, 500)}{hunk.replacementContents.length > 500 ? '...' : ''}</pre></div>}
                                </div>
                              </div>
                            ) : <p className="text-muted-foreground text-xs italic">No line details available.</p>}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 p-6">
              <pre className="text-sm font-mono text-primary leading-relaxed whitespace-pre-wrap">
                <code>{typeof patchDetail.content === 'string' ? patchDetail.content : JSON.stringify(patchDetail.content ?? patchDetail, null, 2)}</code>
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ── Patch list view ──────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : log.length === 0 ? (
        <div className="text-center py-20 border rounded-none border-dashed">
          <History className="w-10 h-10 mx-auto opacity-10 mb-4" />
          <p className="text-muted-foreground">No patches found in history.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {log.map((patch: Patch, idx: number) => (
            <Card
              key={patch.hash}
              ref={(idx === log.length - 1) ? lastPatchRef : null}
              className="hover:bg-accent/30 cursor-pointer border-border/50 transition-all hover:translate-x-1"
              onClick={() => navigate(`/repos/${owner}/${name}/patches/${patch.hash}`)}
            >
              <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
                  <div className="w-8 h-8 shrink-0 rounded-md flex items-center justify-center     bg-primary/10 text-primary">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{patch.message}</div>
                    <div className="flex items-center gap-2 text-2xs text-muted-foreground mt-0.5">
                      <span className="font-bold text-primary font-mono truncate max-w-30 sm:max-w-50" title={patch.hash}>
                        {patch.hash}
                      </span>
                      <span className="shrink-0">•</span>
                      <span className="shrink-0 truncate">{patch.date}</span>
                    </div>
                  </div>
                </div>
                <code className="text-2xs font-mono  px-2 py-1 rounded-sm bg-background/40 text-foreground/90 shrink-0 ml-2" title={patch.author}>
                  {patch.author.slice(0, 8)}
                </code>
              </CardHeader>
            </Card>
          ))}
          {loadingMore && <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
          {isLastPage && <div className="text-center py-4 text-muted-foreground text-sm">You've reached the end of patches</div>}
        </div>
      )}
    </div>
  );
};

export default PatchesTab;
