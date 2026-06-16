let viewerState = {
    album: null, pages: [], currentPage: 1, needPassword: false, flipbookReady: false,
    watermark: null, viewerInfo: null, sidebarOpen: true, bookmarks: new Set(),
    focusedThumbIndex: -1, albumId: null, savedProgress: null, isDoublePageMode: false,
    isFavorited: false
};

const saveProgressDebounced = debounce(async (albumId, page, total) => {
    try {
        if (isLoggedIn()) {
            await api.progress.save(albumId, page, total);
        }
    } catch (e) {}
    saveLocalProgress(albumId, page, total);
}, 500);

function showProgressRestoreToast(page) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: '&#10004;',
        error: '&#10006;',
        warning: '&#9888;',
        info: '&#8505;'
    };

    const toast = document.createElement('div');
    toast.className = 'toast info progress-restore-toast';
    toast.innerHTML = `
        <span class="toast-icon">${icons.info}</span>
        <span class="toast-message">已为你恢复到第 <strong>${page}</strong> 页，返回首页？</span>
        <span class="toast-actions">
            <button class="toast-action-btn" onclick="window.location.hash='#/'">返回首页</button>
            <button class="toast-action-btn toast-action-close" onclick="this.closest('.toast').remove()">&times;</button>
        </span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 6000);
}

async function loadProgressForAlbum(albumId, totalPages) {
    let progress = null;

    try {
        if (isLoggedIn()) {
            const res = await api.progress.get(albumId);
            if (res.data && res.data.has_progress) {
                progress = {
                    current_page: res.data.current_page,
                    total_pages: res.data.actual_total || totalPages,
                    is_completed: res.data.is_completed,
                };
            }
        }
    } catch (e) {}

    if (!progress) {
        progress = getLocalProgress(albumId);
    }

    if (progress && totalPages > 0) {
        let page = progress.current_page;
        if (page > totalPages) page = totalPages;
        if (page < 1) page = 1;
        progress.current_page = page;
        progress.total_pages = totalPages;

        if (isLoggedIn()) {
            correctLocalProgressPage(albumId, totalPages);
        }
    }

    return progress;
}

function getBookmarkStorageKey(albumId) {
    return `flipbook_bookmarks_${albumId}`;
}

function loadLocalBookmarks(albumId) {
    try {
        const raw = localStorage.getItem(getBookmarkStorageKey(albumId));
        return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
}

function saveLocalBookmarks(albumId, pageNumbers) {
    localStorage.setItem(getBookmarkStorageKey(albumId), JSON.stringify(pageNumbers));
}

async function loadBookmarks(albumId) {
    if (isLoggedIn()) {
        try {
            const res = await api.bookmarks.all(albumId);
            viewerState.bookmarks = new Set(res.data.page_numbers || []);
        } catch (e) {
            viewerState.bookmarks = new Set(loadLocalBookmarks(albumId));
        }
    } else {
        viewerState.bookmarks = new Set(loadLocalBookmarks(albumId));
    }
    updateSidebarBookmarks();
}

async function toggleBookmark(pageNumber) {
    const albumId = viewerState.albumId;
    if (!albumId) return;

    if (isLoggedIn()) {
        try {
            const res = await api.bookmarks.toggle(albumId, pageNumber);
            if (res.data.bookmarked) {
                viewerState.bookmarks.add(pageNumber);
            } else {
                viewerState.bookmarks.delete(pageNumber);
            }
        } catch (e) { return; }
    } else {
        if (viewerState.bookmarks.has(pageNumber)) {
            viewerState.bookmarks.delete(pageNumber);
        } else {
            viewerState.bookmarks.add(pageNumber);
        }
        saveLocalBookmarks(albumId, Array.from(viewerState.bookmarks));
    }

    updateSidebarBookmarks();
    updateBookmarkButton();
}

function flipbookPageToThumbIndex(page) {
    if (viewerState.pages.length <= 0) return 0;
    if (!viewerState.flipbookReady) return page - 1;
    const displayPage = page;
    return Math.max(0, Math.min(viewerState.pages.length - 1, displayPage - 1));
}

function thumbIndexToFlipbookPage(thumbIndex) {
    return thumbIndex + 1;
}

function renderViewerPage(id) {
    return `
        <div class="viewer-page">
            <div class="viewer-header">
                <button class="viewer-back" onclick="window.location.hash='#/'">&#8592; 返回画册列表</button>
                <h2 id="viewer-title">加载中...</h2>
                <div class="viewer-header-actions">
                    <button class="viewer-header-btn" id="btn-toggle-favorite" onclick="toggleAlbumFavorite()" title="收藏">&#9734;</button>
                    <button class="viewer-header-btn" id="btn-toggle-sidebar" onclick="toggleSidebar()" title="缩略图导航">&#9776;</button>
                    <button class="viewer-header-btn" id="btn-toggle-bookmark" onclick="toggleCurrentPageBookmark()" title="书签">&#9734;</button>
                </div>
            </div>
            <div class="viewer-body">
                <aside class="viewer-sidebar" id="viewer-sidebar">
                    <div class="sidebar-bookmarks" id="sidebar-bookmarks" style="display:none">
                        <div class="sidebar-bookmarks-header">
                            <span>&#128278; 书签</span>
                        </div>
                        <div class="sidebar-bookmarks-list" id="sidebar-bookmarks-list"></div>
                    </div>
                    <div class="sidebar-thumbs" id="sidebar-thumbs"></div>
                </aside>
                <div class="viewer-main" id="viewer-main">
                    <div class="viewer-container" id="viewer-container">
                        <div class="viewer-bg" id="viewer-bg"></div>
                        <div id="flipbook-wrapper">
                            <div id="viewer-loading">${renderLoading()}</div>
                            <div id="flipbook" style="display:none"></div>
                        </div>
                        <div class="viewer-password" id="viewer-password" style="display:none">
                            <div class="viewer-password-box">
                                <h3>&#128274; 需要访问密码</h3>
                                <p>此画册需要输入分享密码才能查看</p>
                                <div class="form-group">
                                    <input type="password" class="form-input" id="pwd-input" placeholder="请输入分享密码"
                                        onkeydown="if(event.key==='Enter')verifyAlbumPassword(${id})">
                                </div>
                                <button class="btn btn-primary" onclick="verifyAlbumPassword(${id})" style="width:100%">验证密码</button>
                            </div>
                        </div>
                        <div class="viewer-password" id="viewer-quota-exhausted" style="display:none">
                            <div class="viewer-password-box">
                                <div style="font-size:56px;margin-bottom:12px">&#128345;</div>
                                <h3>今日额度已用尽</h3>
                                <p id="viewer-quota-info" style="color:var(--gray-500);margin-bottom:8px">您今日已阅读 3/3 本画册</p>
                                <p style="color:var(--gray-500);margin-bottom:20px">升级会员获取更多阅读额度，或明日再来</p>
                                <div style="display:flex;flex-direction:column;gap:10px">
                                    <button class="btn btn-primary" onclick="window.location.hash='#/profile'" style="width:100%">升级会员</button>
                                    <button class="btn btn-secondary" onclick="window.location.hash='#/'" style="width:100%">返回画册列表</button>
                                    ${!isLoggedIn() ? '<button class="btn btn-secondary" onclick="window.location.hash=\'#/login\'" style="width:100%">登录解锁更多额度</button>' : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="viewer-controls" id="viewer-controls" style="display:none">
                <button onclick="flipPrev()">&#9664; 上一页</button>
                <span class="page-indicator" id="page-indicator">1 / 1</span>
                <button onclick="flipNext()">下一页 &#9654;</button>
                <button onclick="toggleFullscreen()" style="margin-left:16px" title="全屏">&#9974;</button>
            </div>
            <div class="viewer-mobile-drawer-overlay" id="mobile-drawer-overlay" onclick="closeMobileDrawer()"></div>
            <div class="viewer-mobile-drawer" id="mobile-drawer">
                <div class="mobile-drawer-handle" onclick="closeMobileDrawer()"></div>
                <div class="mobile-drawer-bookmarks" id="mobile-drawer-bookmarks" style="display:none">
                    <div class="sidebar-bookmarks-header">
                        <span>&#128278; 书签</span>
                    </div>
                    <div class="sidebar-bookmarks-list" id="mobile-drawer-bookmarks-list"></div>
                </div>
                <div class="mobile-drawer-thumbs" id="mobile-drawer-thumbs"></div>
            </div>
        </div>
    `;
}

function showQuotaExhausted(todayCount, dailyQuota) {
    document.getElementById('viewer-loading').style.display = 'none';
    document.getElementById('viewer-quota-info').textContent =
        `您今日已阅读 ${todayCount}/${dailyQuota} 本受限画册`;
    document.getElementById('viewer-quota-exhausted').style.display = 'flex';
    document.getElementById('viewer-title').textContent = '额度已用尽';
}

async function initViewerPage(id) {
    viewerState = {
        album: null, pages: [], currentPage: 1, needPassword: false, flipbookReady: false,
        watermark: null, viewerInfo: null, sidebarOpen: window.innerWidth > 768,
        bookmarks: new Set(), focusedThumbIndex: -1, albumId: id
    };
    try {
        const res = await api.public.albumDetail(id, undefined, { suppressToast: true });
        if (res.data.need_password) {
            viewerState.needPassword = true;
            viewerState.album = res.data.album;
            document.getElementById('viewer-title').textContent = res.data.album.title || '画册';
            document.getElementById('viewer-loading').style.display = 'none';
            document.getElementById('viewer-password').style.display = 'flex';
            return;
        }
        await setupViewer(res.data);
    } catch (e) {
        if (e.code === 40301) {
            const info = e.data || {};
            showQuotaExhausted(info.today_count || 0, info.daily_quota || 0);
        } else {
            document.getElementById('viewer-loading').innerHTML = renderEmpty('画册加载失败');
        }
    }
}

async function verifyAlbumPassword(id) {
    const pwd = document.getElementById('pwd-input').value.trim();
    if (!pwd) {
        showToast('请输入分享密码', 'warning');
        return;
    }
    try {
        const res = await api.public.albumDetail(id, pwd, { suppressToast: true });
        if (res.data.need_password) {
            showToast('密码不正确', 'error');
            return;
        }
        document.getElementById('viewer-password').style.display = 'none';
        await setupViewer(res.data);
    } catch (e) {
        if (e.code === 40301) {
            const info = e.data || {};
            document.getElementById('viewer-password').style.display = 'none';
            showQuotaExhausted(info.today_count || 0, info.daily_quota || 0);
        }
    }
}

async function setupViewer(data) {
    viewerState.album = data.album;
    viewerState.pages = data.pages || [];
    viewerState.watermark = data.album.watermark || null;
    viewerState.viewerInfo = data.viewer || null;

    const user = getUser();
    if (user && data.quota) {
        user.quota = data.quota;
        setUser(user);
    }

    document.getElementById('viewer-title').textContent = data.album.title || '画册';
    document.getElementById('viewer-loading').style.display = 'none';

    viewerState.isFavorited = false;
    if (isLoggedIn()) {
        try {
            const favRes = await api.favorites.check(viewerState.albumId);
            viewerState.isFavorited = favRes.data && favRes.data.favorited;
            favoriteStateMap[viewerState.albumId] = viewerState.isFavorited;
        } catch (e) {}
    }
    updateFavoriteButtonViewer();

    if (data.album.background_image_url) {
        document.getElementById('viewer-bg').style.backgroundImage = `url(${getImageUrl(data.album.background_image_url)})`;
    }

    if (viewerState.pages.length === 0) {
        document.getElementById('flipbook-wrapper').innerHTML = renderEmpty('该画册暂无页面内容');
        return;
    }

    const totalPages = viewerState.pages.length;
    const savedProgress = await loadProgressForAlbum(viewerState.albumId, totalPages);
    viewerState.savedProgress = savedProgress;

    if (savedProgress && savedProgress.current_page > 1 && !savedProgress.is_completed) {
        viewerState.currentPage = savedProgress.current_page;
    }

    const flipbook = document.getElementById('flipbook');
    flipbook.style.display = 'block';
    flipbook.innerHTML = '';

    const watermarkEnabled = viewerState.watermark && viewerState.watermark.enabled;

    viewerState.pages.forEach((page, index) => {
        const pageEl = document.createElement('div');
        pageEl.className = 'page';
        if (page.image_url) {
            const imgHtml = `<img src="${getImageUrl(page.image_url)}" alt="第${index + 1}页" loading="lazy" data-page-index="${index}" onload="onPageImageLoad(this)">`;
            if (watermarkEnabled) {
                pageEl.innerHTML = `
                    <div class="page-image-wrapper">
                        ${imgHtml}
                        <canvas class="page-watermark" data-page-index="${index}"></canvas>
                    </div>
                `;
            } else {
                pageEl.innerHTML = imgHtml;
            }
        } else {
            pageEl.innerHTML = `<div class="page-content"><h3>${escapeHtml(page.title || '第' + (index + 1) + '页')}</h3></div>`;
        }
        flipbook.appendChild(pageEl);
    });

    document.getElementById('viewer-controls').style.display = 'flex';

    renderSidebarThumbnails();
    updateSidebarState();
    loadBookmarks(viewerState.albumId);

    setTimeout(() => {
        initFlipbook();
    }, 100);
}

function renderSidebarThumbnails() {
    const targets = [
        { container: document.getElementById('sidebar-thumbs'), prefix: 's' },
        { container: document.getElementById('mobile-drawer-thumbs'), prefix: 'm' }
    ];

    targets.forEach(({ container, prefix }) => {
        if (!container) return;

        let html = '';
        viewerState.pages.forEach((page, index) => {
            const pageNum = index + 1;
            const imgSrc = page.image_url ? getImageUrl(page.image_url) : getPlaceholderImage();
            html += `
                <div class="thumb-item" id="${prefix}-thumb-${pageNum}" data-page="${pageNum}" tabindex="-1"
                     onclick="navigateToThumbPage(${pageNum})"
                     onkeydown="onThumbKeyDown(event, ${pageNum})"
                     role="button" aria-label="第${pageNum}页">
                    <div class="thumb-image-wrap">
                        <img class="thumb-img" data-src="${imgSrc}" alt="第${pageNum}页" loading="lazy">
                        <span class="thumb-bookmark-icon" id="${prefix}-thumb-bookmark-${pageNum}" style="display:none">&#9733;</span>
                    </div>
                    <span class="thumb-page-number">${pageNum}</span>
                </div>
            `;
        });
        container.innerHTML = html;

        initThumbLazyLoad(container);
    });
}

function initThumbLazyLoad(container) {
    const images = container.querySelectorAll('.thumb-img[data-src]');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            });
        }, { root: container, rootMargin: '100px' });
        images.forEach(img => observer.observe(img));
    } else {
        images.forEach(img => {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        });
    }
}

function navigateToThumbPage(pageNum) {
    if (viewerState.flipbookReady) {
        $('#flipbook').turn('page', pageNum);
    }
    if (window.innerWidth <= 768) {
        closeMobileDrawer();
    }
}

function onThumbKeyDown(event, pageNum) {
    const thumbs = document.querySelectorAll('#sidebar-thumbs .thumb-item, #mobile-drawer-thumbs .thumb-item');
    if (!thumbs.length) return;

    let idx = -1;
    thumbs.forEach((t, i) => { if (t.dataset.page == pageNum) idx = i; });

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        const next = Math.min(idx + 1, thumbs.length - 1);
        thumbs[next].focus();
        viewerState.focusedThumbIndex = next;
        thumbs[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const prev = Math.max(idx - 1, 0);
        thumbs[prev].focus();
        viewerState.focusedThumbIndex = prev;
        thumbs[prev].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigateToThumbPage(pageNum);
    }
}

function toggleSidebar() {
    if (window.innerWidth <= 768) {
        openMobileDrawer();
        return;
    }
    viewerState.sidebarOpen = !viewerState.sidebarOpen;
    updateSidebarState();
    if (viewerState.flipbookReady) {
        setTimeout(() => handleViewerResize(), 350);
    }
}

function updateSidebarState() {
    const sidebar = document.getElementById('viewer-sidebar');
    const main = document.getElementById('viewer-main');
    const btn = document.getElementById('btn-toggle-sidebar');
    if (!sidebar || !main) return;

    if (window.innerWidth <= 768) {
        sidebar.classList.remove('open', 'closed');
        sidebar.style.display = 'none';
        main.style.marginLeft = '0';
        return;
    }

    if (viewerState.sidebarOpen) {
        sidebar.classList.add('open');
        sidebar.classList.remove('closed');
        sidebar.style.display = '';
        main.style.marginLeft = '';
        if (btn) btn.classList.add('active');
    } else {
        sidebar.classList.remove('open');
        sidebar.classList.add('closed');
        sidebar.style.display = 'none';
        main.style.marginLeft = '0';
        if (btn) btn.classList.remove('active');
    }
}

function openMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (drawer) {
        drawer.classList.add('open');
        const thumbsContainer = document.getElementById('mobile-drawer-thumbs');
        if (thumbsContainer && thumbsContainer.children.length === 0) {
            renderSidebarThumbnails();
        }
        updateSidebarBookmarks();
    }
    if (overlay) overlay.classList.add('show');
}

function closeMobileDrawer() {
    const drawer = document.getElementById('mobile-drawer');
    const overlay = document.getElementById('mobile-drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
}

function renderMobileDrawerThumbs() {
    const container = document.getElementById('mobile-drawer-thumbs');
    if (!container || container.children.length > 0) return;
    renderSidebarThumbnails();
}

function updateSidebarBookmarks() {
    const sortedBookmarks = Array.from(viewerState.bookmarks).sort((a, b) => a - b);

    const bookmarkTargets = [
        { containerId: 'sidebar-bookmarks', listId: 'sidebar-bookmarks-list' },
        { containerId: 'mobile-drawer-bookmarks', listId: 'mobile-drawer-bookmarks-list' }
    ];

    bookmarkTargets.forEach(({ containerId, listId }) => {
        const bookmarksContainer = document.getElementById(containerId);
        const listContainer = document.getElementById(listId);

        if (sortedBookmarks.length > 0) {
            if (bookmarksContainer) bookmarksContainer.style.display = '';
            if (listContainer) {
                listContainer.innerHTML = sortedBookmarks.map(pn => `
                    <button class="bookmark-chip" onclick="navigateToThumbPage(${pn})" title="跳转到第${pn}页">
                        &#9733; 第${pn}页
                    </button>
                `).join('');
            }
        } else {
            if (bookmarksContainer) bookmarksContainer.style.display = 'none';
            if (listContainer) listContainer.innerHTML = '';
        }
    });

    const prefixes = ['s', 'm'];
    viewerState.pages.forEach((_, index) => {
        const pageNum = index + 1;
        prefixes.forEach(prefix => {
            const thumbBookmark = document.getElementById(`${prefix}-thumb-bookmark-${pageNum}`);
            if (thumbBookmark) {
                thumbBookmark.style.display = viewerState.bookmarks.has(pageNum) ? '' : 'none';
            }
        });
    });
}

function updateBookmarkButton() {
    const btn = document.getElementById('btn-toggle-bookmark');
    if (!btn) return;
    if (viewerState.bookmarks.has(viewerState.currentPage)) {
        btn.innerHTML = '&#9733;';
        btn.classList.add('bookmarked');
    } else {
        btn.innerHTML = '&#9734;';
        btn.classList.remove('bookmarked');
    }
}

function updateFavoriteButtonViewer() {
    const btn = document.getElementById('btn-toggle-favorite');
    if (!btn) return;
    const loading = favoriteLoadingSet.has(viewerState.albumId);
    const favorited = viewerState.isFavorited;
    if (loading) {
        btn.innerHTML = '<span class="spinner spinner-sm" style="border-color:rgba(255,255,255,0.2);border-top-color:var(--white)"></span>';
        btn.classList.add('loading');
    } else {
        btn.innerHTML = favorited ? '&#11088;' : '&#9734;';
        btn.classList.remove('loading');
    }
    btn.classList.toggle('bookmarked', favorited);
    btn.title = favorited ? '取消收藏' : '收藏';
}

async function toggleAlbumFavorite() {
    if (!isLoggedIn()) {
        showToast('请先登录后再收藏', 'warning');
        setTimeout(() => { window.location.hash = '#/login'; }, 800);
        return;
    }
    if (favoriteLoadingSet.has(viewerState.albumId)) return;

    const prevState = viewerState.isFavorited;
    favoriteLoadingSet.add(viewerState.albumId);
    updateFavoriteButtonViewer();

    try {
        const res = await api.favorites.toggle(viewerState.albumId);
        viewerState.isFavorited = res.data.favorited;
        favoriteStateMap[viewerState.albumId] = res.data.favorited;
        showToast(res.data.favorited ? '收藏成功' : '已取消收藏', 'success');
        if (window.onFavoriteChanged) {
            window.onFavoriteChanged(viewerState.albumId, res.data.favorited);
        }
    } catch (e) {
        viewerState.isFavorited = prevState;
        favoriteStateMap[viewerState.albumId] = prevState;
    } finally {
        favoriteLoadingSet.delete(viewerState.albumId);
        updateFavoriteButtonViewer();
    }
}

function toggleCurrentPageBookmark() {
    toggleBookmark(viewerState.currentPage);
}

function highlightCurrentThumb() {
    if (!viewerState.flipbookReady) return;
    const thumbIndex = flipbookPageToThumbIndex(viewerState.currentPage);
    const pageNum = thumbIndex + 1;

    document.querySelectorAll('.thumb-item.active').forEach(el => el.classList.remove('active'));

    const desktopThumb = document.getElementById(`s-thumb-${pageNum}`);
    if (desktopThumb) {
        desktopThumb.classList.add('active');
        const sidebar = document.getElementById('viewer-sidebar');
        if (sidebar && sidebar.style.display !== 'none') {
            desktopThumb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    const mobileThumb = document.getElementById(`m-thumb-${pageNum}`);
    if (mobileThumb) {
        mobileThumb.classList.add('active');
    }
}

function resolveWatermarkPlaceholders(text) {
    if (!text) return '';
    const info = viewerState.viewerInfo || {};
    const username = info.username || '访客';
    const date = info.date || new Date().toISOString().slice(0, 10);
    const ipSuffix = info.ip_suffix || '';

    return text
        .replace(/\{用户名\}/g, username)
        .replace(/\{日期\}/g, date)
        .replace(/\{IP后两段\}/g, ipSuffix);
}

function onPageImageLoad(img) {
    if (!viewerState.watermark || !viewerState.watermark.enabled) return;
    const pageIndex = img.getAttribute('data-page-index');
    const canvas = document.querySelector(`.page-watermark[data-page-index="${pageIndex}"]`);
    if (canvas) {
        drawPageWatermark(canvas, img);
    }
}

function drawPageWatermark(canvas, img) {
    const wm = viewerState.watermark;
    if (!wm || !wm.enabled) return;

    const dpr = window.devicePixelRatio || 1;
    const width = img.clientWidth || img.offsetWidth;
    const height = img.clientHeight || img.offsetHeight;

    if (width === 0 || height === 0) {
        requestAnimationFrame(() => drawPageWatermark(canvas, img));
        return;
    }

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const text = resolveWatermarkPlaceholders(wm.text || '版权所有');
    const color = wm.color || '#000000';
    const opacity = wm.opacity ?? 0.15;
    const density = wm.density || 3;

    drawWatermarkPattern(ctx, text, color, opacity, density, width, height);
}

function drawWatermarkPattern(ctx, text, color, opacity, density, width, height) {
    ctx.save();

    const fontSize = Math.max(12, Math.min(18, width / 40));
    const angle = -25 * Math.PI / 180;
    const baseSpacingX = 200 / density;
    const baseSpacingY = 110 / density;
    const scaleFactor = width / 800;
    const spacingX = baseSpacingX * Math.max(0.6, Math.min(1.5, scaleFactor));
    const spacingY = baseSpacingY * Math.max(0.6, Math.min(1.5, scaleFactor));

    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`;
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const diagonal = Math.sqrt(width * width + height * height);
    const startX = -diagonal / 2;
    const endX = diagonal / 2 + spacingX;
    const startY = -diagonal / 2;
    const endY = diagonal / 2 + spacingY;

    ctx.translate(width / 2, height / 2);
    ctx.rotate(angle);

    for (let y = startY; y < endY; y += spacingY) {
        for (let x = startX; x < endX; x += spacingX) {
            ctx.fillText(text, x, y);
        }
    }

    ctx.restore();
}

