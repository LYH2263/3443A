let homeState = { albums: [], categories: [], page: 1, total: 0, limit: 12, categoryId: '', keyword: '', progressMap: {}, favoriteMap: {} };

function renderHomePage() {
    return `
        <div class="home-page">
            ${renderNavbar('home')}
            <section class="hero-section">
                <div class="hero-content">
                    <h1>精美翻页画册</h1>
                    <p>创建、分享和浏览精美的翻页电子画册，支持多终端自适应浏览</p>
                    <div class="hero-search">
                        <input type="text" id="home-search" placeholder="搜索画册..." value="${escapeHtml(homeState.keyword)}" onkeydown="if(event.key==='Enter')searchAlbums()">
                        <button onclick="searchAlbums()">搜索</button>
                    </div>
                </div>
            </section>
            <div id="category-bar"></div>
            <div class="albums-container">
                <div id="albums-list">${renderLoading()}</div>
                <div id="albums-pagination"></div>
            </div>
            ${renderFooter()}
        </div>
    `;
}

async function initHomePage() {
    loadCurrentQuota().then(q => { if (q) updateNavbarQuota(q); }).catch(() => {});
    try {
        const catRes = await api.public.categories();
        homeState.categories = catRes.data || [];
        renderCategoryBar();
    } catch (e) {}
    loadHomeAlbums();
}

function renderCategoryBar() {
    const bar = document.getElementById('category-bar');
    if (!bar) return;
    let html = '<div class="category-filter">';
    html += `<span class="category-chip ${homeState.categoryId === '' ? 'active' : ''}" onclick="filterCategory('')">全部</span>`;
    homeState.categories.forEach(cat => {
        html += `<span class="category-chip ${homeState.categoryId == cat.id ? 'active' : ''}" onclick="filterCategory(${cat.id})">${escapeHtml(cat.name)}</span>`;
    });
    html += '</div>';
    bar.innerHTML = html;
}

function filterCategory(id) {
    homeState.categoryId = id;
    homeState.page = 1;
    renderCategoryBar();
    loadHomeAlbums();
}

function searchAlbums() {
    const input = document.getElementById('home-search');
    homeState.keyword = input ? input.value.trim() : '';
    homeState.page = 1;
    loadHomeAlbums();
}

