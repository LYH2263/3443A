let homeState = { albums: [], categories: [], page: 1, total: 0, limit: 12, categoryId: '', keyword: '' };

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

        let html = '<div class="albums-grid">';
        homeState.albums.forEach(album => {
            const coverUrl = album.cover_image_url ? getImageUrl(album.cover_image_url) : getPlaceholderImage();
            const levelBadge = album.min_level > 0
                ? `<span class="album-card-lock">&#128274; 会员专属</span>` : '';
            const pwdBadge = album.has_password
                ? `<span class="badge badge-warning" style="font-size:11px">密码访问</span>` : '';

            html += `
                <div class="album-card" onclick="viewAlbum(${album.id})">
                    <div class="album-card-image">
                        <img src="${coverUrl}" alt="${escapeHtml(album.title)}" onerror="this.src='${getPlaceholderImage()}'">
                        ${levelBadge}
                        <div class="album-card-badge">${pwdBadge}</div>
                    </div>
                    <div class="album-card-body">
                        <div class="album-card-title">${escapeHtml(album.title)}</div>
                        <div class="album-card-desc">${escapeHtml(album.description || '暂无描述')}</div>
                        <div class="album-card-meta">
                            <span>&#128196; ${album.page_count || 0} 页</span>
                            <span>&#128065; ${album.view_count || 0} 次浏览</span>
                        </div>
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
