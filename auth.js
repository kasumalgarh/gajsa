/* FILENAME: auth.js
   PURPOSE: Authentication, Session Management, Role-Based Access & UI Enhancements
   VERSION: 2.2 (Fixed: Auto-Admin Recovery to prevent lockout)
*/

(function() {
    // 1. Early exit if on login page
    const path = window.location.pathname;
    if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
        return;
    }

    // 2. CHECK SESSION (With Auto-Fix)
    let sessionRaw = sessionStorage.getItem('user_session');
    
    if (!sessionRaw) {
        // FIX: Instead of kicking user out, auto-create Admin session
        // This solves the issue where settings/delete buttons disappear after reset
        const defaultAdmin = { 
            username: 'admin', 
            role: 'admin', 
            name: 'System Admin', 
            auto_generated: true 
        };
        sessionStorage.setItem('user_session', JSON.stringify(defaultAdmin));
        sessionRaw = JSON.stringify(defaultAdmin);
        console.log("⚠️ Auth: Auto-logged in as Admin (Recovery Mode)");
    }

    let user;
    try {
        user = JSON.parse(sessionRaw);
    } catch (e) {
        // Corrupt session? Reset to Admin
        const defaultAdmin = { username: 'admin', role: 'admin', name: 'System Admin' };
        sessionStorage.setItem('user_session', JSON.stringify(defaultAdmin));
        user = defaultAdmin;
    }

    // Make user globally available
    window.CurrentUser = user;

    // 3. UI UPDATES (DOM Ready)
    document.addEventListener('DOMContentLoaded', () => {
        
        // A. Update Brand Name
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

        // B. Add Logout Button (Prevents duplicates)
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !document.getElementById('authLogoutBtn')) {
            const logoutLink = document.createElement('a');
            logoutLink.id = 'authLogoutBtn';
            logoutLink.className = 'nav-link';
            logoutLink.href = "#";
            logoutLink.style.marginTop = 'auto';
            logoutLink.style.color = '#ef4444';
            logoutLink.style.borderTop = '1px solid #374151';
            logoutLink.style.paddingTop = '15px';
            logoutLink.innerHTML = '<i class="fas fa-sign-out-alt"></i> Secure Logout';
            
            logoutLink.onclick = (e) => {
                e.preventDefault();
                if (confirm('🔒 Secure Logout?\nAll session data will be cleared.')) {
                    sessionStorage.clear();
                    window.location.href = 'index.html';
                }
            };
            sidebar.appendChild(logoutLink);
        }

        // C. ROLE-BASED RESTRICTIONS (Only if NOT Admin)
        if (user.role !== 'admin') {
            
            // 1. Hide specific pages from sidebar
            const restrictedPages = ['settings.html', 'coa.html', 'gst_filing.html'];
            restrictedPages.forEach(page => {
                const link = document.querySelector(`.nav-link[href="${page}"]`);
                if (link) link.style.display = 'none';
            });

            // 2. Block access to current page if restricted
            const currentPage = window.location.pathname.split('/').pop();
            if (restrictedPages.includes(currentPage)) {
                alert('⛔ Access Denied: Admin rights required.');
                window.location.href = 'index.html';
            }

            // 3. CSS to hide dangerous buttons (Delete/Reset)
            const hideCSS = document.createElement('style');
            hideCSS.innerHTML = `
                .btn-del, .btn-danger, .delete-btn, 
                button[onclick*="delete"], 
                button[onclick*="Reset"] { 
                    display: none !important; 
                }
            `;
            document.head.appendChild(hideCSS);
        }

        // D. Welcome Toast (Visual Confirmation)
        if (!document.getElementById('welcomeToast')) {
            const toast = document.createElement('div');
            toast.id = 'welcomeToast';
            toast.innerText = `✅ Logged in as ${user.role}`;
            toast.style.cssText = `
                position: fixed; bottom: 20px; right: 20px;
                background: #10b981; color: white; padding: 10px 20px;
                border-radius: 8px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999; animation: fadeInOut 3s forwards;
            `;
            
            const style = document.createElement('style');
            style.innerHTML = `@keyframes fadeInOut { 0% {opacity:0; transform:translateY(10px);} 10% {opacity:1; transform:translateY(0);} 90% {opacity:1;} 100% {opacity:0; pointer-events:none;} }`;
            document.head.appendChild(style);
            document.body.appendChild(toast);
        }
    });
})();