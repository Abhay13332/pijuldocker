import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../api';
import { Box, User, Lock, ArrowRight, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';
import { Input } from '../components/ui/input';

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
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-2">
                        <Box className="w-7 h-7" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">PijulServ</h1>
                    <p className="text-muted-foreground">The premium Pijul hosting platform.</p>
                </div>

                <Card className="border-border/50 shadow-xl">
                    <CardHeader className="space-y-1">
                        <CardTitle className="text-2xl font-bold text-center">
                            {isRegister ? 'Create an account' : 'Welcome back'}
                        </CardTitle>
                        <CardDescription className="text-center">
                            {isRegister ? 'Enter your details to register' : 'Enter your credentials to access your projects'}
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-primary px-1">Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="username" 
                                        className="pl-10"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-sm font-semibold text-primary">Password</label>
                                    {!isRegister && (
                                        <Button variant="link" className="px-0 h-auto text-xs text-indigo-400" type="button">
                                            Forgot password?
                                        </Button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        type="password" 
                                        placeholder="••••••••" 
                                        className="pl-10"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                                    <Info className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex flex-col gap-4">
                            <Button className="w-full bg-indigo-600 hover:bg-indigo-700 h-10 group" type="submit">
                                {isRegister ? 'Register' : 'Sign In'}
                                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Button>
                            
                            <div className="text-center text-sm">
                                <span className="text-muted-foreground">
                                    {isRegister ? 'Already have an account?' : 'Don\'t have an account?'}
                                </span>
                                <Button 
                                    variant="link" 
                                    className="px-2 h-auto text-indigo-400" 
                                    type="button"
                                    onClick={() => setIsRegister(!isRegister)}
                                >
                                    {isRegister ? 'Sign in' : 'Create an account'}
                                </Button>
                            </div>
                        </CardFooter>
                    </form>
                </Card>

                <div className="text-center text-[11px] text-muted-foreground">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                </div>
            </div>
        </div>
    );
};

export default Login;
