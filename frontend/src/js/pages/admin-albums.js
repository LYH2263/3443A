let albumListState = { page: 1, limit: 10, total: 0, keyword: '', status: '', list: [] };

function renderAdminAlbums() {
    return renderAdminLayout('albums', `
        <div class="admin-page-header">
            <h1>&#128218; 画册管理</h1>
            <a href="#/admin/albums/create" class="btn btn-primary">&#43; 创建画册</a>
        </div>
        <div class="card">
            <div class="card-body">
                <div class="filter-bar">
                    <input type="text" class="form-input" id="album-search" placeholder="搜索画册标题..." 
                        value="${escapeHtml(albumListState.keyword)}" onkeydown="if(event.key==='Enter')searchAdminAlbums()">
                    <select class="form-select" id="album-status-filter" onchange="filterAlbumStatus(this.value)">
                        <option value="">全部状态</option>
                        <option value="1" ${albumListState.status === '1' ? 'selected' : ''}>已发布</option>
                        <option value="0" ${albumListState.status === '0' ? 'selected' : ''}>草稿</option>
                    </select>
                    <button class="btn btn-secondary" onclick="searchAdminAlbums()">搜索</button>
                </div>
                <div id="album-table-container">${renderLoading()}</div>
                <div id="album-pagination"></div>
            </div>
        </div>
    `);
}

async function initAdminAlbums() {
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.textContent = '画册管理';
    loadAdminAlbums();
}

function searchAdminAlbums() {
    const input = document.getElementById('album-search');
    albumListState.keyword = input ? input.value.trim() : '';
    albumListState.page = 1;
    loadAdminAlbums();
}

function filterAlbumStatus(val) {
    albumListState.status = val;
    albumListState.page = 1;
    loadAdminAlbums();
}

async function loadAdminAlbums() {
    const container = document.getElementById('album-table-container');
    if (!container) return;
    container.innerHTML = renderLoading();

    try {
        const params = { page: albumListState.page, limit: albumListState.limit };
        if (albumListState.keyword) params.keyword = albumListState.keyword;
        if (albumListState.status !== '') params.status = albumListState.status;

        const res = await api.admin.albums(params);
        albumListState.list = res.data.list || [];
        albumListState.total = res.data.total || 0;

        if (albumListState.list.length === 0) {
            container.innerHTML = renderEmpty('暂无画册');
            document.getElementById('album-pagination').innerHTML = '';
            return;
        }

        let html = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>封面</th>
                            <th>标题</th>
                            <th>分类</th>
                            <th>页数</th>
                            <th>等级要求</th>
                            <th>浏览量</th>
                            <th>收藏数</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        albumListState.list.forEach(album => {
            const coverUrl = album.cover_image_url ? getImageUrl(album.cover_image_url) : getPlaceholderImage();
            html += `
                <tr>
                    <td><img src="${coverUrl}" alt="" style="width:60px;height:40px;object-fit:cover;border-radius:4px" onerror="this.src='${getPlaceholderImage()}'"></td>
                    <td style="font-weight:500;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(album.title)}</td>
                    <td>${album.category ? escapeHtml(album.category.name) : '<span style="color:var(--gray-400)">未分类</span>'}</td>
                    <td>${album.page_count || 0}</td>
                    <td>${album.min_level > 0 ? `<span class="badge badge-warning">等级${album.min_level}</span>` : '<span class="badge badge-gray">公开</span>'}</td>
                    <td>${album.view_count || 0}</td>
                    <td><span style="color:#D97706;font-weight:500">&#11088; ${album.favorite_count || 0}</span></td>
                    <td>${album.status === 1 ? '<span class="badge badge-success">已发布</span>' : '<span class="badge badge-gray">草稿</span>'}</td>
                    <td>
                        <div class="table-actions">
                            <a href="#/admin/albums/edit/${album.id}" class="btn btn-sm btn-secondary" title="编辑">&#9998;</a>
                            <button class="btn btn-sm btn-secondary" onclick="previewAlbum(${album.id})" title="预览">&#128065;</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteAdminAlbum(${album.id},'${escapeHtml(album.title)}')" title="删除">&#128465;</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        const pagEl = document.getElementById('album-pagination');
        if (pagEl) {
            pagEl.innerHTML = renderPagination(albumListState.total, albumListState.page, albumListState.limit, 'goAlbumPage');
        }
    } catch (e) {
        container.innerHTML = renderEmpty('加载失败');
    }
}

function goAlbumPage(page) {
    albumListState.page = page;
    loadAdminAlbums();
}

function previewAlbum(id) {
    window.open(`#/viewer/${id}`, '_blank');
}

function deleteAdminAlbum(id, title) {
    showConfirmModal('删除画册', `确定要删除画册「${escapeHtml(title)}」吗？此操作不可恢复。`, async () => {
        try {
            await api.admin.deleteAlbum(id);
            showToast('画册删除成功', 'success');
            loadAdminAlbums();
        } catch (e) {}
    });
}
