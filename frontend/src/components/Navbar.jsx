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
        <nav className="glass border-b py-3">
            <div className="container flex justify-between items-center">
                <div className="flex items-center gap-6">
                    <Link to="/" className="text-xl font-extrabold text-foreground no-underline flex items-center gap-2">
                        <div className="bg-primary w-6 h-6 rounded"></div>
                        PijulServ
                    </Link>
                    
                    <div className="flex items-center bg-background border border-border rounded-md px-3 py-1 w-70">
                        <Search size={16} className="text-muted-foreground" />
                        <input 
                            type="text" 
                            placeholder="Search or jump to..." 
                            className="bg-transparent border-none text-foreground px-2 py-1 w-full text-sm focus:outline-none"
                        />
                    </div>

                    <Link to="/guide" className="text-muted-foreground no-underline text-sm font-medium flex items-center gap-1 hover:text-foreground transition-colors">
                        <BookOpen size={16} /> Guide
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    {username ? (
                        <>
                            <Link to="/new" className="btn-primary flex items-center gap-1.5 px-3 py-1 text-sm">
                                <Plus size={16} /> New
                            </Link>
                            <Link to="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
                                <Settings size={20} />
                            </Link>
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md">
                                <div className="w-6 h-6 bg-border rounded-full flex items-center justify-center pl-1">
                                    <UserAvatar name={username} />
                                </div>
                                <span className="text-sm font-semibold text-foreground">{username}</span>
                                <button onClick={handleLogout} className="bg-transparent border-none p-0 text-muted-foreground cursor-pointer flex hover:text-foreground transition-colors">
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <Link to="/login" className="text-foreground no-underline text-sm font-semibold hover:text-primary transition-colors">Sign in</Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

const UserAvatar = ({ name }) => {
    return <span className="text-2xs text-foreground">{name.slice(0, 2).toUpperCase()}</span>;
};

export default Navbar;
