import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRepo } from '../api';
import { Book, Plus, Lock, Globe, ArrowLeft, Info } from 'lucide-react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';

const NewRepo = () => {
    const [name, setName] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name) return;
        setLoading(true);
        setError('');
        try {
            const data = await createRepo(name, isPrivate);
            if (data.error) throw new Error(data.error);
            navigate(`/repos/${name}`);
        } catch (err) {
            setError(err.message || err.toString());
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
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-primary">Project name</label>
                                <Input 
                                    placeholder="my-awesome-project" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-10"
                                />
                                <p className="text-2xs text-muted-foreground italic">
                                    Project URL: {window.location.host}/repos/{name || '...'}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-semibold text-primary">Visibility Level</label>
                                <div className="grid gap-3">
                                    <div 
                                        className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                                            !isPrivate 
                                                ? 'bg-primary/5 border-primary/50 shadow-sm' 
                                                : 'hover:bg-accent/50 border-border/50'
                                        }`}
                                        onClick={() => setIsPrivate(false)}
                                    >
                                        <div className="mt-1">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!isPrivate ? 'border-primary' : 'border-muted-foreground'}`}>
                                                {!isPrivate && <div className="w-2 h-2 rounded-full bg-primary" />}
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                                                <Globe className="w-4 h-4 text-muted-foreground group-hover:text-primary/70" /> Public
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                Anyone can see the project. You choose who can record patches.
                                            </p>
                                        </div>
                                    </div>

                                    <div 
                                        className={`flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer ${
                                            isPrivate 
                                                ? 'bg-primary/5 border-primary/50 shadow-sm' 
                                                : 'hover:bg-accent/50 border-border/50'
                                        }`}
                                        onClick={() => setIsPrivate(true)}
                                    >
                                        <div className="mt-1">
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isPrivate ? 'border-primary' : 'border-muted-foreground'}`}>
                                                {isPrivate && <div className="w-2 h-2 rounded-full bg-primary" />}
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                                                <Lock className="w-4 h-4 text-muted-foreground group-hover:text-primary/70" /> Private
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                Project access must be granted explicitly to each user.
                                            </p>
                                        </div>
                                    </div>
                                </div>
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
                                disabled={loading || !name}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[140px]"
                            >
                                {loading ? 'Creating...' : 'Create Project'}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </Layout>
    );
};

export default NewRepo;
