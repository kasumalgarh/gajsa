/* FILENAME: db.js
   PURPOSE: Core Database Engine (Multi-User, Roles & Audit Trail)
   VERSION: 20.0
   AUTHOR: Money Wise Pro Team
*/

class MoneyWiseDB {
    constructor() {
        this.dbName = "MoneyWise_Pro_DB";
        this.dbVersion = 20; // Version upgraded for User Management system
        this.db = null;
    }

    // --- INITIALIZATION ---
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const tx = event.target.transaction;

                // 1. GROUPS TABLE
                if (!db.objectStoreNames.contains("groups")) {
                    const s = db.createObjectStore("groups", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                    this._seedGroups(s);
                }

                // 2. STATES TABLE
                if (!db.objectStoreNames.contains("states")) {
                    const s = db.createObjectStore("states", { keyPath: "code" });
                    this._seedIndianStates(s);
                }

                // 3. LEDGERS TABLE
                if (!db.objectStoreNames.contains("ledgers")) {
                    const s = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                    s.createIndex("group_id", "group_id");
                }

                // 4. UNITS TABLE
                if (!db.objectStoreNames.contains("units")) {
                    const s = db.createObjectStore("units", { keyPath: "id", autoIncrement: true });
                    this._seedDefaultUnits(s);
                }

                // 5. ITEMS TABLE
                if (!db.objectStoreNames.contains("items")) {
                    const s = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                }

                // 6. VOUCHERS TABLE
                let vStore;
                if (!db.objectStoreNames.contains("vouchers")) {
                    vStore = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                } else {
                    vStore = tx.objectStore("vouchers");
                }
                // Ensure indexes exist (safe check)
                if (!vStore.indexNames.contains("voucher_no")) vStore.createIndex("voucher_no", "voucher_no", { unique: true });
                if (!vStore.indexNames.contains("date")) vStore.createIndex("date", "date");
                if (!vStore.indexNames.contains("type")) vStore.createIndex("type", "type");

                // 7. INVENTORY ENTRIES TABLE
                if (!db.objectStoreNames.contains("entries")) {
                    const s = db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_id", "voucher_id");
                }

                // 8. ACCOUNTING ENTRIES TABLE
                if (!db.objectStoreNames.contains("acct_entries")) {
                    const s = db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_id", "voucher_id");
                }

                // 9. SETTINGS TABLE
                if (!db.objectStoreNames.contains("settings")) {
                    db.createObjectStore("settings", { keyPath: "id" });
                }

                // 10. LOGS TABLE (For Audit Trail)
                if (!db.objectStoreNames.contains("logs")) {
                    const s = db.createObjectStore("logs", { keyPath: "id", autoIncrement: true });
                    s.createIndex("date", "timestamp");
                }

                // 11. USERS TABLE (New for Login System)
                if (!db.objectStoreNames.contains("users")) {
                    const s = db.createObjectStore("users", { keyPath: "username" });
                    
                    // Create Default Super Admin
                    const adminUser = { 
                        username: "admin", 
                        password: "123", // In production, this should be hashed
                        role: "admin", 
                        name: "Super Admin",
                        created_at: new Date()
                    };
                    s.add(adminUser);
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Database v20.0 Initialized Successfully");
                this._ensureSystemLedgers().then(() => resolve(this.db));
            };

            request.onerror = (event) => {
                console.error("Database Error:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    // --- USER MANAGEMENT FUNCTIONS (NEW) ---
    
    async loginUser(username, password) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("users", "readonly");
            const store = tx.objectStore("users");
            const req = store.get(username);
            
            req.onsuccess = () => {
                const user = req.result;
                if (user && user.password === password) {
                    this.logAction("Auth", "Login", `User Logged In: ${username}`);
                    resolve(user);
                } else {
                    reject("Invalid Username or PIN");
                }
            };
            req.onerror = () => reject("Database Error");
        });
    }

