import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRepos } from '../api';
import { Book, Lock, Globe, User, GitBranch, Compass, Plus } from 'lucide-react';

const RepoCard = ({ repo }) => (
    <div className="card" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        transition: 'border-color 0.2s',
    }}
        onMouseEnter={e => e.currentTarget.style.borderColor = '#58a6ff'}
        onMouseLeave={e => e.currentTarget.style.borderColor = '#30363d'}
    >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <Book size={20} color="#58a6ff" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <Link
                        to={`/repo/${repo.name}`}
                        style={{ fontSize: '16px', fontWeight: '600', color: '#58a6ff' }}
                    >
                        {repo.name}
                    </Link>
                    <span
                        className="badge"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: repo.isPrivate ? 'rgba(139,92,246,0.15)' : 'rgba(35,134,54,0.15)',
                            color: repo.isPrivate ? '#a78bfa' : '#3fb950',
                            border: `1px solid ${repo.isPrivate ? 'rgba(139,92,246,0.3)' : 'rgba(35,134,54,0.3)'}`,
                        }}
                    >
                        {repo.isPrivate ? <Lock size={11} /> : <Globe size={11} />}
                        {repo.isPrivate ? 'Private' : 'Public'}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8b949e' }}>
                    <User size={12} />
                    <span>{repo.owner}</span>
                    {repo.createdAt && (
                        <>
                            <span>·</span>
                            <span>Created {new Date(repo.createdAt).toLocaleDateString()}</span>
                        </>
                    )}
                </div>
                {repo.collaborators?.length > 0 && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#6e7681' }}>
                        {repo.collaborators.length} collaborator{repo.collaborators.length !== 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </div>
    </div>
);

const SectionHeader = ({ icon: Icon, title, count }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #21262d' }}>
        <Icon size={20} color="#8b949e" />
        <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{title}</h2>
        <span style={{
            fontSize: '12px', fontWeight: '600',
            background: '#21262d', color: '#8b949e',
            padding: '1px 8px', borderRadius: '20px',
            border: '1px solid #30363d'
        }}>
            {count}
        </span>
    </div>
);

const Dashboard = () => {
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(true);
    const currentUsername = localStorage.getItem('username');

    useEffect(() => {
        fetchRepos().then(data => {
            setRepos(Array.isArray(data) ? data : []);
            setLoading(false);
        });
    }, []);

    if (loading) return (
        <div className="container" style={{ marginTop: '60px', textAlign: 'center', color: '#8b949e' }}>
            <GitBranch size={32} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p>Loading repositories…</p>
        </div>
    );

    const myRepos = repos.filter(r => r.owner === currentUsername);
    const publicRepos = repos.filter(r => !r.isPrivate && r.owner !== currentUsername);

    const EmptyState = ({ message }) => (
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <p style={{ color: '#8b949e', fontSize: '14px', margin: 0 }}>{message}</p>
        </div>
    );

    return (
        <div className="container fade-in" style={{ marginTop: '40px', maxWidth: '900px' }}>
            {/* Page header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                        {currentUsername ? `Welcome back, ${currentUsername}` : 'Repositories'}
                    </h1>
                    <p style={{ color: '#8b949e', fontSize: '14px', margin: 0 }}>
                        Manage your Pijul repositories
                    </p>
                </div>
                <Link
                    to="/new"
                    className="btn-primary"
                    id="new-repo-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '14px', fontWeight: '600' }}
                >
                    <Plus size={16} /> New Repository
                </Link>
            </div>

            {/* My Repositories */}
            <div style={{ marginBottom: '48px' }}>
                <SectionHeader icon={GitBranch} title="My Repositories" count={myRepos.length} />
                {myRepos.length === 0 ? (
                    <EmptyState message="You haven't created any repositories yet. Click 'New Repository' to get started!" />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {myRepos.map(repo => <RepoCard key={repo.name} repo={repo} />)}
                    </div>
                )}
            </div>

            {/* Explore Public Repositories */}
            <div>
                <SectionHeader icon={Compass} title="Explore Public Repositories" count={publicRepos.length} />
                {publicRepos.length === 0 ? (
                    <EmptyState message="No other public repositories available yet." />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {publicRepos.map(repo => <RepoCard key={repo.name} repo={repo} />)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
