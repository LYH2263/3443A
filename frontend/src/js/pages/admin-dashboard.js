function renderAdminDashboard() {
    return renderAdminLayout('dashboard', `
        <div class="admin-page-header">
            <h1>&#128202; 仪表盘</h1>
        </div>
        <div id="dashboard-content">${renderLoading()}</div>
    `);
}

function getChinaMapSvg(provinceMap, maxCount) {
    const provincePaths = {
        '北京': 'M490,178 L502,172 L510,168 L518,172 L522,180 L518,190 L508,194 L498,190 Z',
        '天津': 'M522,180 L532,176 L538,182 L536,192 L528,194 L522,190 Z',
        '河北': 'M478,172 L490,168 L502,162 L518,164 L532,168 L538,176 L536,192 L530,200 L520,206 L508,208 L496,206 L484,200 L478,190 Z',
        '山西': 'M462,200 L478,194 L490,200 L496,210 L494,224 L484,232 L472,228 L462,220 L458,210 Z',
        '内蒙古': 'M370,68 L394,58 L420,52 L448,56 L476,60 L504,62 L530,58 L552,64 L564,76 L556,96 L544,112 L530,122 L516,130 L500,136 L486,142 L474,148 L462,156 L454,166 L446,172 L434,168 L420,162 L406,156 L392,148 L380,138 L370,126 L364,112 L362,96 L366,80 Z',
        '辽宁': 'M556,134 L572,128 L586,132 L594,142 L592,156 L584,168 L572,176 L560,180 L550,176 L544,168 L546,156 L550,146 Z',
        '吉林': 'M572,104 L590,98 L606,102 L618,112 L622,126 L618,140 L610,150 L598,156 L586,152 L576,146 L568,136 L566,122 Z',
        '黑龙江': 'M592,44 L614,38 L636,42 L654,52 L666,66 L672,82 L668,100 L660,114 L648,124 L634,130 L620,128 L608,120 L598,110 L590,98 L586,82 L586,66 Z',
        '上海': 'M546,246 L554,242 L560,248 L558,258 L550,262 L544,256 Z',
        '江苏': 'M524,230 L536,224 L546,228 L554,236 L556,248 L554,258 L546,264 L536,262 L528,256 L522,246 Z',
        '浙江': 'M536,262 L548,258 L560,260 L572,266 L576,278 L572,290 L562,296 L550,294 L540,286 L534,274 Z',
        '安徽': 'M516,236 L530,230 L542,232 L548,244 L546,258 L540,270 L530,276 L518,274 L510,264 L508,250 Z',
        '福建': 'M530,286 L544,280 L558,282 L570,290 L574,302 L568,314 L556,320 L542,316 L532,306 L528,296 Z',
        '江西': 'M510,278 L524,272 L538,274 L548,282 L548,296 L542,310 L530,318 L516,314 L506,304 L504,290 Z',
        '山东': 'M506,192 L520,186 L534,188 L544,194 L546,208 L540,220 L530,228 L518,230 L506,226 L496,218 L494,206 Z',
        '河南': 'M484,220 L498,214 L512,218 L522,226 L526,238 L522,250 L512,258 L498,260 L486,254 L478,244 L476,232 Z',
        '湖北': 'M476,260 L490,254 L506,258 L516,264 L520,276 L516,290 L506,296 L492,294 L480,286 L474,274 Z',
        '湖南': 'M486,296 L500,290 L514,292 L522,300 L524,314 L518,326 L506,332 L492,328 L482,318 L478,306 Z',
        '广东': 'M500,330 L516,324 L532,328 L548,334 L556,346 L552,360 L542,370 L528,374 L514,370 L502,362 L494,350 L494,338 Z',
        '广西': 'M464,332 L478,324 L494,328 L504,338 L506,352 L500,364 L490,372 L476,374 L464,368 L456,356 L454,344 Z',
        '海南': 'M498,390 L510,386 L518,394 L516,406 L508,412 L498,408 L494,398 Z',
        '重庆': 'M446,288 L460,282 L474,286 L480,296 L476,308 L466,314 L454,310 L446,300 Z',
        '四川': 'M400,260 L418,254 L436,258 L452,264 L462,274 L466,290 L464,306 L456,320 L444,328 L428,332 L412,328 L398,320 L390,306 L388,290 L392,274 Z',
        '贵州': 'M448,316 L464,310 L478,314 L490,322 L494,336 L490,350 L480,358 L466,360 L454,354 L446,342 L444,328 Z',
        '云南': 'M394,322 L410,316 L428,320 L444,326 L452,340 L454,356 L448,370 L438,382 L424,388 L408,386 L394,378 L384,366 L380,350 L382,336 Z',
        '西藏': 'M220,210 L248,198 L278,192 L310,190 L342,194 L370,202 L392,214 L400,232 L398,254 L392,276 L384,298 L374,318 L360,336 L342,348 L320,356 L296,360 L272,356 L250,346 L232,332 L218,314 L210,294 L206,272 L208,248 L212,228 Z',
        '陕西': 'M438,198 L456,192 L472,198 L484,208 L488,222 L484,238 L476,252 L464,260 L450,264 L438,258 L428,248 L424,234 L426,220 Z',
        '甘肃': 'M350,146 L368,140 L386,144 L402,152 L418,160 L432,170 L442,180 L446,194 L440,210 L432,222 L420,228 L406,232 L392,228 L378,222 L366,214 L356,204 L348,192 L344,178 L346,162 Z',
        '青海': 'M316,196 L338,190 L358,194 L374,202 L386,214 L390,230 L388,250 L382,268 L372,282 L358,292 L342,296 L326,292 L312,284 L302,272 L296,256 L294,240 L298,224 L304,210 Z',
        '宁夏': 'M420,170 L432,164 L442,170 L446,182 L444,194 L438,204 L428,208 L420,202 L416,192 L418,180 Z',
        '新疆': 'M190,62 L220,52 L254,48 L290,50 L324,56 L354,66 L378,80 L394,98 L398,118 L394,140 L386,156 L374,166 L358,172 L340,176 L320,178 L298,176 L276,172 L256,164 L238,154 L222,142 L210,128 L200,112 L194,96 L190,80 Z',
        '台湾': 'M580,284 L588,278 L594,286 L592,300 L586,310 L580,306 L576,294 Z',
        '香港': 'M544,362 L550,358 L554,364 L552,372 L546,374 L542,368 Z',
        '澳门': 'M536,370 L542,366 L544,374 L540,378 L536,376 Z',
    };

    const provinceNames = Object.keys(provincePaths);
    if (provinceNames.length === 0) return '';

    let pathsHtml = '';
    for (const [name, d] of Object.entries(provincePaths)) {
        const count = provinceMap[name] || 0;
        const ratio = maxCount > 0 ? count / maxCount : 0;
        const fillColor = getRegionColor(ratio);
        pathsHtml += `<path class="china-map-path" d="${d}" fill="${fillColor}" stroke="#fff" stroke-width="1.5" data-province="${name}" data-count="${count}"/>`;
    }

    return `<svg viewBox="170 30 520 400" class="china-region-map" xmlns="http://www.w3.org/2000/svg">
        ${pathsHtml}
        <g class="map-tooltip" visibility="hidden">
            <rect x="0" y="0" width="120" height="44" rx="6" fill="rgba(0,0,0,0.8)"/>
            <text x="10" y="18" fill="#fff" font-size="12" class="tooltip-province"></text>
            <text x="10" y="36" fill="#ccc" font-size="11" class="tooltip-count"></text>
        </g>
    </svg>`;
}

