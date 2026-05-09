import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchRepoLog, fetchRepoTree, fetchFileContent, fetchPatchDetail, fetchRepos, addCollaborator, removeCollaborator, deleteRepo } from '../api';
import { File, Folder, Clock, Code, User, ArrowLeft, Box, Terminal, Lock, Globe, Users, Trash2, Shield, AlertTriangle, Settings } from 'lucide-react';

const RepoDetail = () => {
    const { name } = useParams();
    const navigate = useNavigate();
    const [tab, setTab] = useState('files');
    const [repoMeta, setRepoMeta] = useState(null);
    const [tree, setTree] = useState([]);
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [path, setPath] = useState('');
    const [fileContent, setFileContent] = useState(null);
    const [patchDetail, setPatchDetail] = useState(null);
    const [newCollab, setNewCollab] = useState('');
    const [newRole, setNewRole] = useState('developer');
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const currentUsername = localStorage.getItem('username');

    useEffect(() => {
        loadRepoMeta();
    }, [name]);

    const loadRepoMeta = async () => {
        const data = await fetchRepos();
        const meta = Array.isArray(data) ? data.find(r => r.name === name) : null;
        setRepoMeta(meta);
    };

    useEffect(() => {
        if (tab === 'patch-detail' || tab === 'settings') return;
        setLoading(true);
        if (tab === 'files') {
            if (path && !path.endsWith('/')) {
                fetchFileContent(name, path).then(content => {
                    setFileContent(content);
                    setLoading(false);
                });
            } else {
                fetchRepoTree(name, path).then(data => {
                    const filteredData = Array.isArray(data) ? data.filter(item => item !== "No tracked files") : [];
                    setTree(filteredData);
                    setFileContent(null);
                    setLoading(false);
                });
            }
        } else {
            fetchRepoLog(name).then(data => {
                setLog(Array.isArray(data) ? data : []);
                setLoading(false);
            });
        }
    }, [name, tab, path]);

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

    const handleAddCollab = async (e) => {
        e.preventDefault();
        if (!newCollab) return;
        try {
            const collaborators = await addCollaborator(name, newCollab, newRole);
            setRepoMeta({ ...repoMeta, collaborators });
            setNewCollab('');
        } catch (err) {
            alert(err.toString());
        }
    };

    const handleRemoveCollab = async (username) => {
        const collaborators = await removeCollaborator(name, username);
        setRepoMeta({ ...repoMeta, collaborators });
    };

    const handleDeleteRepo = async () => {
        if (deleteConfirm !== name) return;
        setDeleteLoading(true);
        try {
            await deleteRepo(name);
            navigate('/');
        } catch (err) {
            alert('Failed to delete repository: ' + err.toString());
            setDeleteLoading(false);
        }
    };

    const userRole = repoMeta?.owner === currentUsername ? 'owner' :
                     repoMeta?.collaborators?.find(c => c.username === currentUsername)?.role || 'viewer';

    const canManage = ['owner', 'maintainer'].includes(userRole);

    return (
        <div className="container fade-in" style={{ marginTop: '24px' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', marginBottom: '8px' }}>
                        <Folder size={24} color="#58a6ff" />
                        <Link to="/" style={{ color: '#58a6ff' }}>root</Link>
                        <span style={{ color: '#8b949e' }}>/</span>
                        <span style={{ fontWeight: '600' }}>{name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: repoMeta?.isPrivate ? '#30363d' : '#238636', color: 'white' }}>
                            {repoMeta?.isPrivate ? <Lock size={12} /> : <Globe size={12} />}
                            {repoMeta?.isPrivate ? 'Private' : 'Public'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#8b949e' }}>
                            Owned by <span style={{ color: '#c9d1d9' }}>{repoMeta?.owner || 'unknown'}</span>
                        </span>
                    </div>
                </div>
                <div className="glass" style={{ padding: '8px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ fontSize: '12px', color: '#8b949e' }}>pijul clone {window.location.hostname}:/{name}</code>
                    <button 
                        onClick={() => navigator.clipboard.writeText(`pijul clone ${window.location.hostname}:/${name}`)}
                        style={{ background: '#30363d', padding: '4px 8px', fontSize: '10px', color: '#c9d1d9' }}
                    >
                        Copy
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px', borderBottom: '1px solid #30363d', marginBottom: '16px' }}>
                <button 
                    onClick={() => { setTab('files'); setPath(''); setPatchDetail(null); }}
                    style={{ 
                        background: 'none', 
                        padding: '8px 16px', 
                        color: tab === 'files' ? '#c9d1d9' : '#8b949e',
                        borderBottom: tab === 'files' ? '2px solid #f78166' : 'none',
                        borderRadius: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Code size={16} /> Code
                </button>
                <button 
                    onClick={() => { setTab('patches'); setPatchDetail(null); }}
                    style={{ 
                        background: 'none', 
                        padding: '8px 16px', 
                        color: (tab === 'patches' || tab === 'patch-detail') ? '#c9d1d9' : '#8b949e',
                        borderBottom: (tab === 'patches' || tab === 'patch-detail') ? '2px solid #f78166' : 'none',
                        borderRadius: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Clock size={16} /> Patches
                </button>
                {canManage && (
                    <button
                        onClick={() => setTab('settings')}
                        style={{
                            background: 'none',
                            padding: '8px 16px',
                            color: tab === 'settings' ? '#c9d1d9' : '#8b949e',
                            borderBottom: tab === 'settings' ? '2px solid #f78166' : 'none',
                            borderRadius: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <Settings size={16} /> Settings
                    </button>
                )}
            </div>

            {loading && tab !== 'settings' ? (
                <div>Loading...</div>
            ) : tab === 'files' ? (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {path && (
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d', background: '#161b22' }}>
                            <button onClick={() => setPath('')} style={{ background: 'none', color: '#58a6ff', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <ArrowLeft size={14} /> Back
                            </button>
                        </div>
                    )}
                    {fileContent !== null ? (
                        <pre style={{ padding: '16px', margin: 0, overflowX: 'auto', fontSize: '14px', lineHeight: '1.5' }}>
                            <code>{fileContent}</code>
                        </pre>
                    ) : tree.length === 0 ? (
                        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                            <Box size={48} color="#30363d" style={{ marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>This repository is empty</h3>
                            <p style={{ color: '#8b949e', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
                                Get started by adding files and recording your first patch.
                            </p>
                            <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '16px', textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#58a6ff', marginBottom: '12px', fontSize: '14px' }}>
                                    <Terminal size={16} />
                                    <span>Quick Setup</span>
                                </div>
                                <code style={{ fontSize: '13px', lineHeight: '1.6', color: '#c9d1d9' }}>
                                    pijul add README.md<br/>
                                    pijul record -m "Initial patch"
                                </code>
                            </div>
                        </div>
                    ) : (
                        <div>
                            {tree.map(item => (
                                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #30363d' }}>
                                    <File size={16} color="#8b949e" />
                                    <button 
                                        onClick={() => setPath(item)}
                                        style={{ background: 'none', padding: 0, color: '#c9d1d9', textAlign: 'left' }}
                                    >
                                        {item}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : tab === 'patch-detail' ? (
                <div>
                    <button 
                        onClick={() => setTab('patches')}
                        style={{ background: 'none', color: '#58a6ff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <ArrowLeft size={16} /> Back to patches
                    </button>
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #30363d', background: '#161b22', fontWeight: '600' }}>
                            Patch Details
                        </div>
                        <pre style={{ padding: '16px', margin: 0, overflowX: 'auto', fontSize: '13px', lineHeight: '1.4', background: '#0d1117' }}>
                            <code>{patchDetail}</code>
                        </pre>
                    </div>
                </div>
            ) : tab === 'settings' ? (
                <div className="fade-in">
                    {/* Collaborators section */}
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={18} /> Collaborators
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
                        <div>
                            <p style={{ color: '#8b949e', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
                                Control who has access to this repository and what they can do.
                            </p>
                            <div className="card">
                                <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '14px' }}>Add collaborator</h4>
                                <form onSubmit={handleAddCollab}>
                                    <div style={{ marginBottom: '12px' }}>
                                        <input
                                            type="text"
                                            value={newCollab}
                                            onChange={(e) => setNewCollab(e.target.value)}
                                            placeholder="Enter username"
                                            style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px', color: '#c9d1d9', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <select
                                            value={newRole}
                                            onChange={(e) => setNewRole(e.target.value)}
                                            style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '8px', color: '#c9d1d9', boxSizing: 'border-box' }}
                                        >
                                            <option value="developer">Developer (Read/Write)</option>
                                            <option value="maintainer">Maintainer (Manage/Write)</option>
                                            <option value="viewer">Viewer (Read-only)</option>
                                        </select>
                                    </div>
                                    <button type="submit" className="btn-primary" style={{ width: '100%', padding: '8px' }}>Add Collaborator</button>
                                </form>
                            </div>
                        </div>
                        <div className="card">
                            <h4 style={{ fontWeight: '600', marginBottom: '16px', fontSize: '14px' }}>Current Collaborators</h4>
                            {(!repoMeta?.collaborators || repoMeta.collaborators.length === 0) ? (
                                <p style={{ fontSize: '14px', color: '#8b949e' }}>No collaborators added yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {repoMeta.collaborators.map(c => (
                                        <div key={c.username} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <User size={16} color="#8b949e" />
                                                <div>
                                                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{c.username}</div>
                                                    <div style={{ fontSize: '11px', color: '#8b949e', textTransform: 'capitalize' }}>{c.role}</div>
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveCollab(c.username)} style={{ background: 'none', color: '#da3633', padding: '4px' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Danger Zone — owner only */}
                    {userRole === 'owner' && (
                        <div style={{ border: '1px solid rgba(218,54,51,0.4)', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ background: 'rgba(218,54,51,0.08)', padding: '12px 20px', borderBottom: '1px solid rgba(218,54,51,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertTriangle size={16} color="#f85149" />
                                <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#f85149', margin: 0 }}>Danger Zone</h4>
                            </div>
                            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: '600', marginBottom: '4px', fontSize: '14px' }}>Delete this repository</p>
                                    <p style={{ fontSize: '13px', color: '#8b949e', margin: 0 }}>
                                        Once deleted, all data and history will be permanently removed. This action <strong style={{ color: '#c9d1d9' }}>cannot</strong> be undone.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
                                    <input
                                        id="delete-confirm-input"
                                        type="text"
                                        value={deleteConfirm}
                                        onChange={(e) => setDeleteConfirm(e.target.value)}
                                        placeholder={`Type "${name}" to confirm`}
                                        style={{
                                            background: '#0d1117',
                                            border: `1px solid ${deleteConfirm === name ? '#da3633' : '#30363d'}`,
                                            borderRadius: '6px', padding: '8px 10px',
                                            color: '#c9d1d9', fontSize: '13px', width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <button
                                        id="delete-repo-btn"
                                        onClick={handleDeleteRepo}
                                        disabled={deleteConfirm !== name || deleteLoading}
                                        style={{
                                            background: deleteConfirm === name ? '#da3633' : '#21262d',
                                            color: deleteConfirm === name ? 'white' : '#6e7681',
                                            border: '1px solid rgba(218,54,51,0.5)',
                                            borderRadius: '6px', padding: '8px 12px',
                                            cursor: deleteConfirm === name ? 'pointer' : 'not-allowed',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            fontWeight: '600', fontSize: '13px',
                                            transition: 'background 0.2s'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                        {deleteLoading ? 'Deleting…' : 'Delete Repository'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {log.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <Clock size={48} color="#30363d" style={{ marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px' }}>No patches yet</h3>
                            <p style={{ color: '#8b949e' }}>Patches represent changes made to this repository.</p>
                        </div>
                    ) : log.map(patch => (
                        <div 
                            key={patch.hash} 
                            className="card" 
                            style={{ display: 'flex', gap: '16px', cursor: 'pointer' }}
                            onClick={() => showPatch(patch.hash)}
                        >
                            <div style={{ flex: 1 }}>
                                <h4 style={{ fontWeight: '600', marginBottom: '4px' }}>{patch.message}</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#8b949e' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <User size={12} /> {patch.author}
                                    </div>
                                    <span>{patch.date}</span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <code style={{ fontSize: '12px', background: 'rgba(56, 139, 253, 0.1)', color: '#58a6ff', padding: '2px 6px', borderRadius: '4px' }}>
                                    {patch.hash.slice(0, 8)}
                                </code>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RepoDetail;
