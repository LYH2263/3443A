let adminSidebarOpen = false;

function renderAdminLayout(activePage, content) {
    const user = getUser();
    const avatarContent = user && user.avatar
        ? `<img src="${getImageUrl(user.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : (user ? escapeHtml((user.nickname || user.username || 'A').charAt(0).toUpperCase()) : 'A');

    return `
        <div class="admin-layout">
            <div class="admin-sidebar-overlay ${adminSidebarOpen ? 'show' : ''}" id="sidebar-overlay" onclick="toggleAdminSidebar()"></div>
            <aside class="admin-sidebar ${adminSidebarOpen ? 'open' : ''}" id="admin-sidebar">
                <div class="admin-sidebar-logo">
                    <div class="admin-sidebar-logo-icon">${getLogoSvg()}</div>
                    <div class="admin-sidebar-logo-text">
                        <h3>FlipBook</h3>
                        <p>画册管理后台</p>
                    </div>
                </div>
                <nav class="admin-nav">
                    <div class="admin-nav-group">
                        <div class="admin-nav-group-title">概览</div>
                        <a href="#/admin" class="admin-nav-item ${activePage === 'dashboard' ? 'active' : ''}">
                            &#128202; 仪表盘
                        </a>
                    </div>
                    <div class="admin-nav-group">
                        <div class="admin-nav-group-title">内容管理</div>
                        <a href="#/admin/albums" class="admin-nav-item ${activePage === 'albums' ? 'active' : ''}">
                            &#128218; 画册管理
                        </a>
                        <a href="#/admin/categories" class="admin-nav-item ${activePage === 'categories' ? 'active' : ''}">
                            &#128193; 分类管理
                        </a>
                        <a href="#/admin/backgrounds" class="admin-nav-item ${activePage === 'backgrounds' ? 'active' : ''}">
                            &#127756; 背景图管理
                        </a>
                    </div>
                    <div class="admin-nav-group">
                        <div class="admin-nav-group-title">用户管理</div>
                        <a href="#/admin/users" class="admin-nav-item ${activePage === 'users' ? 'active' : ''}">
                            &#128101; 用户列表
                        </a>
                        <a href="#/admin/levels" class="admin-nav-item ${activePage === 'levels' ? 'active' : ''}">
                            &#127942; 会员等级
                        </a>
                    </div>
                    <div class="admin-nav-group">
                        <div class="admin-nav-group-title">其他</div>
                        <a href="#/" class="admin-nav-item">
                            &#127968; 前台首页
                        </a>
                        <a href="#/profile" class="admin-nav-item">
                            &#128100; 个人中心
                        </a>
                    </div>
                </nav>
            </aside>
            <main class="admin-main">
                <header class="admin-topbar">
                    <div class="admin-topbar-left">
                        <button class="admin-mobile-toggle" onclick="toggleAdminSidebar()">&#9776;</button>
                        <h1 class="admin-topbar-title" id="admin-page-title"></h1>
                    </div>
                    <div class="admin-topbar-right">
                        <div class="home-nav-user" onclick="toggleUserDropdown(event)" style="cursor:pointer">
                            <div class="home-nav-avatar">${avatarContent}</div>
                            <span style="font-size:14px;color:var(--gray-700)" id="nav-nickname">${user ? escapeHtml(user.nickname || user.username) : ''}</span>
                            <div class="home-nav-dropdown" id="user-dropdown">
                                <a href="#/profile">&#128100; 个人中心</a>
                                <a href="#/">&#127968; 前台首页</a>
                                <div class="dropdown-divider"></div>
                                <button onclick="logout()">&#128682; 退出登录</button>
                            </div>
                        </div>
                    </div>
                </header>
                <div class="admin-content" id="admin-content">
                    ${content}
                </div>
            </main>
        </div>
    `;
}

function toggleAdminSidebar() {
    adminSidebarOpen = !adminSidebarOpen;
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open', adminSidebarOpen);
    if (overlay) overlay.classList.toggle('show', adminSidebarOpen);
}
