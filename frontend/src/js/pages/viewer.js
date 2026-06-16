let viewerState = {
    album: null, pages: [], currentPage: 1, needPassword: false, flipbookReady: false,
    watermark: null, viewerInfo: null
};

function renderViewerPage(id) {
    return `
        <div class="viewer-page">
            <div class="viewer-header">
                <button class="viewer-back" onclick="window.location.hash='#/'">&#8592; 返回画册列表</button>
                <h2 id="viewer-title">加载中...</h2>
                <div style="width:80px"></div>
            </div>
            <div class="viewer-container" id="viewer-container">
                <div class="viewer-bg" id="viewer-bg"></div>
                <div id="flipbook-wrapper">
                    <div id="viewer-loading">${renderLoading()}</div>
                    <div id="flipbook" style="display:none"></div>
                </div>
                <div class="viewer-password" id="viewer-password" style="display:none">
                    <div class="viewer-password-box">
                        <h3>&#128274; 需要访问密码</h3>
                        <p>此画册需要输入分享密码才能查看</p>
                        <div class="form-group">
                            <input type="password" class="form-input" id="pwd-input" placeholder="请输入分享密码"
                                onkeydown="if(event.key==='Enter')verifyAlbumPassword(${id})">
                        </div>
                        <button class="btn btn-primary" onclick="verifyAlbumPassword(${id})" style="width:100%">验证密码</button>
                    </div>
                </div>
            </div>
            <div class="viewer-controls" id="viewer-controls" style="display:none">
                <button onclick="flipPrev()">&#9664; 上一页</button>
                <span class="page-indicator" id="page-indicator">1 / 1</span>
                <button onclick="flipNext()">下一页 &#9654;</button>
                <button onclick="toggleFullscreen()" style="margin-left:16px" title="全屏">&#9974;</button>
            </div>
        </div>
    `;
}

async function initViewerPage(id) {
    viewerState = {
        album: null, pages: [], currentPage: 1, needPassword: false, flipbookReady: false,
        watermark: null, viewerInfo: null
    };
    try {
        const res = await api.public.albumDetail(id);
        if (res.data.need_password) {
            viewerState.needPassword = true;
            viewerState.album = res.data.album;
            document.getElementById('viewer-title').textContent = res.data.album.title || '画册';
            document.getElementById('viewer-loading').style.display = 'none';
            document.getElementById('viewer-password').style.display = 'flex';
            return;
        }
        setupViewer(res.data);
    } catch (e) {
        document.getElementById('viewer-loading').innerHTML = renderEmpty('画册加载失败');
    }
}

async function verifyAlbumPassword(id) {
    const pwd = document.getElementById('pwd-input').value.trim();
    if (!pwd) {
        showToast('请输入分享密码', 'warning');
        return;
    }
    try {
        const res = await api.public.albumDetail(id, pwd);
        if (res.data.need_password) {
            showToast('密码不正确', 'error');
            return;
        }
        document.getElementById('viewer-password').style.display = 'none';
        setupViewer(res.data);
    } catch (e) {}
}

function setupViewer(data) {
    viewerState.album = data.album;
    viewerState.pages = data.pages || [];
    viewerState.watermark = data.album.watermark || null;
    viewerState.viewerInfo = data.viewer || null;

    document.getElementById('viewer-title').textContent = data.album.title || '画册';
    document.getElementById('viewer-loading').style.display = 'none';

    if (data.album.background_image_url) {
        document.getElementById('viewer-bg').style.backgroundImage = `url(${getImageUrl(data.album.background_image_url)})`;
    }

    if (viewerState.pages.length === 0) {
        document.getElementById('flipbook-wrapper').innerHTML = renderEmpty('该画册暂无页面内容');
        return;
    }

    const flipbook = document.getElementById('flipbook');
    flipbook.style.display = 'block';
    flipbook.innerHTML = '';

    const watermarkEnabled = viewerState.watermark && viewerState.watermark.enabled;

    viewerState.pages.forEach((page, index) => {
        const pageEl = document.createElement('div');
        pageEl.className = 'page';
        if (page.image_url) {
            const imgHtml = `<img src="${getImageUrl(page.image_url)}" alt="第${index + 1}页" loading="lazy" data-page-index="${index}" onload="onPageImageLoad(this)">`;
            if (watermarkEnabled) {
                pageEl.innerHTML = `
                    <div class="page-image-wrapper">
                        ${imgHtml}
                        <canvas class="page-watermark" data-page-index="${index}"></canvas>
                    </div>
                `;
            } else {
                pageEl.innerHTML = imgHtml;
            }
        } else {
            pageEl.innerHTML = `<div class="page-content"><h3>${escapeHtml(page.title || '第' + (index + 1) + '页')}</h3></div>`;
        }
        flipbook.appendChild(pageEl);
    });

    document.getElementById('viewer-controls').style.display = 'flex';

    setTimeout(() => {
        initFlipbook();
    }, 100);
}

function resolveWatermarkPlaceholders(text) {
    if (!text) return '';
    const info = viewerState.viewerInfo || {};
    const username = info.username || '访客';
    const date = info.date || new Date().toISOString().slice(0, 10);
    const ipSuffix = info.ip_suffix || '';

    return text
        .replace(/\{用户名\}/g, username)
        .replace(/\{日期\}/g, date)
        .replace(/\{IP后两段\}/g, ipSuffix);
}

