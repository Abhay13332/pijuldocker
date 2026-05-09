import React from 'react';
import { Terminal, Key, Code, Shield, Info, CheckCircle, Rocket } from 'lucide-react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Link } from 'react-router-dom';

const Guide = () => {
    const hostname = window.location.hostname;

    return (
        <Layout>
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
                <div className="text-center space-y-4 mb-8 mt-4">
                    <div className="w-16 h-16 bg-indigo-500/10 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Rocket className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Getting Started with PijulServ</h1>
                    <p className="text-lg text-muted-foreground">Start collaborating on Pijul repositories in minutes.</p>
                </div>

                {/* Step 1: SSH Key */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
                            <Key className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold">1. Add your SSH Key</h2>
                    </div>
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-6">
                            <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">
                                <h3 className="text-indigo-400 font-semibold flex items-center gap-2">
                                    <Rocket className="w-4 h-4" /> Automated Client Setup (Recommended)
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Run this command in your terminal to automatically generate an SSH key, configure your connection to the server, and set up your Pijul identity in one go:
                                </p>
                                <div className="bg-background border rounded-md p-3 overflow-x-auto">
                                    <code className="text-sm font-mono text-primary">
                                        bash -c "$(curl -fsSL http://{hostname}:3001/setup.sh)"
                                    </code>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-primary">Manual Key Setup</h3>
                                <p className="text-sm text-muted-foreground">
                                    If you prefer to configure things manually, simply add your public SSH key to your account. For the easiest, zero-setup experience, we recommend using a key without a passphrase.
                                </p>
                                <ul className="space-y-3 text-sm text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <div>
                                            Generate a key (leave password blank when asked):
                                            <div className="mt-2 p-2 bg-muted/50 border rounded font-mono text-xs text-primary inline-block">
                                                ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519
                                            </div>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <span>Copy the key content from <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded">~/.ssh/id_ed25519.pub</code></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <span>Paste it into your <Link to="/settings" className="text-indigo-400 hover:underline">Settings</Link> page.</span>
                                    </li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Step 2: Identity */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                            <Shield className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold">2. Setup Pijul Identity</h2>
                    </div>
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-4">
                            <p className="text-sm text-muted-foreground">Run the following command to create your global identity. This is used to sign your patches.</p>
                            <div className="bg-background border rounded-md p-3">
                                <code className="text-sm font-mono text-primary">pijul identity new</code>
                            </div>
                            
                            <div className="bg-muted/30 border rounded-xl p-4 mt-4">
                                <h4 className="font-semibold text-sm mb-3">Recommended Answers:</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                    <div><strong className="text-indigo-400">Unique identity name:</strong> <span className="text-muted-foreground">Your username (e.g. anshuman)</span></div>
                                    <div><strong className="text-indigo-400">Display name:</strong> <span className="text-muted-foreground">Your full name</span></div>
                                    <div><strong className="text-indigo-400">Email:</strong> <span className="text-muted-foreground">Your account email</span></div>
                                    <div><strong className="text-indigo-400">Change encryption?</strong> <span className="text-muted-foreground">Enter <code className="text-orange-400">y</code></span></div>
                                    <div><strong className="text-indigo-400">Key to expire?</strong> <span className="text-muted-foreground">Enter <code className="text-orange-400">n</code></span></div>
                                    <div><strong className="text-indigo-400">Link to remote?</strong> <span className="text-muted-foreground">Enter <code className="text-orange-400">n</code></span></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Step 3: Commands */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
                            <Code className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold">3. Basic Commands</h2>
                    </div>
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-6">
                            <div>
                                <h4 className="font-semibold mb-2">Clone a repository</h4>
                                <div className="bg-background border rounded-md p-3 overflow-x-auto">
                                    <code className="text-sm font-mono text-primary">pijul clone pijulserv@{hostname}:/&lt;repo-name&gt;</code>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-2">Record and Push changes</h4>
                                <div className="bg-background border rounded-md p-3 overflow-x-auto whitespace-pre">
                                    <code className="text-sm font-mono text-primary">
{`pijul add .
pijul record -m "Initial patch"
pijul push pijulserv@${hostname}:/<repo-name>`}
                                    </code>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Troubleshooting */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                            <Info className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold">Troubleshooting & Tips</h2>
                    </div>
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-6">
                            <div>
                                <h4 className="font-semibold text-primary">"Timeout before authentication" or Password Prompt</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    If Pijul hangs and then asks for a system password, your SSH server has timed out while waiting for your SSH key passphrase.
                                    <br/><strong className="text-indigo-400 mt-2 block">Fix:</strong> Use an SSH Agent so your key is provided instantly without a prompt:
                                </p>
                                <div className="bg-background border rounded-md p-3 my-3">
                                    <code className="text-sm font-mono text-primary whitespace-pre">
{`eval $(ssh-agent -s)
ssh-add ~/.ssh/id_ed25519`}
                                    </code>
                                </div>
                                <p className="text-xs text-muted-foreground italic">
                                    For Fish shell, use: <code className="text-primary not-italic">ssh-agent -c | source</code> instead of eval.
                                </p>
                            </div>

                            <div className="pt-4 border-t">
                                <h4 className="font-semibold text-primary">"Not authenticated" or "Access Denied"</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Even if your SSH key is correct, you must be added as a <strong>Collaborator</strong> to private repositories in the Web UI before you can clone or push to them.
                                </p>
                            </div>

                            <div className="pt-4 border-t">
                                <h4 className="font-semibold text-primary">"Only Pijul commands are allowed"</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    If you see this when running <code className="text-primary">ssh pijulserv@{hostname}</code>, it means your setup is <strong className="text-green-500">working perfectly!</strong> The server is correctly blocking standard shell access for security.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </div>
        </Layout>
    );
};

export default Guide;