function getRegionColor(ratio) {
    if (ratio <= 0) return '#eef2ff';
    const colors = [
        [238, 242, 255],
        [199, 210, 254],
        [165, 180, 252],
        [129, 140, 248],
        [99, 102, 241],
        [79, 70, 229],
        [67, 56, 202],
    ];
    const idx = Math.min(Math.floor(ratio * (colors.length - 1)), colors.length - 2);
    const frac = ratio * (colors.length - 1) - idx;
    const c1 = colors[idx];
    const c2 = colors[idx + 1];
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * frac);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * frac);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * frac);
    return `rgb(${r},${g},${b})`;
}

function initChinaMapInteraction() {
    const svg = document.querySelector('.china-region-map');
    if (!svg) return;

    const tooltip = svg.querySelector('.map-tooltip');
    const tooltipProvince = svg.querySelector('.tooltip-province');
    const tooltipCount = svg.querySelector('.tooltip-count');
    if (!tooltip) return;

    const paths = svg.querySelectorAll('.china-map-path');
    paths.forEach(path => {
        path.addEventListener('mouseenter', (e) => {
            const province = path.getAttribute('data-province');
            const count = path.getAttribute('data-count');
            tooltipProvince.textContent = province;
            tooltipCount.textContent = `访问量: ${count}`;
            tooltip.setAttribute('visibility', 'visible');
            path.style.stroke = '#4F46E5';
            path.style.strokeWidth = '2.5';
        });
        path.addEventListener('mousemove', (e) => {
            const svgRect = svg.getBoundingClientRect();
            const viewBox = svg.viewBox.baseVal;
            const scaleX = viewBox.width / svgRect.width;
            const scaleY = viewBox.height / svgRect.height;
            const x = (e.clientX - svgRect.left) * scaleX + viewBox.x;
            const y = (e.clientY - svgRect.top) * scaleY + viewBox.y;
            tooltip.setAttribute('transform', `translate(${x + 10}, ${y - 30})`);
        });
        path.addEventListener('mouseleave', () => {
            tooltip.setAttribute('visibility', 'hidden');
            path.style.stroke = '#fff';
            path.style.strokeWidth = '1.5';
        });
    });
}

