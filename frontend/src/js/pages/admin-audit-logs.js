let auditState = {
    page: 1,
    limit: 20,
    total: 0,
    list: [],
    meta: null,
    filters: {
        operator_id: '',
        action_type: '',
        target_type: '',
        start_date: '',
        end_date: '',
        keyword: '',
    },
    expandedId: null,
    expandedLog: null,
};

function renderAdminAuditLogs() {
    return renderAdminLayout('audit', `
        <div class="admin-page-header">
            <div>
                <h1>&#128220; 审计日志</h1>
                <p style="font-size:13px;color:var(--gray-500);margin-top:4px">记录管理员和用户的关键操作，支持筛选追溯</p>
            </div>
            <div style="display:flex;gap:8px">
                <button class="btn btn-secondary" onclick="openArchiveModal()">&#128193; 日志归档</button>
                <button class="btn btn-primary" onclick="loadAuditMeta(true);loadAuditLogs()">&#8635; 刷新</button>
            </div>
        </div>

        <div id="audit-stats-bar"></div>

        <div class="card">
            <div class="card-body">
                <div class="filter-bar" style="flex-wrap:wrap;gap:12px">
                    <input type="text" class="form-input" id="audit-keyword" placeholder="搜索操作人/目标名称关键词..."
                        style="flex:1;min-width:200px" value="${escapeHtml(auditState.filters.keyword)}" onkeydown="if(event.key==='Enter')applyAuditFilters()">

                    <select class="form-select" id="audit-operator" style="min-width:140px" onchange="applyAuditFilters()">
                        <option value="">全部操作人</option>
                    </select>

                    <select class="form-select" id="audit-action" style="min-width:120px" onchange="applyAuditFilters()">
                        <option value="">全部动作</option>
                    </select>

                    <select class="form-select" id="audit-target" style="min-width:120px" onchange="applyAuditFilters()">
                        <option value="">全部对象</option>
                    </select>

                    <input type="date" class="form-input" id="audit-start" style="min-width:150px"
                        value="${auditState.filters.start_date}" onchange="applyAuditFilters()">
                    <span style="color:var(--gray-400);align-self:center">至</span>
                    <input type="date" class="form-input" id="audit-end" style="min-width:150px"
                        value="${auditState.filters.end_date}" onchange="applyAuditFilters()">

                    <button class="btn btn-secondary" onclick="resetAuditFilters()">重置</button>
                    <button class="btn btn-primary" onclick="applyAuditFilters()">搜索</button>
                </div>

                <div id="audit-table-container" style="margin-top:16px">${renderLoading()}</div>
                <div id="audit-pagination"></div>
            </div>
        </div>

        <div id="audit-detail-modal"></div>
    `);
}

async function initAdminAuditLogs() {
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.textContent = '审计日志';
    await loadAuditMeta();
    await loadAuditLogs();
}

async function loadAuditMeta(force = false) {
    if (auditState.meta && !force) return;
    try {
        const res = await api.admin.auditLogsMeta();
        auditState.meta = res.data || {};
        renderAuditStats();
        renderAuditFilterOptions();
    } catch (e) {}
}

function renderAuditStats() {
    const bar = document.getElementById('audit-stats-bar');
    if (!bar || !auditState.meta?.stats) return;
    const stats = auditState.meta.stats;
    bar.innerHTML = `
        <div class="stats-row">
            <div class="stat-card">
                <div class="stat-card-icon" style="background:linear-gradient(135deg,#667eea,#764ba2)">&#128202;</div>
                <div class="stat-card-body">
                    <div class="stat-card-label">日志总数</div>
                    <div class="stat-card-value">${stats.total_count ?? 0}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon" style="background:linear-gradient(135deg,#f093fb,#f5576c)">&#128197;</div>
                <div class="stat-card-body">
                    <div class="stat-card-label">今日新增</div>
                    <div class="stat-card-value">${stats.today_count ?? 0}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon" style="background:linear-gradient(135deg,#4facfe,#00f2fe)">&#128198;</div>
                <div class="stat-card-body">
                    <div class="stat-card-label">近7天</div>
                    <div class="stat-card-value">${stats.week_count ?? 0}</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon" style="background:linear-gradient(135deg,#43e97b,#38f9d7)">&#128190;</div>
                <div class="stat-card-body">
                    <div class="stat-card-label">最早记录</div>
                    <div class="stat-card-value" style="font-size:16px">${stats.oldest_date ? formatDate(stats.oldest_date) : '-'}</div>
                </div>
            </div>
        </div>
    `;
}

