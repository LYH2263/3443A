let viewerState = {
    album: null, pages: [], currentPage: 1, needPassword: false, flipbookReady: false,
    watermark: null, viewerInfo: null, sidebarOpen: true, bookmarks: new Set(),
    focusedThumbIndex: -1, albumId: null, savedProgress: null, isDoublePageMode: false,
    isFavorited: false,
    magnifierEnabled: false,
    magnifierActive: false,
    magnifierZoom: 2.5,
    magnifierSize: 180,
    isMobileZoomActive: false,
    mobileZoomScale: 1,
    mobilePanOffset: { x: 0, y: 0 },
    mobilePinchStartDistance: 0,
    mobilePinchStartScale: 1,
    mobileTouchStartPos: { x: 0, y: 0 },
    magnifierImageLoaded: false,
    magnifierRafId: null,
    pageViewTracker: {
        sessionId: '',
        currentPageEntryTime: 0,
        pendingPageData: [],
        isTracking: false,
        minStayThreshold: 500,
    }
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
                    <button class="viewer-header-btn" id="btn-toggle-magnifier" onclick="toggleMagnifier()" title="放大镜">&#128269;</button>
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
                        <div class="magnifier-lens" id="magnifier-lens" style="display:none">
                            <div class="magnifier-lens-inner" id="magnifier-lens-inner"></div>
                        </div>
                        <div class="magnifier-controls" id="magnifier-controls" style="display:none">
                            <div class="magnifier-zoom-control">
                                <span class="magnifier-zoom-label">放大倍率</span>
                                <input type="range" id="magnifier-zoom-slider" min="2" max="3" step="0.1" value="2.5" oninput="updateMagnifierZoom(this.value)">
                                <span class="magnifier-zoom-value" id="magnifier-zoom-value">2.5x</span>
                            </div>
                        </div>
                        <div class="mobile-zoom-hint" id="mobile-zoom-hint" style="display:none">
                            双指捏合缩放，单指拖动平移
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
    cleanupPageViewTracker();

    viewerState = {
        album: null, pages: [], currentPage: 1, needPassword: false, flipbookReady: false,
        watermark: null, viewerInfo: null, sidebarOpen: window.innerWidth > 768,
        bookmarks: new Set(), focusedThumbIndex: -1, albumId: id,
        magnifierEnabled: false,
        magnifierActive: false,
        magnifierZoom: 2.5,
        magnifierSize: 180,
        isMobileZoomActive: false,
        mobileZoomScale: 1,
        mobilePanOffset: { x: 0, y: 0 },
        mobilePinchStartDistance: 0,
        mobilePinchStartScale: 1,
        mobileTouchStartPos: { x: 0, y: 0 },
        magnifierImageLoaded: false,
        magnifierRafId: null,
        pageViewTracker: {
            sessionId: '',
            currentPageEntryTime: 0,
            pendingPageData: [],
            isTracking: false,
            minStayThreshold: 500,
        }
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
                        <div class="page-image-loading"></div>
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
    return resolveWatermarkPlaceholdersGlobal(text, viewerState.viewerInfo);
}

function onPageImageLoad(img) {
    if (!viewerState.watermark || !viewerState.watermark.enabled) return;
    const pageIndex = img.getAttribute('data-page-index');
    const canvas = document.querySelector(`.page-watermark[data-page-index="${pageIndex}"]`);
    if (canvas) {
        drawPageWatermark(canvas, img);
        canvas.dataset.drawn = '1';
    }
    const wrapper = img.parentElement;
    if (wrapper) {
        const loading = wrapper.querySelector('.page-image-loading');
        if (loading) loading.style.display = 'none';
    }
}

function drawPageWatermark(canvas, img) {
    const wm = viewerState.watermark;
    if (!wm || !wm.enabled) return;

    const width = img.clientWidth || img.offsetWidth || canvas.parentElement.clientWidth || 0;
    const height = img.clientHeight || img.offsetHeight || canvas.parentElement.clientHeight || 0;

    if (width === 0 || height === 0) {
        requestAnimationFrame(() => drawPageWatermark(canvas, img));
        return;
    }

    const ctx = setupWatermarkCanvas(canvas, width, height);

    const text = resolveWatermarkPlaceholders(wm.text || '版权所有');
    const color = wm.color || '#000000';
    const opacity = wm.opacity ?? 0.15;
    const density = wm.density || 3;

    drawWatermarkPatternGlobal(ctx, text, color, opacity, density, width, height);
}

function drawPlaceholderWatermark(canvas, width, height) {
    const wm = viewerState.watermark;
    if (!wm || !wm.enabled) return;
    if (width === 0 || height === 0) return;

    const ctx = setupWatermarkCanvas(canvas, width, height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const text = resolveWatermarkPlaceholders(wm.text || '版权所有');
    const color = wm.color || '#000000';
    const opacity = wm.opacity ?? 0.15;
    const density = wm.density || 3;

    drawWatermarkPatternGlobal(ctx, text, color, opacity, density, width, height);
}

function prerenderWatermarksForVisiblePages() {
    if (!viewerState.watermark || !viewerState.watermark.enabled) return;
    if (!viewerState.flipbookReady) return;

    const currentPage = viewerState.currentPage || 1;
    const visiblePages = new Set([currentPage, currentPage - 1, currentPage + 1]);

    visiblePages.forEach(pageNum => {
        if (pageNum < 1) return;
        const pageIndex = pageNum - 1;
        if (pageIndex >= viewerState.pages.length) return;

        const canvas = document.querySelector(`.page-watermark[data-page-index="${pageIndex}"]`);
        if (!canvas) return;
        if (canvas.dataset.drawn === '1') return;

        const img = document.querySelector(`.page img[data-page-index="${pageIndex}"]`);
        const wrapper = canvas.parentElement;
        const width = wrapper ? wrapper.clientWidth : 0;
        const height = wrapper ? wrapper.clientHeight : 0;

        if (img && img.complete && img.naturalWidth > 0) {
            drawPageWatermark(canvas, img);
            canvas.dataset.drawn = '1';
        } else if (width > 0 && height > 0) {
            drawPlaceholderWatermark(canvas, width, height);
        }
    });
}

function redrawAllWatermarks() {
    if (!viewerState.watermark || !viewerState.watermark.enabled) return;

    const canvases = document.querySelectorAll('.page-watermark');
    canvases.forEach(canvas => {
        canvas.dataset.drawn = '';
        const pageIndex = canvas.getAttribute('data-page-index');
        const img = document.querySelector(`.page img[data-page-index="${pageIndex}"]`);
        if (img && img.complete && img.naturalWidth > 0) {
            drawPageWatermark(canvas, img);
            canvas.dataset.drawn = '1';
        }
    });

    prerenderWatermarksForVisiblePages();
}

function generatePageViewSessionId() {
    return 'pv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function initPageViewTracker() {
    const tracker = viewerState.pageViewTracker;
    tracker.sessionId = generatePageViewSessionId();
    tracker.pendingPageData = [];
    tracker.isTracking = true;
    tracker.currentPageEntryTime = 0;

    window.addEventListener('beforeunload', handlePageViewBeforeUnload);
    window.addEventListener('pagehide', handlePageViewBeforeUnload);
    document.addEventListener('visibilitychange', handlePageViewVisibilityChange);
}

function cleanupPageViewTracker() {
    const tracker = viewerState.pageViewTracker;
    if (!tracker.isTracking) return;

    recordCurrentPageExit();
    reportPageViewData();

    tracker.isTracking = false;
    tracker.currentPageEntryTime = 0;

    window.removeEventListener('beforeunload', handlePageViewBeforeUnload);
    window.removeEventListener('pagehide', handlePageViewBeforeUnload);
    document.removeEventListener('visibilitychange', handlePageViewVisibilityChange);
}

function handlePageViewBeforeUnload() {
    const tracker = viewerState.pageViewTracker;
    if (!tracker.isTracking) return;

    recordCurrentPageExit();
    reportPageViewData();
}

function handlePageViewVisibilityChange() {
    const tracker = viewerState.pageViewTracker;
    if (!tracker.isTracking) return;

    if (document.visibilityState === 'hidden') {
        recordCurrentPageExit();
        reportPageViewData();
    } else if (document.visibilityState === 'visible' && viewerState.flipbookReady) {
        tracker.currentPageEntryTime = Date.now();
    }
}

function recordPageEntry(pageNumber) {
    const tracker = viewerState.pageViewTracker;
    if (!tracker.isTracking) return;

    tracker.currentPageEntryTime = Date.now();
}

function recordCurrentPageExit() {
    const tracker = viewerState.pageViewTracker;
    if (!tracker.isTracking || tracker.currentPageEntryTime === 0) return;

    const now = Date.now();
    const durationMs = now - tracker.currentPageEntryTime;
    const currentPage = viewerState.currentPage;

    if (currentPage > 0 && durationMs > 0) {
        addPageViewData(currentPage, durationMs);
    }

    tracker.currentPageEntryTime = 0;
}

function addPageViewData(pageNumber, durationMs) {
    const tracker = viewerState.pageViewTracker;
    const threshold = tracker.minStayThreshold;

    if (durationMs < threshold) {
        return;
    }

    const existingIndex = tracker.pendingPageData.findIndex(d => d.page_number === pageNumber);
    if (existingIndex >= 0) {
        tracker.pendingPageData[existingIndex].duration_ms += durationMs;
        tracker.pendingPageData[existingIndex].entry_count += 1;
    } else {
        tracker.pendingPageData.push({
            page_number: pageNumber,
            duration_ms: durationMs,
            entry_count: 1,
        });
    }
}

function reportPageViewData() {
    const tracker = viewerState.pageViewTracker;
    const albumId = viewerState.albumId;

    if (!tracker.isTracking || !albumId || tracker.pendingPageData.length === 0) {
        return;
    }

    try {
        api.pageView.report(albumId, tracker.pendingPageData, tracker.sessionId);
        tracker.pendingPageData = [];
    } catch (e) {
        console.warn('页面浏览数据上报失败', e);
    }
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

                recordCurrentPageExit();

                if (viewerState.magnifierEnabled) {
                    hideMagnifier();
                    resetMobileZoom();
                }
                setTimeout(() => prerenderWatermarksForVisiblePages(), 0);
            },
            turned: function (event, page, view) {
                viewerState.currentPage = page;
                const totalPages = viewerState.pages.length || 1;
                const normalizedPage = normalizeFlipbookPage(page, totalPages, viewerState.isDoublePageMode);
                saveProgressDebounced(viewerState.albumId, normalizedPage, totalPages);

                recordPageEntry(page);

                updatePageIndicator();
                highlightCurrentThumb();
                updateBookmarkButton();
                setTimeout(() => {
                    prerenderWatermarksForVisiblePages();
                    checkAndDrawWatermarks();
                }, 50);

                if (viewerState.magnifierEnabled) {
                    resetMagnifier();
                    viewerState.magnifierImageLoaded = false;
                }
            }
        }
    });

    viewerState.flipbookReady = true;
    updatePageIndicator();
    highlightCurrentThumb();
    updateBookmarkButton();

    initPageViewTracker();
    recordPageEntry(startPage);

    if (shouldShowRestoreToast) {
        setTimeout(() => {
            showProgressRestoreToast(savedProgress.current_page);
        }, 800);
    }

    setTimeout(() => {
        prerenderWatermarksForVisiblePages();
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
                canvas.dataset.drawn = '1';
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

    if (viewerState.magnifierEnabled) {
        hideMagnifier();
        resetMobileZoom();
        resetMagnifier();
    }
}

window.addEventListener('resize', debounce(() => {
    updateSidebarState();
    handleViewerResize();

    if (viewerState.magnifierEnabled) {
        const isMobile = window.innerWidth <= 768;
        const magnifierControls = document.getElementById('magnifier-controls');
        const mobileZoomHint = document.getElementById('mobile-zoom-hint');

        if (magnifierControls) {
            magnifierControls.style.display = isMobile ? 'none' : 'flex';
        }
        if (mobileZoomHint) {
            mobileZoomHint.style.display = isMobile ? 'block' : 'none';
        }
    }
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

function toggleMagnifier() {
    viewerState.magnifierEnabled = !viewerState.magnifierEnabled;
    const btn = document.getElementById('btn-toggle-magnifier');
    const magnifierControls = document.getElementById('magnifier-controls');
    const mobileZoomHint = document.getElementById('mobile-zoom-hint');
    const isMobile = window.innerWidth <= 768;

    if (btn) {
        btn.classList.toggle('active', viewerState.magnifierEnabled);
        btn.title = viewerState.magnifierEnabled ? '关闭放大镜' : '放大镜';
    }

    if (viewerState.magnifierEnabled) {
        showToast('放大镜已开启，鼠标悬停查看细节', 'info', 2000);
        if (isMobile) {
            if (mobileZoomHint) mobileZoomHint.style.display = 'block';
        } else {
            if (magnifierControls) magnifierControls.style.display = 'flex';
        }
        initMagnifierEvents();
        setFlipbookDraggable(false);
    } else {
        if (isMobile) {
            if (mobileZoomHint) mobileZoomHint.style.display = 'none';
            resetMobileZoom();
        } else {
            if (magnifierControls) magnifierControls.style.display = 'none';
            hideMagnifier();
        }
        removeMagnifierEvents();
        setFlipbookDraggable(true);
        resetMagnifier();
    }
}

function updateMagnifierZoom(value) {
    viewerState.magnifierZoom = parseFloat(value);
    const zoomValue = document.getElementById('magnifier-zoom-value');
    if (zoomValue) {
        zoomValue.textContent = viewerState.magnifierZoom.toFixed(1) + 'x';
    }
}

function setFlipbookDraggable(draggable) {
    if (!viewerState.flipbookReady) return;
    try {
        $('#flipbook').turn('options', { draggable: draggable });
    } catch (e) {}
}

function initMagnifierEvents() {
    const flipbookWrapper = document.getElementById('flipbook-wrapper');
    if (!flipbookWrapper) return;

    flipbookWrapper.addEventListener('mousemove', handleMagnifierMouseMove);
    flipbookWrapper.addEventListener('mouseenter', handleMagnifierMouseEnter);
    flipbookWrapper.addEventListener('mouseleave', handleMagnifierMouseLeave);

    initMobileZoomEvents();
}

function removeMagnifierEvents() {
    const flipbookWrapper = document.getElementById('flipbook-wrapper');
    if (!flipbookWrapper) return;

    flipbookWrapper.removeEventListener('mousemove', handleMagnifierMouseMove);
    flipbookWrapper.removeEventListener('mouseenter', handleMagnifierMouseEnter);
    flipbookWrapper.removeEventListener('mouseleave', handleMagnifierMouseLeave);

    removeMobileZoomEvents();
}

function handleMagnifierMouseEnter(e) {
    if (!viewerState.magnifierEnabled) return;
    const img = getCurrentPageImage(e);
    if (!img || !img.complete || img.naturalWidth === 0) {
        viewerState.magnifierImageLoaded = false;
        return;
    }
    viewerState.magnifierImageLoaded = true;
    showMagnifier();
    updateMagnifier(e, img);
}

function handleMagnifierMouseMove(e) {
    if (!viewerState.magnifierEnabled || !viewerState.magnifierImageLoaded) return;
    const img = getCurrentPageImage(e);
    if (!img) return;

    if (viewerState.magnifierRafId) {
        cancelAnimationFrame(viewerState.magnifierRafId);
    }

    viewerState.magnifierRafId = requestAnimationFrame(() => {
        updateMagnifier(e, img);
        viewerState.magnifierRafId = null;
    });
}

function handleMagnifierMouseLeave() {
    hideMagnifier();
}

function getCurrentPageImage(e) {
    const flipbook = document.getElementById('flipbook');
    if (!flipbook) return null;

    if (e) {
        let clientX = e.clientX;
        let clientY = e.clientY;
        let target = e.target;

        if (e.target === undefined && e.identifier !== undefined) {
            clientX = e.clientX;
            clientY = e.clientY;
            target = document.elementFromPoint(clientX, clientY);
        }

        if (target && target.nodeType === 1) {
            const pageEl = target.closest('.page');
            if (pageEl) {
                const img = pageEl.querySelector('img');
                if (img) return img;
            }
        }

        if (clientX !== undefined && clientY !== undefined) {
            const el = document.elementFromPoint(clientX, clientY);
            if (el) {
                const pageEl = el.closest('.page');
                if (pageEl) {
                    const img = pageEl.querySelector('img');
                    if (img) return img;
                }
            }
        }
    }

    const currentPage = viewerState.currentPage;
    const pages = flipbook.querySelectorAll('.page');
    for (let i = 0; i < pages.length; i++) {
        const pageNum = i + 1;
        if (pageNum === currentPage || (viewerState.isDoublePageMode && 
            (pageNum === currentPage || pageNum === currentPage + 1))) {
            const img = pages[i].querySelector('img');
            if (img && img.complete && img.naturalWidth > 0) {
                return img;
            }
        }
    }

    return null;
}

function getMousePositionInImage(e, img) {
    const imgRect = img.getBoundingClientRect();
    let x = e.clientX - imgRect.left;
    let y = e.clientY - imgRect.top;

    x = Math.max(0, Math.min(imgRect.width, x));
    y = Math.max(0, Math.min(imgRect.height, y));

    const percentX = x / imgRect.width;
    const percentY = y / imgRect.height;

    return {
        x: x,
        y: y,
        percentX: percentX,
        percentY: percentY,
        imgRect: imgRect
    };
}

function getWatermarkedCompositeUrl(img) {
    const wm = viewerState.watermark;
    if (!wm || !wm.enabled) {
        return getImageUrl(img.getAttribute('src') || img.src);
    }

    if (img.dataset.compositeUrl) {
        return img.dataset.compositeUrl;
    }

    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    if (!naturalW || !naturalH) {
        return getImageUrl(img.getAttribute('src') || img.src);
    }

    const composite = document.createElement('canvas');
    composite.width = naturalW;
    composite.height = naturalH;
    const ctx = composite.getContext('2d');

    ctx.drawImage(img, 0, 0, naturalW, naturalH);

    const text = resolveWatermarkPlaceholders(wm.text || '版权所有');
    const color = wm.color || '#000000';
    const opacity = wm.opacity ?? 0.15;
    const density = wm.density || 3;
    drawWatermarkPatternGlobal(ctx, text, color, opacity, density, naturalW, naturalH);

    let dataUrl;
    try {
        dataUrl = composite.toDataURL('image/png');
    } catch (e) {
        dataUrl = getImageUrl(img.getAttribute('src') || img.src);
    }
    img.dataset.compositeUrl = dataUrl;
    return dataUrl;
}

function updateMagnifier(e, img) {
    const lens = document.getElementById('magnifier-lens');
    const lensInner = document.getElementById('magnifier-lens-inner');
    if (!lens || !lensInner || !img) return;

    const pos = getMousePositionInImage(e, img);
    const containerRect = document.getElementById('viewer-container').getBoundingClientRect();

    const lensSize = viewerState.magnifierSize;
    const zoom = viewerState.magnifierZoom;

    let lensX = e.clientX - containerRect.left - lensSize / 2;
    let lensY = e.clientY - containerRect.top - lensSize / 2;

    const lensHalf = lensSize / 2;
    const minX = pos.imgRect.left - containerRect.left;
    const maxX = pos.imgRect.right - containerRect.left;
    const minY = pos.imgRect.top - containerRect.top;
    const maxY = pos.imgRect.bottom - containerRect.top;

    lensX = Math.max(minX, Math.min(maxX - lensSize, lensX));
    lensY = Math.max(minY, Math.min(maxY - lensSize, lensY));

    const clampX = Math.max(lensHalf / zoom, Math.min(img.naturalWidth - lensHalf / zoom, pos.percentX * img.naturalWidth));
    const clampY = Math.max(lensHalf / zoom, Math.min(img.naturalHeight - lensHalf / zoom, pos.percentY * img.naturalHeight));

    const bgPosX = -(clampX * zoom - lensHalf);
    const bgPosY = -(clampY * zoom - lensHalf);

    const compositeUrl = getWatermarkedCompositeUrl(img);

    lensInner.style.backgroundImage = `url(${compositeUrl})`;
    lensInner.style.backgroundSize = `${img.naturalWidth * zoom}px ${img.naturalHeight * zoom}px`;
    lensInner.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;

    lens.style.left = `${lensX}px`;
    lens.style.top = `${lensY}px`;
    lens.style.width = `${lensSize}px`;
    lens.style.height = `${lensSize}px`;
}

function showMagnifier() {
    const lens = document.getElementById('magnifier-lens');
    if (lens) {
        lens.style.display = 'block';
        viewerState.magnifierActive = true;
    }
}

function hideMagnifier() {
    if (viewerState.magnifierRafId) {
        cancelAnimationFrame(viewerState.magnifierRafId);
        viewerState.magnifierRafId = null;
    }
    const lens = document.getElementById('magnifier-lens');
    if (lens) {
        lens.style.display = 'none';
        viewerState.magnifierActive = false;
    }
}

function resetMagnifier() {
    if (viewerState.magnifierRafId) {
        cancelAnimationFrame(viewerState.magnifierRafId);
        viewerState.magnifierRafId = null;
    }
    viewerState.magnifierActive = false;
    viewerState.magnifierImageLoaded = false;
    const lens = document.getElementById('magnifier-lens');
    const lensInner = document.getElementById('magnifier-lens-inner');
    if (lens) lens.style.display = 'none';
    if (lensInner) {
        lensInner.style.backgroundImage = '';
        lensInner.style.backgroundPosition = '';
    }
}

function initMobileZoomEvents() {
    const flipbookWrapper = document.getElementById('flipbook-wrapper');
    if (!flipbookWrapper) return;

    flipbookWrapper.addEventListener('touchstart', handleMobileTouchStart, { passive: false });
    flipbookWrapper.addEventListener('touchmove', handleMobileTouchMove, { passive: false });
    flipbookWrapper.addEventListener('touchend', handleMobileTouchEnd);
}

function removeMobileZoomEvents() {
    const flipbookWrapper = document.getElementById('flipbook-wrapper');
    if (!flipbookWrapper) return;

    flipbookWrapper.removeEventListener('touchstart', handleMobileTouchStart);
    flipbookWrapper.removeEventListener('touchmove', handleMobileTouchMove);
    flipbookWrapper.removeEventListener('touchend', handleMobileTouchEnd);
}

function getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function handleMobileTouchStart(e) {
    if (!viewerState.magnifierEnabled) return;

    const img = getCurrentPageImage(e.touches[0]);
    if (!img || !img.complete || img.naturalWidth === 0) return;

    if (e.touches.length === 2) {
        e.preventDefault();
        viewerState.isMobileZoomActive = true;
        viewerState.mobilePinchStartDistance = getTouchDistance(e.touches);
        viewerState.mobilePinchStartScale = viewerState.mobileZoomScale;
        viewerState.mobileTouchStartPos = {
            x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            y: (e.touches[0].clientY + e.touches[1].clientY) / 2
        };
        setFlipbookDraggable(false);
    } else if (e.touches.length === 1 && viewerState.mobileZoomScale > 1) {
        e.preventDefault();
        viewerState.isMobileZoomActive = true;
        viewerState.mobileTouchStartPos = {
            x: e.touches[0].clientX - viewerState.mobilePanOffset.x,
            y: e.touches[0].clientY - viewerState.mobilePanOffset.y
        };
        setFlipbookDraggable(false);
    }
}

function handleMobileTouchMove(e) {
    if (!viewerState.magnifierEnabled) return;

    const img = getCurrentPageImage(e.touches[0]);
    if (!img) return;

    if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        viewerState.isMobileZoomActive = true;
        const currentDistance = getTouchDistance(e.touches);
        const scale = (currentDistance / viewerState.mobilePinchStartDistance) * viewerState.mobilePinchStartScale;
        viewerState.mobileZoomScale = Math.max(1, Math.min(4, scale));
        updateMobileZoom(img);
    } else if (e.touches.length === 1 && viewerState.mobileZoomScale > 1) {
        e.preventDefault();
        e.stopPropagation();
        viewerState.isMobileZoomActive = true;
        const imgRect = img.getBoundingClientRect();
        const maxPanX = (viewerState.mobileZoomScale - 1) * imgRect.width / 2;
        const maxPanY = (viewerState.mobileZoomScale - 1) * imgRect.height / 2;

        let newX = e.touches[0].clientX - viewerState.mobileTouchStartPos.x;
        let newY = e.touches[0].clientY - viewerState.mobileTouchStartPos.y;

        newX = Math.max(-maxPanX, Math.min(maxPanX, newX));
        newY = Math.max(-maxPanY, Math.min(maxPanY, newY));

        viewerState.mobilePanOffset = { x: newX, y: newY };
        updateMobileZoom(img);
    }
}

function handleMobileTouchEnd(e) {
    if (!viewerState.magnifierEnabled) return;

    if (e.touches.length === 0) {
        viewerState.isMobileZoomActive = false;
        if (viewerState.mobileZoomScale <= 1) {
            setFlipbookDraggable(true);
        }
    }
}

function updateMobileZoom(img) {
    if (!img) return;
    const scale = viewerState.mobileZoomScale;
    const panX = viewerState.mobilePanOffset.x;
    const panY = viewerState.mobilePanOffset.y;
    const transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    const transition = viewerState.isMobileZoomActive ? 'none' : 'transform 0.3s ease';

    const wrapper = img.closest('.page-image-wrapper');
    if (wrapper) {
        wrapper.style.transform = transform;
        wrapper.style.transformOrigin = 'center center';
        wrapper.style.transition = transition;
    } else {
        img.style.transform = transform;
        img.style.transformOrigin = 'center center';
        img.style.transition = transition;
    }
}

function resetMobileZoom() {
    viewerState.mobileZoomScale = 1;
    viewerState.mobilePanOffset = { x: 0, y: 0 };
    viewerState.isMobileZoomActive = false;

    const wrappers = document.querySelectorAll('#flipbook .page-image-wrapper');
    wrappers.forEach(wrapper => {
        wrapper.style.transform = '';
        wrapper.style.transformOrigin = '';
        wrapper.style.transition = '';
    });

    const images = document.querySelectorAll('#flipbook .page img');
    images.forEach(img => {
        img.style.transform = '';
        img.style.transformOrigin = '';
        img.style.transition = '';
    });

    setFlipbookDraggable(true);
}

function updateMagnifierButtonState() {
    const btn = document.getElementById('btn-toggle-magnifier');
    if (btn) {
        btn.classList.toggle('active', viewerState.magnifierEnabled);
    }
}

window.addEventListener('hashchange', () => {
    if (viewerState.magnifierEnabled) {
        resetMagnifier();
        resetMobileZoom();
        setFlipbookDraggable(true);
    }
    cleanupPageViewTracker();
});
