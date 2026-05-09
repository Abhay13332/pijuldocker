import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout } from '../api';
import { Plus, Settings, LogOut, Search, BookOpen } from 'lucide-react';

const Navbar = () => {
    const navigate = useNavigate();
    const username = localStorage.getItem('username');

    const handleLogout = () => {
        logout();
        navigate('/login');
        window.location.reload();
    };

    return (
        <nav className="glass" style={{ borderBottom: '1px solid #30363d', padding: '12px 0' }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <Link to="/" style={{ fontSize: '20px', fontWeight: '800', color: '#f0f6fc', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ background: '#f78166', width: '24px', height: '24px', borderRadius: '4px' }}></div>
                        PijulServ
                    </Link>
                    
                    <div style={{ display: 'flex', alignItems: 'center', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '4px 12px', width: '280px' }}>
                        <Search size={16} color="#8b949e" />
                        <input 
                            type="text" 
                            placeholder="Search or jump to..." 
                            style={{ background: 'none', border: 'none', color: '#c9d1d9', padding: '4px 8px', width: '100%', fontSize: '14px' }}
                        />
                    </div>

                    <Link to="/guide" style={{ color: '#8b949e', textDecoration: 'none', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <BookOpen size={16} /> Guide
                    </Link>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {username ? (
                        <>
                            <Link to="/new" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', fontSize: '14px' }}>
                                <Plus size={16} /> New
                            </Link>
                            <Link to="/settings" style={{ color: '#8b949e' }}>
                                <Settings size={20} />
                            </Link>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderRadius: '6px' }}>
                                <div style={{ width: '24px', height: '24px', background: '#30363d', borderRadius: '50%', display: 'flex', alignItems: 'center', justifySelf: 'center', paddingLeft: '4px' }}>
                                    <UserAvatar name={username} />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#c9d1d9' }}>{username}</span>
                                <button onClick={handleLogout} style={{ background: 'none', border: 'none', padding: 0, color: '#8b949e', cursor: 'pointer', display: 'flex' }}>
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <Link to="/login" style={{ color: '#c9d1d9', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>Sign in</Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

const UserAvatar = ({ name }) => {
    return <span style={{ fontSize: '10px', color: '#c9d1d9' }}>{name.slice(0, 2).toUpperCase()}</span>;
};

export default Navbar;
