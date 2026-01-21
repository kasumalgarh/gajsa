/* FILENAME: auth.js
   PURPOSE: Authentication, Session Management, Role-Based Access & UI Enhancements
   VERSION: 2.1 (Improved: Duplicate prevention, mobile safe, better restrictions, cleanup)
*/

(function() {
    // Early exit if on login page (index.html) - no redirect loop
    if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
        return;
    }

    // Check Session
    const sessionRaw = sessionStorage.getItem('user_session');
    if (!sessionRaw) {
        window.location.href = 'index.html';
        return;
    }

    let user;
    try {
        user = JSON.parse(sessionRaw);
    } catch (e) {
        sessionStorage.clear();
        window.location.href = 'index.html';
        return;
    }

    // Make user globally available
    window.CurrentUser = user;

    // DOM Ready
    document.addEventListener('DOMContentLoaded', () => {
        // 1. Update Brand with User Info
        const brandEl = document.querySelector('.brand');
        if (brandEl) {
            brandEl.innerHTML = `
                <div style="line-height:1.3;">
                    🚀 Arth Book<br>
                    <small style="font-size:11px; opacity:0.8; font-weight:400;">
                        👤 ${user.name || user.username} 
                        <span style="color:#fbbf24;">(${user.role.toUpperCase()})</span>
                    </small>
                </div>
            `;
        }

        // 2. Add Logout Button (Only once, at bottom)
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !document.getElementById('authLogoutBtn')) {
            const logoutLink = document.createElement('a');
            logoutLink.id = 'authLogoutBtn';
            logoutLink.className = 'nav-link';
            logoutLink.style.marginTop = 'auto';
            logoutLink.style.color = '#ef4444';
            logoutLink.style.borderTop = '1px solid #374151';
            logoutLink.style.paddingTop = '15px';
            logoutLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> Secure Logout';
            logoutLink.onclick = (e) => {
                e.preventDefault();
                if (confirm('🔒 Secure Logout?\nAll session data will be cleared.')) {
                    sessionStorage.clear();
                    localStorage.removeItem('arthbook_auto_backup'); // Optional cleanup
                    window.location.href = 'index.html';
                }
            };
            sidebar.appendChild(logoutLink);
        }

        // 3. ROLE-BASED ACCESS CONTROL
        const currentPage = window.location.pathname.split('/').pop();

        if (user.role === 'operator') {
            // Restricted pages for operators
            const operatorRestricted = [
                'settings.html',
                'reports.html',
                'coa.html',
                'gst_filing.html',
                'taxation.html'
            ];

            // Hide sidebar links
            operatorRestricted.forEach(page => {
                const link = document.querySelector(`.nav-link[href="${page}"]`);
                if (link) link.style.display = 'none';
            });

            // Block direct access
            if (operatorRestricted.includes(currentPage)) {
                alert('⛔ Access Restricted: This section is for Admins only.');
                window.location.href = 'index.html';
            }
        }

        // 4. HIDE DANGER ACTIONS FOR NON-ADMINS
        if (user.role !== 'admin') {
            const dangerSelectors = [
                '.btn-del',
                '.btn-danger',
                '.delete-btn',
                'button[onclick*="delete"]',
                'button[onclick*="hardReset"]',
                'button[onclick*="factoryReset"]'
            ];

            const hideCSS = document.createElement('style');
            hideCSS.id = 'authHideDanger';
            hideCSS.innerHTML = dangerSelectors.map(sel => `${sel} { display: none !important; }`).join(' ');
            document.head.appendChild(hideCSS);
        }

        // 5. OPTIONAL: Welcome Toast
        const welcomeToast = document.createElement('div');
        welcomeToast.innerHTML = `Welcome back, ${user.name || user.username}!`;
        welcomeToast.style.position = 'fixed';
        welcomeToast.style.bottom = '20px';
        welcomeToast.style.left = '50%';
        welcomeToast.style.transform = 'translateX(-50%)';
        welcomeToast.style.background = '#10b981';
        welcomeToast.style.color = 'white';
        welcomeToast.style.padding = '12px 30px';
        welcomeToast.style.borderRadius = '8px';
        welcomeToast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        welcomeToast.style.zIndex = '2000';
        welcomeToast.style.display = 'none';
        document.body.appendChild(welcomeToast);

        welcomeToast.style.display = 'block';
        setTimeout(() => welcomeToast.style.display = 'none', 3000);
    });
})();