async function loadHomeAlbums() {
    const listEl = document.getElementById('albums-list');
    const pagEl = document.getElementById('albums-pagination');
    if (!listEl) return;
    listEl.innerHTML = renderLoading();

    try {
        const params = { page: homeState.page, limit: homeState.limit };
        if (homeState.categoryId) params.category_id = homeState.categoryId;
        if (homeState.keyword) params.keyword = homeState.keyword;

        const res = await api.public.albums(params);
        homeState.albums = res.data.list || [];
        homeState.total = res.data.total || 0;

        if (homeState.albums.length === 0) {
            listEl.innerHTML = renderEmpty('暂无画册', '&#128218;');
            if (pagEl) pagEl.innerHTML = '';
            return;
        }

        const albumIds = homeState.albums.map(a => a.id);
        const currentUserId = getCurrentUserId();
        homeState.progressMap = {};
        homeState.favoriteMap = {};

        console.debug(`[Progress] Loading batch progress for ${albumIds.length} albums, user=${currentUserId}`);

        try {
            if (currentUserId > 0) {
                const [progressRes, favRes] = await Promise.all([
                    api.progress.batch(albumIds),
                    api.favorites.batchCheck(albumIds)
                ]);
                if (progressRes.data) {
                    homeState.progressMap = progressRes.data;
                    console.debug(`[Progress] Loaded ${Object.keys(progressRes.data).length} progress items from cloud for user ${currentUserId}`);
                }
                if (favRes.data && favRes.data.favorites) {
                    homeState.favoriteMap = favRes.data.favorites;
                    Object.assign(favoriteStateMap, favRes.data.favorites);
                }
            } else {
                albumIds.forEach(id => {
                    const lp = getLocalProgress(id, 0);
                    if (lp && lp.total_pages > 0 && !lp.is_completed) {
                        homeState.progressMap[id] = {
                            album_id: id,
                            current_page: lp.current_page,
                            total_pages: lp.total_pages,
                            progress: Math.min(100, Math.round((lp.current_page / lp.total_pages) * 100)),
                            is_completed: lp.is_completed,
                        };
                    }
                });
                console.debug(`[Progress] Loaded ${Object.keys(homeState.progressMap).length} progress items from visitor localStorage`);
            }
        } catch (e) {
            console.error('[Progress] Failed to load batch progress:', e);
        }

        let html = '<div class="albums-grid">';
        const quota = getCachedQuota();
        const isUnlimited = quota && quota.is_unlimited;
        const remaining = quota && quota.remaining != null ? quota.remaining :
                          quota ? Math.max(0, (quota.daily_quota || 0) - (quota.today_count || 0)) : null;

        homeState.albums.forEach(album => {
            const coverUrl = album.cover_image_url ? getImageUrl(album.cover_image_url) : getPlaceholderImage();
            let levelBadge = '';
            if (album.min_level > 0) {
                const minLevel = parseInt(album.min_level);
                let levelText = '会员专属';
                if (minLevel >= 3) levelText = 'VIP专属';
                else if (minLevel === 2) levelText = '金牌及以上';
                else if (minLevel === 1) levelText = '银牌及以上';

                const quotaHint = isUnlimited
                    ? ''
                    : (remaining != null ? ` · 消耗1配额(剩${remaining})` : ' · 消耗1配额');
                levelBadge = `<span class="album-card-lock" title="需${levelText}等级或以上会员方可浏览，且消耗1次每日配额">&#128274; ${levelText}${quotaHint}</span>`;
            }
            const pwdBadge = album.has_password
                ? `<span class="badge badge-warning" style="font-size:11px">密码访问</span>` : '';

            const progress = homeState.progressMap[album.id];
            let progressHtml = '';
            if (progress && !progress.is_completed && progress.current_page > 1) {
                const total = progress.total_pages || album.page_count || 0;
                if (total > 0) {
                    const pct = Math.min(100, Math.round((progress.current_page / total) * 100));
                    progressHtml = `
                        <div class="album-progress-wrap">
                            <div class="album-progress-bar">
                                <div class="album-progress-fill" style="width:${pct}%"></div>
                            </div>
                            <div class="album-progress-text">读至第 ${progress.current_page}/${total} 页 · ${pct}%</div>
                        </div>
                    `;
                }
            }

            html += `
                <div class="album-card" onclick="viewAlbum(${album.id})">
                    <div class="album-card-image">
                        <img src="${coverUrl}" alt="${escapeHtml(album.title)}" onerror="this.src='${getPlaceholderImage()}'">
                        ${levelBadge}
                        <div class="album-card-badge">${pwdBadge}</div>
                        <div class="album-card-favorite">
                            ${renderFavoriteButton(album.id, { size: 'sm' })}
                        </div>
                    </div>
                    <div class="album-card-body">
                        <div class="album-card-title">${escapeHtml(album.title)}</div>
                        <div class="album-card-desc">${escapeHtml(album.description || '暂无描述')}</div>
                        <div class="album-card-meta">
                            <span>&#128196; ${album.page_count || 0} 页</span>
                            <span>&#128065; ${album.view_count || 0} 次浏览</span>
                            <span>&#11088; ${album.favorite_count || 0}</span>
                        </div>
                        ${progressHtml}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        listEl.innerHTML = html;

        if (pagEl) {
            pagEl.innerHTML = renderPagination(homeState.total, homeState.page, homeState.limit, 'goHomePage');
        }
    } catch (e) {
        listEl.innerHTML = renderEmpty('加载失败，请稍后重试');
    }
}

function goHomePage(page) {
    homeState.page = page;
    loadHomeAlbums();
    window.scrollTo({ top: 400, behavior: 'smooth' });
}

function viewAlbum(id) {
    window.location.hash = `#/viewer/${id}`;
}
