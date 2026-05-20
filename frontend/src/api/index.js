const API_BASE = `http://${window.location.hostname}:5176/api`;

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
    if (data) {
        localStorage.setItem('username', data.username);
        localStorage.setItem('isLoggedIn',true)
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
        localStorage.setItem('isLoggedIn', true);
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

// Repo functions — all use /owner/name namespace
const repoPath = (owner, name) => `${owner}/${name}`;

export const fetchRepos = async () => {
    const res = await fetch(`${API_BASE}/repos`, { headers: getHeaders() });
    return res.json();
};
export const fetchPersonalRepos = async (page = 1, limit = 4) => {
        const res = await fetch(`${API_BASE}/repos/personal?page=${page}&limit=${limit}`, { headers: getHeaders() });
        return res.json();
}
export const fetchCollabRepos = async (page = 1, limit = 4) =>{
        const res = await fetch(`${API_BASE}/repos/collaborators?page=${page}&limit=${limit}`, { headers: getHeaders() });
        return res.json();
}
export const fetchPublicRepos = async (page = 1, limit = 4) =>{
        const res = await fetch(`${API_BASE}/repos/public?page=${page}&limit=${limit}`, { headers: getHeaders() });
        return res.json();
}
export const fetchRepoMeta= async (owner,name) =>{
    const res = await fetch(`${API_BASE}/repo/${repoPath(owner,name)}/meta`, { headers: getHeaders() });
    if(!res.ok) return null;
    return res.json();
}

export const createRepo = async (name, isPrivate = false) => {
    const res = await fetch(`${API_BASE}/repos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, isPrivate })
    });
    return res.json();
};

export const fetchRepoLog = async (owner, name, channel = 'main',page=1,limit=10) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/log?channel=${encodeURIComponent(channel)}&page=${page}&limit=${limit}`, { headers: getHeaders() });
    return res.json();
};

export const fetchRepoTree = async (owner, name, path = '', channel = 'main') => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/tree?path=${encodeURIComponent(path)}&channel=${encodeURIComponent(channel)}`, { headers: getHeaders() });
    return res.json();
};

export const fetchFileContent = async (owner, name, path, channel = 'main') => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/blob?path=${encodeURIComponent(path)}&channel=${encodeURIComponent(channel)}`, { headers: getHeaders() });
    return res.text();
};

export const fetchPatchDetail = async (owner, name, hash, channel) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/patches/${hash}?channel=${channel || ''}`, { headers: getHeaders() });
    return res.json();
};

export const fetchCollaborators = async (owner,repoName) =>{
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/collaborators`)
    return res.json();
}
export const addCollaborator = async (owner, repoName, username, role = 'developer') => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/collaborators`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ username, role })
    });
    return res.json();
};

export const removeCollaborator = async (owner, repoName, username) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/collaborators/${username}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return res.json();
};

export const deleteRepo = async (owner, name) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return res.json();
};

export const fetchChannels = async (owner, name) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/channels`, { headers: getHeaders() });
    return res.json();
};

export const switchChannel = async (owner, name, channel) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/channels/switch`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ channel })
    });
    return res.json();
};

export const forkRepo = async (owner, name, newName) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/fork`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ newName })
    });
    return res.json();
};

export const fetchDiscussions = async (owner, repoName,page=1,limit=10) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/discussions?page=${page}&limit=${limit}`, { headers: getHeaders() });
    return res.json();
};

export const fetchDiscussion = async (owner, repoName, id) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}`, { headers: getHeaders() });
    return res.json();
};

export const createDiscussion = async (owner, repoName, data) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/discussions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
    });
    return res.json();
};

export const addComment = async (owner, repoName, id, text) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}/comments`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text })
    });
    return res.json();
};

export const mergeDiscussion = async (owner, repoName, id) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}/merge`, {
        method: 'POST',
        headers: getHeaders()
    });
    return res.json();
};
export const getMergeConflicts =async (owner,repoName,id)=>{
     const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}/mergeconflicts`, {
       
        headers: getHeaders()
    });
    return res.json();
}
export const closeDiscussion = async (owner, repoName, id) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}/close`, {
        method: 'POST',
        headers: getHeaders()
    });
    return res.json();
};

export const deleteDiscussion = async (owner, repoName, id) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/discussions/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
    });
    return res.json();
};

export const toggleProtection = async (owner, repoName, channel) => {
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, repoName)}/protected-channels/toggle`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ channel })
    });
    return res.json();
};
export const fetchProtectedCh=async(owner,name)=>{
    const res = await fetch(`${API_BASE}/repos/${repoPath(owner, name)}/protected-channels`)
    return res.json();

}
