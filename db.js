/* FILENAME: db.js
   PURPOSE: Bookkeeping & Billing Platinum - Core Database Engine
   FEATURES: Forced Admin Access, System Ledger Auto-Creation, Cloud & Local Backup
*/

class ArthBookDB {
    constructor() {
        this.dbName = "ArthBook_DB";
        this.dbVersion = 24; 
        this.db = null;
        
        // FIX: Default to 'admin' to prevent lockout
        this.currentUser = JSON.parse(sessionStorage.getItem('user_session')) || { role: 'admin', username: 'admin' };
    }

    // --- 1. INITIALIZATION & MIGRATION ---
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // === 1. MASTERS ===
                if (!db.objectStoreNames.contains("groups")) {
                    this._seedGroups(db.createObjectStore("groups", { keyPath: "id", autoIncrement: true }));
                }

                if (!db.objectStoreNames.contains("ledgers")) {
                    const store = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                    store.createIndex("name", "name", { unique: false });
                    store.createIndex("group_id", "group_id");
                }

                if (!db.objectStoreNames.contains("items")) {
                    const store = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                    store.createIndex("name", "name", { unique: false });
                    store.createIndex("sku", "sku", { unique: false });
                } else {
                    const tx = event.target.transaction;
                    const itemStore = tx.objectStore("items");
                    if (!itemStore.indexNames.contains("sku")) {
                        itemStore.createIndex("sku", "sku", { unique: false });
                    }
                }

                // === 2. TRANSACTIONS ===
                if (!db.objectStoreNames.contains("vouchers")) {
                    const store = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                    store.createIndex("voucher_no", "voucher_no", { unique: true });
                    store.createIndex("date", "date");
                    store.createIndex("type", "type");
                    store.createIndex("project_id", "project_id");
                    store.createIndex("branch_id", "branch_id");
                } else {
                    const tx = event.target.transaction;
                    const vStore = tx.objectStore("vouchers");
                    if (!vStore.indexNames.contains("project_id")) vStore.createIndex("project_id", "project_id");
                    if (!vStore.indexNames.contains("branch_id")) vStore.createIndex("branch_id", "branch_id");
                }

                if (!db.objectStoreNames.contains("voucher_items")) {
                    const store = db.createObjectStore("voucher_items", { keyPath: "id", autoIncrement: true });
                    store.createIndex("voucher_id", "voucher_id", { unique: false });
                    store.createIndex("item_id", "item_id", { unique: false });
                }

                if (!db.objectStoreNames.contains("entries")) {
                    db.createObjectStore("entries", { keyPath: "id", autoIncrement: true })
                        .createIndex("voucher_id", "voucher_id");
                }
                
