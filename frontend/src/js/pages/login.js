function renderLoginPage() {
    return `
        <div class="auth-page">
            <div class="auth-container">
                <div class="auth-logo">
                    <div class="auth-logo-icon">${getLogoSvg()}</div>
                    <h1>欢迎回来</h1>
                    <p>登录您的 FlipBook 账号</p>
                </div>
                <form id="login-form" onsubmit="handleLogin(event)">
                    <div class="form-group">
                        <label class="form-label">用户名 <span class="required">*</span></label>
                        <input type="text" class="form-input" id="login-username" placeholder="请输入用户名" autocomplete="username" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">密码 <span class="required">*</span></label>
                        <input type="password" class="form-input" id="login-password" placeholder="请输入密码" autocomplete="current-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" id="login-btn" style="width:100%">登录</button>
                </form>
                <div class="auth-footer">
                    还没有账号？<a href="#/register">立即注册</a>
                </div>
            </div>
        </div>
    `;
}

async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');

    if (!username || !password) {
        showToast('请输入用户名和密码', 'warning');
        return;
    }

    btn.disabled = true;
    btn.textContent = '登录中...';

    try {
        const res = await api.auth.login({ username, password });
        setToken(res.data.token);
        setUser(res.data.user);
        showToast('登录成功', 'success');

        if (res.data.user.role === 'admin') {
            window.location.hash = '#/admin';
        } else {
            window.location.hash = '#/';
        }
    } catch (e) {
        // error shown by api layer
    } finally {
        btn.disabled = false;
        btn.textContent = '登录';
    }
}
