import React from 'react';
import { Terminal, Key, Book, Rocket, Code, Shield, Info, CheckCircle } from 'lucide-react';

const Guide = () => {
    const hostname = window.location.hostname;

    return (
        <div className="container fade-in" style={{ marginTop: '40px', maxWidth: '800px', paddingBottom: '60px' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                <Rocket size={48} color="#58a6ff" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '12px' }}>Getting Started with PijulServ</h1>
                <p style={{ color: '#8b949e', fontSize: '18px' }}>Start collaborating on Pijul repositories in minutes.</p>
            </div>

            <section style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(247, 129, 102, 0.1)', padding: '8px', borderRadius: '8px' }}>
                        <Key size={24} color="#f78166" />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '600' }}>1. Add your SSH Key</h2>
                </div>
                <div className="card">
                    <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(88, 166, 255, 0.1)', borderRadius: '8px', border: '1px solid rgba(88, 166, 255, 0.2)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#58a6ff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Rocket size={18} />
                            Automated Client Setup (Recommended)
                        </h3>
                        <p style={{ color: '#c9d1d9', fontSize: '14px', marginBottom: '12px' }}>
                            Run this command in your terminal to automatically generate an SSH key, configure your connection to the server, and set up your Pijul identity in one go:
                        </p>
                        <div style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', border: '1px solid #30363d', userSelect: 'all' }}>
                            <code style={{ color: '#c9d1d9' }}>bash -c "$(curl -fsSL http://{hostname}:3001/setup.sh)"</code>
                        </div>
                    </div>

                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#c9d1d9', marginBottom: '12px' }}>Manual Key Setup</h3>
                    <p style={{ marginBottom: '16px', color: '#8b949e', fontSize: '14px' }}>If you prefer to configure things manually, simply add your public SSH key to your account. For the easiest, zero-setup experience, we recommend using a key without a passphrase.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
                            <CheckCircle size={16} color="#3fb950" style={{ marginTop: '4px' }} />
                            <span style={{ fontSize: '14px', color: '#8b949e' }}>Generate a key (leave password blank when asked):<br/><code style={{ color: '#c9d1d9', marginTop: '8px', display: 'inline-block' }}>ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519</code></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
                            <CheckCircle size={16} color="#3fb950" style={{ marginTop: '4px' }} />
                            <span style={{ fontSize: '14px', color: '#8b949e' }}>Copy the key content from <code style={{ color: '#c9d1d9' }}>~/.ssh/id_ed25519.pub</code></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'start', gap: '10px' }}>
                            <CheckCircle size={16} color="#3fb950" style={{ marginTop: '4px' }} />
                            <span style={{ fontSize: '14px', color: '#8b949e' }}>Paste it into your <a href="/settings" style={{ color: '#58a6ff' }}>Settings</a> page.</span>
                        </div>
                    </div>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(210, 153, 34, 0.1)', padding: '8px', borderRadius: '8px' }}>
                        <Shield size={24} color="#d29922" />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '600' }}>2. Setup Pijul Identity</h2>
                </div>
                <div className="card">
                    <p style={{ marginBottom: '16px', color: '#c9d1d9' }}>Run the following command to create your global identity. This is used to sign your patches.</p>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '6px', border: '1px solid #30363d', marginBottom: '20px' }}>
                        <code style={{ color: '#c9d1d9' }}>pijul identity new</code>
                    </div>
                    
                    <h4 style={{ fontWeight: '600', marginBottom: '12px', fontSize: '14px', color: '#8b949e' }}>Recommended Answers:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                            <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong style={{ color: '#58a6ff' }}>Unique identity name:</strong> <span style={{ color: '#c9d1d9' }}>Your username (e.g. anshuman)</span></div>
                            <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong style={{ color: '#58a6ff' }}>Display name:</strong> <span style={{ color: '#c9d1d9' }}>Your full name</span></div>
                            <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong style={{ color: '#58a6ff' }}>Email:</strong> <span style={{ color: '#c9d1d9' }}>Your account email</span></div>
                            <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong style={{ color: '#58a6ff' }}>Change encryption?</strong> <span style={{ color: '#c9d1d9' }}>Enter <code style={{ color: '#f78166' }}>y</code> (recommended)</span></div>
                            <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong style={{ color: '#58a6ff' }}>Key to expire?</strong> <span style={{ color: '#c9d1d9' }}>Enter <code style={{ color: '#f78166' }}>n</code> (recommended)</span></div>
                            <div style={{ fontSize: '14px', marginBottom: '4px' }}><strong style={{ color: '#58a6ff' }}>Link to remote?</strong> <span style={{ color: '#c9d1d9' }}>Enter <code style={{ color: '#f78166' }}>n</code> (recommended)</span></div>
                            <div style={{ fontSize: '14px' }}><strong style={{ color: '#58a6ff' }}>Passphrase:</strong> <span style={{ color: '#c9d1d9' }}>Choose a secure password for your identity</span></div>
                        </div>
                    </div>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(63, 185, 80, 0.1)', padding: '8px', borderRadius: '8px' }}>
                        <Code size={24} color="#3fb950" />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '600' }}>3. Basic Commands</h2>
                </div>
                <div className="card">
                    <h4 style={{ fontWeight: '600', marginBottom: '12px', fontSize: '14px' }}>Clone a repository</h4>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '6px', border: '1px solid #30363d', marginBottom: '24px' }}>
                        <code style={{ color: '#c9d1d9' }}>pijul clone abhay@{hostname}:/repo-name</code>
                    </div>

                    <h4 style={{ fontWeight: '600', marginBottom: '12px', fontSize: '14px' }}>Record and Push changes</h4>
                    <div style={{ background: '#0d1117', padding: '16px', borderRadius: '6px', border: '1px solid #30363d' }}>
                        <code style={{ color: '#c9d1d9' }}>
                            pijul add .<br/>
                            pijul record -m "Initial patch"<br/>
                            pijul push abhay@{hostname}:/repo-name
                        </code>
                    </div>
                </div>
            </section>

            <section style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(88, 166, 255, 0.1)', padding: '8px', borderRadius: '8px' }}>
                        <Info size={24} color="#58a6ff" />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '600' }}>4. Troubleshooting & Tips</h2>
                </div>
                <div className="card">
                    <h4 style={{ fontWeight: '600', marginBottom: '12px', fontSize: '14px', color: '#c9d1d9' }}>"Timeout before authentication" or Password Prompt</h4>
                    <p style={{ marginBottom: '16px', color: '#8b949e', fontSize: '14px' }}>
                        If Pijul hangs and then asks for a system password, your SSH server has timed out while waiting for your SSH key passphrase.
                        <br/><br/>
                        <strong style={{ color: '#58a6ff' }}>Fix:</strong> Use an SSH Agent so your key is provided instantly without a prompt:
                    </p>
                    <div style={{ background: '#0d1117', padding: '12px', borderRadius: '6px', border: '1px solid #30363d', margin: '8px 0 16px 0', fontSize: '14px' }}>
                        <code style={{ color: '#c9d1d9' }}>eval $(ssh-agent -s)<br/>ssh-add ~/.ssh/id_ed25519</code>
                    </div>
                    <p style={{ marginBottom: '24px', color: '#8b949e', fontSize: '14px' }}>
                        <em>For Fish shell, use: <code style={{ color: '#c9d1d9' }}>ssh-agent -c | source</code> instead of eval.</em>
                    </p>

                    <h4 style={{ fontWeight: '600', marginBottom: '12px', fontSize: '14px', color: '#c9d1d9' }}>"Not authenticated" or "Access Denied"</h4>
                    <p style={{ marginBottom: '24px', color: '#8b949e', fontSize: '14px' }}>
                        Even if your SSH key is correct, you must be added as a <strong style={{ color: '#c9d1d9' }}>Collaborator</strong> to private repositories in the Web UI before you can clone or push to them.
                    </p>

                    <h4 style={{ fontWeight: '600', marginBottom: '12px', fontSize: '14px', color: '#c9d1d9' }}>"Only Pijul commands are allowed"</h4>
                    <p style={{ color: '#8b949e', fontSize: '14px' }}>
                        If you see this when running <code style={{ color: '#c9d1d9' }}>ssh abhay@{hostname}</code>, it means your setup is <strong style={{ color: '#3fb950' }}>working perfectly!</strong> The server is correctly blocking standard shell access for security.
                    </p>
                </div>
            </section>
        </div>
    );
};

export default Guide;
