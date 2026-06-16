function renderRegisterPage() {
    return `
        <div class="auth-page">
            <div class="auth-container">
                <div class="auth-logo">
                    <div class="auth-logo-icon">${getLogoSvg()}</div>
                    <h1>创建账号</h1>
                    <p>注册 FlipBook 账号，浏览精美画册</p>
                </div>
                <form id="register-form" onsubmit="handleRegister(event)">
                    <div class="form-group">
                        <label class="form-label">用户名 <span class="required">*</span></label>
                        <input type="text" class="form-input" id="reg-username" placeholder="3-30个字符，字母数字下划线" autocomplete="username" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">昵称</label>
                        <input type="text" class="form-input" id="reg-nickname" placeholder="请输入昵称（选填）" autocomplete="nickname">
                    </div>
                    <div class="form-group">
                        <label class="form-label">邮箱</label>
                        <input type="email" class="form-input" id="reg-email" placeholder="请输入邮箱（选填）" autocomplete="email">
                    </div>
                    <div class="form-group">
                        <label class="form-label">手机号</label>
                        <input type="tel" class="form-input" id="reg-phone" placeholder="请输入手机号（选填）" autocomplete="tel">
                    </div>
                    <div class="form-group">
                        <label class="form-label">密码 <span class="required">*</span></label>
                        <input type="password" class="form-input" id="reg-password" placeholder="6-30个字符" autocomplete="new-password" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">确认密码 <span class="required">*</span></label>
                        <input type="password" class="form-input" id="reg-confirm" placeholder="请再次输入密码" autocomplete="new-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" id="reg-btn" style="width:100%">注册</button>
                </form>
                <div class="auth-footer">
                    已有账号？<a href="#/login">立即登录</a>
                </div>
            </div>
        </div>
    `;
}

async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const nickname = document.getElementById('reg-nickname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const btn = document.getElementById('reg-btn');

    if (!username || !password) {
        showToast('请填写用户名和密码', 'warning');
        return;
    }

    if (username.length < 3 || username.length > 30) {
        showToast('用户名长度为3-30个字符', 'warning');
        return;
    }

    if (password.length < 6) {
        showToast('密码长度不能少于6个字符', 'warning');
        return;
    }

    if (password !== confirm) {
        showToast('两次输入的密码不一致', 'warning');
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
    btn.textContent = '注册中...';

    try {
        const res = await api.auth.register({ username, nickname, email, phone, password });
        setToken(res.data.token);
        setUser(res.data.user);

        try {
            const mergeResult = await mergeLocalProgressToCloud();
            if (mergeResult && (mergeResult.merged > 0 || mergeResult.updated > 0)) {
                showToast(`注册成功，已同步 ${mergeResult.merged + mergeResult.updated} 条阅读进度`, 'success');
            } else {
                showToast('注册成功', 'success');
            }
        } catch (e) {
            showToast('注册成功', 'success');
        }

        window.location.hash = '#/';
    } catch (e) {
        // handled by api
    } finally {
        btn.disabled = false;
        btn.textContent = '注册';
    }
}
