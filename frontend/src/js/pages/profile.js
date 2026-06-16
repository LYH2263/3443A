let profileTab = 'info';
let profileQuotaCache = null;
let continueReadingList = [];
let continueReadingLoading = false;

function formatQuotaDisplay(quota) {
    if (!quota) return '';
    if (quota.is_unlimited) {
        return '<span class="badge badge-success" style="font-size:13px;padding:4px 10px">&#9889; 不限量</span>';
    }
    const color = quota.today_count >= quota.daily_quota ? 'var(--danger)' : 'var(--primary)';
    return `
        <span style="font-size:15px;font-weight:500;color:${color}">
            今日已读 <strong>${quota.today_count}</strong> / ${quota.daily_quota}
        </span>
    `;
}

function renderProfilePage() {
    const user = getUser();
    if (!user) return renderLoginPage();

    const avatarContent = user.avatar
        ? `<img src="${getImageUrl(user.avatar)}" alt="">`
        : escapeHtml((user.nickname || user.username || 'U').charAt(0).toUpperCase());

    const quota = user.quota || profileQuotaCache;
    const quotaDisplay = formatQuotaDisplay(quota);

    return `
        <div class="profile-page">
            ${renderNavbar('profile')}
            <div class="profile-container">
                <div class="profile-card">
                    <div class="profile-header-section">
                        <div class="profile-avatar-large" id="profile-avatar-display">${avatarContent}</div>
                        <h2 id="profile-nickname-display">${escapeHtml(user.nickname || user.username)}</h2>
                        <p style="margin-bottom:12px">${escapeHtml(user.member_level ? user.member_level.name : '普通会员')}</p>
                        <div id="profile-quota-display" style="margin-bottom:8px">
                            ${quota ? quotaDisplay : '<span style="color:var(--gray-400);font-size:13px">配额加载中...</span>'}
                        </div>
                    </div>
                    <div class="profile-tabs">
                        <button class="profile-tab ${profileTab === 'info' ? 'active' : ''}" onclick="switchProfileTab('info')">个人信息</button>
                        <button class="profile-tab ${profileTab === 'password' ? 'active' : ''}" onclick="switchProfileTab('password')">修改密码</button>
                        <button class="profile-tab ${profileTab === 'continue' ? 'active' : ''}" onclick="switchProfileTab('continue')">继续阅读</button>
                    </div>
                    <div id="profile-tab-content">
                        ${profileTab === 'info' ? renderProfileInfoTab(user) : profileTab === 'password' ? renderProfilePasswordTab() : renderContinueReadingTab()}
                    </div>
                </div>
            </div>
            ${renderFooter()}
        </div>
    `;
}

function switchProfileTab(tab) {
    profileTab = tab;
    const user = getUser();
    const content = document.getElementById('profile-tab-content');
    if (!content) return;

    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    if (tab === 'info') {
        content.innerHTML = renderProfileInfoTab(user);
    } else if (tab === 'password') {
        content.innerHTML = renderProfilePasswordTab();
    } else if (tab === 'continue') {
        content.innerHTML = renderContinueReadingTab();
        loadContinueReadingList();
    }
}

function renderProfileInfoTab(user) {
    return `
        <div class="profile-form">
            <form onsubmit="handleUpdateProfile(event)">
                <div class="form-group">
                    <label class="form-label">用户名</label>
                    <input type="text" class="form-input" value="${escapeHtml(user.username)}" disabled style="background:var(--gray-100)">
                </div>
                <div class="form-group">
                    <label class="form-label">昵称</label>
                    <input type="text" class="form-input" id="profile-nickname" value="${escapeHtml(user.nickname || '')}" placeholder="请输入昵称">
                </div>
                <div class="form-group">
                    <label class="form-label">邮箱</label>
                    <input type="email" class="form-input" id="profile-email" value="${escapeHtml(user.email || '')}" placeholder="请输入邮箱（选填）">
                </div>
                <div class="form-group">
                    <label class="form-label">手机号</label>
                    <input type="tel" class="form-input" id="profile-phone" value="${escapeHtml(user.phone || '')}" placeholder="请输入手机号（选填）">
                </div>
                <div class="form-group">
                    <label class="form-label">头像</label>
                    ${createUploadArea('avatar')}
                </div>
                <button type="submit" class="btn btn-primary" id="profile-save-btn">保存修改</button>
            </form>
        </div>
    `;
}

