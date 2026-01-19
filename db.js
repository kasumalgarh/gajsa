/* FILENAME: db.js
   PURPOSE: Complete ERP Engine (Full Double-Entry + Async Safe)
   VERSION: 11.0 (Fixed InvalidStateError in Getters)
   AUTHOR: Money Wise Pro
*/

class MoneyWiseDB {
    constructor() {
        this.dbName = "MoneyWise_Pro_DB";
        this.dbVersion = 9; // Version kept same to avoid re-upgrade issues
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // --- TABLES ---
                if (!db.objectStoreNames.contains("groups")) {
                    const g = db.createObjectStore("groups", { keyPath: "id", autoIncrement: true });
                    g.createIndex("name", "name", { unique: true });
                    this._seedMasterChartOfAccounts(g);
                }
                if (!db.objectStoreNames.contains("states")) {
                    const s = db.createObjectStore("states", { keyPath: "code" });
                    this._seedIndianStates(s);
                }
                if (!db.objectStoreNames.contains("ledgers")) {
                    const l = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                    l.createIndex("name", "name", { unique: true });
                    l.createIndex("group_id", "group_id", { unique: false });
                }
                if (!db.objectStoreNames.contains("units")) {
                    const u = db.createObjectStore("units", { keyPath: "id", autoIncrement: true });
                    u.createIndex("name", "name", { unique: true });
                    this._seedDefaultUnits(u);
                }
                if (!db.objectStoreNames.contains("items")) {
                    const i = db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                    i.createIndex("name", "name", { unique: true });
                    i.createIndex("sku", "sku", { unique: false });
                }
                if (!db.objectStoreNames.contains("vouchers")) {
                    const v = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                    v.createIndex("voucher_no", "voucher_no", { unique: true });
                }
                if (!db.objectStoreNames.contains("entries")) {
                    const e = db.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
                    e.createIndex("voucher_id", "voucher_id", { unique: false });
                }
                if (!db.objectStoreNames.contains("acct_entries")) {
                    const ae = db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true });
                    ae.createIndex("voucher_id", "voucher_id", { unique: false });
                    ae.createIndex("ledger_id", "ledger_id", { unique: false });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this._ensureDefaultSystemLedgers();
                console.log("DB Ready: Version 11 (Getters Fixed)");
                resolve(this.db);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- SEEDERS ---
    _seedMasterChartOfAccounts(store) {
        const groups = [
            { name: "Capital Account", nature: "Liability", parent: "Primary" },
            { name: "Reserves & Surplus", nature: "Liability", parent: "Capital Account" },
            { name: "Loans (Liability)", nature: "Liability", parent: "Primary" },
            { name: "Bank OD A/c", nature: "Liability", parent: "Loans (Liability)" },
            { name: "Secured Loans", nature: "Liability", parent: "Loans (Liability)" },
            { name: "Unsecured Loans", nature: "Liability", parent: "Loans (Liability)" },
            { name: "Current Liabilities", nature: "Liability", parent: "Primary" },
            { name: "Duties & Taxes", nature: "Liability", parent: "Current Liabilities" },
            { name: "Provisions", nature: "Liability", parent: "Current Liabilities" },
            { name: "Sundry Creditors", nature: "Liability", parent: "Current Liabilities" },
            { name: "Fixed Assets", nature: "Assets", parent: "Primary" },
            { name: "Investments", nature: "Assets", parent: "Primary" },
            { name: "Current Assets", nature: "Assets", parent: "Primary" },
            { name: "Stock-in-Hand", nature: "Assets", parent: "Current Assets" },
            { name: "Deposits (Asset)", nature: "Assets", parent: "Current Assets" },
            { name: "Loans & Advances (Asset)", nature: "Assets", parent: "Current Assets" },
            { name: "Sundry Debtors", nature: "Assets", parent: "Current Assets" },
            { name: "Cash-in-Hand", nature: "Assets", parent: "Current Assets" },
            { name: "Bank Accounts", nature: "Assets", parent: "Current Assets" },
            { name: "Sales Accounts", nature: "Income", parent: "Primary" },
            { name: "Direct Incomes", nature: "Income", parent: "Primary" },
            { name: "Indirect Incomes", nature: "Income", parent: "Primary" },
            { name: "Purchase Accounts", nature: "Expense", parent: "Primary" },
            { name: "Direct Expenses", nature: "Expense", parent: "Primary" },
            { name: "Indirect Expenses", nature: "Expense", parent: "Primary" },
            { name: "Branch / Divisions", nature: "Liability", parent: "Primary" },
            { name: "Suspense A/c", nature: "Liability", parent: "Primary" },
            { name: "Misc. Expenses (ASSET)", nature: "Assets", parent: "Primary" }
        ];
        groups.forEach(g => store.add(g));
    }

