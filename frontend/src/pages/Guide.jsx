import React, { useState, useEffect } from 'react';
import { Terminal, Key, Code, Shield, Info, CheckCircle, Rocket, Zap, Users, GitBranch, GitMerge, AlertTriangle, BookOpen } from 'lucide-react';
import Layout from '../components/Layout';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Link } from 'react-router-dom';

const CodeBlock = ({ children, className = '' }) => (
    <div className={`bg-background border rounded-md p-3 overflow-x-auto ${className}`}>
        <code className="text-sm font-mono text-primary whitespace-pre">{children}</code>
    </div>
);

const SectionHeader = ({ icon: Icon, color, title }) => (
    <div className="flex items-center gap-3">
        <div className={`p-2 ${color} rounded-lg`}>
            <Icon className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
    </div>
);

const Guide = () => {
    const [hostname, setHostname] = useState(window.location.hostname);
    const [ip, setIp] = useState('');
    const username = localStorage.getItem("username");

   

    const displayHost = import.meta.env.VITE_PUBLIC_IP||hostname;

    return (
        <Layout>
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">

                {/* Hero */}
                <div className="text-center space-y-4 mb-8 mt-4">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <BookOpen className="w-8 h-8" />
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tight">Pijul Basics</h1>
                    <p className="text-lg text-muted-foreground">Understand the model, learn the commands, start collaborating.</p>
                </div>

                {/* ── SECTION 1: Roles & Contribution ── */}
                <section className="space-y-4">
                    <SectionHeader icon={Users} color="bg-blue-500/10 text-blue-500" title="Roles, Channels & the Contribution Flow" />
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-6">

                            {/* Roles */}
                            <div>
                                <h3 className="text-lg font-semibold mb-1 text-foreground">Who can do what</h3>
                                <p className="text-sm text-muted-foreground mb-3">
                                    PijulServ has four roles. Think of them as concentric rings of trust — each ring includes all the permissions of the one inside it.
                                </p>
                                <ul className="space-y-3 text-sm text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                        <span><strong className="text-foreground">Visitor</strong> — default for public repos. Can clone and read everything, but cannot push. Must propose changes via Discussions.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                        <span><strong className="text-foreground">Developer</strong> — can push to <em>unprotected</em> channels. Pushing a brand-new channel name automatically opens a Discussion for it (this is how you make a "pull request"). Cannot touch <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded">main</code> or other protected channels directly.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <span><strong className="text-foreground">Maintainer</strong> — full write access everywhere, including protected channels. Reviews Discussions and pulls patches into <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded">main</code>.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                                        <span><strong className="text-foreground">Owner</strong> — everything a Maintainer can do, plus deleting the repo and changing other users' roles.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Protected vs Unprotected */}
                            <div className="pt-4 border-t">
                                <h3 className="text-lg font-semibold mb-1 text-foreground">Protected vs. unprotected channels</h3>
                                <p className="text-sm text-muted-foreground mb-3">
                                    A <strong>channel</strong> is Pijul's equivalent of a Git branch — but lighter. It's just a label pointing to a set of patches; it carries no commit-graph baggage.
                                </p>
                                <ul className="space-y-3 text-sm text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <Shield className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <span><strong className="text-foreground">Protected</strong> (e.g. <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded">main</code>) — only Maintainers and Owners can push here. Everyone else proposes via a Discussion.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Code className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                        <span><strong className="text-foreground">Unprotected</strong> — any Developer can create or push to these. The moment you push a channel name that doesn't exist yet, PijulServ automatically opens a Discussion thread for it — your live "pull request".</span>
                                    </li>
                                </ul>
                            </div>

                            {/* How patches reach main */}
                            <div className="pt-4 border-t">
                                <h3 className="text-lg font-semibold mb-3 text-foreground">How patches travel from your machine to <code className="text-primary font-mono bg-muted/50 px-1.5 py-0.5 rounded text-base">main</code></h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    There are two paths depending on your role. Both ultimately end with a Maintainer pulling your patches into the protected channel — the difference is only in how your work gets onto the server in the first place.
                                </p>

                                <div className="space-y-4 text-sm text-muted-foreground">
                                    <div className="bg-muted/10 p-4 rounded-lg border border-border/50">
                                        <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                                            <Terminal className="w-4 h-4 text-primary" /> Path A — Developer (push a topic channel)
                                        </h4>
                                        <p className="mb-3">You push directly; PijulServ auto-opens the Discussion for you.</p>
                                        <ol className="list-decimal pl-5 space-y-2">
                                            <li>Create a local topic channel:<br/>
                                                <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded text-xs">pijul channel new my-feature</code>
                                            </li>
                                            <li>Switch to it:<br/>
                                                <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded text-xs">pijul channel switch my-feature</code>
                                            </li>
                                            <li>Record your patches on this channel:<br/>
                                                <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded text-xs">pijul record -m "add feature X"</code>
                                            </li>
                                            <li>Push to a <em>new</em> channel name on the server (this creates the Discussion):<br/>
                                                <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded text-xs">{`pijul push ${username}@${displayHost}:/<owner>/<repo> --to-channel my-feature`}</code>
                                            </li>
                                            <li>PijulServ detects the new unprotected channel → <strong>opens a Discussion automatically</strong>. Share the link with Maintainers for review.</li>
                                            <li>A Maintainer reviews and runs:<br/>
                                                <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded text-xs">{`pijul pull ${username}@${displayHost}:/<owner>/<repo> --from-channel my-feature`}</code><br/>
                                                <span className="text-xs">…on their local <code className="text-primary">main</code>, then pushes to the protected channel. Done.</span>
                                            </li>
                                        </ol>
                                    </div>

                                    <div className="bg-muted/10 p-4 rounded-lg border border-border/50">
                                        <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                                            <Code className="w-4 h-4 text-primary" /> Path B — Visitor (Discussion-first workflow)
                                        </h4>
                                        <p className="mb-3">You can't push at all, so the server creates a channel for you to target.</p>
                                        <ol className="list-decimal pl-5 space-y-2">
                                            <li>Open the web UI → create a new <strong>Discussion</strong> on the repo page.</li>
                                            <li>PijulServ auto-creates a dedicated channel (e.g. <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded text-xs">discussion-42</code>) linked to that thread.</li>
                                            <li>Clone the repo:<br/>
                                                <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded text-xs">{`pijul clone ${username}@${displayHost}:/<owner>/<repo> --channel main`}</code>
                                            </li>
                                            <li>Switch locally to the discussion channel:<br/>
                                                <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded text-xs">pijul channel switch discussion-42</code>
                                            </li>
                                            <li>Record patches and push back to that channel — you have write access only there.</li>
                                            <li>Comment in the Discussion thread when your patches are ready for review.</li>
                                        </ol>
                                    </div>

                                    <p className="italic text-muted-foreground text-xs mt-1">
                                        In both paths, the Maintainer's final step is the same: pull your channel's patches into <code className="text-primary">main</code> and push. No "merge commits", no rebase dance — just patch application.
                                    </p>
                                </div>
                            </div>

                            {/* Patches vs Commits */}
                            <div className="pt-4 border-t">
                                <h3 className="text-lg font-semibold mb-2 text-foreground">Patches vs. Commits — why it matters for collaboration</h3>
                                <p className="text-sm text-muted-foreground">
                                    A Git commit is a snapshot of the whole repo at one moment, chained to its parent. A Pijul patch is a self-contained description of an edit — "insert line X between lines A and B" — identified by a hash of its content, not its position in history. Two patches that touch different parts of the code are <strong>independent</strong> and can be applied in any order with identical results (commutativity).
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    This means <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded">pijul unrecord</code> can remove a patch from six months ago without disturbing anything recorded after it — as long as nothing depends on it. It also means cherry-picking is just a selective pull: choose which patches you want, leave the rest.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* ── SECTION 2: SSH Key ── */}
                <section className="space-y-4">
                    <SectionHeader icon={Key} color="bg-primary/10 text-primary" title="1. Add your SSH Key" />
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-6">
                            <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                                <h3 className="text-primary font-semibold flex items-center gap-2">
                                    <Rocket className="w-4 h-4" /> Automated Client Setup (Recommended)
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Run this in your terminal to generate an SSH key, configure your connection, and set up your Pijul identity in one go:
                                </p>
                                <CodeBlock>{`bash -c "$(curl -fsSL http://${window.location.host}${window.location.port ? ':' + window.location.port : ''}/setup.sh)"`}</CodeBlock>

                                <div className="bg-muted/30 border rounded-xl p-4 mt-4">
                                    <h4 className="font-semibold text-sm mb-3">Recommended Answers:</h4>
                                    <div className="grid grid-cols-1 gap-y-3 text-sm">
                                        <div><strong className="text-primary">Enter a name for your new SSH key:</strong> <span className="text-muted-foreground">Anything you like</span></div>
                                        <div><strong className="text-primary">Do you want to use a passphrase for this key?</strong> <span className="text-muted-foreground"><code className="text-foreground">N</code></span></div>
                                        <div><strong className="text-primary">Add this to your ~/.ssh/config?</strong> <span className="text-muted-foreground"><code className="text-foreground">Y</code></span></div>
                                        <div><strong className="text-primary">Enter your server IP or domain:</strong> <span className="text-muted-foreground"><code className="text-foreground">{displayHost}</code></span></div>
                                        <div><strong className="text-primary">Enter the system username:</strong> <span className="text-muted-foreground"><code className="text-foreground">pijulserv</code></span></div>
                                        <div><strong className="text-primary">Enter the SSH port:</strong> <span className="text-muted-foreground"><code className="text-foreground">45232</code></span></div>
                                        <div><strong className="text-primary">Do you want to create a new Pijul identity now?</strong> <span className="text-muted-foreground"><code className="text-foreground">Y</code></span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-primary">Manual Key Setup</h3>
                                <p className="text-sm text-muted-foreground">
                                    If you prefer to configure things manually, add your public SSH key to your account. For a zero-friction experience, use a key without a passphrase.
                                </p>
                                <ul className="space-y-3 text-sm text-muted-foreground">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <div>Generate a key (leave password blank):
                                            <div className="mt-2">
                                                <CodeBlock>ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519</CodeBlock>
                                            </div>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <span>Copy the contents of <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded">~/.ssh/id_ed25519.pub</code></span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                        <span>Paste it into your <Link to="/settings" className="text-primary hover:underline">Settings</Link> page.</span>
                                    </li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* ── SECTION 3: Identity ── */}
                <section className="space-y-4">
                    <SectionHeader icon={Shield} color="bg-secondary/10 text-secondary" title="2. Set Up Your Pijul Identity" />
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                A Pijul identity is a cryptographic key that signs your patches. Unlike Git's name/email, it can't be spoofed and can be updated retroactively.
                                You need at least one identity before you can record any changes.
                            </p>
                            <CodeBlock>pijul identity new</CodeBlock>

                            <div className="bg-muted/30 border rounded-xl p-4 mt-4">
                                <h4 className="font-semibold text-sm mb-3">Recommended Answers:</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-4 text-sm">
                                    <div><strong className="text-primary">Unique identity name:</strong> <span className="text-muted-foreground">Your username</span></div>
                                    <div><strong className="text-primary">Display name:</strong> <span className="text-muted-foreground">Your full name</span></div>
                                    <div><strong className="text-primary">Email:</strong> <span className="text-muted-foreground">Your account email</span></div>
                                    <div><strong className="text-primary">Change encryption?</strong> <span className="text-muted-foreground"><code className="text-foreground">y</code></span></div>
                                    <div><strong className="text-primary">Key to expire?</strong> <span className="text-muted-foreground"><code className="text-foreground">n</code></span></div>
                                    <div><strong className="text-primary">Link to remote?</strong> <span className="text-muted-foreground"><code className="text-foreground">n</code></span></div>
                                </div>
                            </div>

                            <div className="pt-4 border-t space-y-3">
                                <h4 className="font-semibold text-sm text-foreground">Other identity commands</h4>
                                <CodeBlock>{`pijul identity list             # see all identities
pijul identity edit <name>      # update display name or email
pijul identity prove <remote>   # link identity to a remote account (the Nest, etc.)`}</CodeBlock>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* ── SECTION 4: Core Commands ── */}
                <section className="space-y-4">
                    <SectionHeader icon={Code} color="bg-secondary/10 text-secondary" title="3. Core Commands" />
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-6">

                            {/* Init & Add */}
                            <div>
                                <h4 className="font-semibold mb-1">Start a repository</h4>
                                <p className="text-xs text-muted-foreground mb-2">Creates a <code className="text-primary">.pijul/</code> directory — an empty pristine (recorded state). Then register files to track.</p>
                                <CodeBlock>{`pijul init
pijul init --kind rust          # also sets up .ignore for Rust projects

pijul add src/main.rs Cargo.toml
pijul add -r .                  # recursively add everything`}</CodeBlock>
                            </div>

                            {/* Record */}
                            <div className="pt-4 border-t">
                                <h4 className="font-semibold mb-1">Record a patch</h4>
                                <p className="text-xs text-muted-foreground mb-2">
                                    Diffs the recorded state (pristine) against your working copy, lets you select hunks interactively, then packages the result into a named patch. No staging area — selection happens during record.
                                </p>
                                <CodeBlock>{`pijul record                        # interactive hunk selection
pijul record -m "fix off-by-one"    # skip the message prompt
pijul record src/                   # add + record all files in a directory at once`}</CodeBlock>
                            </div>

                            {/* Diff & Status */}
                            <div className="pt-4 border-t">
                                <h4 className="font-semibold mb-1">Inspect unrecorded changes</h4>
                                <CodeBlock>{`pijul diff                          # full diff of unrecorded edits
pijul diff --short                  # summary only (file names + line counts)
pijul diff --untracked              # also show files not yet added
pijul diff --short --untracked      # combined: quick overview including new files

pijul status                        # show modified / added / deleted files
pijul status -U                     # show only untracked files`}</CodeBlock>
                            </div>

                            {/* Log */}
                            <div className="pt-4 border-t">
                                <h4 className="font-semibold mb-1">Browse history</h4>
                                <CodeBlock>{`pijul log                           # full patch history on current channel
pijul log --hash                    # include patch hashes (needed for unrecord, etc.)
pijul log --limit 10                # last 10 patches only`}</CodeBlock>
                            </div>

                            {/* Clone / Push / Pull */}
                            <div className="pt-4 border-t">
                                <h4 className="font-semibold mb-1">Clone, push & pull</h4>
                                <CodeBlock>{`# Clone
pijul clone ${username}@${displayHost}:/<owner>/<repo> --channel main

# Push to an existing channel (Maintainer only for protected channels)
pijul push ${username}@${displayHost}:/<owner>/<repo>

# Push to a NEW channel (opens a Discussion automatically)
pijul push ${username}@${displayHost}:/<owner>/<repo> --to-channel my-feature

# Pull all new patches from the default remote
pijul pull

# Pull from a specific remote / channel
pijul pull ${username}@${displayHost}:/<owner>/<repo> --from-channel my-feature`}</CodeBlock>
                            </div>

                            {/* Remotes */}
                            <div className="pt-4 border-t">
                                <h4 className="font-semibold mb-1">Named remotes</h4>
                                <p className="text-xs text-muted-foreground mb-2">Save long URLs under a short alias so you don't type them repeatedly.</p>
                                <CodeBlock>{`pijul remote                                        # list saved remotes
pijul remote add origin ${username}@${displayHost}:/<owner>/<repo>
pijul remote delete origin`}</CodeBlock>
                            </div>

                            {/* Reset & Unrecord */}
                            <div className="pt-4 border-t">
                                <h4 className="font-semibold mb-1">Undo things</h4>
                                <p className="text-xs text-muted-foreground mb-2">
                                    <code className="text-primary">unrecord</code> removes a patch from the channel's history (leaving your working copy untouched).
                                    <code className="text-primary ml-2">reset</code> discards working-copy edits to match the pristine.
                                </p>
                                <CodeBlock>{`pijul unrecord                      # interactive: pick which patch to remove
pijul unrecord <HASH>               # remove a specific patch by hash

pijul reset                         # discard ALL unrecorded edits
pijul reset src/main.rs             # reset only one file

# Full rollback: remove last patch AND reset working copy
pijul unrecord && pijul reset`}</CodeBlock>
                            </div>

                        </CardContent>
                    </Card>
                </section>

                {/* ── SECTION 5: Channels ── */}
                <section className="space-y-4">
                    <SectionHeader icon={GitBranch} color="bg-indigo-500/10 text-indigo-500" title="4. Working with Channels" />
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                A channel is just a label pointing to a <em>set of patches</em>. Because independent patches commute, you often need channels far less than you'd need Git branches — you can unrecord and re-record work without disturbing anyone else.
                            </p>
                            <CodeBlock>{`pijul channel                       # list all channels; current one is highlighted
pijul channel new feature-x         # create a new channel (starts as a copy of current)
pijul channel switch feature-x      # switch to it
pijul channel rename feature-x done # rename a channel
pijul channel delete feature-x      # delete it (can't delete the currently active channel)`}</CodeBlock>

                            <div className="pt-2">
                                <h4 className="font-semibold text-sm mb-2 text-foreground">"Merging" a channel</h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                    There is no separate merge command. To bring patches from one channel into another, switch to the destination and pull from the source:
                                </p>
                                <CodeBlock>{`pijul channel switch main
pijul pull . --from-channel feature-x   # pull from a local channel
# or from a remote channel:
pijul pull ${username}@${displayHost}:/<owner>/<repo> --from-channel feature-x`}</CodeBlock>
                                <p className="text-xs text-muted-foreground mt-2 italic">Because the patches are mathematically independent, this never produces spurious conflicts from ordering differences.</p>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* ── SECTION 6: Conflicts ── */}
                <section className="space-y-4">
                    <SectionHeader icon={GitMerge} color="bg-orange-500/10 text-orange-500" title="5. Handling Conflicts" />
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                A conflict in Pijul always happens <em>between two specific patches</em> — not "on a branch". The key difference from Git: Pijul applies both sides of the conflict and keeps working. You don't need to resolve it before recording more patches on top.
                            </p>
                            <p className="text-sm text-muted-foreground">
                                When you do resolve it, the resolution is itself a patch. Once it exists, the conflict can never come back — anyone who pulls the resolution patch is done with it forever.
                            </p>
                            <CodeBlock>{`# After a pull that causes a conflict, Pijul writes markers into the file.
# Edit the file to remove the markers and keep what you want.
# Then record the resolution as a normal patch:
pijul record -m "resolve conflict between X and Y"

# Alternative: abandon one side entirely
pijul unrecord <HASH_OF_CONFLICTING_PATCH>
pijul reset`}</CodeBlock>

                            <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 text-sm text-muted-foreground">
                                <strong className="text-orange-400 block mb-1">Tip:</strong>
                                Run <code className="text-primary font-mono bg-muted/50 px-1 py-0.5 rounded">pijul log --hash</code> first so you have the hashes handy when picking which patch to unrecord.
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* ── SECTION 7: Identity & Keys ── */}
                <section className="space-y-4">
                    <SectionHeader icon={Key} color="bg-purple-500/10 text-purple-500" title="6. Identity & Key Management" />
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Pijul separates two kinds of keys: <strong>identity keys</strong> (sign your authorship of patches) and <strong>SSH keys</strong> (authorise transport to/from the server). You manage them independently.
                            </p>
                            <CodeBlock>{`# Identity management
pijul identity new              # create a new identity (interactive)
pijul identity list             # list all local identities
pijul identity edit <name>      # update display name, email, etc.
pijul identity prove <remote>   # associate this identity with a remote account

# Cryptographic keys (separate from SSH keys)
pijul key generate <name>       # generate a new signing key
pijul key list                  # list all keys`}</CodeBlock>
                            <p className="text-xs text-muted-foreground italic">
                                SSH keys live in <code className="text-primary">~/.ssh/</code> and are only used for the network transport layer — they are not part of Pijul's patch signing.
                            </p>
                        </CardContent>
                    </Card>
                </section>

                {/* ── SECTION 8: Why Pijul ── */}
                <section className="space-y-4">
                    <SectionHeader icon={Zap} color="bg-yellow-500/10 text-yellow-500" title="Why Pijul over Git?" />
                    <Card className="border-border/50">
                        <CardContent className="pt-6">
                            <div className="space-y-4 text-sm text-muted-foreground">
                                <p>Pijul tracks individual changes (patches) rather than full snapshots. This removes several whole categories of pain from collaborative work:</p>
                                <ul className="space-y-4 mt-4">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-foreground">Write-once conflict resolutions.</strong> A resolution is just another patch. Once one teammate pushes it, everyone else just pulls — no one resolves the same conflict twice.
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-foreground">Fewer conflicts overall.</strong> Because Pijul understands which lines each patch touched (not just what the file looked like before and after), it can automatically merge edits that confuse Git's heuristic three-way merge.
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-foreground">No rebase hell.</strong> Independent patches commute — applying them in a different order gives the same result. There's no such thing as "force-push rewritten history breaks everyone's branch".
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-foreground">Effortless cherry-picking.</strong> Pulling a specific fix doesn't drag along the entire branch history. You pull exactly the patches you want; their dependencies come automatically.
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* ── SECTION 9: Troubleshooting ── */}
                <section className="space-y-4">
                    <SectionHeader icon={Info} color="bg-accent/10 text-accent" title="Troubleshooting & Tips" />
                    <Card className="border-border/50">
                        <CardContent className="pt-6 space-y-6">

                            <div>
                                <h4 className="font-semibold text-primary">"Timeout before authentication" or unexpected password prompt</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Pijul hangs, then asks for a system password. Your SSH server timed out waiting for your key passphrase.
                                    Start an SSH agent so the key is provided instantly:
                                </p>
                                <CodeBlock className="my-3">{`eval $(ssh-agent -s)
ssh-add ~/.ssh/id_ed25519`}</CodeBlock>
                                <p className="text-xs text-muted-foreground italic">
                                    Fish shell: use <code className="text-primary not-italic">ssh-agent -c | source</code> instead of eval.
                                </p>
                            </div>

                            <div className="pt-4 border-t">
                                <h4 className="font-semibold text-primary">"Not authenticated" or "Access Denied"</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Your SSH key may be correct, but you still need to be added as a Collaborator to private repositories in the web UI before cloning or pushing.
                                </p>
                            </div>

                            <div className="pt-4 border-t">
                                <h4 className="font-semibold text-primary">"Only Pijul commands are allowed"</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    If you see this when running <code className="text-primary">ssh pijulserv@{displayHost}</code>, your setup is <strong className="text-green-500">working correctly</strong>. The server intentionally blocks plain shell access.
                                </p>
                            </div>

                            <div className="pt-4 border-t">
                                <h4 className="font-semibold text-primary">Push rejected on a protected channel</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    If you're a Developer and try to push directly to <code className="text-primary">main</code>, the server will reject it. Push to a new channel name instead — this opens a Discussion for a Maintainer to review and merge.
                                </p>
                            </div>

                            <div className="pt-4 border-t">
                                <h4 className="font-semibold text-primary">Useful .ignore patterns</h4>
                                <p className="text-sm text-muted-foreground mt-1 mb-2">
                                    Create a <code className="text-primary">.ignore</code> file at the root of your repo (glob syntax, like .gitignore):
                                </p>
                                <CodeBlock>{`target/
*.log
build/
__pycache__/
.env`}</CodeBlock>
                            </div>

                        </CardContent>
                    </Card>
                </section>

            </div>
        </Layout>
    );
};

export default Guide;