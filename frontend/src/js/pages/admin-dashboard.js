function renderAdminDashboard() {
    return renderAdminLayout('dashboard', `
        <div class="admin-page-header">
            <h1>&#128202; 仪表盘</h1>
        </div>
        <div id="dashboard-content">${renderLoading()}</div>
    `);
}

async function initAdminDashboard() {
    const titleEl = document.getElementById('admin-page-title');
    if (titleEl) titleEl.textContent = '仪表盘';

    try {
        const res = await api.admin.dashboard();
        const d = res.data;
        const content = document.getElementById('dashboard-content');
        if (!content) return;

        content.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-icon blue">&#128218;</div>
                    <div class="stat-info">
                        <h3>${d.album_count || 0}</h3>
                        <p>画册总数</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon green">&#10004;</div>
                    <div class="stat-info">
                        <h3>${d.published_count || 0}</h3>
                        <p>已发布</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon purple">&#128196;</div>
                    <div class="stat-info">
                        <h3>${d.page_count || 0}</h3>
                        <p>总页面数</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon orange">&#128101;</div>
                    <div class="stat-info">
                        <h3>${d.user_count || 0}</h3>
                        <p>注册用户</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon pink">&#128065;</div>
                    <div class="stat-info">
                        <h3>${d.total_views || 0}</h3>
                        <p>总浏览量</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon cyan">&#128197;</div>
                    <div class="stat-info">
                        <h3>${d.today_views || 0}</h3>
                        <p>今日浏览</p>
                    </div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:24px">
                <div class="card">
                    <div class="card-header">
                        <h2>&#128218; 最近画册</h2>
                        <a href="#/admin/albums" class="btn btn-sm btn-secondary">查看全部</a>
                    </div>
                    <div class="card-body" style="padding:0">
                        <table class="data-table">
                            <thead>
                                <tr><th>标题</th><th>页数</th><th>状态</th></tr>
                            </thead>
                            <tbody>
                                ${(d.recent_albums || []).map(a => `
                                    <tr>
                                        <td style="font-weight:500">${escapeHtml(a.title)}</td>
                                        <td>${a.page_count || 0}</td>
                                        <td>${a.status === 1
                                            ? '<span class="badge badge-success">已发布</span>'
                                            : '<span class="badge badge-gray">草稿</span>'}</td>
                                    </tr>
                                `).join('')}
                                ${(d.recent_albums || []).length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--gray-400)">暂无数据</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h2>&#128101; 最近用户</h2>
                        <a href="#/admin/users" class="btn btn-sm btn-secondary">查看全部</a>
                    </div>
                    <div class="card-body" style="padding:0">
                        <table class="data-table">
                            <thead>
                                <tr><th>用户名</th><th>角色</th><th>注册时间</th></tr>
                            </thead>
                            <tbody>
                                ${(d.recent_users || []).map(u => `
                                    <tr>
                                        <td style="font-weight:500">${escapeHtml(u.nickname || u.username)}</td>
                                        <td>${u.role === 'admin'
                                            ? '<span class="badge badge-primary">管理员</span>'
                                            : '<span class="badge badge-info">用户</span>'}</td>
                                        <td style="color:var(--gray-500);font-size:13px">${formatDate(u.created_at)}</td>
                                    </tr>
                                `).join('')}
                                ${(d.recent_users || []).length === 0 ? '<tr><td colspan="3" style="text-align:center;color:var(--gray-400)">暂无数据</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        const content = document.getElementById('dashboard-content');
        if (content) content.innerHTML = renderEmpty('仪表盘数据加载失败');
    }
}
