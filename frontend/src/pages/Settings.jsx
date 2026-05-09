import React, { useEffect, useState } from 'react';
import { fetchProfile, addSshKey, deleteSshKey } from '../api';
import { 
  Key, 
  Plus, 
  Trash2, 
  Shield, 
  Info, 
  Terminal, 
  Settings as SettingsIcon,
  User,
  Fingerprint,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';

const Settings = () => {
    const [keys, setKeys] = useState([]);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('');

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const data = await fetchProfile();
        setKeys(data.sshKeys || []);
        setUsername(data.username);
        setLoading(false);
    };

    const handleAddKey = async (e) => {
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

    const handleDeleteKey = async (id) => {
        try {
            await deleteSshKey(id);
            await loadProfile();
        } catch (err) {
            console.error("Failed to delete key:", err);
        }
    };

    return (
        <Layout>
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center gap-4 border-b pb-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
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
                        <Button variant="accent" className="justify-start gap-3 bg-accent text-accent-foreground">
                            <Key className="w-4 h-4" /> SSH Keys
                        </Button>
                        <Button variant="ghost" className="justify-start gap-3 text-muted-foreground">
                            <User className="w-4 h-4" /> Account Settings
                        </Button>
                        <Button variant="ghost" className="justify-start gap-3 text-muted-foreground">
                            <ShieldCheck className="w-4 h-4" /> Security
                        </Button>
                    </nav>

                    <div className="space-y-8">
                        <section className="space-y-4">
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
                                        <Button type="submit" disabled={!newKeyValue} className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs">
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
                                                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-muted-foreground group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-colors">
                                                            <Key className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-sm">{key.name}</div>
                                                            <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate max-w-[200px] sm:max-w-md">
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
                        </section>

                        <Card className="bg-indigo-500/5 border-indigo-500/20 shadow-none">
                            <CardContent className="p-4 flex gap-4">
                                <div className="mt-1">
                                    <ShieldCheck className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-indigo-300">Secure Authentication</h4>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Your keys are automatically synced across the cluster. New keys are active immediately for both SSH and Web-based operations.
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-indigo-400/70 pt-1">
                                        <AlertCircle className="w-3 h-3" />
                                        <span>Authentication managed by PijulServ Dynamic Auth Protocol</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Settings;