function renderProfilePasswordTab() {
    return `
        <div class="profile-form">
            <form onsubmit="handleChangePassword(event)">
                <div class="form-group">
                    <label class="form-label">原密码 <span class="required">*</span></label>
                    <input type="password" class="form-input" id="pwd-old" placeholder="请输入原密码" required autocomplete="current-password">
                </div>
                <div class="form-group">
                    <label class="form-label">新密码 <span class="required">*</span></label>
                    <input type="password" class="form-input" id="pwd-new" placeholder="6-30个字符" required autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label class="form-label">确认新密码 <span class="required">*</span></label>
                    <input type="password" class="form-input" id="pwd-confirm" placeholder="请再次输入新密码" required autocomplete="new-password">
                </div>
                <button type="submit" class="btn btn-primary" id="pwd-save-btn">修改密码</button>
            </form>
        </div>
    `;
}

window.onUploadComplete_avatar = function (results) {
    if (results.length > 0) {
        const avatarPath = results[0].path;
        const previewEl = document.getElementById('upload-preview-avatar');
        if (previewEl) {
            previewEl.innerHTML = `
                <div class="upload-preview-item">
                    <img src="${getImageUrl(results[0].url || results[0].path)}" alt="头像预览">
                </div>
            `;
        }
        window._newAvatarPath = avatarPath;
        showToast('头像上传成功', 'success');
    }
};

async function handleUpdateProfile(event) {
    event.preventDefault();
    const nickname = document.getElementById('profile-nickname').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    const btn = document.getElementById('profile-save-btn');

    if (email && !validateEmail(email)) {
        showToast('邮箱格式不正确', 'warning');
        return;
    }
    if (phone && !validatePhone(phone)) {
        showToast('手机号格式不正确', 'warning');
        return;
    }

    btn.disabled = true;
    btn.textContent = '保存中...';

    try {
        const data = { nickname, email, phone };
        if (window._newAvatarPath) {
            data.avatar = window._newAvatarPath;
        }
        const res = await api.auth.updateProfile(data);
        const user = getUser();
        Object.assign(user, res.data);
        setUser(user);

        const navNickname = document.getElementById('nav-nickname');
        if (navNickname) navNickname.textContent = user.nickname || user.username;

        const profileDisplay = document.getElementById('profile-nickname-display');
        if (profileDisplay) profileDisplay.textContent = user.nickname || user.username;

        if (user.avatar) {
            const avatarDisplay = document.getElementById('profile-avatar-display');
            if (avatarDisplay) avatarDisplay.innerHTML = `<img src="${getImageUrl(user.avatar)}" alt="">`;
        }

        window._newAvatarPath = null;
        showToast('资料更新成功', 'success');
    } catch (e) {
    } finally {
        btn.disabled = false;
        btn.textContent = '保存修改';
    }
}

async function initProfilePage() {
    try {
        const res = await api.auth.profile();
        const user = getUser();
        if (res.data && res.data.quota) {
            profileQuotaCache = res.data.quota;
            if (user) {
                user.quota = res.data.quota;
                if (res.data.member_level) {
                    user.member_level = res.data.member_level;
                }
                setUser(user);
            }
            const el = document.getElementById('profile-quota-display');
            if (el) {
                el.innerHTML = formatQuotaDisplay(res.data.quota);
            }
        }
    } catch (e) {}
}

async function handleChangePassword(event) {
    event.preventDefault();
    const oldPwd = document.getElementById('pwd-old').value;
    const newPwd = document.getElementById('pwd-new').value;
    const confirmPwd = document.getElementById('pwd-confirm').value;
    const btn = document.getElementById('pwd-save-btn');

    if (!oldPwd || !newPwd || !confirmPwd) {
        showToast('请填写所有密码字段', 'warning');
        return;
    }
    if (newPwd.length < 6) {
        showToast('新密码长度不能少于6个字符', 'warning');
        return;
    }
    if (newPwd !== confirmPwd) {
        showToast('两次输入的新密码不一致', 'warning');
        return;
    }

    btn.disabled = true;
    btn.textContent = '修改中...';

    try {
        await api.auth.changePassword({ old_password: oldPwd, new_password: newPwd });
        showToast('密码修改成功，请重新登录', 'success');
        setTimeout(() => {
            removeToken();
            window.location.hash = '#/login';
        }, 1500);
    } catch (e) {
    } finally {
        btn.disabled = false;
        btn.textContent = '修改密码';
    }
}

