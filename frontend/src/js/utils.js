function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getImageUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return path.startsWith('/') ? path : '/uploads/' + path;
}

function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function validateEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
    if (!phone) return true;
    return /^1[3-9]\d{9}$/.test(phone);
}

function renderPagination(total, page, limit, onPageChange) {
    const totalPages = Math.ceil(total / limit);
    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';
    html += `<button class="page-btn" onclick="${onPageChange}(1)" ${page <= 1 ? 'disabled' : ''}>&laquo;</button>`;
    html += `<button class="page-btn" onclick="${onPageChange}(${page - 1})" ${page <= 1 ? 'disabled' : ''}>&lsaquo;</button>`;

    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);

    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
    }

    html += `<button class="page-btn" onclick="${onPageChange}(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>&rsaquo;</button>`;
    html += `<button class="page-btn" onclick="${onPageChange}(${totalPages})" ${page >= totalPages ? 'disabled' : ''}>&raquo;</button>`;
    html += `<span class="page-info">${page}/${totalPages} 共${total}条</span>`;
    html += '</div>';
    return html;
}

function showConfirmModal(title, message, onConfirm) {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
        <div class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()" style="max-width:420px">
                <div class="modal-header">
                    <h3>${escapeHtml(title)}</h3>
                    <button class="modal-close" onclick="document.getElementById('modal-container').innerHTML=''">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="color:var(--gray-600);font-size:14px">${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('modal-container').innerHTML=''">取消</button>
                    <button class="btn btn-danger" id="confirm-btn">确认</button>
                </div>
            </div>
        </div>
    `;
    document.getElementById('confirm-btn').onclick = () => {
        document.getElementById('modal-container').innerHTML = '';
        onConfirm();
    };
}

function closeModal(event) {
    if (event.target.classList.contains('modal-overlay')) {
        document.getElementById('modal-container').innerHTML = '';
    }
}

function getLogoSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>`;
}

function getPlaceholderImage() {
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23f3f4f6' width='400' height='300'/%3E%3Ctext fill='%239ca3af' font-family='sans-serif' font-size='18' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E暂无图片%3C/text%3E%3C/svg%3E`;
}

const PROGRESS_STORAGE_KEY = 'flipbook_read_progress';

function getAllLocalProgress() {
    try {
        const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveAllLocalProgress(progressMap) {
    try {
        localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressMap));
    } catch (e) {}
}

function getLocalProgress(albumId) {
    const all = getAllLocalProgress();
    const item = all[albumId];
    if (!item) return null;

    const totalPages = item.total_pages || 0;
    let currentPage = item.current_page || 1;
    if (totalPages > 0 && currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) currentPage = 1;

    return {
        album_id: parseInt(albumId),
        current_page: currentPage,
        total_pages: totalPages,
        is_completed: totalPages > 0 && currentPage >= totalPages,
        last_read_at: item.last_read_at || null,
    };
}

function saveLocalProgress(albumId, currentPage, totalPages) {
    const all = getAllLocalProgress();
    if (totalPages > 0 && currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (currentPage < 1) currentPage = 1;

    all[albumId] = {
        album_id: parseInt(albumId),
        current_page: currentPage,
        total_pages: totalPages,
        is_completed: totalPages > 0 && currentPage >= totalPages,
        last_read_at: new Date().toISOString(),
    };
    saveAllLocalProgress(all);
    return all[albumId];
}

function correctLocalProgressPage(albumId, actualTotalPages) {
    const all = getAllLocalProgress();
    const item = all[albumId];
    if (!item) return null;

    let currentPage = item.current_page || 1;
    if (actualTotalPages > 0 && currentPage > actualTotalPages) {
        currentPage = actualTotalPages;
    }
    if (currentPage < 1) currentPage = 1;

    item.current_page = currentPage;
    item.total_pages = actualTotalPages;
    item.is_completed = actualTotalPages > 0 && currentPage >= actualTotalPages;
    all[albumId] = item;
    saveAllLocalProgress(all);
    return item;
}

function clearLocalProgress(albumId) {
    const all = getAllLocalProgress();
    if (all[albumId]) {
        delete all[albumId];
        saveAllLocalProgress(all);
    }
}

function getUnfinishedLocalProgressList() {
    const all = getAllLocalProgress();
    const list = [];
    for (const albumId in all) {
        const item = all[albumId];
        if (!item.is_completed) {
            list.push({
                album_id: parseInt(albumId),
                current_page: item.current_page,
                total_pages: item.total_pages,
                last_read_at: item.last_read_at,
            });
        }
    }
    list.sort((a, b) => {
        const ta = a.last_read_at ? new Date(a.last_read_at).getTime() : 0;
        const tb = b.last_read_at ? new Date(b.last_read_at).getTime() : 0;
        return tb - ta;
    });
    return list.slice(0, 20);
}

async function mergeLocalProgressToCloud() {
    if (!isLoggedIn()) return { merged: 0, updated: 0 };

    const localList = Object.values(getAllLocalProgress());
    if (localList.length === 0) return { merged: 0, updated: 0 };

    try {
        const res = await api.progress.merge(localList);
        return res.data;
    } catch (e) {
        return { merged: 0, updated: 0 };
    }
}

function normalizeFlipbookPage(page, totalPages, isDoublePageMode) {
    if (!isDoublePageMode) {
        return Math.max(1, Math.min(totalPages || 1, page));
    }
    const normalized = Math.ceil(page / 2);
    return Math.max(1, Math.min(totalPages || 1, normalized));
}

const WATERMARK_FONT_FAMILY = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`;
const WATERMARK_ANGLE_DEG = -25;
const WATERMARK_REF_WIDTH = 800;

function resolveWatermarkPlaceholdersGlobal(text, viewerInfo) {
    if (!text) return '';
    const info = viewerInfo || {};
    const username = info.username || '访客';
    const date = info.date || new Date().toISOString().slice(0, 10);
    const ipSuffix = info.ip_suffix || '';
    return text
        .replace(/\{用户名\}/g, username)
        .replace(/\{日期\}/g, date)
        .replace(/\{IP后两段\}/g, ipSuffix);
}

function drawWatermarkPatternGlobal(ctx, text, color, opacity, density, width, height) {
    ctx.save();

    const fontSize = Math.max(12, Math.min(18, width / (WATERMARK_REF_WIDTH / 14)));
    const angle = WATERMARK_ANGLE_DEG * Math.PI / 180;
    const baseSpacingX = 200 / density;
    const baseSpacingY = 110 / density;
    const scaleFactor = width / WATERMARK_REF_WIDTH;
    const clampScale = Math.max(0.6, Math.min(1.5, scaleFactor));
    const spacingX = baseSpacingX * clampScale;
    const spacingY = baseSpacingY * clampScale;

    ctx.font = `${fontSize}px ${WATERMARK_FONT_FAMILY}`;
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const diagonal = Math.sqrt(width * width + height * height);
    const startX = -diagonal / 2;
    const endX = diagonal / 2 + spacingX;
    const startY = -diagonal / 2;
    const endY = diagonal / 2 + spacingY;

    ctx.translate(width / 2, height / 2);
    ctx.rotate(angle);

    for (let y = startY; y < endY; y += spacingY) {
        for (let x = startX; x < endX; x += spacingX) {
            ctx.fillText(text, x, y);
        }
    }

    ctx.restore();
}

function setupWatermarkCanvas(canvas, width, height) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    return ctx;
}

const QUOTA_COLORS = {
    safe: '#10b981',
    warn: '#f59e0b',
    danger: '#ef4444',
    unlimited: '#6366f1',
};

function getQuotaColor(usageRate) {
    if (usageRate >= 90) return QUOTA_COLORS.danger;
    if (usageRate >= 60) return QUOTA_COLORS.warn;
    return QUOTA_COLORS.safe;
}

function renderQuotaBar(quota, options = {}) {
    if (!quota) return '';
    const { compact = false, showRemaining = true, showUpgradeHint = true } = options;

    if (quota.is_unlimited) {
        return `
            <div class="quota-display ${compact ? 'compact' : ''}">
                <span class="quota-unlimited-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18.178 8a6 6 0 0 0-10.92-1.829C6.23 7.672 4.478 10.011 2 11.569"/>
                        <path d="M5.822 16a6 6 0 0 0 10.92 1.829c1.028-1.501 2.78-3.84 5.258-5.398"/>
                        <path d="m15 5 3 3-3 3"/>
                        <path d="m9 19-3-3 3-3"/>
                    </svg>
                    无限额度
                </span>
            </div>
        `;
    }

    const today = parseInt(quota.today_count || 0);
    const total = parseInt(quota.daily_quota || 0);
    const remaining = Math.max(0, total - today);
    const usageRate = total > 0 ? Math.min(100, (today / total) * 100) : 0;
    const color = getQuotaColor(usageRate);
    const isExhausted = today >= total;

    if (compact) {
        return `
            <div class="quota-display compact" style="color:${isExhausted ? QUOTA_COLORS.danger : color}" title="今日配额：${today}/${total}">
                <span style="margin-right:4px">&#9203;</span>
                <strong>${today}</strong><span style="opacity:.6">/${total}</span>
                ${showRemaining && !isExhausted ? `<span style="margin-left:4px;opacity:.7">剩${remaining}</span>` : ''}
                ${isExhausted ? `<span style="margin-left:4px;font-size:12px">&#9888;</span>` : ''}
            </div>
        `;
    }

    return `
        <div class="quota-display">
            <div class="quota-header">
                <span class="quota-title">&#9203; 今日阅读配额</span>
                <span class="quota-count" style="color:${color}">
                    <strong>${today}</strong> <span style="opacity:.6">/ ${total}</span>
                </span>
            </div>
            <div class="quota-progress">
                <div class="quota-progress-track">
                    <div class="quota-progress-fill" style="width:${usageRate}%;background:${color}"></div>
                </div>
                ${showRemaining ? `<span class="quota-progress-text" style="color:${isExhausted ? QUOTA_COLORS.danger : color}">${isExhausted ? '额度已用尽' : `剩余 ${remaining} 本`}</span>` : ''}
            </div>
            ${showUpgradeHint && !quota.is_vip && !quota.is_admin && (remaining <= 1 || isExhausted) ? `
                <div class="quota-upgrade-hint">
                    <span>&#128640;</span>
                    <span>${isExhausted ? '升级会员解锁更多阅读额度' : '额度即将用完，升级会员获取更多'}</span>
                    <a href="#/profile" class="quota-upgrade-link">升级 &rarr;</a>
                </div>
            ` : ''}
        </div>
    `;
}

async function loadCurrentQuota() {
    try {
        const res = await api.public.quota();
        const quota = res.data || {};
        const user = getUser();
        if (user) {
            user.quota = quota;
            setUser(user);
        }
        return quota;
    } catch (e) {
        const user = getUser();
        if (user && user.quota) return user.quota;
        return null;
    }
}

function getCachedQuota() {
    const user = getUser();
    if (user && user.quota) return user.quota;
    return null;
}
