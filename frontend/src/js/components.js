function renderNavbar(activePage = '') {
    const user = getUser();
    const logged = isLoggedIn();

    let userSection = '';
    if (logged && user) {
        const avatarContent = user.avatar
            ? `<img src="${getImageUrl(user.avatar)}" alt="">`
            : escapeHtml((user.nickname || user.username || '').charAt(0).toUpperCase());
        userSection = `
            <div class="home-nav-user" onclick="toggleUserDropdown(event)">
                <div class="home-nav-avatar">${avatarContent}</div>
                <span style="font-size:14px;color:var(--gray-700)" id="nav-nickname">${escapeHtml(user.nickname || user.username)}</span>
                <div class="home-nav-dropdown" id="user-dropdown">
                    ${user.role === 'admin' ? `<a href="#/admin">&#9881; 管理后台</a>` : ''}
                    <a href="#/profile">&#128100; 个人中心</a>
                    <a href="#/favorites">&#11088; 我的收藏</a>
                    <div class="dropdown-divider"></div>
                    <button onclick="logout()">&#128682; 退出登录</button>
                </div>
            </div>
        `;
    } else {
        userSection = `
            <a href="#/login" class="btn btn-outline btn-sm">登录</a>
            <a href="#/register" class="btn btn-primary btn-sm">注册</a>
        `;
    }

    return `
        <nav class="home-nav">
            <div class="home-nav-inner">
                <a href="#/" class="home-nav-logo">
                    <div class="home-nav-logo-icon">${getLogoSvg()}</div>
                    FlipBook
                </a>
                <div class="home-nav-links">
                    ${userSection}
                </div>
            </div>
        </nav>
    `;
}

function toggleUserDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

document.addEventListener('click', () => {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown) dropdown.classList.remove('show');
});

function logout() {
    removeToken();
    showToast('已退出登录', 'success');
    window.location.hash = '#/login';
}

function renderFooter() {
    return `
        <footer class="home-footer">
            <p>&copy; ${new Date().getFullYear()} FlipBook 翻页画册管理系统 · All Rights Reserved</p>
        </footer>
    `;
}

function renderLoading() {
    return '<div class="loading"><div class="spinner"></div></div>';
}

function renderEmpty(message = '暂无数据', icon = '&#128218;') {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <h3>${message}</h3>
            <p>请稍后再来查看</p>
        </div>
    `;
}

function createUploadArea(id, accept = 'image/*', multiple = false) {
    return `
        <div class="upload-area" id="upload-area-${id}"
            ondragover="event.preventDefault();this.classList.add('dragover')"
            ondragleave="this.classList.remove('dragover')"
            ondrop="handleDrop(event,'${id}')"
            onclick="document.getElementById('file-input-${id}').click()">
            <div class="upload-area-icon">&#128247;</div>
            <h4>点击或拖拽上传图片</h4>
            <p>支持 JPG、PNG、GIF、WebP 格式，最大 10MB</p>
            <input type="file" id="file-input-${id}" accept="${accept}" ${multiple ? 'multiple' : ''}
                style="display:none" onchange="handleFileSelect(event,'${id}')">
        </div>
        <div class="upload-preview" id="upload-preview-${id}"></div>
    `;
}

async function handleFileSelect(event, id) {
    const files = event.target.files;
    if (!files.length) return;
    await uploadFiles(files, id);
}

async function handleDrop(event, id) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    const files = event.dataTransfer.files;
    if (!files.length) return;
    await uploadFiles(files, id);
}

