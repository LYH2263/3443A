function renderAdminBackgrounds() {
    return renderAdminLayout('backgrounds', `
        <div class="admin-page-header">
            <h1>&#127756; 背景图管理</h1>
        </div>
        <div class="card" style="margin-bottom:24px">
            <div class="card-header"><h2>上传背景图片</h2></div>
            <div class="card-body">
                ${createUploadArea('bg-lib', 'image/*', true)}
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h2>背景图片库</h2></div>
            <div class="card-body">
                <div id="bg-lib-container">${renderLoading()}</div>
            </div>
        </div>
    `);
}

async function initAdminBackgrounds() {
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.textContent = '背景图管理';
    loadAdminBackgrounds();
}

window['onUploadComplete_bg-lib'] = async function (results) {
    for (const r of results) {
        try {
            await api.admin.addBackground({
                name: r.name || '背景图片',
                path: r.path,
                category: 'default'
            });
        } catch (e) {}
    }
    showToast(`成功添加 ${results.length} 张背景图片`, 'success');
    loadAdminBackgrounds();
};

async function loadAdminBackgrounds() {
    const container = document.getElementById('bg-lib-container');
    if (!container) return;
    container.innerHTML = renderLoading();

    try {
        const res = await api.admin.backgrounds();
        const bgs = res.data || [];

        if (bgs.length === 0) {
            container.innerHTML = renderEmpty('暂无背景图片，请上传添加');
            return;
        }

        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px">';
        bgs.forEach(bg => {
            html += `
                <div style="position:relative;border-radius:var(--radius);overflow:hidden;border:1px solid var(--gray-200);transition:var(--transition)" 
                    onmouseover="this.style.boxShadow='var(--shadow-md)'" onmouseout="this.style.boxShadow='none'">
                    <div style="aspect-ratio:16/10;overflow:hidden;background:var(--gray-100)">
                        <img src="${getImageUrl(bg.url || bg.path)}" alt="${escapeHtml(bg.name)}" 
                            style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--gray-400)\\'>加载失败</div>'">
                    </div>
                    <div style="padding:10px;display:flex;align-items:center;justify-content:space-between">
                        <span style="font-size:13px;color:var(--gray-600);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px">${escapeHtml(bg.name)}</span>
                        <button class="btn btn-sm btn-danger" onclick="deleteBackground(${bg.id},'${escapeHtml(bg.name)}')">&#128465;</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = renderEmpty('加载失败');
    }
}

function deleteBackground(id, name) {
    showConfirmModal('删除背景图', `确定要删除背景图片「${escapeHtml(name)}」吗？`, async () => {
        try {
            await api.admin.deleteBackground(id);
            showToast('背景图片删除成功', 'success');
            loadAdminBackgrounds();
        } catch (e) {}
    });
}
