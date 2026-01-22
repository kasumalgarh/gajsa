/* FILENAME: db.js
   PURPOSE: Bookkeeping & Billing Platinum - Core Database Engine
   VERSION: 2.0 (Powered Up with Transaction Engine & Auto-Sync)
*/

class ArthBookDB {
    constructor() {
        this.dbName = "ArthBook_DB";
        this.dbVersion = 24; 
        this.db = null;
        this.currentUser = JSON.parse(sessionStorage.getItem('user_session')) || { role: 'admin', username: 'admin' };
    }

    // --- 1. INITIALIZATION (OLD CODE - UNTOUCHED) ---
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Masters
                if (!db.objectStoreNames.contains("groups")) this._seedGroups(db.createObjectStore("groups", { keyPath: "id", autoIncrement: true }));
                if (!db.objectStoreNames.contains("ledgers")) {
                    const s = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: false });
                    s.createIndex("group_id", "group_id");
                }
                if (!db.objectStoreNames.contains("items")) {
                    const s = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: false });
                    s.createIndex("sku", "sku", { unique: false });
                }

                // Transactions
                if (!db.objectStoreNames.contains("vouchers")) {
                    const s = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_no", "voucher_no", { unique: true });
                    s.createIndex("date", "date");
                    s.createIndex("type", "type");
                }
                if (!db.objectStoreNames.contains("voucher_items")) {
                    const s = db.createObjectStore("voucher_items", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_id", "voucher_id");
                }
                if (!db.objectStoreNames.contains("acct_entries")) {
                    const s = db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_id", "voucher_id");
                    s.createIndex("ledger_id", "ledger_id");
                }

                // System
                if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
                if (!db.objectStoreNames.contains("users")) {
                    const s = db.createObjectStore("users", { keyPath: "username" });
                    s.add({ username: "admin", password: "123", role: "admin", created_at: new Date().toISOString() });
                }
                if (!db.objectStoreNames.contains("audit_chain")) {
                    db.createObjectStore("audit_chain", { keyPath: "id", autoIncrement: true })
                      .add({ timestamp: new Date().toISOString(), module: "System", action: "Genesis" });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log(`✅ Database Ready`);
                window.dispatchEvent(new CustomEvent('backup-status', { detail: 'local_ok' }));
                this._ensureSystemLedgers().then(() => resolve(this.db));
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 2. CORE READ/WRITE (OLD CODE - UNTOUCHED) ---
    async getAll(storeName) {
        if (!this.db) await this.init();
        return new Promise(resolve => {
            if (!this.db.objectStoreNames.contains(storeName)) return resolve([]);
            const tx = this.db.transaction(storeName, "readonly");
            tx.objectStore(storeName).getAll().onsuccess = (e) => resolve(e.target.result || []);
        });
    }

    async getOne(storeName, key) {
        if (!this.db) await this.init();
        return new Promise(resolve => {
            const tx = this.db.transaction(storeName, "readonly");
            tx.objectStore(storeName).get(key).onsuccess = (e) => resolve(e.target.result);
        });
    }

    async login(username, password) {
        const user = await this.getOne('users', username);
        if (!user) throw new Error("User not found");
        // Simple check + Security Utils support
        if (user.password === password || (window.Security && await Security.hashPassword(password) === user.password)) {
            this.currentUser = user;
            sessionStorage.setItem('user_session', JSON.stringify(user));
            return user;
        }
        throw new Error("Invalid password");
    }

    // ============================================================
    // 🔥 NEW POWER ENGINE START (FOR IDS ENTRY & SYNC)
    // ============================================================

    // A. Advanced Transaction Saver (Double Entry System)
    async saveVoucherTransaction(voucherData, entriesData) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            // Transaction across multiple stores for safety
            const tx = this.db.transaction(["vouchers", "acct_entries", "audit_chain"], "readwrite");
            
            // 1. Header Save
            const vStore = tx.objectStore("vouchers");
            const vRequest = voucherData.id ? vStore.put(voucherData) : vStore.add(voucherData);

            vRequest.onsuccess = (e) => {
                const voucherId = voucherData.id || e.target.result;

                // 2. Entries Cleanup (If Editing)
                const eStore = tx.objectStore("acct_entries");
                if (voucherData.id) {
                    // Simple cleanup: Delete old entries for this voucher (Not optimal for huge data but safe for local)
                    const idx = eStore.index("voucher_id");
                    const keyRange = IDBKeyRange.only(voucherId);
                    idx.openCursor(keyRange).onsuccess = (cursorEvent) => {
                        const cursor = cursorEvent.target.result;
                        if (cursor) { cursor.delete(); cursor.continue(); }
                    };
                }

                // 3. Save New Entries (Dr/Cr)
                entriesData.forEach(entry => {
                    entry.voucher_id = voucherId;
                    eStore.add(entry);
                });

                // 4. Audit Log
                const auditStore = tx.objectStore("audit_chain");
                auditStore.add({
                    timestamp: new Date().toISOString(),
                    module: "Voucher",
                    action: voucherData.id ? "Edit" : "Create",
                    description: `${voucherData.type} No: ${voucherData.voucher_no}`,
                    user: this.currentUser.username
                });
            };

            tx.oncomplete = () => {
                console.log("✅ Transaction Committed");
                this._triggerAutoSync(); // 🔥 Auto Cloud Sync
                resolve(true);
            };

            tx.onerror = (e) => {
                console.error("❌ Transaction Failed", e);
                reject(e.target.error);
            };
        });
    }

    // B. Auto Voucher Numbering (Smart Logic)
    async getNextVoucherNo(type) {
        if (!this.db) await this.init();
        const vouchers = await this.getAll('vouchers');
        
        // Filter by type
        const typeVouchers = vouchers.filter(v => v.type === type);
        if(typeVouchers.length === 0) return 1;

        // Find max number
        const nums = typeVouchers.map(v => {
            const parts = v.voucher_no.split('-'); // Assumes format TYPE-123
            return parseInt(parts[parts.length - 1]) || 0;
        });
        
        return (Math.max(...nums) || 0) + 1;
    }

    // C. Stock Checking Guard (For Phase 4)
    async checkStockAvailability(itemId, qtyNeeded) {
        const item = await this.getOne('items', itemId);
        if (!item) return false;
        return (item.current_stock || 0) >= qtyNeeded;
    }

    // D. Helper: Trigger Background Sync
    async _triggerAutoSync() {
        const settings = await this.getAll('settings');
        const config = settings.find(s => s.id === 'global');
        if (config && config.auto_backup_enabled) {
            console.log("☁️ Triggering Auto-Sync...");
            // Use existing backup logic via Event or direct call
            // We use a small timeout to let the UI update first
            setTimeout(async () => {
                const data = await this.getFullBackup();
                if(config.github_token && config.github_repo) {
                    await this.syncToGithub(config.github_token, config.github_repo, 'cloud_backup.json', data);
                    window.dispatchEvent(new CustomEvent('backup-status', { detail: 'success' }));
                }
                if(window.localDirHandle) {
                    await this.syncToLocal(window.localDirHandle, data);
                }
            }, 2000);
        }
    }

    // ============================================================
    // 🔥 POWER ENGINE END
    // ============================================================

    // --- 3. BACKUP ENGINE (OLD CODE - UNTOUCHED) ---
    async getFullBackup() {
        const stores = ["groups", "ledgers", "items", "vouchers", "voucher_items", "acct_entries", "settings", "users", "audit_chain"];
        const backup = {};
        for (const s of stores) { 
            let data = await this.getAll(s);
            if (s === 'settings') { // Security Strip
                data = data.map(setting => {
                    const safe = { ...setting };
                    if (safe.github_token) safe.github_token = ""; 
                    return safe;
                });
            }
            backup[s] = data; 
        }
        return JSON.stringify(backup, null, 2);
    }

    async syncToGithub(token, repo, filename, content) {
        const url = `https://api.github.com/repos/${repo}/contents/${filename}`;
        try {
            const getRes = await fetch(`${url}?t=${Date.now()}`, { 
                headers: { 'Authorization': `token ${token}` }, cache: 'no-store' 
            });
            let sha = null;
            if (getRes.ok) {
                const json = await getRes.json();
                sha = json.sha;
            }
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: "Auto Backup: " + new Date().toLocaleString(),
                    content: btoa(unescape(encodeURIComponent(content))),
                    sha: sha
                })
            });
            return res.ok;
        } catch (e) { console.error("Git Error", e); return false; }
    }

    async syncToLocal(dirHandle, content) {
        try {
            const fileHandle = await dirHandle.getFileHandle('backup_data.json', { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            return true;
        } catch (e) { console.error("Local Save Error", e); return false; }
    }

    // --- 4. SEEDING & UTILS (OLD CODE - UNTOUCHED) ---
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

// --- 5. GLOBAL HELPERS (Compat for settings.html) ---
DB.getSettings = async function() { return this.getOne('settings', 'global') || {}; };
DB.saveSettings = async function(data) { 
    const tx = this.db.transaction('settings', 'readwrite');
    data.id = 'global';
    tx.objectStore('settings').put(data);
};
DB.exportBackup = async function() {
    const data = await this.getFullBackup();
    const blob = new Blob([data], {type: "application/json"});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ArthBook_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
};