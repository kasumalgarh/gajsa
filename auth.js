/* FILENAME: auth.js
   PURPOSE: Security Guard & Role Management
*/

// 1. Check if User is Logged In
const currentUser = JSON.parse(sessionStorage.getItem('currentUser'));

// If no user found AND we are not on the login page, Kick them out!
if (!currentUser && !window.location.href.includes('login.html')) {
    window.location.href = 'login.html';
}

// 2. Role Based Access Control (Permissions)
window.addEventListener('DOMContentLoaded', () => {
    
    // Display User Name in Sidebar (if sidebar exists)
    const brand = document.querySelector('.brand');
    if(brand && currentUser) {
        brand.innerHTML = `
            <div>
                🚀 MoneyWise <span style="font-size:10px; display:block; opacity:0.7; font-weight:normal;">
                👤 ${currentUser.name} (${currentUser.role.toUpperCase()})
                </span>
            </div>
        `;
        
        // Add Logout Button to Sidebar
        const sidebar = document.querySelector('.sidebar');
        if(sidebar) {
            const logoutLink = document.createElement('a');
            logoutLink.className = 'nav-link';
            logoutLink.style.marginTop = 'auto'; // Push to bottom
            logoutLink.style.color = '#ef4444'; // Red color
            logoutLink.innerHTML = '<span class="nav-icon">🚪</span> Logout';
            logoutLink.href = "#";
            logoutLink.onclick = logout;
            sidebar.appendChild(logoutLink);
        }
    }

    // --- RESTRICTIONS BASED ON ROLE ---
    
    if (currentUser) {
        const role = currentUser.role;

        // RULE 1: 'Operator' cannot see Reports or Settings
        if (role === 'operator') {
            hideLink('reports.html');
            hideLink('settings.html');
            hideLink('gst_filing.html');
            hideLink('coa.html'); // Chart of Accounts is sensitive
            
            // If they try to access restricted page directly via URL
            const path = window.location.pathname;
            if(path.includes('reports') || path.includes('settings') || path.includes('gst') || path.includes('coa')) {
                alert("⛔ Access Denied: Operators cannot access this page.");
                window.location.href = 'index.html';
            }
        }

        // RULE 2: 'Manager' cannot see Settings (only Admin can)
        if (role === 'manager') {
            hideLink('settings.html');
             if(window.location.pathname.includes('settings')) {
                alert("⛔ Access Denied: Only Admin can access Settings.");
                window.location.href = 'index.html';
            }
        }

        // RULE 3: Hide Delete Buttons for Non-Admins
        if (role !== 'admin') {
            // Hide existing delete buttons
            const style = document.createElement('style');
            style.innerHTML = `
                .btn-del, .delete-btn, button[onclick*="delete"], button[onclick*="del("] { 
                    display: none !important; 
                }
            `;
            document.head.appendChild(style);
        }
    }
});

function hideLink(filename) {
    const links = document.querySelectorAll(`a[href="${filename}"]`);
    links.forEach(l => l.style.display = 'none');
}

function logout() {
    if(confirm("Logout from System?")) {
        sessionStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    }
}