function renderAuditFilterOptions() {
    if (!auditState.meta) return;

    const operatorSel = document.getElementById('audit-operator');
    if (operatorSel && auditState.meta.operators) {
        const currentVal = auditState.filters.operator_id;
        operatorSel.innerHTML = `<option value="">全部操作人</option>` +
            auditState.meta.operators.map(o => `
                <option value="${o.id}" ${currentVal == o.id ? 'selected' : ''}>${escapeHtml(o.display_name)}${o.role === 'admin' ? ' (管理员)' : ''}</option>
            `).join('');
    }

    const actionSel = document.getElementById('audit-action');
    if (actionSel && auditState.meta.action_types) {
        const currentVal = auditState.filters.action_type;
        actionSel.innerHTML = `<option value="">全部动作</option>` +
            Object.entries(auditState.meta.action_types).map(([k, v]) => `
                <option value="${k}" ${currentVal === k ? 'selected' : ''}>${escapeHtml(v)}</option>
            `).join('');
    }

    const targetSel = document.getElementById('audit-target');
    if (targetSel && auditState.meta.target_types) {
        const currentVal = auditState.filters.target_type;
        targetSel.innerHTML = `<option value="">全部对象</option>` +
            Object.entries(auditState.meta.target_types).map(([k, v]) => `
                <option value="${k}" ${currentVal === k ? 'selected' : ''}>${escapeHtml(v)}</option>
            `).join('');
    }
}

function applyAuditFilters() {
    auditState.filters.keyword = (document.getElementById('audit-keyword')?.value || '').trim();
    auditState.filters.operator_id = document.getElementById('audit-operator')?.value || '';
    auditState.filters.action_type = document.getElementById('audit-action')?.value || '';
    auditState.filters.target_type = document.getElementById('audit-target')?.value || '';
    auditState.filters.start_date = document.getElementById('audit-start')?.value || '';
    auditState.filters.end_date = document.getElementById('audit-end')?.value || '';
    auditState.page = 1;
    loadAuditLogs();
}

