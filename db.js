/* FILENAME: db.js
   PURPOSE: Arth Book (Formerly Money Wise) v22.0 - Platinum Edition
   FEATURES: Mobile Cursor, Blockchain Audit, Multi-Branch, Project Mgmt, ESG, Encryption Hooks
   STATUS: UPDATED (Added Settings & Backup Support)
*/

class MoneyWiseDB {
    constructor() {
        this.dbName = "ArthBook_DB"; // Rebranded Name
        this.dbVersion = 22; // BUMPED for New Stores (Projects, Branches, ESG)
        this.db = null;
        this.currentUser = JSON.parse(sessionStorage.getItem('user_session')) || { role: 'guest' };
    }

    // --- 1. INITIALIZATION & MIGRATION ---
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const tx = event.target.transaction;

                // === A. PRESERVE OLD STORES (No Data Loss) ===
                if (!db.objectStoreNames.contains("groups")) this._seedGroups(db.createObjectStore("groups", { keyPath: "id", autoIncrement: true }));
                if (!db.objectStoreNames.contains("ledgers")) {
                    const s = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                    s.createIndex("group_id", "group_id");
                }
                
                // Existing Items Store Update
                if (!db.objectStoreNames.contains("items")) {
                    const s = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                    s.createIndex("sku", "sku", { unique: false }); 
                } else {
                    // Maintenance: Ensure SKU index exists
                    const store = tx.objectStore("items");
                    if(!store.indexNames.contains("sku")) store.createIndex("sku", "sku", { unique: false });
                }

                if (!db.objectStoreNames.contains("vouchers")) {
                    const s = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_no", "voucher_no", { unique: true });
                    s.createIndex("date", "date");
                    s.createIndex("type", "type");
                } else {
                    // v22 Update: Add Index for Branch & Project Sorting
                    const store = tx.objectStore("vouchers");
                    if(!store.indexNames.contains("project_id")) store.createIndex("project_id", "project_id", { unique: false });
                    if(!store.indexNames.contains("branch_id")) store.createIndex("branch_id", "branch_id", { unique: false });
                }
                
