let userListState = { page: 1, limit: 10, total: 0, keyword: '', role: '', list: [], levels: [] };

function renderAdminUsers() {
    return renderAdminLayout('users', `
        <div class="admin-page-header">
            <h1>&#128101; 用户管理</h1>
            <button class="btn btn-primary" onclick="showUserModal()">&#43; 添加用户</button>
        </div>
        <div class="card">
            <div class="card-body">
                <div class="filter-bar">
                    <input type="text" class="form-input" id="user-search" placeholder="搜索用户名/昵称/邮箱..."
                        value="${escapeHtml(userListState.keyword)}" onkeydown="if(event.key==='Enter')searchAdminUsers()">
                    <select class="form-select" id="user-role-filter" onchange="filterUserRole(this.value)">
                        <option value="">全部角色</option>
                        <option value="admin" ${userListState.role === 'admin' ? 'selected' : ''}>管理员</option>
                        <option value="user" ${userListState.role === 'user' ? 'selected' : ''}>普通用户</option>
                    </select>
                    <button class="btn btn-secondary" onclick="searchAdminUsers()">搜索</button>
                </div>
                <div id="user-table-container">${renderLoading()}</div>
                <div id="user-pagination"></div>
            </div>
        </div>
    `);
}

async function initAdminUsers() {
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.textContent = '用户管理';
    try {
        const levelRes = await api.admin.levels();
        userListState.levels = levelRes.data || [];
    } catch (e) {}
    loadAdminUsers();
}

function searchAdminUsers() {
    const input = document.getElementById('user-search');
    userListState.keyword = input ? input.value.trim() : '';
    userListState.page = 1;
    loadAdminUsers();
}

function filterUserRole(val) {
    userListState.role = val;
    userListState.page = 1;
    loadAdminUsers();
}