function renderContinueReadingTab() {
    return `
        <div class="continue-reading-wrap">
            <div class="continue-reading-header">
                <h3>&#128214; 继续阅读</h3>
                <p style="color:var(--gray-500);font-size:13px;margin:4px 0 0 0">按最近阅读时间倒序展示未读完的画册，点击一键续读</p>
            </div>
            <div id="continue-reading-list">
                ${continueReadingLoading ? renderLoading() : ''}
            </div>
        </div>
    `;
}

async function loadContinueReadingList() {
    const listEl = document.getElementById('continue-reading-list');
    if (!listEl) return;

    continueReadingLoading = true;
    listEl.innerHTML = renderLoading();

    try {
        let list = [];
        if (isLoggedIn()) {
            const res = await api.progress.myUnfinished();
            list = res.data || [];
        } else {
            const localList = getUnfinishedLocalProgressList();
            const albumIds = localList.map(i => i.album_id);
            if (albumIds.length > 0) {
                try {
                    const params = { page: 1, limit: albumIds.length };
                    const albumsRes = await api.public.albums(params);
                    const allAlbums = (albumsRes.data.list || []).filter(a => albumIds.includes(a.id));
                    const albumMap = {};
                    allAlbums.forEach(a => { albumMap[a.id] = a; });

                    list = localList.map(item => {
                        const album = albumMap[item.album_id];
                        if (!album) return null;
                        const total = item.total_pages || album.page_count || 0;
                        return {
                            album: {
                                id: album.id,
                                title: album.title,
                                description: album.description,
                                cover_image_url: album.cover_image_url,
                                page_count: total,
                                view_count: album.view_count,
                                category: album.category,
                            },
                            progress: {
                                current_page: item.current_page,
                                total_pages: total,
                                percent: total > 0 ? Math.min(100, Math.round((item.current_page / total) * 100)) : 0,
                                last_read_at: item.last_read_at,
                            }
                        };
                    }).filter(Boolean);
                } catch (e) {}
            }
        }

        continueReadingList = list;
        renderContinueReadingListItems();
    } catch (e) {
        listEl.innerHTML = renderEmpty('加载失败，请稍后重试');
    } finally {
        continueReadingLoading = false;
    }
}

function renderContinueReadingListItems() {
    const listEl = document.getElementById('continue-reading-list');
    if (!listEl) return;

    if (continueReadingList.length === 0) {
        listEl.innerHTML = renderEmpty('暂无未读完的画册，去首页发现精彩内容吧！', '&#128064;');
        const goHomeBtn = document.createElement('button');
        goHomeBtn.className = 'btn btn-primary';
        goHomeBtn.textContent = '去首页看看';
        goHomeBtn.style.marginTop = '16px';
        goHomeBtn.onclick = () => { window.location.hash = '#/'; };
        const emptyState = listEl.querySelector('.empty-state');
        if (emptyState) emptyState.appendChild(goHomeBtn);
        return;
    }

    let html = '<div class="continue-reading-grid">';
    continueReadingList.forEach(item => {
        const album = item.album;
        const progress = item.progress;
        if (!album || !progress) return;

        const coverUrl = album.cover_image_url ? getImageUrl(album.cover_image_url) : getPlaceholderImage();
        const pct = progress.percent || 0;
        const currentPage = progress.current_page || 1;
        const totalPages = progress.total_pages || album.page_count || 0;
        const lastReadText = progress.last_read_at ? formatDateTime(progress.last_read_at) : '';

        html += `
            <div class="continue-reading-card" onclick="continueReadAlbum(${album.id})">
                <div class="continue-reading-cover">
                    <img src="${coverUrl}" alt="${escapeHtml(album.title)}" onerror="this.src='${getPlaceholderImage()}'">
                    <div class="continue-reading-progress-overlay">
                        <div class="continue-reading-progress-bar">
                            <div class="continue-reading-progress-fill" style="width:${pct}%"></div>
                        </div>
                        <div class="continue-reading-progress-text">${pct}%</div>
                    </div>
                </div>
                <div class="continue-reading-info">
                    <div class="continue-reading-title">${escapeHtml(album.title)}</div>
                    <div class="continue-reading-pages">读至第 ${currentPage} / ${totalPages} 页</div>
                    ${lastReadText ? `<div class="continue-reading-time">&#128336; ${lastReadText}</div>` : ''}
                    <button class="btn btn-primary btn-sm continue-reading-btn" onclick="event.stopPropagation();continueReadAlbum(${album.id})">
                        &#9654; 继续阅读
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    listEl.innerHTML = html;
}

function continueReadAlbum(albumId) {
    window.location.hash = `#/viewer/${albumId}`;
}
