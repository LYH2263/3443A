const API_BASE = '/api';

const recentMessages = new Set();

function showToast(message, type = 'info', duration = 3000) {
    if (recentMessages.has(message)) return;
    recentMessages.add(message);
    setTimeout(() => recentMessages.delete(message), 2000);

    const container = document.getElementById('toast-container');
    const icons = {
        success: '&#10004;',
        error: '&#10006;',
        warning: '&#9888;',
        info: '&#8505;'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <span class="toast-close" onclick="this.parentElement.remove()">&times;</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function getToken() {
    return localStorage.getItem('flipbook_token') || '';
}

function setToken(token) {
    localStorage.setItem('flipbook_token', token);
}

function removeToken() {
    localStorage.removeItem('flipbook_token');
    localStorage.removeItem('flipbook_user');
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('flipbook_user') || 'null');
    } catch (e) { return null; }
}

function setUser(user) {
    localStorage.setItem('flipbook_user', JSON.stringify(user));
}

function isLoggedIn() {
    return !!getToken();
}

function isAdmin() {
    const user = getUser();
    return user && user.role === 'admin';
}

async function apiRequest(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers,
    };

    if (options.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    try {
        const response = await fetch(`${API_BASE}${url}`, {
            ...options,
            headers,
            body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
        });

        if (response.status === 401) {
            removeToken();
            showToast('登录已过期，请重新登录', 'warning');
            setTimeout(() => { window.location.hash = '#/login'; }, 1000);
            const error = new Error('登录已过期，请重新登录');
            error._isBusinessError = true;
            throw error;
        }

        const data = await response.json();

        if (data.code !== 200) {
            showToast(data.message || '操作失败', 'error');
            const error = new Error(data.message);
            error._isBusinessError = true;
            throw error;
        }

        return data;
    } catch (error) {
        if (error._isBusinessError) throw error;
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            showToast('服务器连接失败，请稍后重试', 'error');
        }
        throw error;
    }
}

const api = {
    auth: {
        login: (data) => apiRequest('/auth/login', { method: 'POST', body: data }),
        register: (data) => apiRequest('/auth/register', { method: 'POST', body: data }),
        profile: () => apiRequest('/auth/profile'),
        updateProfile: (data) => apiRequest('/auth/profile', { method: 'PUT', body: data }),
        changePassword: (data) => apiRequest('/auth/password', { method: 'PUT', body: data }),
    },
    public: {
        albums: (params) => apiRequest('/public/albums?' + new URLSearchParams(params)),
        albumDetail: (id, password) => {
            let url = `/public/albums/${id}`;
            if (password) url += `?password=${encodeURIComponent(password)}`;
            return apiRequest(url);
        },
        verifyPassword: (id, password) => apiRequest(`/public/albums/${id}/verify`, { method: 'POST', body: { password } }),
        categories: () => apiRequest('/public/categories'),
    },
    admin: {
        dashboard: () => apiRequest('/admin/dashboard'),
        albums: (params) => apiRequest('/admin/albums?' + new URLSearchParams(params || {})),
        albumDetail: (id) => apiRequest(`/admin/albums/${id}`),
        createAlbum: (data) => apiRequest('/admin/albums', { method: 'POST', body: data }),
        updateAlbum: (id, data) => apiRequest(`/admin/albums/${id}`, { method: 'PUT', body: data }),
        deleteAlbum: (id) => apiRequest(`/admin/albums/${id}`, { method: 'DELETE' }),
        albumPages: (albumId) => apiRequest(`/admin/albums/${albumId}/pages`),
        addPage: (albumId, data) => apiRequest(`/admin/albums/${albumId}/pages`, { method: 'POST', body: data }),
        updatePage: (albumId, id, data) => apiRequest(`/admin/albums/${albumId}/pages/${id}`, { method: 'PUT', body: data }),
        deletePage: (albumId, id) => apiRequest(`/admin/albums/${albumId}/pages/${id}`, { method: 'DELETE' }),
        sortPages: (albumId, pages) => apiRequest(`/admin/albums/${albumId}/pages/sort`, { method: 'POST', body: { pages } }),
        generateQrcode: (data) => apiRequest('/admin/qrcode/generate', { method: 'POST', body: data }),
        users: (params) => apiRequest('/admin/users?' + new URLSearchParams(params || {})),
        userDetail: (id) => apiRequest(`/admin/users/${id}`),
        createUser: (data) => apiRequest('/admin/users', { method: 'POST', body: data }),
        updateUser: (id, data) => apiRequest(`/admin/users/${id}`, { method: 'PUT', body: data }),
        deleteUser: (id) => apiRequest(`/admin/users/${id}`, { method: 'DELETE' }),
        levels: () => apiRequest('/admin/levels'),
        createLevel: (data) => apiRequest('/admin/levels', { method: 'POST', body: data }),
        updateLevel: (id, data) => apiRequest(`/admin/levels/${id}`, { method: 'PUT', body: data }),
        deleteLevel: (id) => apiRequest(`/admin/levels/${id}`, { method: 'DELETE' }),
        categories: () => apiRequest('/admin/categories'),
        createCategory: (data) => apiRequest('/admin/categories', { method: 'POST', body: data }),
        updateCategory: (id, data) => apiRequest(`/admin/categories/${id}`, { method: 'PUT', body: data }),
        deleteCategory: (id) => apiRequest(`/admin/categories/${id}`, { method: 'DELETE' }),
        backgrounds: () => apiRequest('/admin/backgrounds'),
        addBackground: (data) => apiRequest('/admin/backgrounds', { method: 'POST', body: data }),
        deleteBackground: (id) => apiRequest(`/admin/backgrounds/${id}`, { method: 'DELETE' }),
    },
    upload: {
        image: async (file, type = 'albums') => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);
            return apiRequest('/upload/image', { method: 'POST', body: formData, headers: {} });
        },
    },
    init: () => apiRequest('/init'),
};
