import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  fetchRepoLog, 
  fetchRepoTree, 
  fetchFileContent, 
  fetchPatchDetail, 
  fetchRepos, 
  addCollaborator, 
  removeCollaborator, 
  deleteRepo,
  fetchChannels,
  switchChannel,
  forkRepo
} from '../api';
import { 
  File, 
  Folder, 
  Clock, 
  Code, 
  User, 
  ArrowLeft, 
  Box, 
  Terminal, 
  Lock, 
  Globe, 
  Users, 
  Trash2, 
  Shield, 
  AlertTriangle, 
  Settings,
  GitBranch,
  GitFork,
  Copy,
  ChevronRight,
  ExternalLink,
  Search,
  MoreVertical,
  History
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '../components/ui/dropdown-menu';

const RepoDetail = () => {
    const { name, tab: urlTab } = useParams();
    const navigate = useNavigate();
    const [tab, setTab] = useState(urlTab || 'files');

    useEffect(() => {
        if (urlTab && urlTab !== tab) {
            setTab(urlTab);
        }
    }, [urlTab]);

    const handleTabChange = (newTab) => {
        setTab(newTab);
        navigate(`/repos/${name}/${newTab}`);
    };
    const [repoMeta, setRepoMeta] = useState(null);
    const [tree, setTree] = useState([]);
    const [log, setLog] = useState([]);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [path, setPath] = useState('');
    const [fileContent, setFileContent] = useState(null);
    const [patchDetail, setPatchDetail] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [forkLoading, setForkLoading] = useState(false);
    const [newCollab, setNewCollab] = useState('');

    const currentUsername = localStorage.getItem('username');

    useEffect(() => {
        loadRepoData();
    }, [name]);

    const loadRepoData = async () => {
        setLoading(true);
        try {
            const [reposData, channelsData] = await Promise.all([
                fetchRepos(),
                fetchChannels(name)
            ]);
            const meta = Array.isArray(reposData) ? reposData.find(r => r.name === name) : null;
            setRepoMeta(meta);
            setChannels(Array.isArray(channelsData) ? channelsData : []);
        } catch (err) {
            console.error('Failed to load repo data:', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (tab === 'patch-detail' || tab === 'settings') return;
        
        const loadContent = async () => {
            setLoading(true);
            try {
                if (tab === 'files') {
                    if (path && !path.endsWith('/')) {
                        const content = await fetchFileContent(name, path);
                        setFileContent(content);
                    } else {
                        const data = await fetchRepoTree(name, path);
                        const filteredData = Array.isArray(data) ? data.filter(item => item !== "No tracked files") : [];
                        setTree(filteredData);
                        setFileContent(null);
                    }
                } else if (tab === 'patches') {
                    const data = await fetchRepoLog(name);
                    setLog(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('Error loading content:', err);
            }
            setLoading(false);
        };
        
        loadContent();
    }, [name, tab, path]);

    const handleSwitchChannel = async (channelName) => {
        setLoading(true);
        try {
            await switchChannel(name, channelName);
            await loadRepoData(); // Refresh metadata and channels
            setPath(''); // Reset path on channel switch
        } catch (err) {
            alert('Failed to switch channel: ' + err.toString());
        }
        setLoading(false);
    };

    const handleFork = async () => {
        setForkLoading(true);
        try {
            const newRepo = await forkRepo(name, name); // Will append -username in backend
            if (newRepo.error) {
                alert('Failed to fork repository: ' + newRepo.error);
            } else {
                navigate(`/repos/${newRepo.name}`);
            }
        } catch (err) {
            alert('Failed to fork repository: ' + err.toString());
        }
        setForkLoading(false);
    };

    const showPatch = async (hash) => {
        setLoading(true);
        try {
            const data = await fetchPatchDetail(name, hash);
            setPatchDetail(data.patch);
            setTab('patch-detail');
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    const userRole = repoMeta?.owner === currentUsername ? 'owner' :
                     repoMeta?.collaborators?.find(c => c.username === currentUsername)?.role || 'viewer';
    const canManage = ['owner', 'maintainer'].includes(userRole);
    const currentChannel = channels.find(c => c.isCurrent)?.name || 'main';

    if (!repoMeta && !loading) return (
        <Layout>
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold">Repository not found</h2>
                <Button asChild className="mt-4" variant="outline">
                    <Link to="/">Back to Dashboard</Link>
                </Button>
            </div>
        </Layout>
    );

    return (
        <Layout repoName={name} owner={repoMeta?.owner}>
            <div className="space-y-6">
                {/* Repo Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Box className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                {name}
                                <span className={`text-2xs px-2 py-0.5 rounded-full border uppercase transition-colors ${
                                    repoMeta?.isPrivate 
                                        ? 'bg-muted text-muted-foreground border-border' 
                                        : 'bg-primary/5 text-muted-foreground border-border/50 hover:border-primary/30 hover:text-primary/80'
                                }`}>
                                    {repoMeta?.isPrivate ? 'Private' : 'Public'}
                                </span>
                            </h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Project ID: <span className="font-mono text-2xs">{repoMeta?.id?.slice(0, 8)}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleFork} disabled={forkLoading || repoMeta?.owner === currentUsername}>
                            <GitFork className="w-4 h-4 mr-2" />
                            {forkLoading ? 'Forking...' : 'Fork'}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" size="sm">
                                    <Code className="w-4 h-4 mr-2" />
                                    Clone
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80">
                                <DropdownMenuLabel>Clone with SSH</DropdownMenuLabel>
                                <div className="p-2">
                                    <div className="flex items-center gap-2 bg-muted p-2 rounded-md border">
                                        <code className="text-xs truncate flex-1">
                                            pijul clone {window.location.hostname}:/{name}
                                        </code>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(`pijul clone ${window.location.hostname}:/${name}`)}>
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Main Tabs */}
                <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
                        <TabsTrigger value="files" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 h-auto">
                            <Code className="w-4 h-4 mr-2" /> Code
                        </TabsTrigger>
                        <TabsTrigger value="patches" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 h-auto">
                            <History className="w-4 h-4 mr-2" /> Patches
                        </TabsTrigger>
                        {canManage && (
                            <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 h-auto">
                                <Settings className="w-4 h-4 mr-2" /> Settings
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <div className="mt-6">
                        {/* Files Tab */}
                        {tab === 'files' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    <GitBranch className="w-4 h-4 text-primary" />
                                                    {currentChannel}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuLabel>Switch Channel</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {channels.map(c => (
                                                    <DropdownMenuItem key={c.name} onClick={() => handleSwitchChannel(c.name)} className="flex items-center justify-between">
                                                        {c.name}
                                                        {c.isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* Breadcrumbs for path */}
                                        <div className="flex items-center text-sm font-medium ml-2">
                                            <Button variant="ghost" size="sm" onClick={() => setPath('')} className="px-1 h-7">
                                                {name}
                                            </Button>
                                            {path.split('/').filter(Boolean).map((p, i) => (
                                                <React.Fragment key={i}>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                                                    <Button variant="ghost" size="sm" className="px-1 h-7">{p}</Button>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <Card className="overflow-hidden border-border/50">
                                    {loading ? (
                                        <div className="p-12 text-center text-muted-foreground animate-pulse">Loading files...</div>
                                    ) : fileContent !== null ? (
                                        <div className="bg-card">
                                            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
                                                <span className="text-xs font-mono">{path.split('/').pop()}</span>
                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setFileContent(null)}>Close</Button>
                                            </div>
                                            <pre className="p-4 text-sm font-mono overflow-auto max-h-[600px] leading-relaxed">
                                                <code>{fileContent}</code>
                                            </pre>
                                        </div>
                                    ) : tree.length === 0 ? (
                                        <div className="p-20 text-center space-y-4">
                                            <Box className="w-12 h-12 mx-auto opacity-20 text-primary" />
                                            <h3 className="text-lg font-semibold">Repository is empty</h3>
                                            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                                                Add some files to your repository to see them here.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/50">
                                            {path && (
                                                <div 
                                                    className="flex items-center gap-3 p-3 text-sm hover:bg-accent/30 cursor-pointer text-primary font-medium"
                                                    onClick={() => setPath('')}
                                                >
                                                    <ArrowLeft className="w-4 h-4" /> ..
                                                </div>
                                            )}
                                            {tree.map(item => (
                                                <div 
                                                    key={item} 
                                                    className="flex items-center justify-between p-3 hover:bg-accent/30 cursor-pointer group transition-colors"
                                                    onClick={() => setPath(item)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <File className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                                                        <span className="text-sm font-medium">{item}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        <span className="hidden sm:inline italic opacity-0 group-hover:opacity-100 transition-opacity">Updated recently</span>
                                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            </div>
                        )}

                        {/* Patches Tab */}
                        {(tab === 'patches' || tab === 'patch-detail') && (
                            <div className="space-y-6">
                                {tab === 'patch-detail' ? (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <Button variant="ghost" size="sm" onClick={() => setTab('patches')} className="gap-2">
                                            <ArrowLeft className="w-4 h-4" /> Back to patches
                                        </Button>
                                        <Card className="border-border/50 shadow-lg overflow-hidden">
                                            <CardHeader className="bg-muted/30 border-b">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="text-lg">Patch Details</CardTitle>
                                                    <code className="text-2xs bg-accent px-2 py-1 rounded">Hash: {patchDetail?.hash || '...'}</code>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div className="bg-muted/50 p-6">
                                                    <pre className="text-sm font-mono text-primary leading-relaxed whitespace-pre-wrap">
                                                        <code>{patchDetail}</code>
                                                    </pre>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {log.length === 0 ? (
                                            <div className="text-center py-20 border rounded-xl border-dashed">
                                                <History className="w-10 h-10 mx-auto opacity-10 mb-4" />
                                                <p className="text-muted-foreground">No patches found in history.</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-3">
                                                {log.map(patch => (
                                                    <Card 
                                                        key={patch.hash} 
                                                        className="hover:bg-accent/30 cursor-pointer border-border/50 transition-all hover:translate-x-1"
                                                        onClick={() => showPatch(patch.hash)}
                                                    >
                                                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-all">
                                                                    <User className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-sm line-clamp-1">{patch.message}</div>
                                                                    <div className="flex items-center gap-2 text-2xs text-muted-foreground mt-0.5">
                                                                        <span className="font-bold text-primary">{patch.author}</span>
                                                                        <span>•</span>
                                                                        <span>{patch.date}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <code className="text-2xs font-mono bg-accent px-2 py-1 rounded text-muted-foreground">
                                                                {patch.hash.slice(0, 8)}
                                                            </code>
                                                        </CardHeader>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Settings Tab */}
                        {tab === 'settings' && (
                            <div className="space-y-8 max-w-3xl animate-in fade-in duration-300">
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b">
                                        <Shield className="w-5 h-5 text-primary" />
                                        <h2 className="text-xl font-bold">Permissions</h2>
                                    </div>
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-base">Repository Collaborators</CardTitle>
                                            <CardDescription>Grant users access to push or manage this repository.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <Input 
                                                        placeholder="Username to invite..." 
                                                        value={newCollab}
                                                        onChange={(e) => setNewCollab(e.target.value)}
                                                        className="max-w-xs"
                                                    />
                                                    <Button 
                                                        onClick={() => {
                                                            addCollaborator(name, newCollab, 'developer').then((res) => {
                                                                if (res.error) {
                                                                    alert('Failed to add user: ' + res.error);
                                                                } else {
                                                                    setNewCollab('');
                                                                    loadRepoData();
                                                                }
                                                            }).catch(err => {
                                                                alert('Error: ' + err.message);
                                                            });
                                                        }}
                                                        disabled={!newCollab}
                                                    >
                                                        Add User
                                                    </Button>
                                                </div>
                                                <div className="border border-border/50 rounded-md divide-y divide-border/50">
                                                    {repoMeta?.collaborators?.map(c => (
                                                        <div key={c.username} className="flex items-center justify-between p-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                                                                    <User className="w-4 h-4 text-muted-foreground" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-medium text-sm">{c.username}</div>
                                                                    <div className="text-xs text-muted-foreground capitalize">{c.role}</div>
                                                                </div>
                                                            </div>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="text-destructive hover:bg-destructive/10"
                                                                onClick={() => {
                                                                    removeCollaborator(name, c.username).then((res) => {
                                                                        if (res.error) alert('Failed: ' + res.error);
                                                                        else loadRepoData();
                                                                    }).catch(err => alert('Error: ' + err.message));
                                                                }}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    {(!repoMeta?.collaborators || repoMeta.collaborators.length === 0) && (
                                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                                            No collaborators added yet.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </section>

                                {userRole === 'owner' && (
                                    <section className="space-y-4">
                                        <div className="flex items-center gap-2 pb-2 border-b text-destructive">
                                            <AlertTriangle className="w-5 h-5" />
                                            <h2 className="text-xl font-bold">Danger Zone</h2>
                                        </div>
                                        <Card className="border-destructive/30 bg-destructive/5">
                                            <CardHeader>
                                                <CardTitle className="text-base text-destructive">Delete this project</CardTitle>
                                                <CardDescription>Once you delete a project, there is no going back. Please be certain.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="flex flex-col sm:flex-row gap-4">
                                                <Input 
                                                    placeholder={`Type "${name}" to confirm`} 
                                                    className="max-w-xs border-destructive/20 focus-visible:ring-destructive"
                                                    value={deleteConfirm}
                                                    onChange={(e) => setDeleteConfirm(e.target.value)}
                                                />
                                                <Button 
                                                    variant="destructive" 
                                                    disabled={deleteConfirm !== name || deleteLoading}
                                                    onClick={() => {
                                                        setDeleteLoading(true);
                                                        deleteRepo(name).then(() => navigate('/'));
                                                    }}
                                                >
                                                    {deleteLoading ? 'Deleting...' : 'Delete Repository'}
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </section>
                                )}
                            </div>
                        )}
                    </div>
                </Tabs>
            </div>
        </Layout>
    );
};

export default RepoDetail;