    _seedIndianStates(store) {
        const states = [
            {code:"35", name:"Andaman and Nicobar Islands"}, {code:"37", name:"Andhra Pradesh"},
            {code:"12", name:"Arunachal Pradesh"}, {code:"18", name:"Assam"},
            {code:"10", name:"Bihar"}, {code:"04", name:"Chandigarh"},
            {code:"22", name:"Chhattisgarh"}, {code:"26", name:"Dadra and Nagar Haveli"},
            {code:"07", name:"Delhi"}, {code:"30", name:"Goa"},
            {code:"24", name:"Gujarat"}, {code:"06", name:"Haryana"},
            {code:"02", name:"Himachal Pradesh"}, {code:"01", name:"Jammu and Kashmir"},
            {code:"20", name:"Jharkhand"}, {code:"29", name:"Karnataka"},
            {code:"32", name:"Kerala"}, {code:"38", name:"Ladakh"},
            {code:"31", name:"Lakshadweep"}, {code:"23", name:"Madhya Pradesh"},
            {code:"27", name:"Maharashtra"}, {code:"14", name:"Manipur"},
            {code:"17", name:"Meghalaya"}, {code:"15", name:"Mizoram"},
            {code:"13", name:"Nagaland"}, {code:"21", name:"Odisha"},
            {code:"34", name:"Puducherry"}, {code:"03", name:"Punjab"},
            {code:"08", name:"Rajasthan"}, {code:"11", name:"Sikkim"},
            {code:"33", name:"Tamil Nadu"}, {code:"36", name:"Telangana"},
            {code:"16", name:"Tripura"}, {code:"09", name:"Uttar Pradesh"},
            {code:"05", name:"Uttarakhand"}, {code:"19", name:"West Bengal"}
        ];
        states.forEach(s => store.put(s));
    }

    _seedDefaultUnits(store) {
        const units = [{name:"Pcs"}, {name:"Kg"}, {name:"Box"}, {name:"Nos"}, {name:"Mtr"}, {name:"Ltr"}, {name:"Gm"}, {name:"Doz"}];
        units.forEach(u => store.add(u));
    }

    // --- SYSTEM LEDGERS ---
    async _ensureDefaultSystemLedgers() {
        const salesGroupId = await this.getGroupId("Sales Accounts");
        const dutiesGroupId = await this.getGroupId("Duties & Taxes");
        const cashGroupId = await this.getGroupId("Cash-in-Hand");

        if (!salesGroupId || !dutiesGroupId || !cashGroupId) return;

        const defaults = [
            { name: "Cash-in-Hand", group_id: cashGroupId, opening_balance: 0, dr_cr: "Dr" },
            { name: "Local Sales", group_id: salesGroupId, opening_balance: 0, dr_cr: "Cr" },
            { name: "Inter-State Sales", group_id: salesGroupId, opening_balance: 0, dr_cr: "Cr" },
            { name: "Output CGST", group_id: dutiesGroupId, opening_balance: 0, dr_cr: "Cr" },
            { name: "Output SGST", group_id: dutiesGroupId, opening_balance: 0, dr_cr: "Cr" },
            { name: "Output IGST", group_id: dutiesGroupId, opening_balance: 0, dr_cr: "Cr" }
        ];

        for (const l of defaults) {
            if (!await this.getLedgerId(l.name)) {
                await this.createLedger(l);
            }
        }
    }

    // --- HELPERS (Async) ---
    async getLedgerId(name) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("ledgers", "readonly");
            const index = tx.objectStore("ledgers").index("name");
            const req = index.get(name);
            req.onsuccess = () => resolve(req.result ? req.result.id : null);
            req.onerror = () => resolve(null);
        });
    }

    async getGroupId(name) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("groups", "readonly");
            const index = tx.objectStore("groups").index("name");
            const req = index.get(name);
            req.onsuccess = () => resolve(req.result ? req.result.id : null);
            req.onerror = () => resolve(null);
        });
    }

    // --- CRUD OPERATIONS (FIXED HERE) ---
    // The previous error was because we tried to access .result immediately.
    // Now we wrap it in onsuccess.

    async getLedgers() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("ledgers", "readonly");
            const req = tx.objectStore("ledgers").getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getItems() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("items", "readonly");
            const req = tx.objectStore("items").getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getUnits() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("units", "readonly");
            const req = tx.objectStore("units").getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getGroups() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("groups", "readonly");
            const req = tx.objectStore("groups").getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getStates() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("states", "readonly");
            const req = tx.objectStore("states").getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async createLedger(data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("ledgers", "readwrite");
            const req = data.id ? tx.objectStore("ledgers").put(data) : tx.objectStore("ledgers").add(data);
            req.onsuccess = () => resolve({ id: req.result });
            req.onerror = (e) => reject("Error creating ledger");
        });
    }

    async createItem(data) {
        return new Promise((resolve, reject) => {
            if (!data.id && data.op_qty !== undefined && data.current_stock === undefined) {
                data.current_stock = data.op_qty;
            }
            const tx = this.db.transaction("items", "readwrite");
            const req = data.id ? tx.objectStore("items").put(data) : tx.objectStore("items").add(data);
            req.onsuccess = () => resolve({ id: req.result });
            req.onerror = (e) => reject("Error creating item");
        });
    }

    async deleteLedger(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction("ledgers", "readwrite");
            tx.objectStore("ledgers").delete(id);
            tx.oncomplete = () => resolve("deleted");
        });
    }
}

const DB = new MoneyWiseDB();