async function loadAdminUsers() {
    const container = document.getElementById('user-table-container');
    if (!container) return;
    container.innerHTML = renderLoading();

    try {
        const params = { page: userListState.page, limit: userListState.limit };
        if (userListState.keyword) params.keyword = userListState.keyword;
        if (userListState.role) params.role = userListState.role;

        const res = await api.admin.users(params);
        userListState.list = res.data.list || [];
        userListState.total = res.data.total || 0;

        if (userListState.list.length === 0) {
            container.innerHTML = renderEmpty('暂无用户');
            document.getElementById('user-pagination').innerHTML = '';
            return;
        }

        const currentUser = getUser();
        let html = `
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>用户名</th><th>昵称</th><th>邮箱</th><th>角色</th><th>会员等级</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead>
                    <tbody>
        `;

        userListState.list.forEach(u => {
            const isSelf = currentUser && currentUser.id === u.id;
            html += `
                <tr>
                    <td style="font-weight:500">${escapeHtml(u.username)}</td>
                    <td>${escapeHtml(u.nickname || '-')}</td>
                    <td style="font-size:13px;color:var(--gray-500)">${escapeHtml(u.email || '-')}</td>
                    <td>${u.role === 'admin' ? '<span class="badge badge-primary">管理员</span>' : '<span class="badge badge-info">用户</span>'}</td>
                    <td>${u.member_level ? escapeHtml(u.member_level.name) : '-'}</td>
                    <td>${u.status === 1 ? '<span class="badge badge-success">启用</span>' : '<span class="badge badge-danger">禁用</span>'}</td>
                    <td style="font-size:13px;color:var(--gray-500)">${formatDate(u.created_at)}</td>
                    <td>
                        <div class="table-actions">
                            <button class="btn btn-sm btn-secondary" onclick="showUserModal(${u.id})" title="编辑">&#9998;</button>
                            ${isSelf ? '' : `<button class="btn btn-sm btn-danger" onclick="deleteAdminUser(${u.id},'${escapeHtml(u.username)}')" title="删除">&#128465;</button>`}
                        </div>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        const pagEl = document.getElementById('user-pagination');
        if (pagEl) pagEl.innerHTML = renderPagination(userListState.total, userListState.page, userListState.limit, 'goUserPage');
    } catch (e) {
        container.innerHTML = renderEmpty('加载失败');
    }
}

function goUserPage(page) {
    userListState.page = page;
    loadAdminUsers();
}

async function showUserModal(userId) {
    let user = null;
    if (userId) {
        try {
            const res = await api.admin.userDetail(userId);
            user = res.data;
        } catch (e) { return; }
    }

    const currentUser = getUser();
    const isSelf = currentUser && user && currentUser.id === user.id;
    const isEdit = !!user;
    const isDefaultAdmin = user && parseInt(user.id) === 1;

    const container = document.getElementById('modal-container');
    container.innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑用户' : '添加用户'}</h3>
                    <button class="modal-close" onclick="document.getElementById('modal-container').innerHTML=''">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">用户名 <span class="required">*</span></label>
                        <input type="text" class="form-input" id="mu-username" value="${user ? escapeHtml(user.username) : ''}" 
                            placeholder="3-30个字符" ${isEdit ? 'disabled style="background:var(--gray-100)"' : ''}>
                    </div>
                    ${!isEdit ? `
                    <div class="form-group">
                        <label class="form-label">密码 <span class="required">*</span></label>
                        <input type="password" class="form-input" id="mu-password" placeholder="6-30个字符">
                    </div>
                    ` : `
                    <div class="form-group">
                        <label class="form-label">重置密码</label>
                        <input type="password" class="form-input" id="mu-password" placeholder="留空则不修改">
                    </div>
                    `}
                    <div class="form-group">
                        <label class="form-label">昵称</label>
                        <input type="text" class="form-input" id="mu-nickname" value="${user ? escapeHtml(user.nickname || '') : ''}" placeholder="请输入昵称">
                    </div>
                    <div class="form-group">
                        <label class="form-label">邮箱</label>
                        <input type="email" class="form-input" id="mu-email" value="${user ? escapeHtml(user.email || '') : ''}" placeholder="请输入邮箱（选填）">
                    </div>
                    <div class="form-group">
                        <label class="form-label">手机号</label>
                        <input type="tel" class="form-input" id="mu-phone" value="${user ? escapeHtml(user.phone || '') : ''}" placeholder="请输入手机号（选填）">
                    </div>
                    <div class="form-group">
                        <label class="form-label">角色</label>
                        <select class="form-select" id="mu-role" ${isSelf || isDefaultAdmin ? 'disabled style="background:var(--gray-100)"' : ''}>
                            <option value="user" ${user && user.role === 'user' ? 'selected' : ''}>普通用户</option>
                            <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>管理员</option>
                        </select>
                        ${isDefaultAdmin ? '<p style="font-size:12px;color:var(--gray-400);margin-top:4px">默认管理员角色不可变更</p>' : (isSelf ? '<p style="font-size:12px;color:var(--gray-400);margin-top:4px">不能修改自己的角色</p>' : '')}
                    </div>
                    <div class="form-group">
                        <label class="form-label">会员等级</label>
                        <select class="form-select" id="mu-level" ${isDefaultAdmin ? 'disabled style="background:var(--gray-100)"' : ''}>
                            ${userListState.levels.map(l => `<option value="${l.id}" ${user && user.member_level_id == l.id ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}
                        </select>
                        ${isDefaultAdmin ? '<p style="font-size:12px;color:var(--gray-400);margin-top:4px">默认管理员为最高会员等级</p>' : ''}
                    </div>
                    <div class="form-group">
                        <label class="form-label">状态</label>
                        <select class="form-select" id="mu-status" ${isSelf || isDefaultAdmin ? 'disabled style="background:var(--gray-100)"' : ''}>
                            <option value="1" ${!user || user.status === 1 ? 'selected' : ''}>启用</option>
                            <option value="0" ${user && user.status === 0 ? 'selected' : ''}>禁用</option>
                        </select>
                        ${isDefaultAdmin ? '<p style="font-size:12px;color:var(--gray-400);margin-top:4px">默认管理员不可禁用</p>' : (isSelf ? '<p style="font-size:12px;color:var(--gray-400);margin-top:4px">不能禁用自己的账号</p>' : '')}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">取消</button>
                    <button class="btn btn-primary" id="mu-save-btn" onclick="saveUser(${userId || 'null'})">${isEdit ? '保存修改' : '创建用户'}</button>
                </div>
            </div>
        </div>
    `;
}

async function saveUser(userId) {
    const username = document.getElementById('mu-username').value.trim();
    const password = document.getElementById('mu-password').value;
    const nickname = document.getElementById('mu-nickname').value.trim();
    const email = document.getElementById('mu-email').value.trim();
    const phone = document.getElementById('mu-phone').value.trim();
    const role = document.getElementById('mu-role').value;
    const levelId = document.getElementById('mu-level').value;
    const status = document.getElementById('mu-status').value;
    const btn = document.getElementById('mu-save-btn');

    if (!userId && (!username || !password)) {
        showToast('请填写用户名和密码', 'warning');
        return;
    }
    if (email && !validateEmail(email)) {
        showToast('邮箱格式不正确', 'warning');
        return;
    }
    if (phone && !validatePhone(phone)) {
        showToast('手机号格式不正确', 'warning');
        return;
    }

    btn.disabled = true;
    btn.textContent = '保存中...';

    try {
        const data = { nickname, email, phone, role, member_level_id: levelId, status: parseInt(status) };
        if (!userId) {
            data.username = username;
            data.password = password;
            await api.admin.createUser(data);
            showToast('用户创建成功', 'success');
        } else {
            if (password) data.password = password;
            await api.admin.updateUser(userId, data);
            showToast('用户更新成功', 'success');
        }
        document.getElementById('modal-container').innerHTML = '';
        loadAdminUsers();
    } catch (e) {
    } finally {
        btn.disabled = false;
        btn.textContent = userId ? '保存修改' : '创建用户';
    }
}

function deleteAdminUser(id, username) {
    showConfirmModal('删除用户', `确定要删除用户「${escapeHtml(username)}」吗？此操作不可恢复。`, async () => {
        try {
            await api.admin.deleteUser(id);
            showToast('用户删除成功', 'success');
            loadAdminUsers();
        } catch (e) {}
    });
}