                if (!db.objectStoreNames.contains("acct_entries")) {
                    db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true })
                        .createIndex("voucher_id", "voucher_id");
                }

                // === 3. INVENTORY & SYSTEM ===
                if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
                if (!db.objectStoreNames.contains("users")) {
                    const store = db.createObjectStore("users", { keyPath: "username" });
                    store.add({ username: "admin", password: "123", role: "admin", created_at: new Date().toISOString() });
                }
                if (!db.objectStoreNames.contains("audit_chain")) {
                    const store = db.createObjectStore("audit_chain", { keyPath: "id", autoIncrement: true });
                    store.add({ timestamp: new Date().toISOString(), module: "System", action: "Genesis", current_hash: "genesis" });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log(`✅ Database Ready`);
                
                // Event dispatch kept: Signals DB is initialized
                window.dispatchEvent(new CustomEvent('backup-status', { detail: 'local_ok' }));
                
                this._ensureSystemLedgers().then(() => resolve(this.db));
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 2. AUTH ---
    async login(username, password) {
        const user = await this.getOne('users', username);
        if (!user) throw new Error("User not found");
        if (user.password === password || (window.Security && await Security.hashPassword(password) === user.password)) {
            this.currentUser = user;
            sessionStorage.setItem('user_session', JSON.stringify(user));
            return user;
        }
        throw new Error("Invalid password");
    }

    // --- 3. CORE METHODS ---
    async getAll(storeName) {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            if (!this.db.objectStoreNames.contains(storeName)) return resolve([]);
            const tx = this.db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
        });
    }

    async getOne(storeName, key) {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result);
        });
    }

    // --- 4. BACKUP ENGINE (UPDATED TO FIX SECRET DETECTION) ---
    async getFullBackup() {
        const stores = ["groups", "ledgers", "items", "vouchers", "voucher_items", "acct_entries", "settings", "users", "audit_chain"];
        const backup = {};
        
        for (const s of stores) { 
            let data = await this.getAll(s);
            
            // SECURITY FIX: Remove github_token from the backup file content
            // This prevents GitHub from blocking the upload due to "Secret Detected"
            if (s === 'settings') {
                data = data.map(setting => {
                    const safeSetting = { ...setting }; // Create a copy
                    if (safeSetting.github_token) {
                        safeSetting.github_token = ""; // Wipe token from backup only
                    }
                    return safeSetting;
                });
            }
            
            backup[s] = data; 
        }
        return JSON.stringify(backup, null, 2);
    }

    // --- UPDATED GITHUB SYNC (Fixed 409 Conflict with Cache Busting) ---
    async syncToGithub(token, repo, filename, content) {
        const url = `https://api.github.com/repos/${repo}/contents/${filename}`;
        try {
            // FIX: Append timestamp to URL to force browser to fetch fresh data
            const getResponse = await fetch(`${url}?t=${new Date().getTime()}`, { 
                headers: { 'Authorization': `token ${token}` },
                cache: 'no-store' 
            });
            
            let sha = null;
            if (getResponse.ok) {
                const fileData = await getResponse.json();
                sha = fileData.sha; // Now we get the correct latest SHA
            }

            const body = {
                message: "Auto Backup: " + new Date().toLocaleString(),
                content: btoa(unescape(encodeURIComponent(content))),
                sha: sha // Correct SHA prevents 409 Conflict
            };

            const putResponse = await fetch(url, {
                method: 'PUT',
                headers: { 
                    'Authorization': `token ${token}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(body)
            });
            
            if (!putResponse.ok) {
                 console.error("GitHub Put Error:", await putResponse.text());
            }

            return putResponse.ok;
        } catch (e) { 
            console.error("Git Sync Error:", e); 
            return false; 
        }
    }

    async syncToLocal(dirHandle, content) {
        try {
            const fileHandle = await dirHandle.getFileHandle('backup_data.json', { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (e) { return false; }
    }

    // --- 5. SYSTEM UTILS ---
    async logAudit(module, action, description) {
        if (!this.db) return;
        const tx = this.db.transaction("audit_chain", "readwrite");
        tx.objectStore("audit_chain").add({
            timestamp: new Date().toISOString(), module, action, description,
            user: this.currentUser.username || 'system'
        });
    }

    async _ensureSystemLedgers() {
        const ledgers = await this.getAll("ledgers");
        const groups = await this.getAll("groups");
        const required = [
            { name: "Cash A/c", group: "Cash-in-Hand" },
            { name: "Local Sales", group: "Sales Accounts" },
            { name: "Local Purchase", group: "Purchase Accounts" },
            { name: "Output GST", group: "Duties & Taxes" },
            { name: "Input GST", group: "Duties & Taxes" }
        ];
        const tx = this.db.transaction("ledgers", "readwrite");
        const store = tx.objectStore("ledgers");
        required.forEach(req => {
            if (!ledgers.find(l => l.name === req.name)) {
                const grp = groups.find(g => g.name === req.group);
                if (grp) store.add({ name: req.name, group_id: grp.id, opening_balance: 0 });
            }
        });
    }

    _seedGroups(store) {
        const groups = [
            { name: "Capital Account", nature: "Liability" },
            { name: "Cash-in-Hand", nature: "Asset" },
            { name: "Sundry Debtors", nature: "Asset" },
            { name: "Sundry Creditors", nature: "Liability" },
            { name: "Duties & Taxes", nature: "Liability" },
            { name: "Sales Accounts", nature: "Income" },
            { name: "Purchase Accounts", nature: "Expense" }
        ];
        groups.forEach(g => store.add(g));
    }
}

// Global Instance
const DB = new ArthBookDB();

// --- 6. AUTO-BACKUP TIMER (Every 30 Minutes) ---
setInterval(async () => {
    const settings = await DB.getAll('settings');
    const config = settings.find(s => s.id === 'global') || {};

    if (config.auto_backup_enabled) {
        console.log("🔄 Syncing Data...");
        
        // 1. Tell UI: Work Started
        window.dispatchEvent(new CustomEvent('backup-status', { detail: 'syncing' }));

        try {
            const data = await DB.getFullBackup();
            let githubOk = false;
            let localOk = false;

            if (config.github_token && config.github_repo) {
                githubOk = await DB.syncToGithub(config.github_token, config.github_repo, 'cloud_backup.json', data);
            }

            if (window.localDirHandle) {
                localOk = await DB.syncToLocal(window.localDirHandle, data);
            }

            // 2. Tell UI: Result
            if (githubOk || localOk) {
                console.log("✅ Backup Success");
                window.dispatchEvent(new CustomEvent('backup-status', { detail: 'success' }));
            } else {
                console.warn("⚠️ Backup Skipped or Failed (No targets)");
                window.dispatchEvent(new CustomEvent('backup-status', { detail: 'error' }));
            }

        } catch (err) {
            console.error("Backup Error", err);
            window.dispatchEvent(new CustomEvent('backup-status', { detail: 'error' }));
        }
    }
}, 30 * 60 * 1000);