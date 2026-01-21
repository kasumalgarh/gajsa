/* FILENAME: db.js
   PURPOSE: Arth Book Platinum v24.0 - Core Database Engine
   FIXES: Forced Admin Access + System Ledger Auto-Creation
*/

class ArthBookDB {
    constructor() {
        this.dbName = "ArthBook_DB";
        this.dbVersion = 24; // Version bumped to ensure upgrade
        this.db = null;
        
        // FIX: Default to 'admin' to prevent lockout after reset
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

                // === 3. INVENTORY & GRN ===
                if (!db.objectStoreNames.contains("grn_master")) {
                    const store = db.createObjectStore("grn_master", { keyPath: "id", autoIncrement: true });
                    store.createIndex("grn_no", "grn_no", { unique: true });
                }
                
                if (!db.objectStoreNames.contains("grn_items")) {
                    db.createObjectStore("grn_items", { keyPath: "id", autoIncrement: true })
                        .createIndex("grn_id", "grn_id");
                }

                if (!db.objectStoreNames.contains("batches")) {
                    const store = db.createObjectStore("batches", { keyPath: "id", autoIncrement: true });
                    store.createIndex("item_id", "item_id");
                }

                // === 4. SYSTEM & CONFIG ===
                if (!db.objectStoreNames.contains("settings")) {
                    db.createObjectStore("settings", { keyPath: "id" });
                }

                if (!db.objectStoreNames.contains("users")) {
                    const store = db.createObjectStore("users", { keyPath: "username" });
                    store.add({ username: "admin", password: "123", role: "admin", created_at: new Date().toISOString() });
                }

                if (!db.objectStoreNames.contains("projects")) {
                    db.createObjectStore("projects", { keyPath: "id", autoIncrement: true });
                }

                if (!db.objectStoreNames.contains("branches")) {
                    const store = db.createObjectStore("branches", { keyPath: "id", autoIncrement: true });
                    store.add({ id: 1, name: "Head Office", address: "", gstin: "" });
                }

                if (!db.objectStoreNames.contains("audit_chain")) {
                    const store = db.createObjectStore("audit_chain", { keyPath: "id", autoIncrement: true });
                    store.createIndex("timestamp", "timestamp");
                    store.add({
                        timestamp: new Date().toISOString(),
                        module: "System",
                        action: "Genesis",
                        description: "Database Initialized v24",
                        prev_hash: "0",
                        current_hash: "genesis"
                    });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log(`✅ Arth Book DB v${this.dbVersion} Ready`);
                // Auto-create system ledgers on load
                this._ensureSystemLedgers().then(() => resolve(this.db));
            };

            request.onerror = (e) => {
                console.error("❌ DB Error:", e.target.error);
                reject(e.target.error);
            };
        });
    }

    // --- 2. AUTH ---
    async login(username, password) {
        const user = await this.getOne('users', username);
        if (!user) throw new Error("User not found");

        // Allow both plain text (legacy) and hashed passwords
        if (user.password === password || (window.Security && await Security.hashPassword(password) === user.password)) {
            this.currentUser = user;
            sessionStorage.setItem('user_session', JSON.stringify(user));
            this.logAudit("Auth", "Login Success", `User: ${username}`);
            return user;
        }
        throw new Error("Invalid password");
    }

    // --- 3. CORE METHODS ---
    async getAll(storeName) {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            if (!this.db.objectStoreNames.contains(storeName)) {
                console.warn(`Store ${storeName} missing - returning empty`);
                resolve([]);
                return;
            }
            const tx = this.db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
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

    // --- ITEM MASTER ---
    async createItem(data) {
        data.current_stock = parseFloat(data.current_stock) || parseFloat(data.op_qty) || 0;
        return this._put('items', data, "Item Created");
    }

    async updateItem(data) {
        if (data.id) {
            const existing = await this.getOne('items', data.id);
            if (existing) {
                // Preserve stock unless explicitly overwritten
                data.current_stock = existing.current_stock;
            }
        }
        return this._put('items', data, "Item Updated");
    }

    async deleteItem(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('items', 'readwrite');
            const req = tx.objectStore('items').delete(id);
            req.onsuccess = async () => {
                await this.logAudit("Inventory", "Delete", `Item ID ${id} deleted`);
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    }

    async _put(storeName, data, auditDesc) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readwrite');
            const req = tx.objectStore(storeName).put(data);
            req.onsuccess = async () => {
                await this.logAudit("Inventory", auditDesc.split(' ')[0], auditDesc);
                resolve(req.result || data.id);
            };
            req.onerror = () => reject(req.error);
        });
    }

    // --- 4. AUDIT & SYSTEM ---
    async logAudit(module, action, description) {
        if (!this.db) return;
        const tx = this.db.transaction("audit_chain", "readwrite");
        const store = tx.objectStore("audit_chain");
        store.add({
            timestamp: new Date().toISOString(),
            module, action, description,
            user: this.currentUser.username || 'system',
            current_hash: "hash_" + Date.now()
        });
    }

    // --- 5. FIXED: SYSTEM LEDGERS ---
    async _ensureSystemLedgers() {
        const ledgers = await this.getAll("ledgers");
        const groups = await this.getAll("groups");

        const required = [
            { name: "Cash A/c", group: "Cash-in-Hand" },
            { name: "Local Sales", group: "Sales Accounts" },
            { name: "Local Purchase", group: "Purchase Accounts" },
            { name: "Input GST", group: "Duties & Taxes" },
            { name: "Output GST", group: "Duties & Taxes" }
        ];

        const tx = this.db.transaction("ledgers", "readwrite");
        const store = tx.objectStore("ledgers");

        required.forEach(req => {
            if (!ledgers.find(l => l.name === req.name)) {
                const grp = groups.find(g => g.name === req.group);
                if (grp) {
                    store.add({ name: req.name, group_id: grp.id, opening_balance: 0 });
                    console.log(`System Ledger Created: ${req.name}`);
                }
            }
        });

        return new Promise(resolve => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve(); // Non-blocking error
        });
    }

    _seedGroups(store) {
        const groups = [
            { name: "Capital Account", nature: "Liability" },
            { name: "Current Assets", nature: "Asset" },
            { name: "Cash-in-Hand", nature: "Asset", parent: "Current Assets" },
            { name: "Bank Accounts", nature: "Asset", parent: "Current Assets" },
            { name: "Sundry Debtors", nature: "Asset", parent: "Current Assets" },
            { name: "Current Liabilities", nature: "Liability" },
            { name: "Sundry Creditors", nature: "Liability", parent: "Current Liabilities" },
            { name: "Duties & Taxes", nature: "Liability" },
            { name: "Sales Accounts", nature: "Income" },
            { name: "Purchase Accounts", nature: "Expense" },
            { name: "Direct Expenses", nature: "Expense" },
            { name: "Indirect Expenses", nature: "Expense" }
        ];
        groups.forEach(g => store.add(g));
    }
}

// Global Instance
const DB = new ArthBookDB();