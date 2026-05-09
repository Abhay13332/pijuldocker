import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRepo } from '../api';
import { Book, Plus, Lock, Globe } from 'lucide-react';

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
            await createRepo(name, isPrivate);
            navigate(`/repo/${name}`);
        } catch (err) {
            setError(err.toString());
            setLoading(false);
        }
    };

    return (
        <div className="container fade-in" style={{ marginTop: '40px', maxWidth: '600px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px' }}>Create a new repository</h2>
            <p style={{ color: '#8b949e', marginBottom: '24px' }}>
                A repository contains all project files, including the patch history.
            </p>
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Repository name</label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="my-awesome-project"
                            style={{ 
                                background: '#0d1117', 
                                border: '1px solid #30363d', 
                                borderRadius: '6px', 
                                padding: '8px 12px',
                                color: '#c9d1d9',
                                width: '100%',
                                fontSize: '16px'
                            }} 
                        />
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '16px' }}>Visibility</label>
                        <div 
                            className={`card ${!isPrivate ? 'glass' : ''}`} 
                            onClick={() => setIsPrivate(false)}
                            style={{ cursor: 'pointer', display: 'flex', gap: '16px', marginBottom: '12px', borderColor: !isPrivate ? '#58a6ff' : '#30363d' }}
                        >
                            <div style={{ marginTop: '4px' }}>
                                <input type="radio" checked={!isPrivate} readOnly />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px' }}>
                                    <Globe size={16} /> Public
                                </div>
                                <p style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>Anyone on the internet can see this repository.</p>
                            </div>
                        </div>
                        <div 
                            className={`card ${isPrivate ? 'glass' : ''}`} 
                            onClick={() => setIsPrivate(true)}
                            style={{ cursor: 'pointer', display: 'flex', gap: '16px', borderColor: isPrivate ? '#58a6ff' : '#30363d' }}
                        >
                            <div style={{ marginTop: '4px' }}>
                                <input type="radio" checked={isPrivate} readOnly />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '14px' }}>
                                    <Lock size={16} /> Private
                                </div>
                                <p style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>Only you can see this repository.</p>
                            </div>
                        </div>
                    </div>

                    {error && <p style={{ color: '#da3633', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}
                    <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={loading || !name}
                        style={{ width: '100%', padding: '10px' }}
                    >
                        {loading ? 'Creating...' : 'Create repository'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewRepo;
