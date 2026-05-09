import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import RepoDetail from './pages/RepoDetail';
import NewRepo from './pages/NewRepo';
import Login from './pages/Login';
import Settings from './pages/Settings';
import Guide from './pages/Guide';

const App = () => {
    const isAuthenticated = !!localStorage.getItem('token');

    return (
        <Router>
            <Navbar />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/repo/:name" element={<RepoDetail />} />
                <Route path="/new" element={isAuthenticated ? <NewRepo /> : <Navigate to="/login" />} />
                <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" />} />
            </Routes>
        </Router>
    );
};

export default App;
