/* FILENAME: auth.js
   PURPOSE: Authentication, Session Management, Role-Based Access & UI Enhancements
   VERSION: 2.3 (SECURE: Removed Auto-Admin & Forced Login)
*/

(function() {
    // 1. Early exit if on login page to prevent redirect loops
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('login.html');
    
    if (isLoginPage) {
        return;
    }

    // 2. CHECK SESSION (Strict Security)
    let sessionRaw = sessionStorage.getItem('user_session');
    
    if (!sessionRaw) {
        // No session found -> Redirect to login immediately
        console.warn("🔒 Auth: No active session. Redirecting to login...");
        window.location.href = 'login.html';
        return;
    }

    let user;
    try {
        user = JSON.parse(sessionRaw);
    } catch (e) {
        // Corrupt session data -> Clear and logout for safety
        console.error("🔒 Auth: Corrupt session detected.");
        sessionStorage.clear();
        window.location.href = 'login.html';
        return;
    }

    // Make user globally available for other scripts
    window.CurrentUser = user;

    // 3. UI UPDATES (DOM Ready)
    document.addEventListener('DOMContentLoaded', () => {
        
        // A. Update Brand Name with User Info
        const brandEl = document.querySelector('.brand-logo');
        if (brandEl) {
            brandEl.innerHTML = `
                <div style="line-height:1.3;">
                    <i class="fas fa-cube"></i> Arth Book<br>
                    <small style="font-size:11px; opacity:0.8; font-weight:400; display:block; margin-top:2px;">
                        👤 ${user.name || user.username} 
                        <span style="color:#ffca28;">(${user.role.toUpperCase()})</span>
                    </small>
                </div>
            `;
        }

        // B. Add Logout Button to Sidebar
        const sidebar = document.getElementById('sidebar');
        const navList = sidebar ? sidebar.querySelector('.nav-links') : null;

        if (navList && !document.getElementById('authLogoutBtn')) {
            const logoutLi = document.createElement('li');
            logoutLi.style.marginTop = 'auto';
            logoutLi.innerHTML = `
                <a href="#" id="authLogoutBtn" style="color: #ef4444; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                    <i class="fas fa-sign-out-alt"></i> Secure Logout
                </a>
            `;
            
            logoutLi.querySelector('a').onclick = (e) => {
                e.preventDefault();
                if (confirm('🔒 Secure Logout?\nAll session data will be cleared.')) {
                    sessionStorage.clear();
                    window.location.href = 'login.html';
                }
            };
            navList.appendChild(logoutLi);
        }

        // C. ROLE-BASED RESTRICTIONS (For non-admin users)
        if (user.role !== 'admin') {
            
            // 1. Hide sensitive pages from navigation
            const restrictedPages = ['settings.html', 'coa.html', 'gst_filing.html', 'taxation.html'];
            restrictedPages.forEach(page => {
                const link = document.querySelector(`.nav-links a[href="${page}"]`);
                if (link) {
                    const li = link.closest('li');
                    if (li) li.style.display = 'none';
                }
            });

            // 2. Block direct URL access to restricted pages
            const currentPage = path.split('/').pop();
            if (restrictedPages.includes(currentPage)) {
                alert('⛔ Access Denied: Admin rights required.');
                window.location.href = 'index.html';
            }

            // 3. CSS to hide Action Buttons (Delete/Reset) globally for Staff
            const hideCSS = document.createElement('style');
            hideCSS.innerHTML = `
                .btn-del, .btn-danger, .delete-btn, .del-btn,
                button[onclick*="delete"], 
                button[onclick*="Reset"],
                button[onclick*="factoryReset"] { 
                    display: none !important; 
                }
            `;
            document.head.appendChild(hideCSS);
        }

        // D. Optional: Welcome Toast (Only on first load per session)
        if (!sessionStorage.getItem('welcome_shown')) {
            const toast = document.createElement('div');
            toast.innerText = `✅ Verified: ${user.name || user.username}`;
            toast.style.cssText = `
                position: fixed; bottom: 20px; right: 20px;
                background: #10b981; color: white; padding: 12px 24px;
                border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 9999; transition: 0.5s;
            `;
            document.body.appendChild(toast);
            sessionStorage.setItem('welcome_shown', 'true');
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
        }
    });
})();