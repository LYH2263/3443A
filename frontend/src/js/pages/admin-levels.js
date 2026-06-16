function renderAdminLevels() {
    return renderAdminLayout('levels', `
        <div class="admin-page-header">
            <h1>&#127942; 会员等级管理</h1>
            <button class="btn btn-primary" onclick="showLevelModal()">&#43; 添加等级</button>
        </div>
        <div class="card">
            <div class="card-body">
                <div id="level-table-container">${renderLoading()}</div>
            </div>
        </div>
    `);
}

async function initAdminLevels() {
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.textContent = '会员等级管理';
    loadAdminLevels();
}

async function loadAdminLevels() {
    const container = document.getElementById('level-table-container');
    if (!container) return;
    container.innerHTML = renderLoading();

    try {
        const res = await api.admin.levels();
        const levels = res.data || [];

        if (levels.length === 0) {
            container.innerHTML = renderEmpty('暂无会员等级');
            return;
        }

        let html = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>等级名称</th><th>等级值</th><th>每日配额</th><th>描述</th><th>用户数</th><th>操作</th></tr></thead>
                    <tbody>
        `;

        levels.forEach(l => {
            const quotaText = l.daily_quota > 0 ? `${l.daily_quota} 本/天` : '<span class="badge badge-success">不限</span>';
            html += `
                <tr>
                    <td style="font-weight:500">${escapeHtml(l.name)}</td>
                    <td><span class="badge badge-primary">Level ${l.level}</span></td>
                    <td>${quotaText}</td>
                    <td style="color:var(--gray-500);font-size:13px">${escapeHtml(l.description || '-')}</td>
                    <td>${l.user_count || 0}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-sm btn-secondary" onclick="showLevelModal(${l.id},'${escapeHtml(l.name)}',${l.level},'${escapeHtml(l.description || '')}',${l.daily_quota ?? 0})">&#9998;</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteLevel(${l.id},'${escapeHtml(l.name)}')">&#128465;</button>
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

function showLevelModal(id, name, level, description, dailyQuota) {
    const isEdit = !!id;
    const dailyQuotaVal = isEdit ? (dailyQuota ?? 0) : 0;
    const container = document.getElementById('modal-container');
    container.innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width:440px">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑等级' : '添加等级'}</h3>
                    <button class="modal-close" onclick="document.getElementById('modal-container').innerHTML=''">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">等级名称 <span class="required">*</span></label>
                        <input type="text" class="form-input" id="ml-name" value="${isEdit ? escapeHtml(name) : ''}" placeholder="如：金牌会员">
                    </div>
                    <div class="form-group">
                        <label class="form-label">等级值 <span class="required">*</span></label>
                        <input type="number" class="form-input" id="ml-level" value="${isEdit ? level : ''}" placeholder="数值越大权限越高" min="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">每日可阅读画册数</label>
                        <div style="position:relative">
                            <input type="number" class="form-input" id="ml-daily-quota" value="${dailyQuotaVal}" placeholder="0 表示不限" min="0" style="padding-right:70px">
                            <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--gray-400);font-size:13px;pointer-events:none">本/天</span>
                        </div>
                        <div style="font-size:12px;color:var(--gray-400);margin-top:4px">0 表示不限制阅读数量，管理员及 VIP 等级始终不限</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">描述</label>
                        <textarea class="form-textarea" id="ml-desc" placeholder="等级描述">${isEdit ? escapeHtml(description) : ''}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">取消</button>
                    <button class="btn btn-primary" id="ml-save-btn" onclick="saveLevel(${id || 'null'})">${isEdit ? '保存修改' : '创建等级'}</button>
                </div>
            </div>
        </div>
    `;
}

async function saveLevel(id) {
    const name = document.getElementById('ml-name').value.trim();
    const level = document.getElementById('ml-level').value;
    const description = document.getElementById('ml-desc').value.trim();
    const dailyQuota = document.getElementById('ml-daily-quota').value;
    const btn = document.getElementById('ml-save-btn');

    if (!name) { showToast('请输入等级名称', 'warning'); return; }
    if (level === '' || level === null) { showToast('请输入等级值', 'warning'); return; }

    btn.disabled = true;
    btn.textContent = '保存中...';

    try {
        const data = { name, level: parseInt(level), description, daily_quota: parseInt(dailyQuota || 0) };
        if (id) {
            await api.admin.updateLevel(id, data);
            showToast('等级更新成功', 'success');
        } else {
            await api.admin.createLevel(data);
            showToast('等级创建成功', 'success');
        }
        document.getElementById('modal-container').innerHTML = '';
        loadAdminLevels();
    } catch (e) {
    } finally {
        btn.disabled = false;
        btn.textContent = id ? '保存修改' : '创建等级';
    }
}

function deleteLevel(id, name) {
    showConfirmModal('删除等级', `确定要删除会员等级「${escapeHtml(name)}」吗？`, async () => {
        try {
            await api.admin.deleteLevel(id);
            showToast('等级删除成功', 'success');
            loadAdminLevels();
        } catch (e) {}
    });
}