function redrawAllWatermarks() {
    if (!viewerState.watermark || !viewerState.watermark.enabled) return;

    const canvases = document.querySelectorAll('.page-watermark');
    canvases.forEach(canvas => {
        const pageIndex = canvas.getAttribute('data-page-index');
        const img = document.querySelector(`.page img[data-page-index="${pageIndex}"]`);
        if (img && img.complete && img.naturalWidth > 0) {
            drawPageWatermark(canvas, img);
        }
    });
}

function initFlipbook() {
    const flipbook = $('#flipbook');
    const container = document.getElementById('viewer-container');
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;

    let width = Math.min(800, containerWidth);
    let height = Math.min(500, containerHeight);

    if (window.innerWidth <= 768) {
        width = containerWidth;
        height = width * 0.65;
    }

    const startPage = viewerState.currentPage || 1;
    const savedProgress = viewerState.savedProgress;
    const shouldShowRestoreToast = savedProgress && savedProgress.current_page > 1 && !savedProgress.is_completed;

    flipbook.turn({
        width: width,
        height: height,
        autoCenter: true,
        elevation: 50,
        gradients: true,
        duration: 1000,
        acceleration: true,
        page: startPage,
        when: {
            turning: function (event, page, view) {
                viewerState.currentPage = page;
                updatePageIndicator();
                highlightCurrentThumb();
            },
            turned: function (event, page, view) {
                viewerState.currentPage = page;
                const totalPages = viewerState.pages.length || 1;
                const normalizedPage = normalizeFlipbookPage(page, totalPages, viewerState.isDoublePageMode);
                saveProgressDebounced(viewerState.albumId, normalizedPage, totalPages);

                updatePageIndicator();
                highlightCurrentThumb();
                updateBookmarkButton();
                setTimeout(() => checkAndDrawWatermarks(), 50);
            }
        }
    });

    viewerState.flipbookReady = true;
    updatePageIndicator();
    highlightCurrentThumb();
    updateBookmarkButton();

    if (shouldShowRestoreToast) {
        setTimeout(() => {
            showProgressRestoreToast(savedProgress.current_page);
        }, 800);
    }

    setTimeout(() => {
        checkAndDrawWatermarks();
    }, 200);
}

