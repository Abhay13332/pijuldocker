import { useEffect, useState } from 'react';
import { fetchProfile, addSshKey, deleteSshKey } from '../api';
import type { SshKey } from '../types';
import { 
  Key, 
  Plus, 
  Trash2, 
  User,
  Fingerprint,
  ShieldCheck,
  AlertCircle,
  Palette,
  Check,
  Github
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useColorTheme } from '../hooks/useColorTheme';

const Settings = () => {
    const [keys, setKeys] = useState<SshKey[]>([]);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('');
    const [section, setSection] = useState<'ssh' | 'appearance' | 'github'>('ssh');
    const [gitConnected, setGitConnected] = useState(false);
    const { themeId, themes, setTheme } = useColorTheme();

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        const data = await fetchProfile();
        setKeys(data.sshKeys || []);
        setUsername(data.username);
        
        // Retrieve connected state from local storage or fallback to API and synchronize
        const localGit = localStorage.getItem('gitConnected');
        if (localGit !== null) {
            setGitConnected(localGit === 'true');
        } else {
            const connectedState = !!data.gitConnected;
            localStorage.setItem('gitConnected', String(connectedState));
            setGitConnected(connectedState);
        }
        
        setLoading(false);
    }

    const handleConnectGitHub = () => {
        localStorage.setItem('gitConnected', 'true');
        const gitUrl = import.meta.env.VITE_GITURL || 'https://github.com/login/oauth/authorize?client_id=dummy';
        const separator = gitUrl.includes('?') ? '&' : '?';
        window.location.href = `${gitUrl}${separator}state=user`;
    };

    const handleDisconnectGitHub = () => {
        localStorage.setItem('gitConnected', 'false');
        setGitConnected(false);
    };

    const handleAddKey = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!newKeyValue) return;
        
        let title = newKeyName.trim();
        if (!title) {
            const parts = newKeyValue.trim().split(' ');
            title = parts.length >= 3 ? parts.slice(2).join(' ') : 'My SSH Key';
        }

        try {
            await addSshKey(title, newKeyValue.trim());
            setNewKeyName('');
            setNewKeyValue('');
            await loadProfile();
        } catch (err) {
            console.error("Failed to add key:", err);
        }
    };

    const handleDeleteKey = async (id: string) => {
        try {
            await deleteSshKey(id);
            await loadProfile();
        } catch (err) {
            console.error("Failed to delete key:", err);
        }
    };

    if (loading) return null;

    return (
        <Layout>
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center gap-4 border-b pb-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                        <User className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{username}'s Profile</h1>
                        <p className="text-muted-foreground text-sm flex items-center gap-2">
                            Manage your account settings and SSH keys.
                        </p>
                    </div>
                </div>

                <div className="grid md:grid-cols-[240px_1fr] gap-8">
                    {/* Sub-nav */}
                    <nav className="flex flex-col gap-1">
                        <Button
                            variant={section === 'ssh' ? 'secondary' : 'ghost'}
                            className={`justify-start gap-3 ${section === 'ssh' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground'}`}
                            onClick={() => setSection('ssh')}
                        >
                            <Key className="w-4 h-4" /> SSH Keys
                        </Button>
                        <Button
                            variant={section === 'appearance' ? 'secondary' : 'ghost'}
                            className={`justify-start gap-3 ${section === 'appearance' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground'}`}
                            onClick={() => setSection('appearance')}
                        >
                            <Palette className="w-4 h-4" /> Appearance
                        </Button>
                        <Button
                            variant={section === 'github' ? 'secondary' : 'ghost'}
                            className={`justify-start gap-3 ${section === 'github' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground'}`}
                            onClick={() => setSection('github')}
                        >
                            <Github className="w-4 h-4" /> GitHub Integration
                        </Button>
                        <Button variant="ghost" className="justify-start gap-3 text-muted-foreground">
                            <User className="w-4 h-4" /> Account Settings
                        </Button>
                        <Button variant="ghost" className="justify-start gap-3 text-muted-foreground">
                            <ShieldCheck className="w-4 h-4" /> Security
                        </Button>
                    </nav>

                    <div className="space-y-8">
                        {section === 'appearance' && (
                            <section className="space-y-4">
                                <div className="flex flex-col space-y-1">
                                    <h2 className="text-xl font-bold">Appearance</h2>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {Object.values(themes).map(theme => {
                                        const selected = themeId === theme.id;
                                        return (
                                            <button
                                                key={theme.id}
                                                onClick={() => setTheme(theme.id)}
                                                className={`relative group rounded-xl border-2 p-3 text-left transition-all duration-150
                                                    hover:scale-[1.02] hover:shadow-md
                                                    ${selected
                                                        ? 'border-primary shadow-md shadow-primary/20'
                                                        : 'border-border hover:border-primary/50'
                                                    }`}
                                            >
                                                {/* Colour swatches */}
                                                <div className="flex gap-1.5 mb-2">
                                                    <div className="w-8 h-8 rounded-md border border-border/50 flex-shrink-0"
                                                        style={{ background: theme.preview.background }} />
                                                    <div className="w-8 h-8 rounded-md flex-shrink-0"
                                                        style={{ background: theme.preview.primary }} />
                                                    <div className="w-8 h-8 rounded-md flex-shrink-0"
                                                        style={{ background: theme.preview.accent }} />
                                                </div>
                                                <div className="text-sm font-semibold text-foreground">{theme.name}</div>

                                                {selected && (
                                                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                                        <Check className="w-3 h-3 text-primary-foreground" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {section === 'github' && (
                            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex flex-col space-y-1">
                                    <h2 className="text-xl font-bold">GitHub Integration</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Connect your account to GitHub to authorize repository sync and collaborate seamlessly.
                                    </p>
                                </div>

                                {gitConnected ? (
                                    <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-md shadow-emerald-500/5 transition-all overflow-hidden relative group">
                                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/50 to-teal-500/50" />
                                        <CardHeader className="pb-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 relative shrink-0">
                                                        <Github className="w-6 h-6 animate-pulse" />
                                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
                                                            <Check className="w-2.5 h-2.5 text-white" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-lg flex items-center gap-2">
                                                            Connected to GitHub
                                                        </CardTitle>
                                                        <CardDescription className="text-emerald-600/80 dark:text-emerald-400/80 text-xs">
                                                            Authorized as @{username}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                                <Badge className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-2xs font-bold uppercase tracking-wider rounded-full">
                                                    Active
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="bg-background/40 backdrop-blur-sm rounded-xl p-3 border border-border/30 text-xs space-y-2 text-muted-foreground leading-relaxed">
                                                <p className="font-semibold text-foreground">Active Scopes & Capabilities:</p>
                                                <ul className="list-disc list-inside space-y-1 ml-1">
                                                    <li>Sync Pijul channels to GitHub repositories automatically</li>
                                                    <li>Import remote GitHub public and private repositories</li>
                                                    <li>Automated pull request synchronization (Standard Channels)</li>
                                                </ul>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="bg-emerald-500/5 border-t border-emerald-500/10 p-3 flex justify-end">
                                            <Button 
                                                variant="ghost" 
                                                onClick={handleDisconnectGitHub} 
                                                className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                                            >
                                                Disconnect Account
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ) : (
                                    <Card className="border-border/50 bg-gradient-to-br from-background via-background to-accent/5 shadow-sm transition-all duration-300 hover:shadow-md">
                                        <CardHeader className="pb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 transition-transform duration-300 group-hover:scale-105">
                                                    <Github className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">Link your GitHub Account</CardTitle>
                                                    <CardDescription>
                                                        Link your identity with GitHub to unlock deep repository integrations.
                                                    </CardDescription>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                Linking your account is quick and secure. We only request permissions necessary to keep your repositories and channels perfectly in sync with your GitHub mirrors.
                                            </p>
                                            <div className="grid sm:grid-cols-2 gap-3 pt-2">
                                                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border/30 bg-muted/20">
                                                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="text-xs font-semibold">1:1 Account Mapping</h4>
                                                        <p className="text-2xs text-muted-foreground mt-0.5">Strictly connects to a single user profile safely.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border/30 bg-muted/20">
                                                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="text-xs font-semibold">Secure Mirroring</h4>
                                                        <p className="text-2xs text-muted-foreground mt-0.5">Continuous integration triggers and automatic branch commits.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="bg-muted/30 border-t p-4 flex justify-end">
                                            <Button 
                                                onClick={handleConnectGitHub} 
                                                className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-white font-medium shadow-md shadow-black/10 dark:shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 h-9 px-4 text-xs gap-2"
                                            >
                                                <Github className="w-4 h-4" /> Connect GitHub Account
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                )}
                            </section>
                        )}

                        {section === 'ssh' && (<>
                            <div className="flex flex-col space-y-1">
                                <h2 className="text-xl font-bold">SSH Keys</h2>
                                <p className="text-sm text-muted-foreground">
                                    SSH keys allow you to securely authenticate with Pijul without entering passwords.
                                </p>
                            </div>

                            <Card className="border-border/50">
                                <form onSubmit={handleAddKey}>
                                    <CardHeader>
                                        <CardTitle className="text-base">Add SSH Key</CardTitle>
                                        <CardDescription>Paste your public key here (e.g. ed25519 or rsa).</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-primary uppercase tracking-wider">Title</label>
                                            <Input 
                                                placeholder="e.g. Work Laptop" 
                                                value={newKeyName}
                                                onChange={(e) => setNewKeyName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-primary uppercase tracking-wider">Public Key</label>
                                            <textarea 
                                                className="w-full h-32 bg-background border border-input rounded-md p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                                placeholder="Begins with 'ssh-rsa' or 'ssh-ed25519'..."
                                                value={newKeyValue}
                                                onChange={(e) => setNewKeyValue(e.target.value)}
                                            />
                                        </div>
                                    </CardContent>
                                    <CardFooter className="bg-muted/30 border-t p-3 flex justify-end">
                                        <Button type="submit" disabled={!newKeyValue} className="bg-primary hover:bg-primary/90 h-8 text-xs">
                                            <Plus className="w-3 h-3 mr-2" /> Add Key
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Card>

                            <div className="space-y-3 pt-4">
                                <h3 className="text-sm font-bold text-primary px-1">Your Registered Keys</h3>
                                {keys.length === 0 ? (
                                    <Card className="border-dashed border-2 bg-transparent">
                                        <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                                            <Fingerprint className="w-8 h-8 mb-2 opacity-20" />
                                            <p className="text-sm">No SSH keys registered yet.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className="grid gap-3">
                                        {keys.map(key => (
                                            <Card key={key.id} className="border-border/50 hover:bg-accent/20 transition-colors group">
                                                <div className="p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                                                            <Key className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-sm">{key.name}</div>
                                                            <div className="text-2xs font-mono text-muted-foreground mt-0.5 truncate max-w-[200px] sm:max-w-md">
                                                                {key.key.slice(0, 60)}...
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="text-muted-foreground hover:text-destructive transition-colors"
                                                        onClick={() => handleDeleteKey(key.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        <Card className="bg-primary/5 border-primary/20 shadow-none">
                            <CardContent className="p-4 flex gap-4">
                                <div className="mt-1">
                                    <ShieldCheck className="w-5 h-5 text-primary" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-primary">Secure Authentication</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Your keys are automatically synced across the cluster. New keys are active immediately for both SSH and Web-based operations.
                                    </p>
                                    <div className="flex items-center gap-2 text-2xs text-primary/70 pt-1">
                                        <AlertCircle className="w-3 h-3" />
                                        <span>Authentication managed by PijulServ Dynamic Auth Protocol</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        </>)}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Settings;
