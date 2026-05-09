import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RepoDetail from './pages/RepoDetail';
import NewRepo from './pages/NewRepo';
import Login from './pages/Login';
import Settings from './pages/Settings';
import Guide from './pages/Guide';

const ProtectedRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem('token');
    return isAuthenticated ? children : <Navigate to="/login" />;
};

const App = () => {
    return (
        <div className='dark bg-background text-foreground min-h-screen'>
        <Router >
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/repos/:name" element={<RepoDetail />} />
                <Route path="/repos/:name/:tab" element={<RepoDetail />} />
                <Route path="/repo/:name" element={<Navigate to="/repos/:name" replace />} />
                <Route path="/new" element={<ProtectedRoute><NewRepo /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
        </div>
    );
};

export default App;
