/* FILENAME: auth.js
   PURPOSE: Security, Role Management & UI Cleanup
   VERSION: 2.0 (Syncs with DB.js)
*/

(function() {
    // 1. SESSION CHECK
    const sessionRaw = sessionStorage.getItem('user_session');
    
    // If on index.html, let the page handle login logic (don't redirect)
    // If on other pages AND no session, kick to index.html
    if (!sessionRaw) {
        if (!window.location.href.includes('index.html')) {
            window.location.href = 'index.html';
        }
        return; // Stop execution if no user
    }

    const user = JSON.parse(sessionRaw);
    window.CurrentUser = user; // Make available globally

    // 2. UI UPDATE (Sidebar & Name)
    window.addEventListener('DOMContentLoaded', () => {
        // A. Show User Name
        const brand = document.querySelector('.brand');
        if (brand) {
            brand.innerHTML = `
                <div style="line-height:1.2;">
                    🚀 MoneyWise <br>
                    <span style="font-size:11px; font-weight:400; opacity:0.8;">
                        👤 ${user.name} (${user.role.toUpperCase()})
                    </span>
                </div>
            `;
        }

        // B. Add Logout Button
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            // Check if logout already exists to prevent duplicate
            if (!document.getElementById('logoutBtn')) {
                const a = document.createElement('a');
                a.id = 'logoutBtn';
                a.className = 'nav-link';
                a.style.marginTop = 'auto';
                a.style.color = '#ef4444'; // Red
                a.style.cursor = 'pointer';
                a.innerHTML = '<span class="nav-icon">🚪</span> Logout';
                a.onclick = () => {
                    if (confirm("Sign out?")) {
                        sessionStorage.clear();
                        window.location.href = 'index.html';
                    }
                };
                sidebar.appendChild(a);
            }
        }

        // 3. PERMISSION ENFORCEMENT (The Gatekeeper)
        
        // RULE: Operators cannot access sensitive pages
        if (user.role === 'operator') {
            const restricted = ['settings.html', 'reports.html', 'coa.html', 'taxation.html'];
            
            // Hide Links
            restricted.forEach(page => {
                const link = document.querySelector(`a[href="${page}"]`);
                if (link) link.style.display = 'none';
            });

            // Block Direct URL Access
            const currentPage = window.location.pathname.split('/').pop();
            if (restricted.includes(currentPage)) {
                alert("⛔ ACCESS DENIED: Operators cannot access this area.");
                window.location.href = 'index.html';
            }
        }

        // RULE: Hide 'Delete' buttons for Non-Admins
        if (user.role !== 'admin') {
            const style = document.createElement('style');
            style.innerHTML = `
                .btn-del, .btn-danger, .del-row, button[onclick*="delete"], .delete-btn {
                    display: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    });
})();