    async createUser(userData) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("users", "readwrite");
            const store = tx.objectStore("users");
            const req = store.add(userData);
            
            req.onsuccess = () => {
                this.logAction("UserMgmt", "Create", `New User Created: ${userData.username} (${userData.role})`);
                resolve(true);
            };
            req.onerror = () => reject("Username already exists");
        });
    }

    async deleteUser(username) {
        if(username === 'admin') return Promise.reject("Cannot delete Super Admin");
        
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("users", "readwrite");
            const store = tx.objectStore("users");
            const req = store.delete(username);
            
            req.onsuccess = () => {
                this.logAction("UserMgmt", "Delete", `User Deleted: ${username}`);
                resolve(true);
            };
            req.onerror = () => reject("Delete Failed");
        });
    }

    async getUsers() {
        return this.getAll("users");
    }

    // --- AUDIT LOGGING SYSTEM ---
    
    async logAction(module, action, description) {
        try {
            // Check who is currently logged in (from Session)
            const currentUser = sessionStorage.getItem('currentUser') || 'System';
            
            const tx = this.db.transaction("logs", "readwrite");
            const store = tx.objectStore("logs");
            store.add({
                timestamp: new Date(),
                module: module,
                action: action,
                description: description,
                user: currentUser
            });
        } catch(e) { 
            console.error("Logging Failed:", e); 
        }
    }

    async getLogs() {
        return this.getAll('logs');
    }

    // --- DATA SEEDING (DEFAULT DATA) ---

    _seedGroups(store) {
        const groups = [
            { name: "Capital Account", nature: "Liability" },
            { name: "Current Liabilities", nature: "Liability" },
            { name: "Sundry Creditors", nature: "Liability", parent: "Current Liabilities" },
            { name: "Duties & Taxes", nature: "Liability", parent: "Current Liabilities" },
            { name: "Current Assets", nature: "Asset" },
            { name: "Sundry Debtors", nature: "Asset", parent: "Current Assets" },
            { name: "Cash-in-Hand", nature: "Asset", parent: "Current Assets" },
            { name: "Stock-in-Hand", nature: "Asset", parent: "Current Assets" },
            { name: "Sales Accounts", nature: "Income" },
            { name: "Purchase Accounts", nature: "Expense" },
            { name: "Indirect Expenses", nature: "Expense" },
            { name: "Bank Accounts", nature: "Asset", parent: "Current Assets" }
        ];
        groups.forEach(g => store.add(g));
    }

    _seedIndianStates(store) {
        const states = [
            {code:"08", name:"Rajasthan"}, {code:"07", name:"Delhi"}, {code:"06", name:"Haryana"},
            {code:"09", name:"Uttar Pradesh"}, {code:"27", name:"Maharashtra"}, {code:"24", name:"Gujarat"},
            {code:"10", name:"Bihar"}, {code:"23", name:"Madhya Pradesh"}, {code:"03", name:"Punjab"},
            {code:"33", name:"Tamil Nadu"}, {code:"29", name:"Karnataka"}, {code:"19", name:"West Bengal"}
        ];
        states.forEach(s => store.put(s));
    }

    _seedDefaultUnits(store) {
        const units = [
            {name:"Pcs"}, {name:"Kg"}, {name:"Box"}, {name:"Nos"}, {name:"Mtr"}, {name:"Ltr"}
        ];
        units.forEach(u => store.add(u));
    }

    async _ensureSystemLedgers() {
        const required = [
            { name: "Cash-in-Hand", group: "Cash-in-Hand", opening_balance: 0 },
            { name: "Local Sales", group: "Sales Accounts" },
            { name: "Inter-State Sales", group: "Sales Accounts" },
            { name: "Local Purchase", group: "Purchase Accounts" },
            { name: "Inter-State Purchase", group: "Purchase Accounts" },
            { name: "Output CGST", group: "Duties & Taxes" },
            { name: "Output SGST", group: "Duties & Taxes" },
            { name: "Output IGST", group: "Duties & Taxes" },
            { name: "Input CGST", group: "Duties & Taxes" },
            { name: "Input SGST", group: "Duties & Taxes" },
            { name: "Input IGST", group: "Duties & Taxes" }
        ];

        for (const r of required) {
            const groupId = await this.getGroupId(r.group);
            if (!groupId) continue;
            const exists = await this.getLedgerId(r.name);
            if (!exists) {
                await this.createLedger({ 
                    name: r.name, 
                    group_id: groupId, 
                    opening_balance: r.opening_balance || 0 
                });
            }
        }
    }

    // --- HELPER METHODS ---

    async getGroupId(name) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("groups", "readonly");
            const req = tx.objectStore("groups").index("name").get(name);
            req.onsuccess = () => resolve(req.result?.id || null);
        });
    }

    async getLedgerId(name) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("ledgers", "readonly");
            const req = tx.objectStore("ledgers").index("name").get(name);
            req.onsuccess = () => resolve(req.result?.id || null);
        });
    }

    // --- GENERIC GETTERS ---

    async getAll(storeName) {
        return new Promise(resolve => {
            const tx = this.db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = (e) => resolve(e.target.result);
        });
    }

    async getLedgers() { return this.getAll('ledgers'); }
    async getItems() { return this.getAll('items'); }
    async getGroups() { return this.getAll('groups'); }
    async getStates() { return this.getAll('states'); }
    async getUnits() { return this.getAll("units"); }

    // --- SETTINGS CRUD ---

    async saveSettings(data) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("settings", "readwrite");
            data.id = "company_profile"; 
            tx.objectStore("settings").put(data);
            
            // Log this action
            this.logAction("Settings", "Update", "Company Profile Updated");
            
            tx.oncomplete = () => resolve(true);
        });
    }

    async getSettings() {
        return new Promise((resolve) => {
            const tx = this.db.transaction("settings", "readonly");
            const req = tx.objectStore("settings").get("company_profile");
            req.onsuccess = () => resolve(req.result || null);
        });
    }

    // --- CORE CRUD OPERATIONS (WITH LOGGING) ---

    async createLedger(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("ledgers", "readwrite");
            const store = tx.objectStore("ledgers");
            const req = data.id ? store.put(data) : store.add(data);
            
            req.onsuccess = () => {
                this.logAction("Ledger", data.id ? "Edit" : "Create", `Ledger: ${data.name}`);
                resolve({ id: req.result });
            };
            req.onerror = () => reject("Error: Ledger Save Failed");
        });
    }

    async deleteLedger(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("ledgers", "readwrite");
            tx.objectStore("ledgers").delete(id);
            
            this.logAction("Ledger", "Delete", `Deleted Ledger ID: ${id}`);
            
            tx.oncomplete = () => resolve("deleted");
        });
    }

    async createItem(data) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("items", "readwrite");
            const store = tx.objectStore("items");
            
            if (data.id) {
                // Update existing
                store.get(data.id).onsuccess = (e) => {
                    const old = e.target.result;
                    data.current_stock = old?.current_stock || 0;
                    store.put(data);
                    this.logAction("Inventory", "Edit", `Item Updated: ${data.name}`);
                    resolve({ id: data.id });
                };
            } else {
                // Create new
                data.current_stock = parseFloat(data.op_qty) || 0;
                store.add(data).onsuccess = (e) => {
                    this.logAction("Inventory", "Create", `Item Created: ${data.name}`);
                    resolve({ id: e.target.result });
                }
            }
        });
    }

    async deleteItem(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("items", "readwrite");
            tx.objectStore("items").delete(id);
            
            this.logAction("Inventory", "Delete", `Deleted Item ID: ${id}`);
            
            tx.oncomplete = () => resolve(true);
        });
    }

    // --- TRANSACTION HANDLING (VOUCHERS) ---

    async deleteVoucher(id) {
        return new Promise((resolve, reject) => {
             const tx = this.db.transaction(['vouchers', 'acct_entries', 'entries'], 'readwrite');
             
             // 1. Delete main voucher record
             tx.objectStore('vouchers').delete(id);
             
             // 2. Cleanup Account Entries
             const acctStore = tx.objectStore('acct_entries');
             const idx = acctStore.index('voucher_id');
             idx.getAllKeys(id).onsuccess = (e) => {
                 e.target.result.forEach(key => acctStore.delete(key));
             };

             // 3. Cleanup Inventory Entries 
             // (Note: For a fully strict accounting system, stock should be reversed here. 
             // Currently, we are just removing the record for V1 consistency)
             const invStore = tx.objectStore('entries');
             const idx2 = invStore.index('voucher_id');
             idx2.getAllKeys(id).onsuccess = (e) => {
                 e.target.result.forEach(key => invStore.delete(key));
             };

             this.logAction("Voucher", "Delete", `Deleted Voucher ID: ${id}`);

             tx.oncomplete = () => resolve(true);
             tx.onerror = (e) => reject(e);
        });
    }

    async saveVoucher(vData, invEntries, acctEntries) {
        return new Promise((resolve, reject) => {
            // Open transaction across all related stores
            const tx = this.db.transaction(["vouchers", "entries", "acct_entries", "items", "ledgers", "logs"], "readwrite");
            
            const vStore = tx.objectStore("vouchers");
            const checkReq = vStore.index("voucher_no").get(vData.voucher_no);
            
            checkReq.onsuccess = () => {
                // Duplicate Check
                if(checkReq.result && checkReq.result.id !== vData.id) {
                    return reject("Duplicate Voucher No");
                }
                
                // Save Voucher
                const vReq = vData.id ? vStore.put(vData) : vStore.add(vData);
                
                vReq.onsuccess = (e) => {
                    const vid = e.target.result;
                    
                    // Log the action
                    const actionType = vData.id ? "Edit" : "Create";
                    const logStore = tx.objectStore("logs");
                    logStore.add({
                        timestamp: new Date(),
                        module: "Voucher",
                        action: actionType,
                        description: `${vData.type} #${vData.voucher_no} (₹${vData.amount})`,
                        user: sessionStorage.getItem('currentUser') || 'System'
                    });

                    // Save Inventory Entries
                    const eStore = tx.objectStore("entries");
                    const iStore = tx.objectStore("items");
                    
                    invEntries.forEach(ent => {
                        ent.voucher_id = vid;
                        eStore.add(ent);
                        
                        // Update Stock Logic
                        iStore.get(ent.item_id).onsuccess = (ev) => {
                            const item = ev.target.result;
                            if(item) {
                                const change = ent.qty * (vData.type === 'Sales' ? -1 : 1);
                                item.current_stock = (item.current_stock || 0) + change;
                                
                                // Update Cost Price on Purchase
                                if(vData.type === 'Purchase') {
                                    item.std_cost = ent.rate;
                                }
                                iStore.put(item);
                            }
                        };
                    });

                    // Save Account Entries
                    const aeStore = tx.objectStore("acct_entries");
                    acctEntries.forEach(ae => {
                        ae.voucher_id = vid;
                        aeStore.add(ae);
                    });
                };
            };

            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // --- BACKUP & EXPORT ---

    async exportBackup() {
        try {
            const data = {};
            const stores = [
                "groups", "states", "ledgers", "units", 
                "items", "vouchers", "entries", "acct_entries", 
                "settings", "logs", "users" // Included new stores
            ];
            
            for (const s of stores) {
                data[s] = await this.getAll(s);
            }
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `MoneyWise_Backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            
            this.logAction("System", "Backup", "Full System Backup Downloaded");
        } catch(e) { 
            console.error(e);
            alert("Backup Failed"); 
        }
    }
}

// Initialize Global DB Instance
const DB = new MoneyWiseDB();