function onPageImageLoad(img) {
    if (!viewerState.watermark || !viewerState.watermark.enabled) return;
    const pageIndex = img.getAttribute('data-page-index');
    const canvas = document.querySelector(`.page-watermark[data-page-index="${pageIndex}"]`);
    if (canvas) {
        drawPageWatermark(canvas, img);
    }
}

function drawPageWatermark(canvas, img) {
    const wm = viewerState.watermark;
    if (!wm || !wm.enabled) return;

    const dpr = window.devicePixelRatio || 1;
    const width = img.clientWidth || img.offsetWidth;
    const height = img.clientHeight || img.offsetHeight;

    if (width === 0 || height === 0) {
        requestAnimationFrame(() => drawPageWatermark(canvas, img));
        return;
    }

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const text = resolveWatermarkPlaceholders(wm.text || '版权所有');
    const color = wm.color || '#000000';
    const opacity = wm.opacity ?? 0.15;
    const density = wm.density || 3;

    drawWatermarkPattern(ctx, text, color, opacity, density, width, height);
}

function drawWatermarkPattern(ctx, text, color, opacity, density, width, height) {
    ctx.save();

    const fontSize = Math.max(12, Math.min(18, width / 40));
    const angle = -25 * Math.PI / 180;
    const baseSpacingX = 200 / density;
    const baseSpacingY = 110 / density;
    const scaleFactor = width / 800;
    const spacingX = baseSpacingX * Math.max(0.6, Math.min(1.5, scaleFactor));
    const spacingY = baseSpacingY * Math.max(0.6, Math.min(1.5, scaleFactor));

    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif`;
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

function redrawAllWatermarks() {
    if (!viewerState.watermark || !viewerState.watermark.enabled) return;

    const canvases = document.querySelectorAll('.page-watermark');
    canvases.forEach(canvas => {
        const pageIndex = canvas.getAttribute('data-page-index');
        const img = document.querySelector(`.page img[data-page-index="${pageIndex}"]`);
        if (img && img.complete && img.naturalWidth > 0) {
            drawPageWatermark(canvas, img);
        }
    });
}

function initFlipbook() {
    const flipbook = $('#flipbook');
    const container = document.getElementById('viewer-container');
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 40;

    let width = Math.min(800, containerWidth);
    let height = Math.min(500, containerHeight);

    if (window.innerWidth <= 768) {
        width = containerWidth;
        height = width * 0.65;
    }

    flipbook.turn({
        width: width,
        height: height,
        autoCenter: true,
        elevation: 50,
        gradients: true,
        duration: 1000,
        acceleration: true,
        when: {
            turning: function (event, page, view) {
                viewerState.currentPage = page;
                updatePageIndicator();
            },
            turned: function (event, page, view) {
                viewerState.currentPage = page;
                updatePageIndicator();
                setTimeout(() => checkAndDrawWatermarks(), 50);
            }
        }
    });

    viewerState.flipbookReady = true;
    updatePageIndicator();

    setTimeout(() => {
        checkAndDrawWatermarks();
    }, 200);
}

function checkAndDrawWatermarks() {
    if (!viewerState.watermark || !viewerState.watermark.enabled) return;

    const images = document.querySelectorAll('.page img[data-page-index]');
    images.forEach(img => {
        if (img.complete && img.naturalWidth > 0) {
            const pageIndex = img.getAttribute('data-page-index');
            const canvas = document.querySelector(`.page-watermark[data-page-index="${pageIndex}"]`);
            if (canvas) {
                drawPageWatermark(canvas, img);
            }
        }
    });
}

function updatePageIndicator() {
    const indicator = document.getElementById('page-indicator');
    if (indicator && viewerState.flipbookReady) {
        const total = $('#flipbook').turn('pages');
        indicator.textContent = `${viewerState.currentPage} / ${total}`;
    }
}

function flipPrev() {
    if (viewerState.flipbookReady) {
        $('#flipbook').turn('previous');
    }
}

function flipNext() {
    if (viewerState.flipbookReady) {
        $('#flipbook').turn('next');
    }
}

function toggleFullscreen() {
    const el = document.querySelector('.viewer-page');
    if (!document.fullscreenElement) {
        el.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

window.addEventListener('resize', debounce(() => {
    if (viewerState.flipbookReady) {
        const container = document.getElementById('viewer-container');
        if (!container) return;
        const containerWidth = container.clientWidth - 40;
        let width = Math.min(800, containerWidth);
        let height = width * 0.625;
        if (window.innerWidth <= 768) {
            width = containerWidth;
            height = width * 0.65;
        }
        $('#flipbook').turn('size', width, height);
        setTimeout(() => redrawAllWatermarks(), 50);
    }
}, 300));

document.addEventListener('fullscreenchange', () => {
    if (viewerState.flipbookReady) {
        setTimeout(() => {
            const container = document.getElementById('viewer-container');
            if (container) {
                const containerWidth = container.clientWidth - 40;
                let width = Math.min(800, containerWidth);
                let height = width * 0.625;
                if (window.innerWidth <= 768) {
                    width = containerWidth;
                    height = width * 0.65;
                }
                if (document.fullscreenElement) {
                    width = Math.min(containerWidth * 0.9, containerWidth - 40);
                    height = width * 0.625;
                }
                $('#flipbook').turn('size', width, height);
            }
            setTimeout(() => redrawAllWatermarks(), 100);
        }, 100);
    }
});
