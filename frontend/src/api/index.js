const API_BASE = `http://${window.location.hostname}:3001/api`;

const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

export const login = async (username, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
    }
    return data;
};

export const register = async (username, password) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
    }
    return data;
};

export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
};

export const fetchProfile = async () => {
    const res = await fetch(`${API_BASE}/user/profile?t=${Date.now()}`, { headers: getHeaders() });
    return res.json();
};

export const addSshKey = async (name, key) => {
    const res = await fetch(`${API_BASE}/user/keys`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, key })
    });
    return res.json();
};

export const deleteSshKey = async (id) => {
    const res = await fetch(`${API_BASE}/user/keys/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return res.json();
};

// Repo functions
export const fetchRepos = async () => {
    const res = await fetch(`${API_BASE}/repos`, { headers: getHeaders() });
    return res.json();
};

export const createRepo = async (name, isPrivate = false) => {
    const res = await fetch(`${API_BASE}/repos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, isPrivate })
    });
    return res.json();
};

export const fetchRepoLog = async (name) => {
    const res = await fetch(`${API_BASE}/repos/${name}/log`, { headers: getHeaders() });
    return res.json();
};

export const fetchRepoTree = async (name, path = '') => {
    const res = await fetch(`${API_BASE}/repos/${name}/tree?path=${path}`, { headers: getHeaders() });
    return res.json();
};

export const fetchFileContent = async (name, path) => {
    const res = await fetch(`${API_BASE}/repos/${name}/blob?path=${path}`, { headers: getHeaders() });
    return res.text();
};

export const fetchPatchDetail = async (name, hash) => {
    const res = await fetch(`${API_BASE}/repos/${name}/patches/${hash}`, { headers: getHeaders() });
    return res.json();
};

export const addCollaborator = async (repoName, username, role = 'developer') => {
    const res = await fetch(`${API_BASE}/repos/${repoName}/collaborators`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ username, role })
    });
    return res.json();
};

export const removeCollaborator = async (repoName, username) => {
    const res = await fetch(`${API_BASE}/repos/${repoName}/collaborators/${username}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return res.json();
};

export const deleteRepo = async (name) => {
    const res = await fetch(`${API_BASE}/repos/${name}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return res.json();
};
