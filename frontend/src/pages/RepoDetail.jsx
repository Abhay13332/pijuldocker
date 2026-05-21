import React, { useEffect, useState,useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  fetchRepoLog, 
  fetchRepoTree, 
  fetchFileContent, 
  fetchPatchDetail, 
  fetchRepoMeta, 
  fetchCollaborators,
  addCollaborator, 
  removeCollaborator, 
  deleteRepo,
  fetchChannels,
  switchChannel,
  forkRepo,
  fetchDiscussions,
  fetchDiscussion,
  createDiscussion,
  addComment,
  mergeDiscussion,
  closeDiscussion,
  deleteDiscussion,
  toggleProtection,
  fetchProtectedCh,
  getMergeConflicts
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
  Loader2,
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
  History,
  MessageSquare,
  ArrowUpCircle,
  CheckCircle2,
  Unlock,
  Plus,
  Minus,
  XCircle
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
import ConflictsBox from '../components/repo/conflicts';
import { useCallback } from 'react';

const RepoDetail = () => {
    const { owner, name, tab: urlTab } = useParams();
    console.log(owner,name);
    const navigate = useNavigate();
    const [tab, setTab] = useState(urlTab || 'files');

    useEffect(() => {
        if (urlTab && urlTab !== tab) {
            setTab(urlTab);
        }
    }, [urlTab]);

    
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
    const [newCollabRole, setNewCollabRole] = useState('developer');
    const [currCollab,setCurrCollab] = useState([]);
    const [currProtectedCh,setCurrProtectedCh]=useState([])
    const [discussions, setDiscussions] = useState([]);
    const [conflicts,setConflicts]=useState(null);
    const [selectedPR, setSelectedPR] = useState(null);
    const [isCreatingPR, setIsCreatingPR] = useState(false);
    const [newPR, setNewPR] = useState({ title: '', description: '', sourceChannel: '', targetChannel: 'main' });
    const [commentText, setCommentText] = useState('');
    const [selectedChannel, setSelectedChannel] = useState('main');
    const [copiedHash, setCopiedHash] = useState(false);
    const handleTabChange = (newTab) => {
        setTab(newTab);
        
        navigate(`/repos/${owner}/${name}/${newTab}`);
    };
    const currentUsername = localStorage.getItem('username');
    const [hostname, setHostname] = useState(window.location.hostname);
    const [ip, setIp] = useState('');

   

    const displayHost = import.meta.env.VITE_PUBLIC_IP||hostname;
    const hasConflicts=conflicts!=null && conflicts.length!=0;
    useEffect(() => {
        loadRepoData();
    }, [name]);
console.log(log);
    const loadRepoData = async () => {
        setLoading(true);
        try {
            const [repoData, channelsData] = await Promise.all([
                fetchRepoMeta(owner,name),
                fetchChannels(owner, name)
                
            ]);
            console.log(repoData);
            setRepoMeta(repoData);
            
            setChannels(Array.isArray(channelsData) ? channelsData : []);
        } catch (err) {
            console.error('Failed to load repo data:', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (tab === 'patch-detail' ) return;
        console.log(tab);
        const loadContent = async () => {
            setLoading(true);
            try {  
                if (tab === 'files') {
                    if (path && !path.endsWith('/')) {
                        const content = await fetchFileContent(owner, name, path, selectedChannel);
                        setFileContent(content);
                    } else {
                        const data = await fetchRepoTree(owner, name, path, selectedChannel);
                        const filteredData = Array.isArray(data) ? data : [];
                        setTree(filteredData);
                        setFileContent(null);
                    }
                } else if (tab === 'patches') {
                    const data = await fetchRepoLog(owner, name, selectedChannel);
                    console.log(data);
                    setLog(Array.isArray(data.patches) ? data.patches : []);
                } else if (tab === 'discussions') {
                    const data = await fetchDiscussions(owner, name);
                    setDiscussions(Array.isArray(data) ? data : []);
                }else if(tab==='settings'){
                    await Promise.all([showCollborators(), showProtectedChannels()]);
                }
            } catch (err) {
                console.error('Error loading content:', err);
            }
            setLoading(false);
        };
        
        loadContent();
    }, [name, tab, path, selectedChannel]);

    // const handleSwitchChannel = async (channelName) => {
    //     setLoading(true);
    //     try {
    //         await switchChannel(owner, name, channelName);
    //         await loadRepoData();
    //         setPath('');
    //     } catch (err) {
    //         alert('Failed to switch channel: ' + err.toString());
    //     }
    //     setLoading(false);
    // };

    const handleToggleProtection = async (channel) => {
        try {
            await toggleProtection(owner, name, channel);
            if(currProtectedCh.includes(channel)){
                setCurrProtectedCh(channels=>channels.filter(c));

            }else{
                setCurrProtectedCh(channels=>[...channels,{name:channel,isCurrent:false}]);
            }
        } catch (err) {
            alert('Failed to toggle protection');
        }
    };
    const showSelectedpr = async(id) =>{
        setLoading(true);
        try{
            const pr=await fetchDiscussion(owner,repoMeta.name,id);
            setSelectedPR(pr);
        }catch(e){
            alert("failed to show selected pr")
        }
         setLoading(false);
    }
    const handleCreatePR = async () => {
        try {
            const pr = await createDiscussion(owner, name, {
                title: newPR.title,
                description: newPR.description,
                targetChannel: newPR.targetChannel || 'main'
            });
            if (pr.error) {
                alert('Failed to create discussion: ' + pr.error);
                return;
            }
            setDiscussions([pr, ...discussions]);
            setIsCreatingPR(false);
            setNewPR({ title: '', description: '', sourceChannel: '', targetChannel: 'main' });
            let channelsData=await fetchChannels(owner, name);
            setChannels(Array.isArray(channelsData) ? channelsData : []);

        } catch (err) {
            alert('Failed to create discussion');
        }
    };

    const handleAddComment = async (prId) => {
        if (!commentText.trim()) return;
        try {
            const updatedPR = await addComment(owner, name, prId, commentText);
            if (selectedPR?.id === prId) setSelectedPR(updatedPR);
            setDiscussions(discussions.map(d => d.id === prId ? updatedPR : d));
            setCommentText('');
        } catch (err) {
            alert('Failed to add comment');
        }
    };

    const handleMergePR = async (prId) => {
        if(conflicts!=null && conflicts.length>0){
            if(!confirm("there are merge conflict ,do you still want to merge(resolve later)")) return;
        }
        try {

            await mergeDiscussion(owner, name, prId);
            const updatedDisc = await fetchDiscussions(owner, name);
            setDiscussions(updatedDisc);
            if (selectedPR?.id === prId) setSelectedPR({ ...selectedPR, status: 'merged' });
            alert('Discussion merged successfully');
        } catch (err) {
            alert('Failed to merge: ' + err.toString());
        }
    };

    const handleClosePR = async (prId) => {
        if (!confirm('Close this discussion? The branch will be permanently deleted — no further push/pull will be possible.')) return;
        try {
            const res = await closeDiscussion(owner, name, prId);
            if (res.error) { alert('Error: ' + res.error); return; }
            const updatedDisc = await fetchDiscussions(owner, name);
            setDiscussions(updatedDisc);
            if (selectedPR?.id === prId) setSelectedPR({ ...selectedPR, status: 'closed' });
        } catch (err) { alert('Close failed: ' + err.toString()); }
    };

    const handleDeletePR = async (prId) => {
        if (!confirm('Permanently delete this discussion? The branch will be removed and the record will be gone forever.')) return;
        try {
            const res = await deleteDiscussion(owner, name, prId);
            if (res.error) { alert('Error: ' + res.error); return; }
            setSelectedPR(null);
            const updatedDisc = await fetchDiscussions(owner, name);
            setDiscussions(updatedDisc);
        } catch (err) { alert('Delete failed: ' + err.toString()); }
    };
    const showConflictsPR = async(prId) =>{
        setLoading(true);
        try{
            const res=await getMergeConflicts(owner,name,prId);
            console.log(res);
            if (res.error) { alert('Error: ' + res.error); return; }
            if(res.isconflicts){
                console.log(res.conflicts)
                setConflicts(res.conflicts);
                
            }else{
                setConflicts(null);
            }
        }catch (err) {
            console.error(err);
        }
        setLoading(false);
    }

    const handleFork = async () => {
        setForkLoading(true);
        try {
            const newRepo = await forkRepo(owner, name, name);
            if (newRepo.error) {
                alert('Failed to fork repository: ' + newRepo.error);
            } else {
                navigate(`/repos/${newRepo.owner}/${newRepo.name}`);
            }
        } catch (err) {
            alert('Failed to fork repository: ' + err.toString());
        }
        setForkLoading(false);
    };
    
    const showPatch = async (hash) => {
        setLoading(true);
        try {
            const data = await fetchPatchDetail(owner, name, hash, selectedChannel);
            setPatchDetail({ content: data.patch, hash });
            setTab('patch-detail');
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };
    //patches infinte
    const observerRefpatches = useRef();
    const [loadingMorePt, setLoadingMorePt] = useState(false);
    const [lastPatchArr,setLastPatchArr]=useState(false);
    const [patchPage,setpatchPage]=useState(1);
    const lastPatchRef=useCallback(node=>{
         if (loadingMorePt ||lastPatchArr) return;
         if (observerRefpatches.current) observerRefpatches.current.disconnect();
         observerRefpatches.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && (!lastPatchArr)) {
        loadMorePatches();
      }
      
    });
       if (node) observerRefpatches.current.observe(node);
    },[loadingMorePt,lastPatchArr]);
    const loadMorePatches=async()=>{
        if(loadingMorePt || lastPatchArr) return;
        setLoadingMorePt(true);
        const nextpage=patchPage+1;
        try{
            const response=await fetchRepoLog(owner,name,selectedChannel,nextpage,10);
            const newPatches=Array.isArray(response.patches) ? response.patches : [];
            setLog(Logs=>[...Logs,...newPatches]);
            setLastPatchArr(response.isLastPage);
            setpatchPage(nextpage)
        }catch(error){
            console.log({error:error.toString()});
        }finally{
            setLoadingMorePt(false);
        }
    }
    //patches infinite end

    //discussions
    const observerRefdiscussion = useRef();
    const [loadingMoreDis, setLoadingMoreDis] = useState(false);
    const [lastDisArr,setLastDisArr]=useState(false);
    const [DissPage,setDissPage]=useState(1);
    const lastDisscussRef=useCallback(node=>{
         if (loadingMoreDis ||lastDisArr) return;
         if (observerRefdiscussion.current) observerRefdiscussion.current.disconnect();
         observerRefdiscussion.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && (!lastDisArr)) {
        loadMoreDiscussion();
      }
      
    });
       if (node) observerRefdiscussion.current.observe(node);
    },[loadingMoreDis,lastDisArr]);
    const loadMoreDiscussion =async()=>{
        if(loadingMoreDis || lastDisArr)return;
        setLoadingMoreDis(true);
        const nextpage=DissPage+1;
        try{
            const data=await fetchDiscussions(owner,name,nextpage,10);
            const newDissarr=(Array.isArray(data) ? data : []);
            setDiscussions(diss=>[...diss,...newDissarr]);
            setLastDisArr(newDissarr.length==0);
            setDissPage(nextpage);
            

        }
        catch(error){
            console.log({error:error.toString()});
        }finally{
            setLoadingMoreDis(false);
        }
    }


    //discussions
    const showCollborators =async () =>{
     const collaborators=await fetchCollaborators(owner,name);
     setCurrCollab(collaborators);
    }
    const showProtectedChannels = async()=>{
        const protectedch=await fetchProtectedCh(owner,name);
        setCurrProtectedCh(protectedch);
    }
    
    const userRole = repoMeta ?repoMeta.role:null;
    const canManage = ['owner', 'maintainer'].includes(userRole);
    const currentChannel = channels.find(c => c.isCurrent)?.name || 'main';

    if (!repoMeta && !loading) return (
        <Layout>
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold">Repository not found</h2>
                <Button asChild className="mt-4" variant="outline hover:text-primary">
                    <Link to="/">Back to Dashboard</Link>
                </Button>
            </div>
        </Layout>
    );

    return (
        <Layout repoName={name} owner={owner}>
            <div className="space-y-6">
                {/* Repo Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-none bg-primary/10 flex items-center justify-center text-primary">
                            <Box className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <span className="text-muted-foreground font-normal text-lg">{owner}/</span>{name}
                                <span className={`text-2xs px-2 py-0.5 rounded-none border uppercase transition-colors ${
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
                                    <div className="flex items-center gap-2 bg-muted p-2 rounded-none border">
                                        <code className="text-xs truncate flex-1">
                                            pijul clone {currentUsername}@{displayHost}:/{repoMeta?.owner}/{name} --channel {selectedChannel}
                                        </code>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(`pijul clone ${currentUsername}@${displayHost}:/${repoMeta?.owner}/${name}  --channel ${selectedChannel}`)}>
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
                        <TabsTrigger value="discussions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 py-2 h-auto">
                            <MessageSquare className="w-4 h-4 mr-2" /> Discussions
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
                                                    {selectedChannel}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuLabel>View Channel</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {channels.map(c => (
                                                    <DropdownMenuItem 
                                                        key={c.name} 
                                                        onClick={() => { setSelectedChannel(c.name); setPath(''); setFileContent(null); }} 
                                                        className="flex items-center justify-between"
                                                    >
                                                        {c.name}
                                                        {c.name === selectedChannel && <div className="w-1.5 h-1.5 rounded-none bg-green-500" />}
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

                                <Card className="overflow-hidden border-border/50 rounded-none shadow-none">
                                    {loading ? (
                                        <div className="p-12 text-center text-muted-foreground animate-pulse">Loading files...</div>
                                    ) : fileContent !== null ? (
                                            <div className="bg-card rounded-none">
                                                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50 rounded-none">
                                                    <span className="text-xs font-mono">{path.split('/').pop()}</span>
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs rounded-none" onClick={() => setFileContent(null)}>Close</Button>
                                                </div>
                                                <pre className="p-4 text-sm font-mono overflow-auto leading-relaxed rounded-none whitespace-pre min-w-full">
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
                                                    onClick={() => {
                                                        const parts = path.split('/').filter(Boolean);
                                                        parts.pop();
                                                        setPath(parts.length > 0 ? parts.join('/') + '/' : '');
                                                    }}
                                                >
                                                    <ArrowLeft className="w-4 h-4" /> ..
                                                </div>
                                            )}

                                            {tree.map(item => {
                                                const itemName = typeof item === 'string' ? item : item.path;
                                                const isDir = typeof item === 'object' ? item.isDir : false;
                                                return (
                                                <div 
                                                    key={itemName} 
                                                    className="flex items-center justify-between p-3 hover:bg-accent/30 cursor-pointer group transition-colors"
                                                    onClick={() => {
                                                        const base = path ? (path.endsWith('/') ? path : path + '/') : '';
                                                        setPath(base + itemName + (isDir ? '/' : ''));
                                                    }}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {isDir ? (
                                                            <Folder className="w-4 h-4 text-primary group-hover:text-primary/80" />
                                                        ) : (
                                                            <File className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                                                        )}
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
                            </div>
                        )}

                        {/* Patches Tab */}
                        {(tab === 'patches' || tab === 'patch-detail') && (
                            <div className="space-y-6">
                                {tab === 'patch-detail' ? (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <Button variant="ghost" size="sm" onClick={() => setTab('patches')} className="gap-2 hover:text-primary" >
                                            <ArrowLeft className="w-4 h-4" /> Back to patches
                                        </Button>
                                        <Card className="border-border/50 shadow-lg overflow-hidden">
                                            <CardHeader className="bg-muted/30 border-b">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="text-lg">Patch Details</CardTitle>
                                                    {patchDetail?.hash && (
                                                        <div className="flex items-center gap-2 bg-accent px-2 py-1 rounded">
                                                            <code 
                                                                className="text-2xs cursor-help"
                                                                title={patchDetail.hash}
                                                            >
                                                                Hash: {patchDetail.hash.slice(0, 8)}...
                                                            </code>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-4 w-4 hover:bg-primary/20" 
                                                                onClick={() => {
                                                                    const text = patchDetail.hash;
                                                                    if (navigator.clipboard && navigator.clipboard.writeText) {
                                                                        navigator.clipboard.writeText(text).then(() => {
                                                                            setCopiedHash(true);
                                                                            setTimeout(() => setCopiedHash(false), 2000);
                                                                        });
                                                                    } else {
                                                                        const textArea = document.createElement("textarea");
                                                                        textArea.value = text;
                                                                        document.body.appendChild(textArea);
                                                                        textArea.select();
                                                                        document.execCommand('copy');
                                                                        document.body.removeChild(textArea);
                                                                        setCopiedHash(true);
                                                                        setTimeout(() => setCopiedHash(false), 2000);
                                                                    }
                                                                }}
                                                            >
                                                                {copiedHash ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                {patchDetail?.content && typeof patchDetail.content === 'object' ? (
                                                    <div className="bg-card">
                                                        <div className="p-6 space-y-8">
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
                                                                        <p className="text-sm text-muted-foreground">
                                                                            {new Date(patchDetail.content.timestamp).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                        <Users className="w-3 h-3" /> Author(s)
                                                                    </h3>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {patchDetail.content.authors?.map(author => (
                                                                            <code key={author} className="text-[10px] bg-accent/50 border border-border/50 px-2 py-1 rounded-none text-primary font-mono shadow-sm" title={author}>
                                                                                {author.slice(0, 12)}...
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
                                                                    {patchDetail.content.hunks?.map((hunk, idx) => (
                                                                        <div key={idx} className="border border-border/50 rounded-none overflow-hidden shadow-sm bg-background">
                                                                            <div className="bg-muted/30 px-4 py-2.5 border-b border-border/50 flex justify-between items-center">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className={`text-[10px] uppercase font-black px-1.5 py-0.5 rounded ${
                                                                                        hunk.hunkType === 'Edit' ? 'bg-blue-500/10 text-blue-500' :
                                                                                        hunk.hunkType === 'Replacement' ? 'bg-orange-500/10 text-orange-500' :
                                                                                        'bg-primary/10 text-primary'
                                                                                    }`}>
                                                                                        {hunk.hunkType}
                                                                                    </span>
                                                                                    <span className="text-xs font-mono font-medium text-foreground/80">
                                                                                        {hunk.path} {hunk.newPath ? `→ ${hunk.newPath}` : ''}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Line {hunk.line}</span>
                                                                            </div>
                                                                            <div className="p-0 font-mono text-xs overflow-x-auto">
                                                                                {hunk.previous && (
                                                                                    <div className="p-3 bg-muted/10 border-b border-border/5">
                                                                                        <div className="text-[10px] uppercase font-bold text-muted-foreground/50 mb-1">Context (Previous)</div>
                                                                                        <pre className="whitespace-pre-wrap opacity-60 italic">{hunk.previous}</pre>
                                                                                    </div>
                                                                                )}
                                                                                {hunk.remove && (
                                                                                    <div className="p-3 bg-red-500/5 border-b border-border/5">
                                                                                        <div className="text-[10px] uppercase font-bold text-red-500/50 mb-1">Removed</div>
                                                                                        <pre className="whitespace-pre-wrap text-red-500/80">{hunk.remove}</pre>
                                                                                    </div>
                                                                                )}
                                                                                {hunk.newData && (
                                                                                    <div className="p-3 bg-green-500/5 border-b border-border/5">
                                                                                        <div className="text-[10px] uppercase font-bold text-green-500/50 mb-1">Added</div>
                                                                                        <pre className="whitespace-pre-wrap text-green-500/80">{hunk.newData}</pre>
                                                                                    </div>
                                                                                )}
                                                                                {hunk.lines && hunk.lines.length > 0 ? (
                                                                                    <div className="min-w-full divide-y divide-border/5">
                                                                                        {hunk.lines.map((line, lIdx) => (
                                                                                            <div key={lIdx} className={`flex group ${
                                                                                                line.lineType === 'addition' ? 'bg-green-500/5 hover:bg-green-500/10' : 
                                                                                                line.lineType === 'deletion' ? 'bg-red-500/5 hover:bg-red-500/10' : 
                                                                                                'hover:bg-accent/5'
                                                                                            }`}>
                                                                                                <div className="w-12 shrink-0 text-right pr-4 py-0.5 select-none text-[10px] border-r border-border/10 text-muted-foreground/40 font-light bg-muted/10">
                                                                                                    {line.lineNumber}
                                                                                                </div>
                                                                                                <div className={`w-6 shrink-0 flex justify-center py-0.5 select-none font-bold ${
                                                                                                    line.lineType === 'addition' ? 'text-green-500' : 
                                                                                                    line.lineType === 'deletion' ? 'text-red-500' : 
                                                                                                    'text-muted-foreground/20'
                                                                                                }`}>
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
                                                                                                <div className="text-xs text-muted-foreground italic mb-2 flex items-center justify-center gap-2">
                                                                                                    <Terminal className="w-3 h-3" /> Binary or large block change
                                                                                                </div>
                                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                                                    {hunk.contents && (
                                                                                                        <div className="space-y-2">
                                                                                                            <div className="text-[10px] uppercase font-bold text-red-500/50 text-center">Original</div>
                                                                                                            <pre className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-[10px] overflow-auto max-h-40">
                                                                                                                {hunk.contents.toString('utf-8').slice(0, 500)}
                                                                                                                {hunk.contents.length > 500 ? '...' : ''}
                                                                                                            </pre>
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {hunk.replacementContents && (
                                                                                                        <div className="space-y-2">
                                                                                                            <div className="text-[10px] uppercase font-bold text-green-500/50 text-center">Replacement</div>
                                                                                                            <pre className="p-3 bg-green-500/5 border border-green-500/10 rounded-lg text-[10px] overflow-auto max-h-40">
                                                                                                                {hunk.replacementContents.toString('utf-8').slice(0, 500)}
                                                                                                                {hunk.replacementContents.length > 500 ? '...' : ''}
                                                                                                            </pre>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        ) : (
                                                                                            <p className="text-muted-foreground text-xs italic">No line details available for this change type.</p>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-muted/50 p-6">
                                                        <pre className="text-sm font-mono text-primary leading-relaxed whitespace-pre-wrap">
                                                            <code>{patchDetail?.content || patchDetail}</code>
                                                        </pre>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {log.length === 0 ? (
                                            <div className="text-center py-20 border rounded-none border-dashed">
                                                <History className="w-10 h-10 mx-auto opacity-10 mb-4" />
                                                <p className="text-muted-foreground">No patches found in history.</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-3">
                                                {log.map((patch,idx) => (
                                                    <Card 
                                                        key={patch.hash} 
                                                        ref={(idx==log.length-1)?lastPatchRef:null}
                                                        className="hover:bg-accent/30 cursor-pointer border-border/50 transition-all hover:translate-x-1"
                                                        onClick={() => showPatch(patch.hash)}
                                                    >
                                                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-none bg-accent flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-all">
                                                                    <User className="w-4 h-4" />
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-sm line-clamp-1">{patch.message}</div>
                                                                    <div className="flex items-center gap-2 text-2xs text-muted-foreground mt-0.5">
                                                                        <span className="font-bold text-primary">{patch.hash}</span>
                                                                        <span>•</span>
                                                                        <span>{patch.date}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <code className="text-2xs font-mono bg-accent px-2 py-1 rounded text-muted-foreground" title={patch.author}>
                                                                {patch.author.slice(0, 8)}
                                                            </code>
                                                        </CardHeader>
                                                    </Card>
                                                ))}
                                                {loadingMorePt && (
                                                   <div className="flex justify-center py-4">
                                                     <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                   </div>
                                                 )}
                                                {lastPatchArr && <div className="text-center py-4 text-muted-foreground text-sm">
                                                       You've reached the end of patches
                                                     </div>}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}


                        {/* Discussions Tab */}
                        {tab === 'discussions' && (
                            <div className="space-y-6">
                                {selectedPR ? (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <Button variant="ghost" size="sm" onClick={() => setSelectedPR(null)} className="gap-2 hover:text-primary">
                                            <ArrowLeft className="w-4 h-4" /> Back to discussions
                                        </Button>
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <h2 className="text-2xl font-bold">{selectedPR.title}</h2>
                                                <span className={`px-2 py-0.5 rounded-none text-xs font-bold uppercase border ${
                                                    selectedPR.status === 'merged' ? 'bg-accent/10 text-accent border-accent/20' :
                                                    selectedPR.status === 'open' ? 'bg-primary/10 text-primary border-primary/20' :
                                                    'bg-muted text-muted-foreground border-border'
                                                }`}>
                                                    {selectedPR.status}
                                                </span>
                                            </div>
                                            {canManage && (
                                                <div className="flex items-center gap-2">
                                                    {selectedPR.status === 'open' && (<>
                                                        <Button onClick={() => handleMergePR(selectedPR.id)} className={`bg-primary text-primary-foreground ${(hasConflicts) 
                                                               ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' 
                                                               : 'bg-primary text-primary-foreground hover:opacity-90 cursor-pointer shadow-sm'
                                                             }`}>
                                                            <CheckCircle2 className={`w-4 h-4 mr-2 `} /> Merge Discussion
                                                        </Button>
                                                        <Button variant="outline" onClick={() => handleClosePR(selectedPR.id)} className="border-primary text-primary hover:bg-orange-500/10">
                                                            <XCircle className="w-4 h-4 mr-2" /> Close Discussion
                                                        </Button>
                                                    </>)}
                                                    <Button variant="outline " onClick={() => handleDeletePR(selectedPR.id)} className="border-destructive/50 text-destructive hover:bg-destructive/10">
                                                        <Trash2 className=" relative h-4" /> 
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
                                  {selectedPR.description && selectedPR.description.length>0 &&
                                        <Card className="border-border/50">
                                            <CardContent className="pt-6">
                                                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selectedPR.description}</p>
                                            </CardContent>
                                        </Card>
}
                                        {selectedPR.status === 'open' && (
                                            <div className="bg-primary/5 border border-primary/20 rounded-none p-4 space-y-3">
                                                <h4 className="text-sm font-bold flex items-center gap-2">
                                                    <Terminal className="w-4 h-4" /> How to contribute to this discussion
                                                </h4>
                                                <p className="text-xs text-muted-foreground">
                                                    You can push your patches directly to this discussion's channel. 
                                                    Your changes will appear here as part of the discussion.
                                                </p>
                                                <div className="bg-background border rounded-none p-2 flex items-center justify-between">
                                                    <code className="text-[10px] font-mono text-primary">
                                                        pijul push {currentUsername}@{displayHost}:/{repoMeta?.owner}/{name} --to-channel {selectedPR.sourceChannel}
                                                    </code>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(`pijul push ${currentUsername}@${displayHost}:/${repoMeta?.owner}/${name} --to-channel ${selectedPR.sourceChannel}`)}>
                                                        <Copy className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                         {/* conflicts st */}
                                       {conflicts &&  <ConflictsBox conflicts={conflicts} source={selectedPR.sourceChannel} target={selectedPR.targetChannel}></ConflictsBox>}
                                         {/* conflicts end*/}

                                        <div className="space-y-4">
                                            <h3 className="font-bold flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4" /> Comments
                                            </h3>
                                            <div className="space-y-3">
                                                {selectedPR.comments.map(c => (
                                                    <div key={c.id} className="bg-muted/30 border rounded-none p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="font-bold text-sm">{c.author}</span>
                                                            <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
                                                        </div>
                                                        <p className="text-sm">{c.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-3 pt-4">
                                                <textarea 
                                                    className="w-full bg-background border rounded-none p-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-25"
                                                    placeholder="Leave a comment..."
                                                    value={commentText}
                                                    onChange={(e) => setCommentText(e.target.value)}
                                                />
                                                <div className="flex justify-end">
                                                    <Button onClick={() => handleAddComment(selectedPR.id)} disabled={!commentText.trim()} size="sm">
                                                        Comment
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : isCreatingPR ? (
                                    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                                        <h2 className="text-2xl font-bold">New Discussion / PR</h2>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Title</label>
                                                <Input 
                                                    placeholder="e.g. Add authentication feature" 
                                                    value={newPR.title}
                                                    onChange={(e) => setNewPR({ ...newPR, title: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Description</label>
                                                <textarea 
                                                    className="w-full bg-background border rounded-none p-3 text-sm min-h-37.5 focus:outline-none focus:ring-1 focus:ring-primary"
                                                    placeholder="What changes are you proposing? Explain why."
                                                    value={newPR.description}
                                                    onChange={(e) => setNewPR({ ...newPR, description: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Merge into (Target Branch)</label>
                                                <select
                                                    className="w-full h-10 bg-background border rounded-none px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                                    value={newPR.targetChannel}
                                                    onChange={(e) => setNewPR({ ...newPR, targetChannel: e.target.value })}
                                                >
                                                    {channels.map(c => (
                                                        <option key={c.name} value={c.name}>{c.name}{c.isCurrent ? ' (current)' : ''}</option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-muted-foreground">The branch your changes will be merged into when this discussion is accepted.</p>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" onClick={() => setIsCreatingPR(false)}>Cancel</Button>
                                                <Button onClick={handleCreatePR} disabled={!newPR.title}>Create Discussion</Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-xl font-bold">Discussions</h2>
                                            <Button size="sm" onClick={() => setIsCreatingPR(true)}>
                                                New Discussion
                                            </Button>
                                        </div>
                                        {discussions.length === 0 ? (
                                            <div className="p-20 text-center border-2 border-dashed rounded-none space-y-3">
                                                <MessageSquare className="w-12 h-12 mx-auto opacity-20 text-primary" />
                                                <h3 className="text-lg font-semibold">No discussions yet</h3>
                                                <p className="text-sm text-muted-foreground">Submit your first PR to request changes.</p>
                                            </div>
                                        ) : (
                                            <div className="grid gap-3">
                                                {discussions.map((disc,idx) => (
                                                    <Card 
                                                        key={disc.id} 
                                                        ref={(discussions.length-1==idx)?lastDisscussRef:null}
                                                        className="hover:border-primary/50 transition-all hover:translate-x-1 cursor-pointer" 
                                                        onClick={() =>{ showSelectedpr(disc.id),showConflictsPR(disc.id)}}
                                                    >
                                                        <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-none flex items-center justify-center ${
                                                                    disc.status === 'merged' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
                                                                }`}>
                                                                    {disc.status === 'merged' ? <ArrowUpCircle className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-sm">{disc.title}</div>
                                                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                        #{disc.id.slice(-4)} opened by {disc.author}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-[10px] font-bold uppercase px-2 py-0.5 border rounded-none">
                                                                {disc.status}
                                                            </div>
                                                        </CardHeader>
                                                    </Card>
                                                ))}
                                                 {loadingMoreDis && (
                                                        <div className="flex justify-center py-4">
                                                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                                        </div>
                                                      )}
                                                {lastDisArr && (
                                                        <div className="text-center py-4 text-muted-foreground text-sm">
                                                          You've reached the end of Discussions
                                                        </div>
                                                      )}
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
                                                <div className="flex items-center gap-2">
                                                    <Input 
                                                        placeholder="Username to invite..." 
                                                        value={newCollab}
                                                        onChange={(e) => setNewCollab(e.target.value)}
                                                        className="max-w-xs"
                                                    />
                                                    <select 
                                                        className="h-10 bg-background border rounded-none px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                                                        value={newCollabRole}
                                                        onChange={(e) => setNewCollabRole(e.target.value)}
                                                    >
                                                        <option value="developer">Developer</option>
                                                        <option value="maintainer">Maintainer</option>
                                                    </select>
                                                    <Button 
                                                        onClick={() => {
                                                            addCollaborator(owner, name, newCollab.trim(), newCollabRole).then((res) => {
                                                                if (res.error) {
                                                                    alert('Failed to add user: ' + res.error);
                                                                } else {
                                                                    setCurrCollab(currCollab=>[...currCollab.filter(colab=>colab.username!=newCollab.trim()),{username:newCollab.trim(),role:newCollabRole}]);
                                                                    setNewCollab('');


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
                                                <div className="border border-border/50 rounded-none divide-y divide-border/50">
                                                    {currCollab?.map(c => (
                                                        <div key={c.username} className="flex items-center justify-between p-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-none bg-accent flex items-center justify-center">
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
                                                                    removeCollaborator(owner, name, c.username).then((res) => {
                                                                        if (res.error) alert('Failed: ' + res.error);
                                                                        else {
                                                                            setCurrCollab(currCollab=>currCollab.filter((co)=>co.username!=c.username))
                                                                        };
                                                                    }).catch(err => alert('Error: ' + err.message));
                                                                }}
                                                            >
                                                                Remove
                                                            </Button>
                                                        </div>
                                                    ))}
                                                    {(!currCollab || currCollab.length === 0) && (
                                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                                            No collaborators added yet.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </section>
                                <section className="space-y-4">
                                    <div className="flex items-center gap-2 pb-2 border-b">
                                        <Lock className="w-5 h-5 text-primary" />
                                        <h2 className="text-xl font-bold">Branch Protection</h2>
                                    </div>
                                    <Card className="border-border/50">
                                        <CardHeader>
                                            <CardTitle className="text-base">Protected Channels</CardTitle>
                                            <CardDescription>
                                                Protecting a channel prevents non-maintainers from pushing directly. They must use Discussions/PRs to propose changes.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>

                                            <div className="border border-border/50 rounded-none divide-y divide-border/50">
                                                {channels.sort((a,b)=>a.name.localeCompare(b.name)).map(c => (
                                                    <div key={c.name} className="flex items-center justify-between p-4 transition-colors hover:bg-accent/5">
                                                        <div className="flex items-center gap-3">
                                                            {currProtectedCh?.includes(c.name) ? 
                                                                <Lock className="w-4 h-4 text-primary" /> : 
                                                                <Unlock className="w-4 h-4 text-muted-foreground" />
                                                            }
                                                            <div>
                                                                <div className="font-mono text-sm font-bold">{c.name}</div>
                                                                {c.isCurrent && <span className="text-[10px] text-primary uppercase font-bold">Current</span>}
                                                            </div>
                                                        </div>
                                                        <Button 
                                                            variant={currProtectedCh?.includes(c.name) ? "destructive" : "outline"}
                                                            size="sm"
                                                            onClick={() => handleToggleProtection(c.name)}
                                                            className="h-8"
                                                        >
                                                            {currProtectedCh?.includes(c.name) ? "Unprotect" : "Protect"}
                                                        </Button>
                                                    </div>
                                                ))}
                                                {channels.length === 0 && (
                                                    <div className="p-4 text-center text-sm text-muted-foreground">
                                                        No channels found.
                                                    </div>
                                                )}
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
                                                        deleteRepo(owner, name).then(() => navigate('/'));
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
