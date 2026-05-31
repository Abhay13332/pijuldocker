import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RepoDetail from './pages/Repo';
import NewRepo from './pages/NewRepo';
import Login from './pages/Login';
import Settings from './pages/Settings';
import Guide from './pages/Guide';
import OrgsList from './pages/Orgs/OrgsList';
import NewOrg from './pages/Orgs/NewOrg';
import OrgDetail from './pages/Orgs/OrgDetail';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const isAuthenticated = !!localStorage.getItem('isLoggedIn');
    return isAuthenticated ? children : <Navigate to="/login" />;
};

/** Fix for the broken static redirect — reads live params and interpolates them */
const RepoRedirect = () => {
    const { owner = '', name = '' } = useParams<{ owner: string; name: string }>();
    return <Navigate to={`/repos/${owner}/${name}`} replace />;
};

const App = () => {
    return (
        <div className='bg-background text-foreground min-h-screen'>
            <Router>
                <Routes>
                    {/* ── Auth ── */}
                    <Route path="/login" element={<Login />} />

                    {/* ── Dashboard ── */}
                    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

                    {/* ── Static pages ── */}
                    <Route path="/guide" element={<Guide />} />

                    {/* ── Repo — root (defaults to "files" tab) ── */}
                    <Route path="/repos/:owner/:name" element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />

                    {/* ── Repo — named tab routes (for direct deep-links and clarity) ── */}
                    <Route path="/repos/:owner/:name/files"        element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />
                    <Route path="/repos/:owner/:name/tree/:channel/*" element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />
                    <Route path="/repos/:owner/:name/blob/:channel/*" element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />
                    <Route path="/repos/:owner/:name/patches"      element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />
                    <Route path="/repos/:owner/:name/discussions"  element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />
                    <Route path="/repos/:owner/:name/settings"     element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />

                    {/* ── Repo — generic :tab wildcard (backward compat + future tabs) ── */}
                    <Route path="/repos/:owner/:name/:tab"         element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />

                    {/* ── Repo — deep-link: specific patch or discussion ── */}
                    <Route path="/repos/:owner/:name/patches/:hash"              element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />
                    <Route path="/repos/:owner/:name/discussions/:discussionId"  element={<ProtectedRoute><RepoDetail /></ProtectedRoute>} />

                    {/* ── Legacy /repo → /repos redirect (fixed) ── */}
                    <Route path="/repo/:owner/:name" element={<RepoRedirect />} />

                    {/* ── User ── */}
                    <Route path="/new"      element={<ProtectedRoute><NewRepo /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="/profile"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />

                    {/* ── Organizations ── */}
                    <Route path="/orgs" element={<ProtectedRoute><OrgsList /></ProtectedRoute>} />
                    <Route path="/orgs/new" element={<ProtectedRoute><NewOrg /></ProtectedRoute>} />
                    <Route path="/orgs/:orgName" element={<ProtectedRoute><OrgDetail /></ProtectedRoute>} />

                    {/* ── Catch-all ── */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Router>
        </div>
    );
};

export default App;
