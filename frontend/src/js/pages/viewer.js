let viewerState = { album: null, pages: [], currentPage: 1, needPassword: false, flipbookReady: false };

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
    viewerState = { album: null, pages: [], currentPage: 1, needPassword: false, flipbookReady: false };
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

    viewerState.pages.forEach((page, index) => {
        const pageEl = document.createElement('div');
        pageEl.className = 'page';
        if (page.image_url) {
            pageEl.innerHTML = `<img src="${getImageUrl(page.image_url)}" alt="第${index + 1}页" loading="lazy">`;
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
            }
        }
    });

    viewerState.flipbookReady = true;
    updatePageIndicator();
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
    }
}, 300));