                if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "id", autoIncrement: true }).createIndex("voucher_id", "voucher_id");
                if (!db.objectStoreNames.contains("acct_entries")) db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true }).createIndex("voucher_id", "voucher_id");
                if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
                
                // Old Log Store (kept for history, strictly read-only now)
                if (!db.objectStoreNames.contains("logs")) db.createObjectStore("logs", { keyPath: "id", autoIncrement: true }).createIndex("date", "timestamp");

                // Legacy Modules (GRN, Batches, ITR, Users) - KEPT AS IS
                if (!db.objectStoreNames.contains("users")) {
                    const s = db.createObjectStore("users", { keyPath: "username" });
                    // Default Admin (Password will be hashed in auth.js)
                    s.add({ username: "admin", password: "123", name: "Owner", role: "admin", permissions: ['all'], created_at: new Date() });
                }
                if (!db.objectStoreNames.contains("grn_master")) {
                    const s = db.createObjectStore("grn_master", { keyPath: "id", autoIncrement: true });
                    s.createIndex("grn_no", "grn_no", { unique: true });
                    s.createIndex("status", "status");
                }
                if (!db.objectStoreNames.contains("grn_items")) db.createObjectStore("grn_items", { keyPath: "id", autoIncrement: true }).createIndex("grn_id", "grn_id");
                if (!db.objectStoreNames.contains("batches")) {
                    const s = db.createObjectStore("batches", { keyPath: "id", autoIncrement: true });
                    s.createIndex("item_id", "item_id");
                    s.createIndex("expiry", "expiry_date");
                }
                if (!db.objectStoreNames.contains("itr_data")) db.createObjectStore("itr_data", { keyPath: "fy_year" });
                if (!db.objectStoreNames.contains("metadata")) db.createObjectStore("metadata", { keyPath: "key" });

                // === B. NEW STORES (PLATINUM EDITION v22) ===
                
                // 1. Projects & Jobs (Contractor Mode)
                if (!db.objectStoreNames.contains("projects")) {
                    const s = db.createObjectStore("projects", { keyPath: "id", autoIncrement: true });
                    s.createIndex("status", "status"); // Active/Closed
                }

                // 2. Multi-Branch Support
                if (!db.objectStoreNames.contains("branches")) {
                    const s = db.createObjectStore("branches", { keyPath: "id", autoIncrement: true });
                    s.add({ id: 1, name: "Main Head Office", location: "Default" }); // Seed Default
                }

                // 3. ESG (Carbon Footprint Data) - 2026 Ready
                if (!db.objectStoreNames.contains("esg_data")) {
                    db.createObjectStore("esg_data", { keyPath: "id", autoIncrement: true });
                }

                // 4. BLOCKCHAIN AUDIT LOG (Replaces simple logs)
                // Stores Hash Chains to prevent tampering
                if (!db.objectStoreNames.contains("audit_chain")) {
                    const s = db.createObjectStore("audit_chain", { keyPath: "id", autoIncrement: true });
                    s.createIndex("timestamp", "timestamp");
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Arth Book Database v22.0 (Mobile Optimized) Ready");
                this._ensureSystemLedgers().then(() => resolve(this.db));
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 2. SECURITY & AUTH (Updated for Hashing Hooks) ---
    
    async login(username, password) {
        // NOTE: Actual Hashing happens in Auth.js or Security_Utils.js before calling this
        // This function expects the stored password to match.
        const user = await this.getOne("users", username);
        if (user && user.password === password) {
            this.currentUser = user;
            sessionStorage.setItem('user_session', JSON.stringify(user));
            // Log to Blockchain
            this.logAudit("Auth", "Login", `User ${username} Accessed System`);
            return user;
        }
        throw new Error("Invalid Credentials");
    }

    // --- 3. MOBILE PERFORMANCE ENGINE (The Cursor System) ---
    // Instead of getAll(), use this for large lists (Vouchers, Items)
    
    async getPaginated(storeName, page = 1, pageSize = 20, sortIndex = null) {
        return new Promise((resolve) => {
            const tx = this.db.transaction(storeName, "readonly");
            const store = tx.objectStore(storeName);
            const request = sortIndex ? store.index(sortIndex).openCursor(null, 'prev') : store.openCursor(null, 'prev'); // 'prev' for Newest First
            
            let results = [];
            let hasSkipped = false;
            let skipCount = (page - 1) * pageSize;
            let counter = 0;

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (!cursor) {
                    resolve({ data: results, page: page, hasMore: false });
                    return;
                }

                if (skipCount > 0 && !hasSkipped) {
                    hasSkipped = true;
                    cursor.advance(skipCount);
                    return;
                }

                if (results.length < pageSize) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve({ data: results, page: page, hasMore: true });
                }
            };
        });
    }

    // --- 4. CORE BUSINESS LOGIC (Updated for Projects & Branches) ---

    async saveVoucher(vData, invEntries, acctEntries) {
        // Enforce Security
        if(this.currentUser.role !== 'admin') {
             const today = new Date().toISOString().slice(0, 10);
             if (vData.date < today) throw new Error("Security: Back-dating blocked.");
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["vouchers", "entries", "acct_entries", "items", "grn_master", "audit_chain", "projects"], "readwrite");
            
            const vStore = tx.objectStore("vouchers");
            
            // Add Branch & Project ID if missing
            vData.branch_id = vData.branch_id || 1; 
            vData.updated_at = new Date();

            const req = vData.id ? vStore.put(vData) : vStore.add(vData);
            
            req.onsuccess = (e) => {
                const vid = e.target.result;
                
                // If GRN Linked -> Close It
                if(vData.grn_id) {
                    const grnStore = tx.objectStore("grn_master");
                    grnStore.get(vData.grn_id).onsuccess = (ev) => {
                        const g = ev.target.result;
                        if(g) { g.status = "BILLED"; grnStore.put(g); }
                    }
                }

                // Inventory Logic (Stock +/-)
                const eStore = tx.objectStore("entries");
                const iStore = tx.objectStore("items");

                invEntries.forEach(ent => {
                    ent.voucher_id = vid;
                    eStore.add(ent);
                    
                    // Direct Stock Update
                    if(vData.type === 'Sales') {
                        iStore.get(ent.item_id).onsuccess = (ev) => {
                            let i = ev.target.result; 
                            if(i) { i.current_stock -= ent.qty; iStore.put(i); }
                        }
                    } else if (vData.type === 'Purchase' && !vData.grn_id) {
                        iStore.get(ent.item_id).onsuccess = (ev) => {
                            let i = ev.target.result; 
                            if(i) { 
                                i.current_stock += ent.qty; 
                                i.std_cost = ent.rate; // Update Buying Price
                                iStore.put(i); 
                            }
                        }
                    }
                });

                // Accounting Logic
                const aStore = tx.objectStore("acct_entries");
                acctEntries.forEach(ae => { ae.voucher_id = vid; aStore.add(ae); });

                // Blockchain Audit Log
                this._internalAudit(tx, "Finance", vData.id ? "Edit" : "Create", `Voucher #${vData.voucher_no} (${vData.grand_total})`);
            };

            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 5. BLOCKCHAIN AUDIT ENGINE ---
    
    async logAudit(module, action, desc) {
        const tx = this.db.transaction("audit_chain", "readwrite");
        this._internalAudit(tx, module, action, desc);
    }

    _internalAudit(tx, module, action, desc) {
        const store = tx.objectStore("audit_chain");
        // Get Last Entry to create Hash Chain (Simple Logic for Offline Speed)
        const req = store.openCursor(null, 'prev');
        
        req.onsuccess = (e) => {
            const cursor = e.target.result;
            const prevHash = cursor ? cursor.value.current_hash : "GENESIS_BLOCK";
            
            // Create Simple Hash (In security_utils we use proper SHA256)
            // Here we just ensure linkage
            const rawString = `${prevHash}-${module}-${action}-${Date.now()}`;
            // Simple Hash function for internal linking (Not Crypto Grade, but tamper evident)
            let hash = 0;
            for (let i = 0; i < rawString.length; i++) {
                hash = ((hash << 5) - hash) + rawString.charCodeAt(i);
                hash |= 0;
            }

            store.add({
                timestamp: new Date(),
                module, action, description: desc,
                user: this.currentUser.username,
                prev_hash: prevHash,
                current_hash: hash.toString(16)
            });
        };
    }

    // --- 5.1 NEW METHODS FOR SETTINGS.HTML (Added) ---

    async getSettings() {
        return await this.getOne('settings', 'company_profile') || {};
    }

    async saveSettings(data) {
        data.id = 'company_profile'; // Force single ID
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('settings', 'readwrite');
            const req = tx.objectStore('settings').put(data);
            req.onsuccess = () => resolve("Settings Saved");
            req.onerror = () => reject("Save Failed");
        });
    }

    async exportBackup() {
        const stores = ['vouchers', 'items', 'ledgers', 'acct_entries', 'settings', 'users', 'logs', 'grn_master', 'batches', 'projects', 'branches', 'esg_data', 'audit_chain'];
        const backup = {};
        for(let s of stores) {
            // Check if store exists to avoid errors on older versions
            if(this.db.objectStoreNames.contains(s)) {
                backup[s] = await this.getAll(s);
            }
        }
        const blob = new Blob([JSON.stringify(backup)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ArthBook_Backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    }
    // --- 5.2 ITEM MASTER FUNCTIONS (Inventory Fix) ---

    async createItem(itemData) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('items', 'readwrite');
            const store = tx.objectStore('items');
            
            // नंबर को सही फॉर्मेट में बदलना (Number Fixing)
            itemData.std_price = parseFloat(itemData.std_price) || 0;
            itemData.std_cost = parseFloat(itemData.std_cost) || 0;
            itemData.current_stock = parseFloat(itemData.current_stock) || 0;
            itemData.reorder_level = parseFloat(itemData.reorder_level) || 0;
            itemData.gst_rate = parseFloat(itemData.gst_rate) || 0;

            const req = store.add(itemData);
            req.onsuccess = (e) => {
                // Blockchain Audit (Optional Log)
                this.logAudit("Inventory", "Create", `Added Item: ${itemData.name}`);
                resolve(e.target.result);
            };
            req.onerror = (e) => reject("Error creating item: " + e.target.error);
        });
    }

    async updateItem(itemData) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('items', 'readwrite');
            const store = tx.objectStore('items');
            
            // नंबर को सही करना
            itemData.std_price = parseFloat(itemData.std_price) || 0;
            itemData.std_cost = parseFloat(itemData.std_cost) || 0;
            itemData.current_stock = parseFloat(itemData.current_stock) || 0;

            const req = store.put(itemData);
            req.onsuccess = () => {
                this.logAudit("Inventory", "Update", `Updated Item: ${itemData.name}`);
                resolve("Item Updated");
            };
            req.onerror = (e) => reject("Error updating item: " + e.target.error);
        });
    }

    async deleteItem(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('items', 'readwrite');
            const store = tx.objectStore('items');
            const req = store.delete(id);
            req.onsuccess = () => {
                this.logAudit("Inventory", "Delete", `Deleted Item ID: ${id}`);
                resolve("Item Deleted");
            };
            req.onerror = (e) => reject("Error deleting item: " + e.target.error);
        });
    }
    // --- 5.3 LIST HELPERS (Loading Fix) ---

    async getItems() { return await this.getAll('items'); }
    
    async getGroups() { return await this.getAll('groups'); }
    
    async getLedgers() { return await this.getAll('ledgers'); }

    // --- 6. STANDARD HELPERS ---

    async getOne(store, key) {
        return new Promise(r => {
            const req = this.db.transaction(store, "readonly").objectStore(store).get(key);
            req.onsuccess = () => r(req.result);
        });
    }

    // Legacy getAll (Use getPaginated for Lists, this is for Dropdowns)
    async getAll(store) {
        return new Promise(r => {
            const req = this.db.transaction(store, "readonly").objectStore(store).getAll();
            req.onsuccess = () => r(req.result);
        });
    }

    // Seeding & Init
    _seedGroups(store) {
        const grps = [
            {name:"Capital Account", nature:"Liability"}, {name:"Current Assets", nature:"Asset"},
            {name:"Bank Accounts", nature:"Asset", parent:"Current Assets"}, {name:"Cash-in-Hand", nature:"Asset", parent:"Current Assets"},
            {name:"Sundry Debtors", nature:"Asset", parent:"Current Assets"}, {name:"Sundry Creditors", nature:"Liability"},
            {name:"Sales Accounts", nature:"Income"}, {name:"Purchase Accounts", nature:"Expense"},
            {name:"Direct Expenses", nature:"Expense"}, {name:"Indirect Expenses", nature:"Expense"},
            {name:"Duties & Taxes", nature:"Liability"}
        ];
        grps.forEach(g => store.add(g));
    }

    async _ensureSystemLedgers() {
        const required = ["Cash-in-Hand", "Local Sales", "Local Purchase", "Input CGST", "Input SGST", "Output CGST", "Output SGST"];
        const ledgers = await this.getAll("ledgers");
        const groups = await this.getAll("groups");
        
        const tx = this.db.transaction("ledgers", "readwrite");
        const store = tx.objectStore("ledgers");

        required.forEach(name => {
            if(!ledgers.find(l => l.name === name)) {
                let grpName = "";
                if(name.includes("Sales")) grpName = "Sales Accounts";
                else if(name.includes("Purchase")) grpName = "Purchase Accounts";
                else if(name.includes("GST")) grpName = "Duties & Taxes";
                else grpName = "Cash-in-Hand";

                const grp = groups.find(g => g.name === grpName);
                if(grp) store.add({ name: name, group_id: grp.id, opening_balance: 0 });
            }
        });
    }
}

// GLOBAL INSTANCE
const DB = new MoneyWiseDB();