async function uploadFiles(files, id) {
    const uploadArea = document.getElementById(`upload-area-${id}`);
    if (uploadArea) {
        uploadArea.innerHTML = '<div class="loading"><div class="spinner"></div></div><p style="margin-top:8px;font-size:13px;color:var(--gray-500)">上传中...</p>';
    }

    try {
        const type = id === 'avatar' ? 'avatars' :
                     id === 'logo' ? 'logos' :
                     id === 'background' || id === 'bg-lib' ? 'backgrounds' :
                     id === 'cover' ? 'albums' :
                     id === 'page' || id === 'pages' ? 'pages' : 'albums';

        const results = [];
        for (const file of files) {
            const res = await api.upload.image(file, type);
            if (res.data) results.push(res.data);
        }

        if (window['onUploadComplete_' + id]) {
            window['onUploadComplete_' + id](results);
        }
    } catch (e) {
        // error already shown by apiRequest
    }

    if (uploadArea) {
        uploadArea.innerHTML = `
            <div class="upload-area-icon">&#128247;</div>
            <h4>点击或拖拽上传图片</h4>
            <p>支持 JPG、PNG、GIF、WebP 格式，最大 10MB</p>
        `;
    }
}

const favoriteLoadingSet = new Set();
const favoriteStateMap = {};

function renderFavoriteButton(albumId, options = {}) {
    const { size = 'md', showText = false, className = '' } = options;
    const loading = favoriteLoadingSet.has(albumId);
    const favorited = favoriteStateMap[albumId] || false;

    const sizeClass = size === 'sm' ? 'fav-btn-sm' : size === 'lg' ? 'fav-btn-lg' : '';
    const icon = favorited ? '&#11088;' : '&#9734;';
    const text = favorited ? '已收藏' : '收藏';

    return `
        <button class="favorite-btn ${sizeClass} ${favorited ? 'favorited' : ''} ${loading ? 'loading' : ''} ${className}"
                data-album-id="${albumId}"
                onclick="handleFavoriteToggle(event, ${albumId})"
                title="${favorited ? '取消收藏' : '收藏'}">
            <span class="fav-icon">${loading ? '<span class="spinner spinner-sm"></span>' : icon}</span>
            ${showText ? `<span class="fav-text">${text}</span>` : ''}
        </button>
    `;
}

async function handleFavoriteToggle(event, albumId) {
    if (event) event.stopPropagation();

    if (!isLoggedIn()) {
        showToast('请先登录后再收藏', 'warning');
        setTimeout(() => { window.location.hash = '#/login'; }, 800);
        return;
    }

    if (favoriteLoadingSet.has(albumId)) return;

    const prevState = favoriteStateMap[albumId] || false;
    favoriteLoadingSet.add(albumId);
    updateFavoriteButtonUI(albumId);

    try {
        const res = await api.favorites.toggle(albumId);
        favoriteStateMap[albumId] = res.data.favorited;
        showToast(res.data.favorited ? '收藏成功' : '已取消收藏', 'success');

        if (window.onFavoriteChanged) {
            window.onFavoriteChanged(albumId, res.data.favorited);
        }
    } catch (e) {
        favoriteStateMap[albumId] = prevState;
    } finally {
        favoriteLoadingSet.delete(albumId);
        updateFavoriteButtonUI(albumId);
    }
}

function updateFavoriteButtonUI(albumId) {
    document.querySelectorAll(`.favorite-btn[data-album-id="${albumId}"]`).forEach(btn => {
        const loading = favoriteLoadingSet.has(albumId);
        const favorited = favoriteStateMap[albumId] || false;

        btn.classList.toggle('loading', loading);
        btn.classList.toggle('favorited', favorited);

        const iconEl = btn.querySelector('.fav-icon');
        if (iconEl) {
            iconEl.innerHTML = loading ? '<span class="spinner spinner-sm"></span>' : (favorited ? '&#11088;' : '&#9734;');
        }

        const textEl = btn.querySelector('.fav-text');
        if (textEl) {
            textEl.textContent = favorited ? '已收藏' : '收藏';
        }

        btn.title = favorited ? '取消收藏' : '收藏';
    });
}

async function loadFavoriteStates(albumIds) {
    if (!isLoggedIn() || !albumIds || albumIds.length === 0) return;
    try {
        const res = await api.favorites.batchCheck(albumIds);
        if (res.data && res.data.favorites) {
            Object.assign(favoriteStateMap, res.data.favorites);
        }
    } catch (e) {}
}
