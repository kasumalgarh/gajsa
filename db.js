/* FILENAME: db.js
   PURPOSE: Core Database Engine (Updated for GST Settings)
   VERSION: 18.0
*/

class MoneyWiseDB {
    constructor() {
        this.dbName = "MoneyWise_Pro_DB";
        this.dbVersion = 18; // Version Upgraded
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const tx = event.target.transaction;

                // 1. GROUPS
                if (!db.objectStoreNames.contains("groups")) {
                    const s = db.createObjectStore("groups", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                    this._seedGroups(s);
                }

                // 2. STATES
                if (!db.objectStoreNames.contains("states")) {
                    const s = db.createObjectStore("states", { keyPath: "code" });
                    this._seedIndianStates(s);
                }

                // 3. LEDGERS
                if (!db.objectStoreNames.contains("ledgers")) {
                    const s = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                    s.createIndex("group_id", "group_id");
                }

                // 4. UNITS
                if (!db.objectStoreNames.contains("units")) {
                    const s = db.createObjectStore("units", { keyPath: "id", autoIncrement: true });
                    this._seedDefaultUnits(s);
                }

                // 5. ITEMS
                if (!db.objectStoreNames.contains("items")) {
                    const s = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                }

                // 6. VOUCHERS
                let vStore;
                if (!db.objectStoreNames.contains("vouchers")) {
                    vStore = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                } else {
                    vStore = tx.objectStore("vouchers");
                }
                if (!vStore.indexNames.contains("voucher_no")) vStore.createIndex("voucher_no", "voucher_no", { unique: true });
                if (!vStore.indexNames.contains("date")) vStore.createIndex("date", "date");
                if (!vStore.indexNames.contains("type")) vStore.createIndex("type", "type");

                // 7. ENTRIES
                if (!db.objectStoreNames.contains("entries")) {
                    const s = db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_id", "voucher_id");
                }

                // 8. ACCT ENTRIES
                if (!db.objectStoreNames.contains("acct_entries")) {
                    const s = db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_id", "voucher_id");
                }

                // --- 9. SETTINGS (NEW FOR GST) ---
                if (!db.objectStoreNames.contains("settings")) {
                    db.createObjectStore("settings", { keyPath: "id" });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("DB v18 Ready");
                this._ensureSystemLedgers().then(() => resolve(this.db));
            };
            request.onerror = (e) => reject(e);
        });
    }

    // --- SEEDING DATA ---
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
        [{name:"Pcs"}, {name:"Kg"}, {name:"Box"}, {name:"Nos"}, {name:"Mtr"}, {name:"Ltr"}].forEach(u => store.add(u));
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
                await this.createLedger({ name: r.name, group_id: groupId, opening_balance: r.opening_balance || 0 });
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

    // --- GETTERS ---
    async getAll(storeName) {
        return new Promise(resolve => {
            const tx = this.db.transaction(storeName, "readonly");
            tx.objectStore(storeName).getAll().onsuccess = (e) => resolve(e.target.result);
        });
    }
    async getLedgers() { return this.getAll('ledgers'); }
    async getItems() { return this.getAll('items'); }
    async getGroups() { return this.getAll('groups'); }
    async getStates() { return this.getAll('states'); }
    async getUnits() { return this.getAll("units"); }

    // --- SETTINGS (NEW) ---
    async saveSettings(data) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("settings", "readwrite");
            data.id = "company_profile"; 
            tx.objectStore("settings").put(data);
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

    // --- CRUD OPERATIONS ---
    async createLedger(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("ledgers", "readwrite");
            const store = tx.objectStore("ledgers");
            const req = data.id ? store.put(data) : store.add(data);
            req.onsuccess = () => resolve({ id: req.result });
            req.onerror = () => reject("Error");
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
        return new Promise((resolve) => {
            const tx = this.db.transaction("items", "readwrite");
            const store = tx.objectStore("items");
            if (data.id) {
                store.get(data.id).onsuccess = (e) => {
                    const old = e.target.result;
                    data.current_stock = old?.current_stock || 0;
                    store.put(data);
                    resolve({ id: data.id });
                };
            } else {
                data.current_stock = parseFloat(data.op_qty) || 0;
                store.add(data).onsuccess = (e) => resolve({ id: e.target.result });
            }
        });
    }

    async deleteItem(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("items", "readwrite");
            tx.objectStore("items").delete(id);
            tx.oncomplete = () => resolve(true);
        });
    }

    async saveVoucher(vData, invEntries, acctEntries) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["vouchers", "entries", "acct_entries", "items", "ledgers"], "readwrite");
            
            const vStore = tx.objectStore("vouchers");
            const checkReq = vStore.index("voucher_no").get(vData.voucher_no);
            
            checkReq.onsuccess = () => {
                if(checkReq.result && checkReq.result.id !== vData.id) {
                    return reject("Duplicate Voucher No");
                }
                
                const vReq = vData.id ? vStore.put(vData) : vStore.add(vData);
                vReq.onsuccess = (e) => {
                    const vid = e.target.result;
                    
                    // Inventory
                    const eStore = tx.objectStore("entries");
                    const iStore = tx.objectStore("items");
                    invEntries.forEach(ent => {
                        ent.voucher_id = vid;
                        eStore.add(ent);
                        iStore.get(ent.item_id).onsuccess = (ev) => {
                            const item = ev.target.result;
                            if(item) {
                                const change = ent.qty * (vData.type === 'Sales' ? -1 : 1);
                                item.current_stock = (item.current_stock || 0) + change;
                                if(vData.type === 'Purchase') item.std_cost = ent.rate;
                                iStore.put(item);
                            }
                        };
                    });

                    // Accounts
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

    async exportBackup() {
        try {
            const data = {};
            const stores = ["groups", "states", "ledgers", "units", "items", "vouchers", "entries", "acct_entries", "settings"];
            for (const s of stores) data[s] = await this.getAll(s);
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `MoneyWise_Backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        } catch(e) { alert("Backup Failed"); }
    }
}

const DB = new MoneyWiseDB();