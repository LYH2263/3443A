function renderAdminCategories() {
    return renderAdminLayout('categories', `
        <div class="admin-page-header">
            <h1>&#128193; 分类管理</h1>
            <button class="btn btn-primary" onclick="showCategoryModal()">&#43; 添加分类</button>
        </div>
        <div class="card">
            <div class="card-body">
                <div id="cat-table-container">${renderLoading()}</div>
            </div>
        </div>
    `);
}

async function initAdminCategories() {
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.textContent = '分类管理';
    loadAdminCategories();
}

async function loadAdminCategories() {
    const container = document.getElementById('cat-table-container');
    if (!container) return;
    container.innerHTML = renderLoading();

    try {
        const res = await api.admin.categories();
        const categories = res.data || [];

        if (categories.length === 0) {
            container.innerHTML = renderEmpty('暂无分类');
            return;
        }

        let html = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>分类名称</th><th>排序</th><th>画册数</th><th>状态</th><th>操作</th></tr></thead>
                    <tbody>
        `;

        categories.forEach(c => {
            html += `
                <tr>
                    <td style="font-weight:500">${escapeHtml(c.name)}</td>
                    <td>${c.sort_order || 0}</td>
                    <td>${c.album_count || 0}</td>
                    <td>${c.status === 1 ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-gray">禁用</span>'}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-sm btn-secondary" onclick="showCategoryModal(${c.id},'${escapeHtml(c.name)}',${c.sort_order || 0},${c.status})">&#9998;</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id},'${escapeHtml(c.name)}')">&#128465;</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = renderEmpty('加载失败');
    }
}

function showCategoryModal(id, name, sortOrder, status) {
    const isEdit = !!id;
    const container = document.getElementById('modal-container');
    container.innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width:440px">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑分类' : '添加分类'}</h3>
                    <button class="modal-close" onclick="document.getElementById('modal-container').innerHTML=''">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">分类名称 <span class="required">*</span></label>
                        <input type="text" class="form-input" id="mc-name" value="${isEdit ? escapeHtml(name) : ''}" placeholder="如：企业宣传">
                    </div>
                    <div class="form-group">
                        <label class="form-label">排序</label>
                        <input type="number" class="form-input" id="mc-sort" value="${isEdit ? sortOrder : 0}" placeholder="数字越小越靠前" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">状态</label>
                        <select class="form-select" id="mc-status">
                            <option value="1" ${!isEdit || status === 1 ? 'selected' : ''}>启用</option>
                            <option value="0" ${isEdit && status === 0 ? 'selected' : ''}>禁用</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">取消</button>
                    <button class="btn btn-primary" id="mc-save-btn" onclick="saveCategory(${id || 'null'})">${isEdit ? '保存修改' : '创建分类'}</button>
                </div>
            </div>
        </div>
    `;
}

async function saveCategory(id) {
    const name = document.getElementById('mc-name').value.trim();
    const sortOrder = parseInt(document.getElementById('mc-sort').value) || 0;
    const status = parseInt(document.getElementById('mc-status').value);
    const btn = document.getElementById('mc-save-btn');

    if (!name) { showToast('请输入分类名称', 'warning'); return; }

    btn.disabled = true;
    btn.textContent = '保存中...';

    try {
        const data = { name, sort_order: sortOrder, status };
        if (id) {
            await api.admin.updateCategory(id, data);
            showToast('分类更新成功', 'success');
        } else {
            await api.admin.createCategory(data);
            showToast('分类创建成功', 'success');
        }
        document.getElementById('modal-container').innerHTML = '';
        loadAdminCategories();
    } catch (e) {
    } finally {
        btn.disabled = false;
        btn.textContent = id ? '保存修改' : '创建分类';
    }
}

function deleteCategory(id, name) {
    showConfirmModal('删除分类', `确定要删除分类「${escapeHtml(name)}」吗？`, async () => {
        try {
            await api.admin.deleteCategory(id);
            showToast('分类删除成功', 'success');
            loadAdminCategories();
        } catch (e) {}
    });
}