async function loadRegionStats(range) {
    try {
        const res = await api.admin.regionStats(range);
        const d = res.data;
        const container = document.getElementById('region-stats-container');
        if (!container) return;

        const top10 = d.top10 || [];
        const provinceMap = d.province_map || {};
        const maxCount = Math.max(...Object.values(provinceMap), 1);
        const total = d.total || 0;
        const unknownCount = d.unknown_count || 0;

        const rankColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

        const top10Html = top10.map((item, i) => {
            const barColor = rankColors[i] || 'var(--primary)';
            const barWidth = total > 0 ? (item.count / total * 100) : 0;
            return `
                <div class="region-rank-item">
                    <span class="region-rank-index" style="background:${i < 3 ? barColor : 'var(--gray-300)'};color:${i < 3 ? '#fff' : 'var(--gray-700)'}">${i + 1}</span>
                    <span class="region-rank-name">${escapeHtml(item.province)}</span>
                    <div class="region-rank-bar-wrap">
                        <div class="region-rank-bar" style="width:${barWidth}%;background:${barColor}"></div>
                    </div>
                    <span class="region-rank-count">${item.count}</span>
                    <span class="region-rank-percent">${item.percent}%</span>
                </div>
            `;
        }).join('');

        const mapSvg = getChinaMapSvg(provinceMap, maxCount);

        container.innerHTML = `
            <div class="region-stats-grid">
                <div class="region-map-section">
                    <div class="region-map-wrap">
                        ${mapSvg}
                    </div>
                    <div class="region-legend">
                        <span class="region-legend-label">少</span>
                        <div class="region-legend-bar">
                            <span style="background:${getRegionColor(0)}"></span>
                            <span style="background:${getRegionColor(0.17)}"></span>
                            <span style="background:${getRegionColor(0.33)}"></span>
                            <span style="background:${getRegionColor(0.5)}"></span>
                            <span style="background:${getRegionColor(0.67)}"></span>
                            <span style="background:${getRegionColor(0.83)}"></span>
                            <span style="background:${getRegionColor(1)}"></span>
                        </div>
                        <span class="region-legend-label">多</span>
                    </div>
                </div>
                <div class="region-ranking-section">
                    <div class="region-top10-header">
                        <h3>Top 10 省份访问量</h3>
                        <div class="region-total-badge">共 ${total} 次访问${unknownCount > 0 ? ` · 未知 ${unknownCount}` : ''}</div>
                    </div>
                    <div class="region-top10-list">
                        ${top10Html || '<div class="region-empty">暂无数据</div>'}
                    </div>
                </div>
            </div>
        `;

        initChinaMapInteraction();
    } catch (e) {
        const container = document.getElementById('region-stats-container');
        if (container) container.innerHTML = renderEmpty('地域数据加载失败');
    }
}

function switchRegionRange(range) {
    document.querySelectorAll('.region-range-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.range === range);
    });
    loadRegionStats(range);
}

async function handleBackfillRegion() {
    const btn = document.getElementById('backfill-region-btn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = '回填中...';
    try {
        const res = await api.admin.backfillRegion();
        const d = res.data;
        showToast(res.message || `回填完成：处理${d.processed}条，更新${d.updated}条`, 'success');
        loadRegionStats(document.querySelector('.region-range-btn.active')?.dataset.range || 'today');
    } catch (e) {
        showToast('回填失败', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '回填历史IP';
    }
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

            <div class="card region-card" style="margin-bottom:24px">
                <div class="card-header" style="flex-wrap:wrap;gap:12px">
                    <h2>&#127759; 访问地域分布</h2>
                    <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
                        <div class="region-range-group">
                            <button class="region-range-btn active" data-range="today" onclick="switchRegionRange('today')">今日</button>
                            <button class="region-range-btn" data-range="7days" onclick="switchRegionRange('7days')">7天</button>
                            <button class="region-range-btn" data-range="30days" onclick="switchRegionRange('30days')">30天</button>
                        </div>
                        <button id="backfill-region-btn" class="btn btn-sm btn-secondary" onclick="handleBackfillRegion()">回填历史IP</button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="region-stats-container">${renderLoading()}</div>
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

        loadRegionStats('today');
    } catch (e) {
        const content = document.getElementById('dashboard-content');
        if (content) content.innerHTML = renderEmpty('仪表盘数据加载失败');
    }
}
