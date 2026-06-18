let editAlbumState = {
    album: null, categories: [], levels: [], backgrounds: [], pages: [], isNew: true,
    activeTab: 'basic',
    heatmapData: null,
    heatmapLoading: false,
};

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
                sort_order: 0,
                watermark_enabled: 0, watermark_text: '', watermark_opacity: 0.15,
                watermark_density: 3, watermark_color: '#000000'
            };
            editAlbumState.pages = [];
        }

        renderAlbumEditForm(id);
        if (editAlbumState.album.watermark_enabled) {
            setTimeout(() => initWatermarkPreview(), 100);
        }
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

    const tabs = id ? [
        { key: 'basic', label: '基本信息', icon: '&#9998;' },
        { key: 'heatmap', label: '阅读热力图', icon: '&#128293;' },
    ] : [
        { key: 'basic', label: '基本信息', icon: '&#9998;' },
    ];

    container.innerHTML = `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:24px">
            <div>
                ${id ? `
                <div class="tabs" style="margin-bottom:16px">
                    ${tabs.map(t => `
                        <button class="tab-btn ${editAlbumState.activeTab === t.key ? 'active' : ''}" onclick="switchEditTab('${t.key}', ${id})">
                            ${t.icon} ${t.label}
                        </button>
                    `).join('')}
                </div>
                ` : ''}

                <div id="tab-basic" style="${editAlbumState.activeTab === 'basic' ? '' : 'display:none'}">
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
                                ${id ? `
                                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:4px">
                                    <div class="form-group" style="margin-bottom:0">
                                        <label class="form-label">浏览量</label>
                                        <div style="padding:10px 14px;background:var(--gray-50);border-radius:var(--radius);color:var(--gray-700);font-weight:500">
                                            &#128065; ${a.view_count || 0} 次浏览
                                        </div>
                                    </div>
                                    <div class="form-group" style="margin-bottom:0">
                                        <label class="form-label">收藏数</label>
                                        <div style="padding:10px 14px;background:var(--gray-50);border-radius:var(--radius);color:#D97706;font-weight:500">
                                            &#11088; ${a.favorite_count || 0} 人收藏
                                        </div>
                                    </div>
                                </div>
                                ` : ''}
                            </form>
                        </div>
                    </div>

                    <div class="card" style="margin-bottom:24px">
                        <div class="card-header">
                            <h2>水印设置</h2>
                            <label class="switch-label">
                                <input type="checkbox" id="watermark-enabled" ${a.watermark_enabled ? 'checked' : ''} onchange="toggleWatermarkSettings()">
                                <span class="switch-slider"></span>
                                <span style="margin-left:8px;font-size:13px;font-weight:400">启用水印</span>
                            </label>
                        </div>
                        <div class="card-body" id="watermark-settings" style="${a.watermark_enabled ? '' : 'display:none'}">
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                                <div class="form-group">
                                    <label class="form-label">水印文字</label>
                                    <input type="text" class="form-input" id="watermark-text" value="${escapeHtml(a.watermark_text || '')}" placeholder="支持{用户名} {日期} {IP后两段}" oninput="updateWatermarkPreview()">
                                    <p style="font-size:12px;color:var(--gray-400);margin-top:4px">可用占位符: {'{'}用户名{'}'} {'{'}日期{'}'} {'{'}IP后两段{'}'}</p>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">水印颜色</label>
                                    <div style="display:flex;gap:8px;align-items:center">
                                        <input type="color" id="watermark-color" value="${a.watermark_color || '#000000'}" oninput="updateWatermarkPreview()" style="width:40px;height:38px;border:1px solid var(--gray-300);border-radius:var(--radius);cursor:pointer;background:none">
                                        <input type="text" class="form-input" id="watermark-color-text" value="${a.watermark_color || '#000000'}" oninput="syncWatermarkColor()" style="flex:1">
                                    </div>
                                </div>
                            </div>
                            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                                <div class="form-group">
                                    <label class="form-label">透明度: <span id="opacity-value">${Math.round((a.watermark_opacity || 0.15) * 100)}%</span></label>
                                    <input type="range" id="watermark-opacity" min="5" max="50" value="${Math.round((a.watermark_opacity || 0.15) * 100)}" oninput="updateOpacityLabel();updateWatermarkPreview()" style="width:100%">
                                </div>
                                <div class="form-group">
                                    <label class="form-label">平铺密度</label>
                                    <select class="form-select" id="watermark-density" onchange="updateWatermarkPreview()">
                                        <option value="1" ${a.watermark_density == 1 ? 'selected' : ''}>稀疏</option>
                                        <option value="2" ${a.watermark_density == 2 ? 'selected' : ''}>较稀</option>
                                        <option value="3" ${a.watermark_density == 3 ? 'selected' : ''}>适中</option>
                                        <option value="4" ${a.watermark_density == 4 ? 'selected' : ''}>较密</option>
                                        <option value="5" ${a.watermark_density == 5 ? 'selected' : ''}>密集</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">实时预览</label>
                                <div class="watermark-preview-box">
                                    <canvas id="watermark-preview-canvas" width="400" height="280"></canvas>
                                </div>
                            </div>
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

                <div id="tab-heatmap" style="${editAlbumState.activeTab === 'heatmap' ? '' : 'display:none'}">
                    ${renderHeatmapTab(id)}
                </div>
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
                        ${id ? `
                            <button class="btn btn-outline-secondary" onclick="openHistoryDrawer()" style="width:100%;margin-bottom:12px">
                                &#128197; 历史版本
                            </button>
                        ` : ''}
                        <button class="btn btn-primary btn-lg" onclick="saveAlbum(${id || 'null'})" style="width:100%" id="save-album-btn">
                            ${id ? '&#128190; 保存修改' : '&#43; 创建画册'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function switchEditTab(tabKey, albumId) {
    editAlbumState.activeTab = tabKey;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.textContent.includes(tabKey === 'basic' ? '基本信息' : '阅读热力图')) {
            btn.classList.add('active');
        }
    });

    document.getElementById('tab-basic').style.display = tabKey === 'basic' ? '' : 'none';
    document.getElementById('tab-heatmap').style.display = tabKey === 'heatmap' ? '' : 'none';

    if (tabKey === 'heatmap') {
        loadHeatmapData(albumId);
    }
}

function renderHeatmapTab(albumId) {
    if (!editAlbumState.heatmapData && !editAlbumState.heatmapLoading) {
        setTimeout(() => loadHeatmapData(albumId), 50);
    }

    if (editAlbumState.heatmapLoading) {
        return `
            <div class="card">
                <div class="card-header">
                    <h2>&#128293; 阅读热力图</h2>
                </div>
                <div class="card-body">
                    ${renderLoading()}
                </div>
            </div>
        `;
    }

    const data = editAlbumState.heatmapData;
    if (!data) {
        return `
            <div class="card">
                <div class="card-header">
                    <h2>&#128293; 阅读热力图</h2>
                </div>
                <div class="card-body">
                    ${renderEmpty('数据加载失败')}
                </div>
            </div>
        `;
    }

    const stats = data.stats || [];
    const totalPages = data.total_pages || 0;
    const pages = editAlbumState.pages || [];

    if (totalPages === 0 || pages.length === 0) {
        return `
            <div class="card">
                <div class="card-header">
                    <h2>&#128293; 阅读热力图</h2>
                </div>
                <div class="card-body">
                    ${renderEmpty('该画册暂无页面，无法展示阅读热力图')}
                </div>
            </div>
        `;
    }

    if (stats.length === 0 || stats.every(s => s.total_seconds === 0)) {
        return `
            <div class="card">
                <div class="card-header">
                    <h2>&#128293; 阅读热力图</h2>
                </div>
                <div class="card-body">
                    ${renderEmpty('暂无阅读数据，等待用户阅读后将展示热力图')}
                </div>
            </div>
        `;
    }

    const avgTotal = data.avg_total_seconds || 0;
    const bouncePage = data.bounce_page;
    const maxPage = data.max_seconds_page;

    const formatDuration = (seconds) => {
        if (seconds < 60) return `${seconds.toFixed(1)}秒`;
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(0);
        return `${mins}分${secs}秒`;
    };

    const heatLegend = [
        { level: 0, label: '无数据', color: 'rgba(229, 231, 235, 0.6)' },
        { level: 1, label: '较低', color: 'rgba(34, 197, 94, 0.7)' },
        { level: 2, label: '中等', color: 'rgba(234, 179, 8, 0.7)' },
        { level: 3, label: '较高', color: 'rgba(249, 115, 22, 0.75)' },
        { level: 4, label: '最热', color: 'rgba(239, 68, 68, 0.8)' },
    ];

    return `
        <div class="card" style="margin-bottom:24px">
            <div class="card-header">
                <h2>&#128293; 阅读热力图</h2>
                <div style="font-size:13px;color:var(--gray-500)">
                    ${data.heat_algorithm_note || ''}
                </div>
            </div>
            <div class="card-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
                    <div style="padding:16px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:12px;color:#fff">
                        <div style="font-size:13px;opacity:0.9;margin-bottom:4px">平均每页停留</div>
                        <div style="font-size:24px;font-weight:700">${formatDuration(avgTotal)}</div>
                    </div>
                    ${maxPage ? `
                    <div style="padding:16px;background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);border-radius:12px;color:#fff">
                        <div style="font-size:13px;opacity:0.9;margin-bottom:4px">最受欢迎页</div>
                        <div style="font-size:24px;font-weight:700">第${maxPage.page_number}页</div>
                        <div style="font-size:12px;opacity:0.9;margin-top:4px">平均 ${formatDuration(maxPage.avg_seconds)}</div>
                    </div>
                    ` : ''}
                    ${bouncePage ? `
                    <div style="padding:16px;background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);border-radius:12px;color:#fff">
                        <div style="font-size:13px;opacity:0.9;margin-bottom:4px">跳出页（停留最短）</div>
                        <div style="font-size:24px;font-weight:700">第${bouncePage.page_number}页</div>
                        <div style="font-size:12px;opacity:0.9;margin-top:4px">平均 ${formatDuration(bouncePage.avg_seconds)}</div>
                    </div>
                    ` : ''}
                </div>

                <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
                    <span style="font-size:13px;color:var(--gray-600)">热度等级：</span>
                    ${heatLegend.map(h => `
                        <div style="display:flex;align-items:center;gap:6px">
                            <div style="width:20px;height:20px;border-radius:4px;background:${h.color};border:1px solid rgba(0,0,0,0.1)"></div>
                            <span style="font-size:12px;color:var(--gray-600)">${h.label}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="pages-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
                    ${stats.map(stat => {
                        const page = pages.find(p => p.page_number === stat.page_number);
                        const imgSrc = page ? getImageUrl(page.image_url || page.image) : getPlaceholderImage();
                        const isBounce = bouncePage && stat.page_number === bouncePage.page_number;
                        const isMax = maxPage && stat.page_number === maxPage.page_number;

                        return `
                            <div class="heatmap-page-card">
                                <div class="heatmap-page-image">
                                    <img src="${imgSrc}" alt="第${stat.page_number}页" onerror="this.src='${getPlaceholderImage()}'">
                                    <div class="heatmap-overlay" style="background:${stat.heat_color}"></div>
                                    <span class="heatmap-page-number">第${stat.page_number}页</span>
                                    ${isBounce ? '<span class="heatmap-tag bounce-tag">&#8598; 跳出</span>' : ''}
                                    ${isMax ? '<span class="heatmap-tag hot-tag">&#128293; 最热</span>' : ''}
                                </div>
                                <div class="heatmap-page-info">
                                    <div class="heatmap-stat-row">
                                        <span class="heatmap-stat-label">平均停留</span>
                                        <span class="heatmap-stat-value">${formatDuration(stat.avg_seconds)}</span>
                                    </div>
                                    <div class="heatmap-stat-row">
                                        <span class="heatmap-stat-label">累计时长</span>
                                        <span class="heatmap-stat-value">${formatDuration(stat.total_seconds)}</span>
                                    </div>
                                    <div class="heatmap-stat-row">
                                        <span class="heatmap-stat-label">进入次数</span>
                                        <span class="heatmap-stat-value">${stat.entry_count}次</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

async function loadHeatmapData(albumId) {
    if (!albumId) return;

    editAlbumState.heatmapLoading = true;
    const heatmapTab = document.getElementById('tab-heatmap');
    if (heatmapTab) {
        heatmapTab.innerHTML = renderHeatmapTab(albumId);
    }

    try {
        const res = await api.pageView.getStats(albumId);
        editAlbumState.heatmapData = res.data;
    } catch (e) {
        editAlbumState.heatmapData = null;
    } finally {
        editAlbumState.heatmapLoading = false;
        const tab = document.getElementById('tab-heatmap');
        if (tab && editAlbumState.activeTab === 'heatmap') {
            tab.innerHTML = renderHeatmapTab(albumId);
        }
    }
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
        watermark_enabled: document.getElementById('watermark-enabled').checked ? 1 : 0,
        watermark_text: document.getElementById('watermark-text').value.trim(),
        watermark_opacity: parseInt(document.getElementById('watermark-opacity').value) / 100,
        watermark_density: parseInt(document.getElementById('watermark-density').value),
        watermark_color: document.getElementById('watermark-color').value,
    };

    if (window._albumCoverPath) data.cover_image = window._albumCoverPath;
    if (window._albumBgPath) data.background_image = window._albumBgPath;
    if (window._albumLogoPath) data.qrcode_logo = window._albumLogoPath;

    if (id && editAlbumState.album && editAlbumState.album.current_version !== undefined) {
        data.expected_version = editAlbumState.album.current_version;
    }

    try {
        if (id) {
            const res = await api.admin.updateAlbum(id, data, { suppressToast: true });
            if (res.data && res.data.current_version !== undefined) {
                editAlbumState.album.current_version = res.data.current_version;
            }
            showToast('画册更新成功', 'success');
            window._albumCoverPath = null;
            window._albumBgPath = null;
            window._albumLogoPath = null;
            if (document.getElementById('history-drawer')) {
                loadSnapshots(id);
            }
        } else {
            const res = await api.admin.createAlbum(data);
            showToast('画册创建成功', 'success');
            window.location.hash = `#/admin/albums/edit/${res.data.id}`;
        }
    } catch (e) {
        if (e._isBusinessError && e.data && e.data.conflict) {
            showConfirmModal(
                '版本冲突',
                '画册已被其他人修改，您的更改未保存。<br><br>点击"确定"刷新页面获取最新内容（当前编辑内容将丢失），或点击"取消"保留当前编辑。',
                () => {
                    initAdminAlbumEdit(id);
                }
            );
        } else if (e._isBusinessError) {
            showToast(e.message || '保存失败', 'error');
        }
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

function toggleWatermarkSettings() {
    const enabled = document.getElementById('watermark-enabled').checked;
    const settingsEl = document.getElementById('watermark-settings');
    if (enabled) {
        settingsEl.style.display = 'block';
        updateWatermarkPreview();
    } else {
        settingsEl.style.display = 'none';
    }
}

function syncWatermarkColor() {
    const colorText = document.getElementById('watermark-color-text').value;
    if (/^#[0-9A-Fa-f]{6}$/.test(colorText) || /^#[0-9A-Fa-f]{3}$/.test(colorText)) {
        document.getElementById('watermark-color').value = colorText;
        updateWatermarkPreview();
    }
}

function updateOpacityLabel() {
    const opacity = document.getElementById('watermark-opacity').value;
    document.getElementById('opacity-value').textContent = opacity + '%';
}

function updateWatermarkPreview() {
    const canvas = document.getElementById('watermark-preview-canvas');
    if (!canvas) return;

    const rawText = document.getElementById('watermark-text').value || '版权所有';
    const color = document.getElementById('watermark-color').value;
    const opacity = parseInt(document.getElementById('watermark-opacity').value) / 100;
    const density = parseInt(document.getElementById('watermark-density').value);

    const previewViewerInfo = {
        username: '预览用户',
        date: new Date().toISOString().slice(0, 10),
        ip_suffix: '12.34',
    };
    const displayText = resolveWatermarkPlaceholdersGlobal(rawText, previewViewerInfo);

    const rect = canvas.getBoundingClientRect();
    const w = rect.width || 400;
    const h = rect.height || 280;

    const ctx = setupWatermarkCanvas(canvas, w, h);

    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#e0e7ff');
    gradient.addColorStop(1, '#c7d2fe');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#6366f1';
    ctx.font = `bold 16px ${WATERMARK_FONT_FAMILY}`;
    ctx.fillText('预览图', 20, 30);

    drawWatermarkPatternGlobal(ctx, displayText, color, opacity, density, w, h);
}

function initWatermarkPreview() {
    const canvas = document.getElementById('watermark-preview-canvas');
    if (canvas) {
        setTimeout(() => updateWatermarkPreview(), 50);
    }
}

let historyState = {
    snapshots: [],
    selectedSnapshot: null,
    diffSnapshot: null,
    diffData: null,
    viewMode: 'list',
    isLoading: false,
    page: 1,
    limit: 20,
    total: 0,
};

function openHistoryDrawer() {
    const hash = window.location.hash;
    const match = hash.match(/\/admin\/albums\/edit\/(\d+)/);
    if (!match) return;
    const albumId = match[1];

    const drawerHTML = `
        <div class="drawer-overlay" id="history-drawer-overlay" onclick="closeHistoryDrawer()">
        </div>
        <div class="drawer" id="history-drawer">
            <div class="drawer-header">
                <h3>&#128197; 历史版本</h3>
                <button class="btn btn-sm btn-ghost" onclick="closeHistoryDrawer()">&times;</button>
            </div>
            <div class="drawer-body" id="history-drawer-body">
                ${renderLoading()}
            </div>
            <div class="drawer-footer">
                <button class="btn btn-sm btn-secondary" onclick="closeHistoryDrawer()">关闭</button>
                <button class="btn btn-sm btn-primary" onclick="createManualSnapshot()" id="create-snapshot-btn">
                    &#43; 保存当前为版本
                </button>
            </div>
        </div>
    `;

    const oldDrawer = document.getElementById('history-drawer');
    if (oldDrawer) oldDrawer.remove();
    const oldOverlay = document.getElementById('history-drawer-overlay');
    if (oldOverlay) oldOverlay.remove();

    document.body.insertAdjacentHTML('beforeend', drawerHTML);

    setTimeout(() => {
        document.getElementById('history-drawer').classList.add('drawer-open');
        document.getElementById('history-drawer-overlay').classList.add('drawer-overlay-open');
    }, 10);

    loadSnapshots(albumId);
}

function closeHistoryDrawer() {
    const drawer = document.getElementById('history-drawer');
    const overlay = document.getElementById('history-drawer-overlay');
    if (drawer) {
        drawer.classList.remove('drawer-open');
        setTimeout(() => drawer.remove(), 300);
    }
    if (overlay) {
        overlay.classList.remove('drawer-overlay-open');
        setTimeout(() => overlay.remove(), 300);
    }
    historyState.viewMode = 'list';
    historyState.selectedSnapshot = null;
    historyState.diffSnapshot = null;
    historyState.diffData = null;
}

async function loadSnapshots(albumId) {
    historyState.isLoading = true;
    const body = document.getElementById('history-drawer-body');
    if (body) body.innerHTML = renderLoading();

    try {
        const res = await api.admin.snapshots(albumId, { page: historyState.page, limit: historyState.limit });
        historyState.snapshots = res.data.list || [];
        historyState.total = res.data.total || 0;
        historyState.viewMode = 'list';
        renderSnapshotList();
    } catch (e) {
        if (body) body.innerHTML = renderEmpty('加载失败');
    } finally {
        historyState.isLoading = false;
    }
}

function renderSnapshotList() {
    const body = document.getElementById('history-drawer-body');
    if (!body) return;

    const snapshots = historyState.snapshots;

    if (snapshots.length === 0) {
        body.innerHTML = renderEmpty('暂无历史版本');
        return;
    }

    body.innerHTML = `
        <div style="margin-bottom:12px;font-size:13px;color:var(--gray-500)">
            共 ${historyState.total} 个版本，保留最近 20 个
        </div>
        <div class="timeline">
            ${snapshots.map((s, i) => `
                <div class="timeline-item ${i === 0 ? 'timeline-item-latest' : ''}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <span class="timeline-version">v${s.version}</span>
                            ${i === 0 ? '<span class="tag tag-primary">当前</span>' : ''}
                            ${s.remark ? `<span class="timeline-remark">${escapeHtml(s.remark)}</span>` : ''}
                        </div>
                        <div class="timeline-meta">
                            <span>&#128100; ${escapeHtml(s.operator_name || '未知')}</span>
                            <span>&#128190; ${formatDateTime(s.created_at)}</span>
                            <span>&#128221; ${s.page_count} 页</span>
                            <span>&#128202; ${s.size_kb} KB</span>
                        </div>
                        <div class="timeline-actions">
                            <button class="btn btn-xs btn-secondary" onclick="viewSnapshotDiff(${s.id})">
                                &#128260; 查看差异
                            </button>
                            ${i !== 0 ? `
                                <button class="btn btn-xs btn-warning" onclick="confirmRollback(${s.id}, ${s.version})">
                                    &#8634; 回滚到此版本
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function viewSnapshotDiff(snapshotId) {
    const hash = window.location.hash;
    const match = hash.match(/\/admin\/albums\/edit\/(\d+)/);
    if (!match) return;
    const albumId = match[1];

    const snapshots = historyState.snapshots;
    const currentIdx = snapshots.findIndex(s => s.id === snapshotId);
    if (currentIdx < 0 || currentIdx >= snapshots.length - 1) {
        showToast('无法对比差异', 'warning');
        return;
    }

    const prevSnapshotId = snapshots[currentIdx + 1].id;

    const body = document.getElementById('history-drawer-body');
    if (body) body.innerHTML = renderLoading();

    try {
        const res = await api.admin.snapshotDiff(albumId, prevSnapshotId, snapshotId);
        historyState.diffData = res.data;
        historyState.viewMode = 'diff';
        renderDiffView();
    } catch (e) {
        showToast('加载差异失败', 'error');
        historyState.viewMode = 'list';
        renderSnapshotList();
    }
}

function renderDiffView() {
    const body = document.getElementById('history-drawer-body');
    if (!body || !historyState.diffData) return;

    const data = historyState.diffData;
    const albumDiff = data.album_diff || [];
    const pagesDiff = data.pages_diff || {};

    body.innerHTML = `
        <div style="margin-bottom:16px">
            <button class="btn btn-sm btn-ghost" onclick="backToList()">
                &#8592; 返回版本列表
            </button>
        </div>
        <div class="diff-header">
            <div class="diff-version-info">
                <span class="diff-label">旧版本</span>
                <span class="diff-version">v${data.snapshot1.version}</span>
                <span class="diff-date">${formatDateTime(data.snapshot1.created_at)}</span>
            </div>
            <div class="diff-arrow">&#8594;</div>
            <div class="diff-version-info">
                <span class="diff-label diff-label-new">新版本</span>
                <span class="diff-version">v${data.snapshot2.version}</span>
                <span class="diff-date">${formatDateTime(data.snapshot2.created_at)}</span>
            </div>
        </div>

        <div class="diff-section">
            <h4>画册基本信息 (${albumDiff.length} 项变更)</h4>
            ${albumDiff.length === 0 ? '<div style="color:var(--gray-400);font-size:13px">无变更</div>' : ''}
            <div class="diff-fields">
                ${albumDiff.map(item => `
                    <div class="diff-field-item">
                        <div class="diff-field-label">${escapeHtml(item.label)}</div>
                        <div class="diff-field-values">
                            <div class="diff-old-value">${escapeHtml(String(item.old_value || '(空)'))}</div>
                            <div class="diff-arrow">&#8594;</div>
                            <div class="diff-new-value">${escapeHtml(String(item.new_value || '(空)'))}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="diff-section">
            <h4>页面变更 (${pagesDiff.summary || ''})</h4>
            
            ${(pagesDiff.added && pagesDiff.added.length > 0) ? `
                <div class="diff-subsection">
                    <div class="diff-subtitle diff-add-title">&#10133; 新增页面 (${pagesDiff.added.length})</div>
                    <div class="diff-page-list">
                        ${pagesDiff.added.map(p => `
                            <div class="diff-page-item diff-page-added">
                                <span class="diff-page-number">第${p.page_number}页</span>
                                <span class="diff-page-title">${escapeHtml(p.title || '(无标题)')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${(pagesDiff.removed && pagesDiff.removed.length > 0) ? `
                <div class="diff-subsection">
                    <div class="diff-subtitle diff-del-title">&#10134; 删除页面 (${pagesDiff.removed.length})</div>
                    <div class="diff-page-list">
                        ${pagesDiff.removed.map(p => `
                            <div class="diff-page-item diff-page-removed">
                                <span class="diff-page-number">第${p.page_number}页</span>
                                <span class="diff-page-title">${escapeHtml(p.title || '(无标题)')}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${(pagesDiff.modified && pagesDiff.modified.length > 0) ? `
                <div class="diff-subsection">
                    <div class="diff-subtitle diff-mod-title">&#9998; 修改页面 (${pagesDiff.modified.length})</div>
                    <div class="diff-page-list">
                        ${pagesDiff.modified.map(p => `
                            <div class="diff-page-item diff-page-modified">
                                <span class="diff-page-number">第${p.page_number}页</span>
                                <span class="diff-page-title">
                                    ${escapeHtml(p.old_title || '(无)')}
                                    &rarr;
                                    ${escapeHtml(p.new_title || '(无)')}
                                </span>
                                <div class="diff-page-changes">
                                    ${(p.changes || []).map(c => `
                                        <span class="diff-change-tag">${escapeHtml(c.field)}</span>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${(!pagesDiff.added || pagesDiff.added.length === 0) &&
              (!pagesDiff.removed || pagesDiff.removed.length === 0) &&
              (!pagesDiff.modified || pagesDiff.modified.length === 0)
                ? '<div style="color:var(--gray-400);font-size:13px">页面无变更</div>' : ''}
        </div>
    `;
}

function backToList() {
    historyState.viewMode = 'list';
    historyState.diffData = null;
    renderSnapshotList();
}

function confirmRollback(snapshotId, version) {
    showConfirmModal(
        '回滚版本',
        `确定要回滚到版本 v${version} 吗？<br><br>回滚操作会先生成当前状态的快照，然后恢复到目标版本。您可以随时从历史版本中撤销此次回滚。`,
        async () => {
            const hash = window.location.hash;
            const match = hash.match(/\/admin\/albums\/edit\/(\d+)/);
            if (!match) return;
            const albumId = match[1];

            try {
                const res = await api.admin.rollbackSnapshot(albumId, snapshotId);
                showToast('回滚成功', 'success');
                closeHistoryDrawer();
                initAdminAlbumEdit(albumId);
            } catch (e) {}
        }
    );
}

async function createManualSnapshot() {
    const hash = window.location.hash;
    const match = hash.match(/\/admin\/albums\/edit\/(\d+)/);
    if (!match) return;
    const albumId = match[1];

    const btn = document.getElementById('create-snapshot-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '&#8987; 保存中...';
    }

    try {
        const remark = prompt('请输入版本备注（可选）：', '');
        if (remark === null) return;

        const res = await api.admin.createSnapshot(albumId, remark || '手动保存快照');
        showToast('快照创建成功', 'success');
        loadSnapshots(albumId);
        if (editAlbumState.album) {
            editAlbumState.album.current_version = res.data.version;
        }
    } catch (e) {
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '&#43; 保存当前为版本';
        }
    }
}

function formatDateTime(str) {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