function resetAuditFilters() {
    auditState.filters = {
        operator_id: '',
        action_type: '',
        target_type: '',
        start_date: '',
        end_date: '',
        keyword: '',
    };
    auditState.page = 1;
    ['audit-keyword', 'audit-operator', 'audit-action', 'audit-target', 'audit-start', 'audit-end'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderAuditFilterOptions();
    loadAuditLogs();
}

async function loadAuditLogs() {
    const container = document.getElementById('audit-table-container');
    if (!container) return;
    container.innerHTML = renderLoading();

    try {
        const params = { page: auditState.page, limit: auditState.limit };
        if (auditState.filters.operator_id) params.operator_id = auditState.filters.operator_id;
        if (auditState.filters.action_type) params.action_type = auditState.filters.action_type;
        if (auditState.filters.target_type) params.target_type = auditState.filters.target_type;
        if (auditState.filters.start_date) params.start_date = auditState.filters.start_date;
        if (auditState.filters.end_date) params.end_date = auditState.filters.end_date;
        if (auditState.filters.keyword) params.keyword = auditState.filters.keyword;

        const res = await api.admin.auditLogs(params);
        auditState.list = res.data.list || [];
        auditState.total = res.data.total || 0;

        if (auditState.list.length === 0) {
            container.innerHTML = renderEmpty('暂无审计日志');
            document.getElementById('audit-pagination').innerHTML = '';
            return;
        }

        renderAuditTable();

        const pagEl = document.getElementById('audit-pagination');
        if (pagEl) pagEl.innerHTML = renderPagination(auditState.total, auditState.page, auditState.limit, 'goAuditPage');
    } catch (e) {
        container.innerHTML = renderEmpty('加载失败');
    }
}

function renderAuditTable() {
    const container = document.getElementById('audit-table-container');
    if (!container) return;

    let html = `
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width:60px">ID</th>
                        <th>操作人</th>
                        <th>动作</th>
                        <th>对象</th>
                        <th>目标名称</th>
                        <th>IP</th>
                        <th>时间</th>
                        <th style="width:80px">操作</th>
                    </tr>
                </thead>
                <tbody>
    `;

    auditState.list.forEach(log => {
        const expanded = auditState.expandedId === log.id;
        const actionBadge = getActionBadge(log.action_type);
        const roleBadge = log.operator_role === 'admin'
            ? '<span class="badge badge-primary" style="font-size:11px;padding:1px 6px">管理员</span>'
            : log.operator_role === 'user'
                ? '<span class="badge badge-info" style="font-size:11px;padding:1px 6px">用户</span>'
                : '';
        const opName = log.operator_name ? escapeHtml(log.operator_name) : '<span style="color:var(--gray-400)">访客</span>';
        const targetName = log.target_name ? escapeHtml(log.target_name) : '<span style="color:var(--gray-400)">-</span>';

        html += `
            <tr style="${expanded ? 'background:var(--gray-50)' : ''}">
                <td style="font-family:monospace;font-size:12px;color:var(--gray-500)">#${log.id}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:6px">
                        ${opName}
                        ${roleBadge}
                    </div>
                </td>
                <td>${actionBadge}</td>
                <td><span class="badge badge-outline" style="font-size:12px">${escapeHtml(log.target_type_text || log.target_type)}</span></td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(log.target_name || '')}">
                    ${targetName}
                    ${log.target_id ? `<div style="font-size:11px;color:var(--gray-400)">ID:${escapeHtml(log.target_id)}</div>` : ''}
                </td>
                <td style="font-family:monospace;font-size:12px">${escapeHtml(log.ip || '-')}</td>
                <td style="font-size:13px;color:var(--gray-600)">${formatDateTime(log.created_at)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-sm btn-secondary" onclick="toggleAuditDetail(${log.id})" title="查看详情">
                            ${expanded ? '&#9650;' : '&#9660;'}
                        </button>
                    </div>
                </td>
            </tr>
        `;

        if (expanded) {
            const detailHtml = auditState.expandedLog ? renderAuditDetail(auditState.expandedLog) : renderLoading();
            html += `<tr><td colspan="8" style="padding:0">${detailHtml}</td></tr>`;
        }
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function getActionBadge(type) {
    const colors = {
        create:   'badge-success',
        update:   'badge-warning',
        delete:   'badge-danger',
        login:    'badge-primary',
        logout:   'badge-outline',
        qrcode:   'badge-info',
        snapshot: 'badge-outline',
        rollback: 'badge-warning',
        other:    'badge-outline',
    };
    const labelMap = auditState.meta?.action_types || {};
    const label = labelMap[type] || type;
    const cls = colors[type] || 'badge-outline';
    return `<span class="badge ${cls}" style="font-size:12px">${escapeHtml(label)}</span>`;
}

async function toggleAuditDetail(id) {
    if (auditState.expandedId === id) {
        auditState.expandedId = null;
        auditState.expandedLog = null;
        renderAuditTable();
        return;
    }
    auditState.expandedId = id;
    auditState.expandedLog = null;
    renderAuditTable();
    try {
        const res = await api.admin.auditLogDetail(id);
        auditState.expandedLog = res.data;
        renderAuditTable();
    } catch (e) {
        auditState.expandedId = null;
    }
}

function renderAuditDetail(log) {
    let changesHtml = '';
    if (log.changes && log.changes.length > 0) {
        changesHtml = `
            <div style="padding:16px;border-top:1px solid var(--gray-200);background:#fafafa">
                <h4 style="margin:0 0 12px;font-size:14px;color:var(--gray-700)">&#128221; 变更详情</h4>
                <div class="table-wrapper">
                    <table class="data-table" style="background:#fff;font-size:13px">
                        <thead>
                            <tr>
                                <th style="width:30%">字段</th>
                                <th style="width:35%">变更前</th>
                                <th style="width:35%">变更后</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${log.changes.map(c => `
                                <tr>
                                    <td style="font-weight:500;color:var(--gray-700)">${escapeHtml(c.label)}</td>
                                    <td style="color:var(--danger)">${formatChangeValue(c.before)}</td>
                                    <td style="color:var(--success)">${formatChangeValue(c.after)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else if (log.change_summary) {
        changesHtml = `
            <div style="padding:16px;border-top:1px solid var(--gray-200);background:#fafafa">
                <h4 style="margin:0 0 12px;font-size:14px;color:var(--gray-700)">&#128221; 附加信息</h4>
                <pre style="background:#fff;padding:12px;border-radius:6px;border:1px solid var(--gray-200);font-size:12px;overflow-x:auto;white-space:pre-wrap">${escapeHtml(JSON.stringify(log.change_summary, null, 2))}</pre>
            </div>
        `;
    } else {
        changesHtml = `
            <div style="padding:16px;border-top:1px solid var(--gray-200);background:#fafafa;color:var(--gray-400);font-size:13px">
                该操作无变更详情
            </div>
        `;
    }

    return `
        <div style="background:#fff">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;padding:16px;border-bottom:1px dashed var(--gray-200)">
                <div>
                    <label style="font-size:12px;color:var(--gray-500)">操作人ID</label>
                    <div style="font-weight:500">${log.operator_id ?? '-'}</div>
                </div>
                <div>
                    <label style="font-size:12px;color:var(--gray-500)">操作角色</label>
                    <div style="font-weight:500">${escapeHtml(log.role_text || log.operator_role || '-')}</div>
                </div>
                <div>
                    <label style="font-size:12px;color:var(--gray-500)">动作类型</label>
                    <div style="font-weight:500">${escapeHtml(log.action_type_text || log.action_type)}</div>
                </div>
                <div>
                    <label style="font-size:12px;color:var(--gray-500)">目标类型</label>
                    <div style="font-weight:500">${escapeHtml(log.target_type_text || log.target_type)}</div>
                </div>
                <div>
                    <label style="font-size:12px;color:var(--gray-500)">目标ID</label>
                    <div style="font-weight:500;font-family:monospace">${escapeHtml(log.target_id || '-')}</div>
                </div>
                <div>
                    <label style="font-size:12px;color:var(--gray-500)">目标名称</label>
                    <div style="font-weight:500">${escapeHtml(log.target_name || '-')}</div>
                </div>
                <div>
                    <label style="font-size:12px;color:var(--gray-500)">操作IP</label>
                    <div style="font-weight:500;font-family:monospace">${escapeHtml(log.ip || '-')}</div>
                </div>
                <div>
                    <label style="font-size:12px;color:var(--gray-500)">操作时间</label>
                    <div style="font-weight:500">${formatDateTime(log.created_at)}</div>
                </div>
            </div>
            ${changesHtml}
        </div>
    `;
}

function formatChangeValue(val) {
    if (val === null || val === undefined) return '<span style="color:var(--gray-400)">(空)</span>';
    if (val === true) return '是';
    if (val === false) return '否';
    if (typeof val === 'object') return escapeHtml(JSON.stringify(val));
    const s = String(val);
    if (s === '') return '<span style="color:var(--gray-400)">(空字符串)</span>';
    if (s.length > 100) return escapeHtml(s.substring(0, 100) + '...');
    return escapeHtml(s);
}

function goAuditPage(page) {
    auditState.page = page;
    loadAuditLogs();
}

function openArchiveModal() {
    const container = document.getElementById('audit-detail-modal');
    container.innerHTML = `
        <div class="modal-overlay" onclick="closeAuditModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width:480px">
                <div class="modal-header">
                    <h3>&#128193; 日志归档</h3>
                    <button class="modal-close" onclick="document.getElementById('audit-detail-modal').innerHTML=''">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="color:var(--gray-600);font-size:14px;margin-bottom:16px">
                        将指定天数之前的日志移动到归档表（audit_logs_archive_YYYY_MM），减少主表数据量，提升查询性能。
                    </p>
                    <div class="form-group">
                        <label class="form-label">归档 N 天之前的日志</label>
                        <input type="number" class="form-input" id="archive-days" value="90" min="30" max="3650">
                        <p style="font-size:12px;color:var(--gray-400);margin-top:4px">最小值30天，建议定期归档</p>
                    </div>
                    ${auditState.meta?.stats?.total_count ? `
                        <div style="background:var(--gray-50);padding:12px;border-radius:6px;font-size:13px;color:var(--gray-600)">
                            当前主表日志总数：<strong>${auditState.meta.stats.total_count}</strong> 条
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('audit-detail-modal').innerHTML=''">取消</button>
                    <button class="btn btn-primary" id="archive-btn" onclick="executeArchive()">执行归档</button>
                </div>
            </div>
        </div>
    `;
}

async function executeArchive() {
    const days = parseInt(document.getElementById('archive-days').value);
    if (!days || days < 30) {
        showToast('归档天数至少为30天', 'warning');
        return;
    }
    const btn = document.getElementById('archive-btn');
    btn.disabled = true;
    btn.textContent = '执行中...';
    try {
        const res = await api.admin.auditLogsArchive(days);
        showToast(`归档完成，共处理 ${res.data.archived_count || 0} 条日志`, 'success');
        document.getElementById('audit-detail-modal').innerHTML = '';
        loadAuditMeta(true);
        loadAuditLogs();
    } catch (e) {
    } finally {
        btn.disabled = false;
        btn.textContent = '执行归档';
    }
}

function closeAuditModal(event) {
    if (event.target.classList.contains('modal-overlay')) {
        document.getElementById('audit-detail-modal').innerHTML = '';
    }
}
