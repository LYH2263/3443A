let editAlbumState = { album: null, categories: [], levels: [], backgrounds: [], pages: [], isNew: true };

function renderAdminAlbumEdit(id) {
    editAlbumState.isNew = !id;
    return renderAdminLayout('albums', `
        <div class="admin-page-header">
            <h1>${id ? '&#9998; 编辑画册' : '&#43; 创建画册'}</h1>
            <a href="#/admin/albums" class="btn btn-secondary">&#8592; 返回列表</a>
        </div>
        <div id="album-edit-content">${renderLoading()}</div>
    `);
}

async function initAdminAlbumEdit(id) {
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.textContent = id ? '编辑画册' : '创建画册';

    try {
        const [catRes, levelRes, bgRes] = await Promise.all([
            api.admin.categories(),
            api.admin.levels(),
            api.admin.backgrounds()
        ]);
        editAlbumState.categories = catRes.data || [];
        editAlbumState.levels = levelRes.data || [];
        editAlbumState.backgrounds = bgRes.data || [];

        if (id) {
            const albumRes = await api.admin.albumDetail(id);
            editAlbumState.album = albumRes.data;
            editAlbumState.pages = albumRes.data.pages || [];
        } else {
            editAlbumState.album = {
                title: '', description: '', cover_image: '', background_image: '',
                category_id: '', min_level: 0, share_password: '', status: 1,
                qrcode_logo: '', qrcode_text_line1: '', qrcode_text_line2: '',
                sort_order: 0
            };
            editAlbumState.pages = [];
        }

        renderAlbumEditForm(id);
    } catch (e) {
        document.getElementById('album-edit-content').innerHTML = renderEmpty('加载失败');
    }
}

