import React, { useEffect, useState } from 'react';
import { fetchProfile, addSshKey, deleteSshKey } from '../api';
import { Key, Plus, Trash2, Shield, Info, Terminal, Settings as SettingsIcon } from 'lucide-react';

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
        if (!newKeyValue) {
            alert("Please enter an SSH key.");
            return;
        }
        
        let title = newKeyName.trim();
        if (!title) {
            // Try to extract comment from key (e.g. ssh-rsa AAA... user@host)
            const parts = newKeyValue.trim().split(' ');
            if (parts.length >= 3) {
                title = parts.slice(2).join(' ');
            } else {
                title = 'My SSH Key';
            }
        }

        try {
            await addSshKey(title, newKeyValue.trim());
            setNewKeyName('');
            setNewKeyValue('');
            await loadProfile();
        } catch (err) {
            console.error("Failed to add key:", err);
            alert("Failed to add key. Please check the console.");
        }
    };

    const handleDeleteKey = async (id) => {
        try {
            await deleteSshKey(id);
            await loadProfile();
        } catch (err) {
            console.error("Failed to delete key:", err);
            alert("Failed to delete key. Please check the console.");
        }
    };

    return (
        <div className="container fade-in" style={{ marginTop: '40px', maxWidth: '900px' }}>
            <div style={{ display: 'flex', gap: '40px' }}>
                <div style={{ width: '250px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <SettingsIcon size={24} />
                        <h2 style={{ fontSize: '20px', fontWeight: '600' }}>User Settings</h2>
                    </div>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <button className="glass" style={{ textAlign: 'left', padding: '8px 16px', color: '#c9d1d9', border: 'none', background: 'rgba(56, 139, 253, 0.1)' }}>
                            SSH Keys
                        </button>
                        <button style={{ textAlign: 'left', padding: '8px 16px', color: '#8b949e', background: 'none' }}>
                            Account
                        </button>
                    </nav>
                </div>

                <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Key size={20} /> SSH Keys
                    </h3>
                    <p style={{ color: '#8b949e', fontSize: '14px', marginBottom: '24px' }}>
                        SSH keys allow you to securely clone and push to repositories without entering your password every time.
                    </p>

                    <div className="card" style={{ marginBottom: '32px' }}>
                        <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '14px' }}>Add SSH Key</h4>
                        <form onSubmit={handleAddKey}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Title</label>
                                <input 
                                    type="text" 
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    placeholder="e.g. My Laptop"
                                    style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px', color: '#c9d1d9' }}
                                />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Key</label>
                                <textarea 
                                    value={newKeyValue}
                                    onChange={(e) => setNewKeyValue(e.target.value)}
                                    placeholder="Begins with 'ssh-rsa', 'ssh-ed25519', etc."
                                    style={{ width: '100%', height: '100px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px', color: '#c9d1d9', fontFamily: 'monospace', fontSize: '12px' }}
                                />
                            </div>
                            <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }}>
                                <Plus size={16} /> Add SSH Key
                            </button>
                        </form>
                    </div>

                    <div style={{ marginBottom: '40px' }}>
                        <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '14px' }}>Your Keys</h4>
                        {keys.length === 0 ? (
                            <div className="card" style={{ textAlign: 'center', color: '#8b949e', padding: '24px' }}>
                                You haven't added any SSH keys yet.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {keys.map(key => (
                                    <div key={key.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ background: '#30363d', padding: '8px', borderRadius: '50%' }}>
                                                <Key size={16} color="#8b949e" />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '14px' }}>{key.name}</div>
                                                <div style={{ fontSize: '12px', color: '#8b949e', fontFamily: 'monospace', marginTop: '2px' }}>
                                                    {key.key.slice(0, 30)}...
                                                </div>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteKey(key.id)} style={{ background: 'none', color: '#da3633', padding: '8px' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ background: 'rgba(63, 185, 80, 0.05)', borderColor: 'rgba(63, 185, 80, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3fb950', marginBottom: '12px', fontWeight: '600' }}>
                            <Shield size={18} />
                            <span>Dynamic SSH Authentication Enabled</span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#8b949e', lineHeight: '1.6', marginBottom: '12px' }}>
                            Your SSH keys are managed dynamically by PijulServ. When you add a key here, it becomes active immediately for all your repositories.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#8b949e' }}>
                            <Info size={14} color="#58a6ff" />
                            <span>Administrators: Ensure <code style={{ color: '#c9d1d9' }}>scripts/setup-ssh.sh</code> has been run on the server.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
