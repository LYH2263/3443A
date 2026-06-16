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

        const quotaUsageList = d.quota_usage || [];
        const quotaRowsHtml = quotaUsageList.map(q => {
            const progressColor = q.usage_rate >= 90 ? 'var(--danger)' : q.usage_rate >= 60 ? 'var(--warning)' : 'var(--primary)';
            const progressWidth = q.is_unlimited ? 0 : Math.min(q.usage_rate, 100);
            return `
                <tr>
                    <td style="font-weight:500">${escapeHtml(q.level_name)}</td>
                    <td>
                        ${q.is_unlimited
                            ? '<span class="badge badge-success">不限</span>'
                            : `<span class="badge badge-info">${q.daily_quota} 本/天</span>`}
                    </td>
                    <td>${q.user_count || 0}</td>
                    <td>
                        ${q.is_unlimited
                            ? `<strong style="color:var(--success)">${q.today_reads || 0}</strong>`
                            : `<strong style="color:${progressColor}">${q.today_reads || 0}</strong> / ${(q.daily_quota || 0) * (q.user_count || 0)}`}
                    </td>
                    <td style="min-width:180px">
                        ${q.is_unlimited
                            ? '<div style="color:var(--success);font-size:13px">&#9889; 无限额度</div>'
                            : `
                                <div style="display:flex;align-items:center;gap:8px">
                                    <div style="flex:1;height:8px;background:var(--gray-200);border-radius:4px;overflow:hidden">
                                        <div style="height:100%;width:${progressWidth}%;background:${progressColor};border-radius:4px;transition:width .3s"></div>
                                    </div>
                                    <span style="font-size:12px;color:var(--gray-500);min-width:42px;text-align:right">${q.usage_rate}%</span>
                                </div>
                            `}
                    </td>
                </tr>
            `;
        }).join('');

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
                <div class="stat-card" style="grid-column:span 1">
                    <div class="stat-icon yellow" style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff">&#9203;</div>
                    <div class="stat-info">
                        <h3>${d.today_quota_reads || 0}</h3>
                        <p>今日受限阅读</p>
                    </div>
                </div>
            </div>

            <div class="card" style="margin-bottom:24px">
                <div class="card-header">
                    <h2>&#9203; 各等级配额使用率（今日）</h2>
                    <a href="#/admin/levels" class="btn btn-sm btn-secondary">等级管理</a>
                </div>
                <div class="card-body" style="padding:0">
                    <table class="data-table">
                        <thead>
                            <tr><th>会员等级</th><th>每日配额</th><th>用户数</th><th>今日阅读</th><th>使用率</th></tr>
                        </thead>
                        <tbody>
                            ${quotaRowsHtml || '<tr><td colspan="5" style="text-align:center;color:var(--gray-400)">暂无数据</td></tr>'}
                        </tbody>
                    </table>
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
                                <tr><th>标题</th><th>页数</th><th>收藏</th><th>状态</th></tr>
                            </thead>
                            <tbody>
                                ${(d.recent_albums || []).map(a => `
                                    <tr>
                                        <td style="font-weight:500">${escapeHtml(a.title)}</td>
                                        <td>${a.page_count || 0}</td>
                                        <td><span style="color:#D97706">&#11088; ${a.favorite_count || 0}</span></td>
                                        <td>${a.status === 1
                                            ? '<span class="badge badge-success">已发布</span>'
                                            : '<span class="badge badge-gray">草稿</span>'}</td>
                                    </tr>
                                `).join('')}
                                ${(d.recent_albums || []).length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--gray-400)">暂无数据</td></tr>' : ''}
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

            <div class="card" style="margin-top:24px">
                <div class="card-header">
                    <h2>&#11088; 最受欢迎画册 Top5（按收藏数）</h2>
                    <a href="#/admin/albums" class="btn btn-sm btn-secondary">查看全部</a>
                </div>
                <div class="card-body" style="padding:0">
                    <table class="data-table">
                        <thead>
                            <tr><th>排名</th><th>封面</th><th>标题</th><th>收藏数</th></tr>
                        </thead>
                        <tbody>
                            ${(d.top_favorite_albums || []).map((a, i) => {
                                const rankColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
                                const color = rankColors[i] || 'var(--gray-500)';
                                const coverUrl = a.cover_image_url ? getImageUrl(a.cover_image_url) : getPlaceholderImage();
                                return `
                                    <tr>
                                        <td style="font-weight:700;font-size:18px;color:${color};width:60px">#${i + 1}</td>
                                        <td><img src="${coverUrl}" alt="" style="width:50px;height:36px;object-fit:cover;border-radius:4px" onerror="this.src='${getPlaceholderImage()}'"></td>
                                        <td style="font-weight:500">${escapeHtml(a.title)}</td>
                                        <td><strong style="color:#D97706;font-size:16px">&#11088; ${a.favorite_count || 0}</strong></td>
                                    </tr>
                                `;
                            }).join('')}
                            ${(d.top_favorite_albums || []).length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--gray-400)">暂无收藏数据</td></tr>' : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (e) {
        const content = document.getElementById('dashboard-content');
        if (content) content.innerHTML = renderEmpty('仪表盘数据加载失败');
    }
}