function renderAlbumEditForm(id) {
    const a = editAlbumState.album;
    const container = document.getElementById('album-edit-content');
    if (!container) return;

    const coverPreview = a.cover_image
        ? `<div class="upload-preview"><div class="upload-preview-item"><img src="${getImageUrl(a.cover_image_url || a.cover_image)}" alt="封面" onerror="this.parentElement.style.display='none'"></div></div>`
        : '';
    const bgPreview = a.background_image
        ? `<div class="upload-preview"><div class="upload-preview-item"><img src="${getImageUrl(a.background_image_url || a.background_image)}" alt="背景" onerror="this.parentElement.style.display='none'"></div></div>`
        : '';
    const logoPreview = a.qrcode_logo
        ? `<div class="upload-preview"><div class="upload-preview-item"><img src="${getImageUrl(a.qrcode_logo_url || a.qrcode_logo)}" alt="Logo" onerror="this.parentElement.style.display='none'"></div></div>`
        : '';
    const qrcodePreview = a.qrcode_image_url
        ? `<div style="margin-top:12px"><img src="${getImageUrl(a.qrcode_image_url)}" alt="二维码" style="max-width:200px;border-radius:8px;box-shadow:var(--shadow)"></div>`
        : '';

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px">
            <div>
                <div class="card" style="margin-bottom:24px">
                    <div class="card-header"><h2>基本信息</h2></div>
                    <div class="card-body">
                        <form id="album-form">
                            <div class="form-group">
                                <label class="form-label">画册标题 <span class="required">*</span></label>
                                <input type="text" class="form-input" id="album-title" value="${escapeHtml(a.title)}" placeholder="请输入画册标题" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">画册描述</label>
                                <textarea class="form-textarea" id="album-desc" placeholder="请输入画册描述">${escapeHtml(a.description || '')}</textarea>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                                <div class="form-group">
                                    <label class="form-label">分类</label>
                                    <select class="form-select" id="album-category">
                                        <option value="">请选择分类</option>
                                        ${editAlbumState.categories.map(c => `<option value="${c.id}" ${a.category_id == c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">最低访问等级</label>
                                    <select class="form-select" id="album-min-level">
                                        <option value="0" ${a.min_level == 0 ? 'selected' : ''}>公开（所有人可见）</option>
                                        ${editAlbumState.levels.map(l => `<option value="${l.level}" ${a.min_level == l.level ? 'selected' : ''}>${escapeHtml(l.name)}（等级${l.level}）</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                                <div class="form-group">
                                    <label class="form-label">分享密码</label>
                                    <input type="text" class="form-input" id="album-password" value="${escapeHtml(a.share_password || '')}" placeholder="留空则无密码限制">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">发布状态</label>
                                    <select class="form-select" id="album-status">
                                        <option value="1" ${a.status == 1 ? 'selected' : ''}>已发布</option>
                                        <option value="0" ${a.status == 0 ? 'selected' : ''}>草稿</option>
                                    </select>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="card" style="margin-bottom:24px">
                    <div class="card-header"><h2>封面与背景</h2></div>
                    <div class="card-body">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                            <div>
                                <label class="form-label">封面图片</label>
                                ${createUploadArea('cover')}
                                <div id="cover-preview">${coverPreview}</div>
                            </div>
                            <div>
                                <label class="form-label">背景图片</label>
                                ${createUploadArea('background')}
                                <div id="bg-preview">${bgPreview}</div>
                                ${editAlbumState.backgrounds.length > 0 ? `
                                    <div style="margin-top:16px">
                                        <label class="form-label">或从图库选择背景</label>
                                        <div class="bg-grid">
                                            ${editAlbumState.backgrounds.map(bg => `
                                                <div class="bg-grid-item ${a.background_image === bg.path ? 'selected' : ''}" onclick="selectBackground('${bg.path}','${getImageUrl(bg.url || bg.path)}')">
                                                    <img src="${getImageUrl(bg.url || bg.path)}" alt="${escapeHtml(bg.name)}" onerror="this.parentElement.style.display='none'">
                                                    <div class="bg-check">&#10004;</div>
                                                </div>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                ${id ? `
                <div class="card" style="margin-bottom:24px">
                    <div class="card-header">
                        <h2>画册页面 (${editAlbumState.pages.length})</h2>
                        <div>
                            ${createUploadArea('pages')}
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="pages-grid" id="pages-grid">
                            ${editAlbumState.pages.length === 0 ? renderEmpty('暂无页面，请上传图片添加页面') : ''}
                            ${editAlbumState.pages.map((p, i) => `
                                <div class="page-card" data-id="${p.id}">
                                    <div class="page-card-image">
                                        <img src="${getImageUrl(p.image_url || p.image)}" alt="第${i + 1}页" onerror="this.src='${getPlaceholderImage()}'">
                                        <span class="page-card-number">第${p.page_number}页</span>
                                    </div>
                                    <div class="page-card-actions">
                                        <button class="btn btn-sm btn-danger" onclick="deleteAlbumPage(${id},${p.id})">&#128465; 删除</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>

            <div>
                <div class="card" style="margin-bottom:24px;position:sticky;top:88px">
                    <div class="card-header"><h2>二维码</h2></div>
                    <div class="card-body">
                        <div class="form-group">
                            <label class="form-label">二维码Logo</label>
                            ${createUploadArea('logo')}
                            <div id="logo-preview">${logoPreview}</div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">文字行1</label>
                            <input type="text" class="form-input" id="qr-text1" value="${escapeHtml(a.qrcode_text_line1 || '')}" placeholder="二维码下方第一行文字">
                        </div>
                        <div class="form-group">
                            <label class="form-label">文字行2</label>
                            <input type="text" class="form-input" id="qr-text2" value="${escapeHtml(a.qrcode_text_line2 || '')}" placeholder="二维码下方第二行文字">
                        </div>
                        ${id ? `<button class="btn btn-secondary" onclick="generateQrcode(${id})" style="width:100%;margin-bottom:16px" id="qr-gen-btn">&#128290; 生成二维码</button>` : '<p style="font-size:13px;color:var(--gray-400)">请先保存画册后生成二维码</p>'}
                        <div id="qrcode-preview">${qrcodePreview}</div>
                        <hr style="margin:20px 0;border:none;border-top:1px solid var(--gray-200)">
                        <button class="btn btn-primary btn-lg" onclick="saveAlbum(${id || 'null'})" style="width:100%" id="save-album-btn">
                            ${id ? '&#128190; 保存修改' : '&#43; 创建画册'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window._albumCoverPath = null;
window._albumBgPath = null;
window._albumLogoPath = null;

window.onUploadComplete_cover = function (results) {
    if (results.length > 0) {
        window._albumCoverPath = results[0].path;
        document.getElementById('cover-preview').innerHTML = `
            <div class="upload-preview"><div class="upload-preview-item">
                <img src="${getImageUrl(results[0].url || results[0].path)}" alt="封面">
            </div></div>
        `;
        showToast('封面上传成功', 'success');
    }
};

window.onUploadComplete_background = function (results) {
    if (results.length > 0) {
        window._albumBgPath = results[0].path;
        document.getElementById('bg-preview').innerHTML = `
            <div class="upload-preview"><div class="upload-preview-item">
                <img src="${getImageUrl(results[0].url || results[0].path)}" alt="背景">
            </div></div>
        `;
        showToast('背景上传成功', 'success');
    }
};

window.onUploadComplete_logo = function (results) {
    if (results.length > 0) {
        window._albumLogoPath = results[0].path;
        document.getElementById('logo-preview').innerHTML = `
            <div class="upload-preview"><div class="upload-preview-item">
                <img src="${getImageUrl(results[0].url || results[0].path)}" alt="Logo">
            </div></div>
        `;
        showToast('Logo上传成功', 'success');
    }
};

window.onUploadComplete_pages = function (results) {
    if (results.length > 0) {
        const hash = window.location.hash;
        const match = hash.match(/\/admin\/albums\/edit\/(\d+)/);
        if (!match) return;
        const albumId = match[1];
        addPagesSequentially(albumId, results, 0);
    }
};

async function addPagesSequentially(albumId, results, index) {
    if (index >= results.length) {
        showToast(`成功添加 ${results.length} 个页面`, 'success');
        initAdminAlbumEdit(albumId);
        return;
    }
    try {
        await api.admin.addPage(albumId, { image: results[index].path });
        addPagesSequentially(albumId, results, index + 1);
    } catch (e) {
        showToast(`第 ${index + 1} 个页面添加失败`, 'error');
        addPagesSequentially(albumId, results, index + 1);
    }
}

function selectBackground(path, url) {
    window._albumBgPath = path;
    document.getElementById('bg-preview').innerHTML = `
        <div class="upload-preview"><div class="upload-preview-item">
            <img src="${url}" alt="背景">
        </div></div>
    `;
    document.querySelectorAll('.bg-grid-item').forEach(el => el.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    showToast('背景图片已选择', 'success');
}

async function saveAlbum(id) {
    const title = document.getElementById('album-title').value.trim();
    if (!title) {
        showToast('请输入画册标题', 'warning');
        return;
    }

    const btn = document.getElementById('save-album-btn');
    btn.disabled = true;
    btn.innerHTML = '&#8987; 保存中...';

    const data = {
        title,
        description: document.getElementById('album-desc').value.trim(),
        category_id: document.getElementById('album-category').value || null,
        min_level: parseInt(document.getElementById('album-min-level').value) || 0,
        share_password: document.getElementById('album-password').value.trim(),
        status: parseInt(document.getElementById('album-status').value),
        qrcode_text_line1: document.getElementById('qr-text1').value.trim(),
        qrcode_text_line2: document.getElementById('qr-text2').value.trim(),
    };

    if (window._albumCoverPath) data.cover_image = window._albumCoverPath;
    if (window._albumBgPath) data.background_image = window._albumBgPath;
    if (window._albumLogoPath) data.qrcode_logo = window._albumLogoPath;

    try {
        if (id) {
            await api.admin.updateAlbum(id, data);
            showToast('画册更新成功', 'success');
            window._albumCoverPath = null;
            window._albumBgPath = null;
            window._albumLogoPath = null;
        } else {
            const res = await api.admin.createAlbum(data);
            showToast('画册创建成功', 'success');
            window.location.hash = `#/admin/albums/edit/${res.data.id}`;
        }
    } catch (e) {
    } finally {
        btn.disabled = false;
        btn.innerHTML = id ? '&#128190; 保存修改' : '&#43; 创建画册';
    }
}

async function generateQrcode(albumId) {
    const btn = document.getElementById('qr-gen-btn');
    btn.disabled = true;
    btn.innerHTML = '&#8987; 生成中...';

    try {
        const data = {
            album_id: albumId,
            text_line1: document.getElementById('qr-text1').value.trim(),
            text_line2: document.getElementById('qr-text2').value.trim(),
            frontend_url: window.location.origin,
        };
        if (window._albumLogoPath) data.logo = window._albumLogoPath;
        else if (editAlbumState.album && editAlbumState.album.qrcode_logo) data.logo = editAlbumState.album.qrcode_logo;

        const res = await api.admin.generateQrcode(data);
        document.getElementById('qrcode-preview').innerHTML = `
            <div style="margin-top:12px;text-align:center">
                <img src="${getImageUrl(res.data.url || res.data.path)}" alt="二维码" style="max-width:200px;border-radius:8px;box-shadow:var(--shadow)">
                <p style="margin-top:8px;font-size:13px;color:var(--gray-500)">二维码已生成并保存</p>
            </div>
        `;
        showToast('二维码生成成功', 'success');
    } catch (e) {
    } finally {
        btn.disabled = false;
        btn.innerHTML = '&#128290; 生成二维码';
    }
}

async function deleteAlbumPage(albumId, pageId) {
    showConfirmModal('删除页面', '确定要删除此页面吗？', async () => {
        try {
            await api.admin.deletePage(albumId, pageId);
            showToast('页面删除成功', 'success');
            initAdminAlbumEdit(albumId);
        } catch (e) {}
    });
}
