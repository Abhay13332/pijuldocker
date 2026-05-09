import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api';
import { Zap, User, Lock } from 'lucide-react';

const Login = () => {
    const [isRegister, setIsRegister] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const data = isRegister 
                ? await register(username, password)
                : await login(username, password);
            
            if (data.token) {
                navigate('/');
            } else {
                setError(data.error || 'Authentication failed');
            }
        } catch (err) {
            setError('Connection failed');
        }
    };

    return (
        <div className="container fade-in" style={{ marginTop: '80px', maxWidth: '400px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <Zap size={48} color="#58a6ff" fill="#58a6ff" style={{ marginBottom: '16px' }} />
                <h1 style={{ fontSize: '24px', fontWeight: '700' }}>{isRegister ? 'Create an account' : 'Sign in to PijulServ'}</h1>
            </div>
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Username</label>
                        <div style={{ position: 'relative' }}>
                            <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
                            <input 
                                type="text" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter username"
                                style={{ 
                                    background: '#0d1117', 
                                    border: '1px solid #30363d', 
                                    borderRadius: '6px', 
                                    padding: '8px 12px 8px 36px',
                                    color: '#c9d1d9',
                                    width: '100%'
                                }} 
                            />
                        </div>
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                style={{ 
                                    background: '#0d1117', 
                                    border: '1px solid #30363d', 
                                    borderRadius: '6px', 
                                    padding: '8px 12px 8px 36px',
                                    color: '#c9d1d9',
                                    width: '100%'
                                }} 
                            />
                        </div>
                    </div>
                    {error && <p style={{ color: '#da3633', marginBottom: '16px', fontSize: '14px' }}>{error}</p>}
                    <button type="submit" className="btn-primary" style={{ width: '100%', padding: '10px' }}>
                        {isRegister ? 'Register' : 'Sign in'}
                    </button>
                </form>
            </div>
            <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: '#8b949e' }}>
                {isRegister ? 'Already have an account?' : 'New to PijulServ?'} {' '}
                <button 
                    onClick={() => setIsRegister(!isRegister)} 
                    style={{ background: 'none', color: '#58a6ff', padding: 0, fontWeight: '400' }}
                >
                    {isRegister ? 'Sign in' : 'Create an account'}
                </button>
            </p>
        </div>
    );
};

export default Login;
