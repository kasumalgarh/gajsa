/* FILENAME: db.js
   PURPOSE: Complete ERP Engine (Double-Entry + Stock Safety + Backup + Auto-Healing)
   VERSION: 17.0 (Auto-Fix Indexes)
   AUTHOR: Money Wise Pro
*/

class MoneyWiseDB {
    constructor() {
        this.dbName = "MoneyWise_Pro_DB";
        this.dbVersion = 17; // Version Bumped to force upgrade
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const tx = event.target.transaction;

                // --- 1. GROUPS ---
                if (!db.objectStoreNames.contains("groups")) {
                    const store = db.createObjectStore("groups", { keyPath: "id", autoIncrement: true });
                    store.createIndex("name", "name", { unique: true });
                    this._seedGroups(store);
                }

                // --- 2. STATES ---
                if (!db.objectStoreNames.contains("states")) {
                    const store = db.createObjectStore("states", { keyPath: "code" });
                    this._seedIndianStates(store);
                }

                // --- 3. LEDGERS ---
                if (!db.objectStoreNames.contains("ledgers")) {
                    const store = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                    store.createIndex("name", "name", { unique: true });
                    store.createIndex("group_id", "group_id");
                }

                // --- 4. UNITS ---
                if (!db.objectStoreNames.contains("units")) {
                    const store = db.createObjectStore("units", { keyPath: "id", autoIncrement: true });
                    store.createIndex("name", "name", { unique: true });
                    this._seedDefaultUnits(store);
                }

                // --- 5. ITEMS ---
                if (!db.objectStoreNames.contains("items")) {
                    const store = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                    store.createIndex("name", "name", { unique: true });
                    store.createIndex("sku", "sku");
                }

                // --- 6. VOUCHERS (The Fix for Index Error) ---
                let vStore;
                if (!db.objectStoreNames.contains("vouchers")) {
                    vStore = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                } else {
                    vStore = tx.objectStore("vouchers");
                }
                
                // Ensure Indexes exist
                if (!vStore.indexNames.contains("voucher_no")) {
                    vStore.createIndex("voucher_no", "voucher_no", { unique: true });
                }
                if (!vStore.indexNames.contains("date")) {
                    vStore.createIndex("date", "date");
                }
                if (!vStore.indexNames.contains("type")) {
                    vStore.createIndex("type", "type");
                }

                // --- 7. ENTRIES ---
                if (!db.objectStoreNames.contains("entries")) {
                    const store = db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
                    store.createIndex("voucher_id", "voucher_id");
                    store.createIndex("item_id", "item_id");
                }

                // --- 8. ACCT ENTRIES ---
                if (!db.objectStoreNames.contains("acct_entries")) {
                    const store = db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true });
                    store.createIndex("voucher_id", "voucher_id");
                    store.createIndex("ledger_id", "ledger_id");
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("MoneyWise DB Ready - v17.0");
                this._ensureSystemLedgers().then(() => resolve(this.db));
            };

            request.onerror = (e) => {
                console.error("DB Open Error:", e);
                // Auto-recover if version error
                if(e.target.error.name === 'VersionError') {
                    alert("Database version conflict. Please clear browser data.");
                }
                reject(e.target.error);
            };
        });
    }

    // --- SEEDING ---
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
            {code:"01", name:"Jammu and Kashmir"}, {code:"02", name:"Himachal Pradesh"}, {code:"03", name:"Punjab"},
            {code:"04", name:"Chandigarh"}, {code:"05", name:"Uttarakhand"}, {code:"06", name:"Haryana"},
            {code:"07", name:"Delhi"}, {code:"08", name:"Rajasthan"}, {code:"09", name:"Uttar Pradesh"},
            {code:"10", name:"Bihar"}, {code:"11", name:"Sikkim"}, {code:"12", name:"Arunachal Pradesh"},
            {code:"13", name:"Nagaland"}, {code:"14", name:"Manipur"}, {code:"15", name:"Mizoram"},
            {code:"16", name:"Tripura"}, {code:"17", name:"Meghalaya"}, {code:"18", name:"Assam"},
            {code:"19", name:"West Bengal"}, {code:"20", name:"Jharkhand"}, {code:"21", name:"Odisha"},
            {code:"22", name:"Chhattisgarh"}, {code:"23", name:"Madhya Pradesh"}, {code:"24", name:"Gujarat"},
            {code:"26", name:"Dadra and Nagar Haveli"}, {code:"27", name:"Maharashtra"}, {code:"29", name:"Karnataka"},
            {code:"30", name:"Goa"}, {code:"31", name:"Lakshadweep"}, {code:"32", name:"Kerala"},
            {code:"33", name:"Tamil Nadu"}, {code:"34", name:"Puducherry"}, {code:"35", name:"Andaman and Nicobar"},
            {code:"36", name:"Telangana"}, {code:"37", name:"Andhra Pradesh"}, {code:"38", name:"Ladakh"}
        ];
        states.forEach(s => store.put(s));
    }

    _seedDefaultUnits(store) {
        [{name:"Pcs"}, {name:"Kg"}, {name:"Box"}, {name:"Nos"}, {name:"Mtr"}, {name:"Ltr"}].forEach(u => store.add(u));
    }

    async _ensureSystemLedgers() {
        const required = [
            { name: "Cash-in-Hand", group: "Cash-in-Hand", opening_balance: 50000, dr_cr: "Dr" },
            { name: "Local Sales", group: "Sales Accounts", dr_cr: "Cr" },
            { name: "Inter-State Sales", group: "Sales Accounts", dr_cr: "Cr" },
            { name: "Local Purchase", group: "Purchase Accounts", dr_cr: "Dr" },
            { name: "Inter-State Purchase", group: "Purchase Accounts", dr_cr: "Dr" },
            { name: "Output CGST", group: "Duties & Taxes", dr_cr: "Cr" },
            { name: "Output SGST", group: "Duties & Taxes", dr_cr: "Cr" },
            { name: "Output IGST", group: "Duties & Taxes", dr_cr: "Cr" },
            { name: "Input CGST", group: "Duties & Taxes", dr_cr: "Dr" },
            { name: "Input SGST", group: "Duties & Taxes", dr_cr: "Dr" },
            { name: "Input IGST", group: "Duties & Taxes", dr_cr: "Dr" }
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

    // --- HELPERS ---
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

    // --- GETTERS ---
    async getLedgers() { return this.getAll("ledgers"); }
    async getItems() { return this.getAll("items"); }
    async getGroups() { return this.getAll("groups"); }
    async getUnits() { return this.getAll("units"); }
    async getStates() { return this.getAll("states"); }
    async getStockGroups() { return [{name: "General"}, {name: "Electronics"}]; }

    async getAll(storeName) {
        return new Promise(resolve => {
            const tx = this.db.transaction(storeName, "readonly");
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => console.error(`getAll(${storeName}) failed:`, e);
        });
    }

    // --- CRUD ---
    async createLedger(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("ledgers", "readwrite");
            const store = tx.objectStore("ledgers");
            const req = data.id ? store.put(data) : store.add(data);
            req.onsuccess = () => resolve({ id: req.result });
            req.onerror = () => reject("Error creating ledger (Duplicate Name?)");
        });
    }

    async deleteLedger(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("ledgers", "readwrite");
            tx.objectStore("ledgers").delete(id);
            tx.oncomplete = () => resolve("deleted");
        });
    }

    async createItem(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("items", "readwrite");
            const store = tx.objectStore("items");
            
            if (data.id) {
                const getReq = store.get(data.id);
                getReq.onsuccess = () => {
                    const old = getReq.result;
                    data.current_stock = old?.current_stock || 0;
                    store.put(data);
                    resolve({ id: data.id });
                };
            } else {
                data.current_stock = parseFloat(data.op_qty) || 0;
                const addReq = store.add(data);
                addReq.onsuccess = () => resolve({ id: addReq.result });
            }
        });
    }

    async deleteItem(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("items", "readwrite");
            const store = tx.objectStore("items");
            store.delete(id);
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    // --- TRANSACTION ---
    async saveVoucher(voucherData, inventoryEntries = [], acctEntries = []) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["vouchers", "entries", "acct_entries", "items", "ledgers"], "readwrite");
            
            tx.onerror = (e) => {
                console.error("Save Voucher Failed:", e.target.error);
                reject(e.target.error);
            };

            // Voucher No Check
            const vStore = tx.objectStore("vouchers");
            const checkReq = vStore.index("voucher_no").get(voucherData.voucher_no);
            
            checkReq.onsuccess = () => {
                if (checkReq.result && checkReq.result.id !== voucherData.id) {
                    tx.abort();
                    reject("Duplicate Voucher Number!");
                    return;
                }

                const vReq = voucherData.id ? vStore.put(voucherData) : vStore.add(voucherData);
                
                vReq.onsuccess = (e) => {
                    const vid = e.target.result;

                    // Inventory
                    if (inventoryEntries.length > 0) {
                        const iStore = tx.objectStore("items");
                        const eStore = tx.objectStore("entries");
                        inventoryEntries.forEach(ent => {
                            ent.voucher_id = vid;
                            eStore.add(ent);
                            
                            const iReq = iStore.get(ent.item_id);
                            iReq.onsuccess = () => {
                                const item = iReq.result;
                                if(item) {
                                    const change = ent.qty * (voucherData.type === 'Sales' ? -1 : 1);
                                    const newStock = (item.current_stock || 0) + change;
                                    
                                    if (newStock < 0 && voucherData.type === 'Sales') {
                                        console.warn(`Negative Stock: ${item.name}`);
                                    }

                                    item.current_stock = newStock;
                                    if(voucherData.type === 'Purchase') item.std_cost = ent.rate;
                                    iStore.put(item);
                                }
                            };
                        });
                    }

                    // Accounting
                    if (acctEntries.length > 0) {
                        const aeStore = tx.objectStore("acct_entries");
                        acctEntries.forEach(ae => {
                            ae.voucher_id = vid;
                            aeStore.add(ae);
                        });
                    }
                };
            };
            
            tx.oncomplete = () => resolve({ success: true });
        });
    }

    // --- BACKUP ---
    async exportBackup() {
        try {
            const data = {};
            const stores = ["groups", "states", "ledgers", "units", "items", "vouchers", "entries", "acct_entries"];
            for (const s of stores) {
                data[s] = await this.getAll(s);
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `MoneyWise_Backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        } catch(e) {
            console.error("Backup Failed:", e);
            alert("Backup Failed! Check console.");
        }
    }
}

const DB = new MoneyWiseDB();