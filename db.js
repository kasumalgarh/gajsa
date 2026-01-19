/* FILENAME: db.js
   PURPOSE: Money Wise Pro v2.0 - The ERP Engine
   FEATURES: Multi-User, GRN/Finance Split, ITR, Batch Inventory, Audit Log
   VERSION: 21.0 (Major Upgrade)
*/

class MoneyWiseDB {
    constructor() {
        this.dbName = "MoneyWise_Pro_DB";
        this.dbVersion = 21; // Version Bumped for Schema Changes
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

                // --- EXISTING STORES (Maintenance) ---
                if (!db.objectStoreNames.contains("groups")) this._seedGroups(db.createObjectStore("groups", { keyPath: "id", autoIncrement: true }));
                if (!db.objectStoreNames.contains("ledgers")) {
                    const s = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                    s.createIndex("group_id", "group_id");
                }
                if (!db.objectStoreNames.contains("items")) {
                    const s = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                    // v21 Update: Add Barcode Index
                    s.createIndex("sku", "sku", { unique: false }); 
                } else {
                    // Upgrade existing Item Store
                    const store = tx.objectStore("items");
                    if(!store.indexNames.contains("sku")) store.createIndex("sku", "sku", { unique: false });
                }

                if (!db.objectStoreNames.contains("vouchers")) {
                    const s = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_no", "voucher_no", { unique: true });
                    s.createIndex("date", "date");
                    s.createIndex("type", "type");
                }
                
                if (!db.objectStoreNames.contains("entries")) db.createObjectStore("entries", { keyPath: "id", autoIncrement: true }).createIndex("voucher_id", "voucher_id");
                if (!db.objectStoreNames.contains("acct_entries")) db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true }).createIndex("voucher_id", "voucher_id");
                if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
                if (!db.objectStoreNames.contains("logs")) db.createObjectStore("logs", { keyPath: "id", autoIncrement: true }).createIndex("date", "timestamp");

                // --- NEW STORES FOR v2.0 (The 70+ Features Support) ---

                // A. USERS & ROLES (Security)
                if (!db.objectStoreNames.contains("users")) {
                    const s = db.createObjectStore("users", { keyPath: "username" });
                    s.add({ 
                        username: "admin", password: "123", name: "Super Admin", role: "admin", 
                        permissions: ['all'], created_at: new Date() 
                    });
                }

                // B. GRN - PURCHASE DEPT (Store Room)
                if (!db.objectStoreNames.contains("grn_master")) {
                    const s = db.createObjectStore("grn_master", { keyPath: "id", autoIncrement: true });
                    s.createIndex("grn_no", "grn_no", { unique: true });
                    s.createIndex("vendor_id", "vendor_id");
                    s.createIndex("status", "status"); // Pending/Billed
                }
                if (!db.objectStoreNames.contains("grn_items")) {
                    const s = db.createObjectStore("grn_items", { keyPath: "id", autoIncrement: true });
                    s.createIndex("grn_id", "grn_id");
                }

                // C. BATCHES & EXPIRY (Inventory Pro)
                if (!db.objectStoreNames.contains("batches")) {
                    const s = db.createObjectStore("batches", { keyPath: "id", autoIncrement: true });
                    s.createIndex("item_id", "item_id");
                    s.createIndex("batch_no", "batch_no");
                    s.createIndex("expiry", "expiry_date");
                }

                // D. ITR & COMPLIANCE (Taxation)
                if (!db.objectStoreNames.contains("itr_data")) {
                    db.createObjectStore("itr_data", { keyPath: "fy_year" }); // e.g. "2025-26"
                }
                
                // E. METADATA (Sequences & Config)
                if (!db.objectStoreNames.contains("metadata")) {
                    db.createObjectStore("metadata", { keyPath: "key" }); 
                    // Stores last invoice numbers: {key: 'last_inv_sales', val: 105}
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("MoneyWise Pro DB v21.0 (ERP Edition) Ready");
                this._ensureSystemLedgers().then(() => resolve(this.db));
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 2. ADVANCED USER & SECURITY ---
    
    async login(username, password) {
        const user = await this.getOne("users", username);
        if (user && user.password === password) {
            this.currentUser = user;
            sessionStorage.setItem('user_session', JSON.stringify(user));
            this.audit("Auth", "Login", `User ${username} logged in`);
            return user;
        }
        throw new Error("Invalid Credentials");
    }

    can(permission) {
        if(this.currentUser.role === 'admin') return true;
        return this.currentUser.permissions?.includes(permission);
    }

    checkBackDate(dateStr) {
        if(this.currentUser.role === 'admin') return true;
        const today = new Date().toISOString().slice(0, 10);
        if (dateStr < today) throw new Error("⚠️ Security Alert: Back-dated entry not allowed for your role.");
        return true;
    }

    // --- 3. PURCHASE DEPT (GRN) LOGIC ---

    async createGRN(data, items) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["grn_master", "grn_items", "batches", "items", "logs"], "readwrite");
            
            // 1. Save Master
            const masterStore = tx.objectStore("grn_master");
            data.status = "PENDING_BILL"; // Finance hasn't booked it yet
            masterStore.add(data).onsuccess = (e) => {
                const grnId = e.target.result;
                
                // 2. Save Items & Batches
                const itemStore = tx.objectStore("grn_items");
                const batchStore = tx.objectStore("batches");
                const mainItemStore = tx.objectStore("items");

                items.forEach(itm => {
                    itm.grn_id = grnId;
                    itemStore.add(itm);

                    // Add to Batch if exists
                    if(itm.batch_no) {
                        batchStore.add({
                            item_id: itm.item_id,
                            batch_no: itm.batch_no,
                            expiry_date: itm.expiry_date,
                            qty: itm.qty,
                            mfg_date: itm.mfg_date,
                            grn_ref: grnId
                        });
                    }

                    // Update Main Stock (Physical Stock Increase)
                    mainItemStore.get(itm.item_id).onsuccess = (ev) => {
                        const prod = ev.target.result;
                        if(prod) {
                            prod.current_stock = (prod.current_stock || 0) + parseFloat(itm.qty);
                            mainItemStore.put(prod);
                        }
                    };
                });

                this.audit("Store", "GRN", `GRN Generated #${data.grn_no}`, tx);
            };

            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject("GRN Failed");
        });
    }

    // --- 4. FINANCE DEPT (BILLING) LOGIC ---

    async saveVoucher(vData, invEntries, acctEntries) {
        // Enforce Security
        this.checkBackDate(vData.date);

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["vouchers", "entries", "acct_entries", "items", "logs", "grn_master"], "readwrite");
            
            // Duplicate Check
            const vStore = tx.objectStore("vouchers");
            const dupCheck = vStore.index("voucher_no").get(vData.voucher_no);
            
            dupCheck.onsuccess = () => {
                if(dupCheck.result && dupCheck.result.id !== vData.id) return reject("Duplicate Voucher No!");

                // Save Voucher
                const req = vData.id ? vStore.put(vData) : vStore.add(vData);
                
                req.onsuccess = (e) => {
                    const vid = e.target.result;
                    
                    // If Linked to GRN, Close GRN
                    if(vData.grn_id) {
                        const grnStore = tx.objectStore("grn_master");
                        grnStore.get(vData.grn_id).onsuccess = (ev) => {
                            const g = ev.target.result;
                            if(g) { g.status = "BILLED"; grnStore.put(g); }
                        }
                    }

                    // Save Inventory (Only update value/stock if NOT GRN linked)
                    // If Sales -> Reduce Stock. If Purchase(Direct) -> Increase Stock.
                    const eStore = tx.objectStore("entries");
                    const iStore = tx.objectStore("items");

                    invEntries.forEach(ent => {
                        ent.voucher_id = vid;
                        eStore.add(ent);
                        
                        // Stock Logic
                        if(vData.type === 'Sales') {
                            iStore.get(ent.item_id).onsuccess = (ev) => {
                                const i = ev.target.result;
                                if(i) {
                                    i.current_stock -= ent.qty;
                                    iStore.put(i);
                                }
                            }
                        } else if (vData.type === 'Purchase' && !vData.grn_id) {
                            // Direct Purchase (No GRN route)
                            iStore.get(ent.item_id).onsuccess = (ev) => {
                                const i = ev.target.result;
                                if(i) {
                                    i.current_stock += ent.qty;
                                    i.std_cost = ent.rate; // Update Cost
                                    iStore.put(i);
                                }
                            }
                        }
                    });

                    // Save Accounts
                    const aStore = tx.objectStore("acct_entries");
                    acctEntries.forEach(ae => { ae.voucher_id = vid; aStore.add(ae); });

                    this.audit("Finance", vData.id ? "Edit Bill" : "New Bill", `${vData.type} #${vData.voucher_no}`, tx);
                };
            };
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 5. ITR & TAXATION ---

    async saveITR(fy, data) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("itr_data", "readwrite");
            data.fy_year = fy;
            data.updated_at = new Date();
            tx.objectStore("itr_data").put(data);
            this.audit("Compliance", "ITR Update", `ITR Data updated for FY ${fy}`);
            tx.oncomplete = () => resolve(true);
        });
    }

    // --- 6. CORE UTILITIES ---

    async audit(module, action, desc, existingTx = null) {
        const entry = {
            timestamp: new Date(),
            user: this.currentUser.username || 'system',
            module, action, description: desc
        };
        if(existingTx) {
            existingTx.objectStore("logs").add(entry);
        } else {
            const tx = this.db.transaction("logs", "readwrite");
            tx.objectStore("logs").add(entry);
        }
    }

    async getOne(store, key) {
        return new Promise(r => {
            const req = this.db.transaction(store, "readonly").objectStore(store).get(key);
            req.onsuccess = () => r(req.result);
        });
    }

    async getAll(store) {
        return new Promise(r => {
            const req = this.db.transaction(store, "readonly").objectStore(store).getAll();
            req.onsuccess = () => r(req.result);
        });
    }

    // Wrappers for ease
    getLedgers() { return this.getAll('ledgers'); }
    getItems() { return this.getAll('items'); }
    getGroups() { return this.getAll('groups'); }
    getSettings() { return this.getOne('settings', 'company_profile'); }

    // --- SEEDING (Initialization) ---
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
        // Creates default ledgers if they don't exist
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