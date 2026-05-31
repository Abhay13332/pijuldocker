import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import type { TabBaseProps } from './types';
import type { TreeItem, RepoSyncInfo } from '../../types';
import {
  File, Folder, ArrowLeft, Box, ExternalLink, ChevronRight, GitBranch,
  RefreshCw, Loader2, Trash2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from '../../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  fetchRepoTree, fetchFileContent, fetchStandardChannels,
  fetchGitRemoteBranches, syncChannelToGit, addStandardChannel,
  removeStandardChannel, fetchSyncHistory,
} from '../../api';

const FilesTab = ({
  owner, name, channels, selectedChannel, setSelectedChannel,
  gitInfo, setGitInfo, canManage, repoMeta,
}: TabBaseProps) => {
  const [tree, setTree] = useState<TreeItem[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Git Sync & Standard Channels State
  const [standardChannels, setStandardChannels] = useState<string[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [selectedRemoteBranch, setSelectedRemoteBranch] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(false);

  const [showManageModal, setShowManageModal] = useState(false);
  const [newStandardChannel, setNewStandardChannel] = useState('');
  const [standardActionLoading, setStandardActionLoading] = useState<string | null>(null);

  // Sync history state
  const [syncHistory, setSyncHistory] = useState<RepoSyncInfo[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Premium Shadcn Alert Dialog State
  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm?: () => void;
    isConfirm?: boolean;
  }>({
    open: false,
    title: '',
    description: '',
  });

  const showAlert = (title: string, description: string) => {
    setAlertDialog({
      open: true,
      title,
      description,
      isConfirm: false,
    });
  };

  const showConfirm = (title: string, description: string, onConfirm: () => void) => {
    setAlertDialog({
      open: true,
      title,
      description,
      onConfirm,
      isConfirm: true,
    });
  };

  const { channel, '*': splat } = useParams<{ channel?: string; '*': string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isBlob = location.pathname.includes('/blob/');
  const currentPath = splat || '';
  const activeChannel = channel || selectedChannel;

  // Sync selected channel to parent component if updated via URL
  useEffect(() => {
    if (channel && channel !== selectedChannel) {
      setSelectedChannel(channel);
    }
  }, [channel, selectedChannel, setSelectedChannel]);

  useEffect(() => {
    const loadStandardChannels = async () => {
      try {
        const res = await fetchStandardChannels(owner, name);
        if (res.success && res.channels) {
          setStandardChannels(res.channels);
        }
      } catch (err) {
        console.error('Failed to load standard channels:', err);
      }
    };
    loadStandardChannels();
  }, [owner, name]);

  const isStandardChannel = standardChannels.includes(activeChannel);
  const isGithubSynced = repoMeta?.isGithubSynced || !!gitInfo;

  const handleSyncClick = async () => {
    const isSyncedPreviously = gitInfo?.syncedchannels?.includes(activeChannel);
    if (isSyncedPreviously) {
      setSyncLoading(true);
      try {
        const res = await syncChannelToGit(owner, name, activeChannel);
        if (res.success) {
          showAlert('Synchronization Complete', `Successfully synced channel ${activeChannel} to GitHub!`);
        } else {
          showAlert('Sync Failed', `Sync failed: ${res.error || 'Unknown error'}`);
        }
      } catch (err) {
        showAlert('Sync Error', `Sync error: ${String(err)}`);
      } finally {
        setSyncLoading(false);
      }
    } else {
      setShowSyncModal(true);
      setLoadingBranches(true);
      try {
        const res = await fetchGitRemoteBranches(owner, name);
        if (res.success && res.branches) {
          setRemoteBranches(res.branches);
          if (res.branches.includes(activeChannel)) {
            setSelectedRemoteBranch(activeChannel);
          } else if (res.branches.includes('main')) {
            setSelectedRemoteBranch('main');
          } else if (res.branches.length > 0) {
            setSelectedRemoteBranch(res.branches[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch remote branches:', err);
      } finally {
        setLoadingBranches(false);
      }
    }
  };

  const handleSyncSubmit = async () => {
    if (!selectedRemoteBranch) return;
    setSyncLoading(true);
    try {
      const res = await syncChannelToGit(owner, name, activeChannel, selectedRemoteBranch);
      if (res.success) {
        if (gitInfo && setGitInfo) {
          setGitInfo({
            ...gitInfo,
            syncedchannels: [...(gitInfo.syncedchannels || []), activeChannel]
          });
        }
        setShowSyncModal(false);
        showAlert('Synchronization Complete', `Successfully synced ${activeChannel} to remote branch ${selectedRemoteBranch}!`);
      } else {
        showAlert('Sync Failed', `Sync failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err) {
      showAlert('Sync Error', `Sync error: ${String(err)}`);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleAddStandardChannel = async () => {
    if (!newStandardChannel) return;
    const cleanChan = newStandardChannel.trim();
    if (standardChannels.includes(cleanChan)) {
      showAlert('Standard Channel Exists', 'Channel is already standard.');
      return;
    }
    setStandardActionLoading('__add__');
    try {
      const res = await addStandardChannel(owner, name, cleanChan);
      if (res.success) {
        setStandardChannels([...standardChannels, cleanChan]);
        setNewStandardChannel('');
      } else {
        showAlert('Action Failed', `Failed to add standard channel: ${res.error || 'Unknown error'}`);
      }
    } catch (err) {
      showAlert('Error', `Error: ${String(err)}`);
    } finally {
      setStandardActionLoading(null);
    }
  };

  const handleRemoveStandardChannel = (chan: string) => {
    showConfirm(
      'Remove Standard Channel',
      `Are you sure you want to remove '${chan}' from standard channels? This will prevent direct git synchronization.`,
      async () => {
        setStandardActionLoading(chan);
        try {
          const res = await removeStandardChannel(owner, name, chan);
          if (res.success) {
            setStandardChannels(standardChannels.filter(c => c !== chan));
          } else {
            showAlert('Action Failed', `Failed to remove standard channel: ${res.error || 'Unknown error'}`);
          }
        } catch (err) {
          showAlert('Error', `Error: ${String(err)}`);
        } finally {
          setStandardActionLoading(null);
        }
      }
    );
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (isBlob && currentPath) {
          const content = await fetchFileContent(owner, name, currentPath, activeChannel);
          setFileContent(content);
          setTree([]);
        } else {
          const data = await fetchRepoTree(owner, name, currentPath, activeChannel);
          setTree(Array.isArray(data) ? data : []);
          setFileContent(null);
        }
      } catch (err) {
        console.error('Error loading files:', err);
      }
      setLoading(false);
    };
    load();
  }, [owner, name, currentPath, activeChannel, isBlob]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              {activeChannel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-37.5">
            <DropdownMenuLabel>View Channel</DropdownMenuLabel>
            <DropdownMenuSeparator className=' h-px'/>
            {channels.map(c => (
              <DropdownMenuItem
                key={c.name}
                onClick={() => {
                  navigate(`/repos/${owner}/${name}/tree/${c.name}/${currentPath}`);
                }}
                className="flex items-center justify-between"
              >
                {c.name}
                {c.name === activeChannel && <div className="w-1.5 h-1.5 rounded-sm bg-primary/70" />}
              </DropdownMenuItem>
            ))}
            {canManage && (
              <>
                <DropdownMenuSeparator className="h-px bg-border/50 my-1" />
                <DropdownMenuItem
                  onClick={() => setShowManageModal(true)}
                  className="flex items-center justify-between text-xs text-primary font-medium hover:bg-primary/5 cursor-pointer"
                >
                  Manage Standard Channels
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Breadcrumbs */}
        <div className="flex items-center text-sm font-medium ml-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/repos/${owner}/${name}/tree/${activeChannel}`)}
            className="px-1 h-7"
          >
            {name}
          </Button>
          {currentPath.split('/').filter(Boolean).map((p, i, arr) => {
            const isLast = i === arr.length - 1;
            const segmentPath = arr.slice(0, i + 1).join('/');
            const targetUrl = isLast && isBlob
              ? `/repos/${owner}/${name}/blob/${activeChannel}/${segmentPath}`
              : `/repos/${owner}/${name}/tree/${activeChannel}/${segmentPath}`;
            return (
              <React.Fragment key={i}>
                <ChevronRight className="w-4 h-4 text-muted-foreground mx-1 " />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(targetUrl)}
                  className="px-1 h-7"
                >
                  {p}
                </Button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Sync Button + History Dot */}
        {canManage && isGithubSynced && isStandardChannel && (
          <div className="flex items-center gap-1 ml-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncClick}
              disabled={syncLoading}
              className="h-8 px-3 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary gap-1.5 transition-colors"
            >
              {syncLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync to GitHub
            </Button>

            {/* History indicator dot */}
            <DropdownMenu open={historyOpen} onOpenChange={(open) => {
              setHistoryOpen(open);
              if (open && syncHistory.length === 0) {
                setHistoryLoading(true);
                fetchSyncHistory(owner, name, 1, 10)
                  .then(res => { if (res.success && res.history) setSyncHistory(res.history); })
                  .catch(console.error)
                  .finally(() => setHistoryLoading(false));
              }
            }}>
              <DropdownMenuTrigger asChild>
                <button
                  title="Sync history"
                  className="relative flex items-center justify-center w-5 h-5 rounded-full hover:bg-muted transition-colors focus:outline-none"
                >
                  <span className="w-2 h-2 rounded-full bg-primary/60 block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-72 max-h-72 overflow-y-auto p-0"
              >
                <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-0 bg-popover border-b">
                  Sync History
                </DropdownMenuLabel>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                  </div>
                ) : syncHistory.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">No sync history yet.</div>
                ) : (
                  syncHistory.map((entry, i) => {
                    const date = new Date(entry.runAt);
                    const timeAgo = (() => {
                      const diff = Math.floor((Date.now() - date.getTime()) / 1000);
                      if (diff < 60) return `${diff}s ago`;
                      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
                      return date.toLocaleDateString();
                    })();
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 px-3 py-2.5 border-b last:border-0 text-xs hover:bg-muted/40 transition-colors"
                      >
                        <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                          !entry.success ? 'bg-destructive' :
                          entry.status === 'waiting' ? 'bg-amber-500' :
                          'bg-emerald-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{entry.localChannel} → {entry.remoteBranch}</span>
                            <span className="text-muted-foreground shrink-0">{timeAgo}</span>
                          </div>
                          <div className={`mt-0.5 ${
                            !entry.success ? 'text-destructive' :
                            entry.status === 'waiting' ? 'text-amber-600 dark:text-amber-400' :
                            'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {!entry.success ? 'Failed' : entry.status === 'waiting' ? 'Waiting at remote' : 'Merged'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Card className="overflow-hidden border-border/50 rounded-sm shadow-none">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">Loading files...</div>
        ) : fileContent !== null ? (
          <div className="bg-card rounded-none">
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
              <span className="text-xs font-mono">{currentPath.split('/').pop()}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs rounded-sm"
                onClick={() => {
                  const parts = currentPath.split('/').filter(Boolean);
                  parts.pop();
                  const parentPath = parts.join('/');
                  navigate(`/repos/${owner}/${name}/tree/${activeChannel}/${parentPath}`);
                }}
              >
                Close
              </Button>
            </div>
            <pre className="p-4 text-sm font-mono overflow-auto leading-relaxed whitespace-pre min-w-full">
              <code>{fileContent}</code>
            </pre>
          </div>
        ) : tree.length === 0 ? (
          <div className="p-20 text-center space-y-4">
            <Box className="w-12 h-12 mx-auto opacity-20 text-primary" />
            <h3 className="text-lg font-semibold">Repository is empty</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">Add some files to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {currentPath && (
              <div
                className="flex items-center gap-3 p-3 text-sm hover:bg-accent/30 cursor-pointer text-primary font-medium"
                onClick={() => {
                  const parts = currentPath.split('/').filter(Boolean);
                  parts.pop();
                  const parentPath = parts.join('/');
                  navigate(`/repos/${owner}/${name}/tree/${activeChannel}/${parentPath}`);
                }}
              >
                <ArrowLeft className="w-4 h-4" /> ..
              </div>
            )}
            {tree.map(item => {
              const itemName = typeof item === 'string' ? item : item.path;
              const isDir = typeof item === 'object' ? item.isDir : false;
              const itemPath = currentPath ? `${currentPath}/${itemName}` : itemName;
              const targetUrl = isDir
                ? `/repos/${owner}/${name}/tree/${activeChannel}/${itemPath}`
                : `/repos/${owner}/${name}/blob/${activeChannel}/${itemPath}`;
              return (
                <div
                  key={itemName}
                  className="flex items-center justify-between p-3 hover:bg-accent/30 cursor-pointer group transition-colors"
                  onClick={() => navigate(targetUrl)}
                >
                  <div className="flex items-center gap-3">
                    {isDir
                      ? <Folder className="w-4 h-4 text-primary group-hover:text-primary/80" />
                      : <File className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                    }
                    <span className="text-sm font-medium">{itemName}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="hidden sm:inline italic opacity-0 group-hover:opacity-100 transition-opacity">Updated recently</span>
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── First-Time Sync Modal ── */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-background border border-border p-6 rounded-lg shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold tracking-tight text-foreground">Select Remote Git Branch</h3>
              <p className="text-xs text-muted-foreground leading-normal">
                This standard channel has not been synced to GitHub previously. Point it to a remote target branch to establish a mirror link.
              </p>
            </div>
            {loadingBranches ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span>Fetching remote branches...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-primary">Target Remote Branch</label>
                  <select
                    value={selectedRemoteBranch}
                    onChange={(e) => setSelectedRemoteBranch(e.target.value)}
                    className="w-full h-9 px-3 py-1 bg-background border border-border rounded-md text-sm outline-none ring-offset-background focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
                  >
                    <option value="">-- Choose Branch --</option>
                    {remoteBranches.map((br) => (
                      <option key={br} value={br}>
                        {br}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowSyncModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                onClick={handleSyncSubmit}
                disabled={!selectedRemoteBranch || syncLoading || loadingBranches}
                className="bg-primary text-primary-foreground text-xs min-w-[80px]"
                size="sm"
              >
                {syncLoading && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                Confirm Sync
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Standard Channels Modal ── */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-background border border-border p-6 rounded-lg shadow-2xl max-w-md w-full space-y-4 animate-in zoom-in-95 duration-200">
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold tracking-tight text-foreground">Configure Standard Channels</h3>
              <p className="text-xs text-muted-foreground leading-normal">
                Configure which channels are recognized as standard. Standard channels can be direct-synced to GitHub.
              </p>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-border/40 p-2 rounded bg-muted/10">
              {standardChannels.map((ch) => (
                <div key={ch} className="flex items-center justify-between px-2.5 py-1.5 bg-muted/40 rounded border border-border/30 hover:bg-muted/60 transition-colors">
                  <span className="text-xs font-semibold font-mono text-foreground">{ch}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => handleRemoveStandardChannel(ch)}
                    disabled={standardActionLoading !== null}
                  >
                    {standardActionLoading === ch ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              ))}
              {standardChannels.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-4">No standard channels configured.</p>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                placeholder="Add standard channel (e.g. main, dev)..."
                value={newStandardChannel}
                onChange={(e) => setNewStandardChannel(e.target.value)}
                className="flex-1 h-9 px-3 bg-background border border-border rounded-md text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-shadow"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddStandardChannel();
                }}
              />
              <Button
                size="sm"
                onClick={handleAddStandardChannel}
                disabled={!newStandardChannel || standardActionLoading !== null}
                className="bg-primary text-primary-foreground text-xs px-4"
              >
                {standardActionLoading === '__add__' && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                Add
              </Button>
            </div>
            
            <div className="flex justify-end pt-2 border-t border-border/40">
              <Button variant="outline" size="sm" onClick={() => setShowManageModal(false)} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ── Reusable Premium Shadcn Alert / Confirm Dialog ── */}
      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {alertDialog.isConfirm ? (
              <>
                <AlertDialogCancel onClick={() => setAlertDialog(prev => ({ ...prev, open: false }))}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setAlertDialog(prev => ({ ...prev, open: false }));
                    if (alertDialog.onConfirm) alertDialog.onConfirm();
                  }}
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                  Confirm
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction onClick={() => setAlertDialog(prev => ({ ...prev, open: false }))}>
                OK
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FilesTab;