function checkAndDrawWatermarks() {
    if (!viewerState.watermark || !viewerState.watermark.enabled) return;

    const images = document.querySelectorAll('.page img[data-page-index]');
    images.forEach(img => {
        if (img.complete && img.naturalWidth > 0) {
            const pageIndex = img.getAttribute('data-page-index');
            const canvas = document.querySelector(`.page-watermark[data-page-index="${pageIndex}"]`);
            if (canvas) {
                drawPageWatermark(canvas, img);
            }
        }
    });
}

function updatePageIndicator() {
    const indicator = document.getElementById('page-indicator');
    if (indicator && viewerState.flipbookReady) {
        const total = $('#flipbook').turn('pages');
        indicator.textContent = `${viewerState.currentPage} / ${total}`;
    }
}

function flipPrev() {
    if (viewerState.flipbookReady) {
        $('#flipbook').turn('previous');
    }
}

function flipNext() {
    if (viewerState.flipbookReady) {
        $('#flipbook').turn('next');
    }
}

function toggleFullscreen() {
    const el = document.querySelector('.viewer-page');
    if (!document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

function handleViewerResize() {
    if (!viewerState.flipbookReady) return;
    const container = document.getElementById('viewer-container');
    if (!container) return;
    const containerWidth = container.clientWidth - 40;
    let width = Math.min(800, containerWidth);
    let height = width * 0.625;
    if (window.innerWidth <= 768) {
        width = containerWidth;
        height = width * 0.65;
    }
    $('#flipbook').turn('size', width, height);
    setTimeout(() => redrawAllWatermarks(), 50);
}

window.addEventListener('resize', debounce(() => {
    updateSidebarState();
    handleViewerResize();
}, 300));

document.addEventListener('fullscreenchange', () => {
    if (viewerState.flipbookReady) {
        setTimeout(() => {
            const container = document.getElementById('viewer-container');
            if (container) {
                const containerWidth = container.clientWidth - 40;
                let width = Math.min(800, containerWidth);
                let height = width * 0.625;
                if (window.innerWidth <= 768) {
                    width = containerWidth;
                    height = width * 0.65;
                }
                if (document.fullscreenElement) {
                    width = Math.min(containerWidth * 0.9, containerWidth - 40);
                    height = width * 0.625;
                }
                $('#flipbook').turn('size', width, height);
            }
            setTimeout(() => redrawAllWatermarks(), 100);
        }, 100);
    }
});

document.addEventListener('keydown', (e) => {
    if (!viewerState.flipbookReady) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowLeft') {
        flipPrev();
    } else if (e.key === 'ArrowRight') {
        flipNext();
    }
});
