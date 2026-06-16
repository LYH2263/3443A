let favoritesState = { albums: [], categories: [], page: 1, total: 0, limit: 12, categoryId: '', sort: 'created_at' };

function renderFavoritesPage() {
    return `
        <div class="favorites-page">
            ${renderNavbar('favorites')}
            <div class="favorites-header">
                <h1>&#11088; 我的收藏</h1>
                <p>收藏你喜欢的画册，随时翻阅</p>
            </div>
            <div class="favorites-container">
                <div id="favorites-filter-bar"></div>
                <div id="favorites-list">${renderLoading()}</div>
                <div id="favorites-pagination"></div>
            </div>
            ${renderFooter()}
        </div>
    `;
}

async function initFavoritesPage() {
    try {
        const catRes = await api.public.categories();
        favoritesState.categories = catRes.data || [];
    } catch (e) {}
    renderFavoritesFilterBar();
    loadFavorites();
}

function renderFavoritesFilterBar() {
    const bar = document.getElementById('favorites-filter-bar');
    if (!bar) return;

    let html = '<div class="favorites-filter-bar">';
    html += '<div class="category-filter" style="padding:0;max-width:none;margin:0">';
    html += `<span class="category-chip ${favoritesState.categoryId === '' ? 'active' : ''}" onclick="filterFavoritesCategory('')">全部分类</span>`;
    favoritesState.categories.forEach(cat => {
        html += `<span class="category-chip ${favoritesState.categoryId == cat.id ? 'active' : ''}" onclick="filterFavoritesCategory(${cat.id})">${escapeHtml(cat.name)}</span>`;
    });
    html += '</div>';
    html += `
        <select class="sort-select" onchange="sortFavorites(this.value)">
            <option value="created_at" ${favoritesState.sort === 'created_at' ? 'selected' : ''}>按收藏时间</option>
            <option value="category" ${favoritesState.sort === 'category' ? 'selected' : ''}>按画册分类</option>
        </select>
    `;
    html += '</div>';
    bar.innerHTML = html;
}

function filterFavoritesCategory(id) {
    favoritesState.categoryId = id;
    favoritesState.page = 1;
    renderFavoritesFilterBar();
    loadFavorites();
}

function sortFavorites(sort) {
    favoritesState.sort = sort;
    favoritesState.page = 1;
    loadFavorites();
}

async function loadFavorites() {
    const listEl = document.getElementById('favorites-list');
    const pagEl = document.getElementById('favorites-pagination');
    if (!listEl) return;
    listEl.innerHTML = renderLoading();

    try {
        const params = {
            page: favoritesState.page,
            limit: favoritesState.limit,
            sort: favoritesState.sort,
        };
        if (favoritesState.categoryId !== '') params.category_id = favoritesState.categoryId;

        const res = await api.favorites.list(params);
        favoritesState.albums = res.data.list || [];
        favoritesState.total = res.data.total || 0;

        const albumIds = favoritesState.albums.map(a => a.id);
        albumIds.forEach(id => { favoriteStateMap[id] = true; });

        if (favoritesState.albums.length === 0) {
            listEl.innerHTML = renderEmpty('还没有收藏任何画册', '&#11088;');
            if (pagEl) pagEl.innerHTML = '';
            return;
        }

        let html = '<div class="albums-grid">';
        favoritesState.albums.forEach(album => {
            const coverUrl = album.cover_image_url ? getImageUrl(album.cover_image_url) : getPlaceholderImage();
            const levelBadge = album.min_level > 0
                ? `<span class="album-card-lock">&#128274; 会员专属</span>` : '';
            const pwdBadge = album.has_password
                ? `<span class="badge badge-warning" style="font-size:11px">密码访问</span>` : '';

            const favTime = album.favorited_at ? formatDate(album.favorited_at) : '';

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
                    </div>
                    <div class="favorite-card-actions">
                        <span>收藏于 ${favTime || '--'}</span>
                        <button class="btn btn-sm btn-danger" onclick="quickUnfavorite(event, ${album.id})" style="padding:4px 10px;font-size:12px">
                            &#128465; 取消收藏
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        listEl.innerHTML = html;

        if (pagEl) {
            pagEl.innerHTML = renderPagination(favoritesState.total, favoritesState.page, favoritesState.limit, 'goFavoritesPage');
        }
    } catch (e) {
        listEl.innerHTML = renderEmpty('加载失败，请稍后重试');
    }
}

async function quickUnfavorite(event, albumId) {
    if (event) event.stopPropagation();
    if (!confirm('确定要取消收藏该画册吗？')) return;

    favoriteLoadingSet.add(albumId);
    updateFavoriteButtonUI(albumId);

    try {
        await api.favorites.toggle(albumId);
        favoriteStateMap[albumId] = false;
        showToast('已取消收藏', 'success');
        const idx = favoritesState.albums.findIndex(a => a.id === albumId);
        if (idx !== -1) {
            favoritesState.albums.splice(idx, 1);
            favoritesState.total = Math.max(0, favoritesState.total - 1);
        }
        if (favoritesState.albums.length === 0 && favoritesState.page > 1) {
            favoritesState.page -= 1;
        }
        loadFavorites();
    } catch (e) {
        favoriteStateMap[albumId] = true;
        updateFavoriteButtonUI(albumId);
    } finally {
        favoriteLoadingSet.delete(albumId);
    }
}

function goFavoritesPage(page) {
    favoritesState.page = page;
    loadFavorites();
    window.scrollTo({ top: 400, behavior: 'smooth' });
}
