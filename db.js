/* FILENAME: db.js
   PURPOSE: Arth Book Core Engine (Double Entry System)
   VERSION: 3.2 (Final Polish: Delete Logic, Strict Date, Enhanced Audit)
*/

class ArthBookDB {
    constructor() {
        this.dbName = "ArthBook_DB";
        this.dbVersion = 26;
        this.db = null;
        this.currentUser = JSON.parse(sessionStorage.getItem('user_session')) || { role: 'admin', username: 'Owner' };
    }

    // --- 1. INITIALIZATION ---
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Core Stores
                if (!db.objectStoreNames.contains("vouchers")) {
                    const s = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("type", "type");
                    s.createIndex("date", "date"); 
                    s.createIndex("voucher_no", "voucher_no", { unique: true });
                }
                if (!db.objectStoreNames.contains("acct_entries")) {
                    const s = db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_id", "voucher_id");
                    s.createIndex("ledger_id", "ledger_id");
                }
                if (!db.objectStoreNames.contains("ledgers")) {
                    const s = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                }
                if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
                if (!db.objectStoreNames.contains("audit_logs")) db.createObjectStore("audit_logs", { keyPath: "id", autoIncrement: true });
                if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 2. GET SINGLE RECORD ---
    async getOne(storeName, key) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // --- 3. THE REAL BALANCE ENGINE ---
    async getLedgerBalance(ledgerId) {
        if (!this.db) await this.init();
        
        // Step 1: Get Ledger & Opening Balance
        const ledger = await this.getOne('ledgers', parseInt(ledgerId));
        let opening = parseFloat(ledger?.opening_balance) || 0;
        
        // Nature Check: Liabilities (Group 1,4,7) & Income (Group 8) treated as Credit (-ve)
        // Groups: 1=Capital, 4=Bank(OD), 7=Creditors, 8=Sales/Income
        const creditNatureGroups = [1, 4, 7, 8]; 
        if (creditNatureGroups.includes(ledger?.group_id)) {
            opening = -Math.abs(opening); 
        }

        // Step 2: Sum Transactions
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['acct_entries'], 'readonly');
            const store = tx.objectStore('acct_entries');
            const index = store.index('ledger_id');
            const request = index.getAll(parseInt(ledgerId));

            request.onsuccess = (e) => {
                const entries = e.target.result;
                let dr = 0, cr = 0;
                
                entries.forEach(entry => {
                    dr += parseFloat(entry.debit) || 0;
                    cr += parseFloat(entry.credit) || 0;
                });
                
                const net = opening + dr - cr;
                
                resolve({ 
                    dr_total: dr, 
                    cr_total: cr, 
                    net: net, 
                    abs: Math.abs(net),
                    type: net >= 0 ? 'Dr' : 'Cr'
                });
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 4. SAVE TRANSACTION (Strict Date & Audit) ---
    async saveVoucherTransaction(voucherData, entriesData) {
        if (!this.db) await this.init();

        // A. BLOCKER: Check Imbalance
        let totalDr = 0, totalCr = 0;
        entriesData.forEach(e => {
            totalDr += parseFloat(e.debit) || 0;
            totalCr += parseFloat(e.credit) || 0;
        });

        if (Math.abs(totalDr - totalCr) > 0.05) {
            throw new Error(`BLOCKER: Voucher Unbalanced by ₹${Math.abs(totalDr - totalCr).toFixed(2)}`);
        }

        // B. AUTO-FILL: Voucher Amount
        voucherData.amount = Math.max(totalDr, totalCr);

        // C. VALIDATION: Strict Date (DDMMYY -> ISO)
        if (voucherData.date && voucherData.date.length === 6) {
            const dd = parseInt(voucherData.date.slice(0,2));
            const mm = parseInt(voucherData.date.slice(2,4));
            const yy = parseInt(voucherData.date.slice(4,6)); // 25 -> 2025

            const fullYear = 2000 + yy;
            
            // Native Date Object Check (Handles Leap Years etc)
            const dateObj = new Date(fullYear, mm - 1, dd);
            
            if (dateObj.getFullYear() !== fullYear || 
                dateObj.getMonth() + 1 !== mm || 
                dateObj.getDate() !== dd) {
                throw new Error(`Invalid Date! ${dd}/${mm}/${yy} is not a valid calendar date.`);
            }

            // Convert to ISO YYYY-MM-DD
            voucherData.date = `${fullYear}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["vouchers", "acct_entries", "audit_logs"], "readwrite");
            
            // 1. Save Header
            const vStore = tx.objectStore("vouchers");
            const vRequest = voucherData.id ? vStore.put(voucherData) : vStore.add(voucherData);

            vRequest.onsuccess = (e) => {
                const voucherId = voucherData.id || e.target.result;
                const eStore = tx.objectStore("acct_entries");

                // If Editing: Delete old entries
                if(voucherData.id) {
                    const idx = eStore.index("voucher_id");
                    const keyRange = IDBKeyRange.only(voucherId);
                    idx.openCursor(keyRange).onsuccess = (cursorEvent) => {
                        const cursor = cursorEvent.target.result;
                        if (cursor) { cursor.delete(); cursor.continue(); }
                    };
                }

                // 2. Save Rows
                entriesData.forEach(entry => {
                    entry.voucher_id = voucherId;
                    if(entry.meta_data && typeof entry.meta_data === 'object') {
                        entry.meta_data = JSON.stringify(entry.meta_data);
                    }
                    eStore.add(entry);
                });

                // 3. ENHANCED AUDIT LOG
                tx.objectStore("audit_logs").add({
                    timestamp: new Date().toISOString(),
                    action: voucherData.id ? "EDIT" : "CREATE",
                    desc: `${voucherData.type} #${voucherData.voucher_no} (Rows: ${entriesData.length}) - ₹${voucherData.amount.toFixed(2)}`,
                    user: this.currentUser.username
                });
            };

            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 5. DELETE VOUCHER (New Feature) ---
    async deleteVoucher(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["vouchers", "acct_entries", "audit_logs"], "readwrite");
            
            // 1. Get Voucher details for Audit
            const vStore = tx.objectStore("vouchers");
            const vReq = vStore.get(id);
            
            vReq.onsuccess = (e) => {
                const voucher = e.target.result;
                if (!voucher) { reject("Voucher not found"); return; }

                // 2. Delete Voucher
                vStore.delete(id);

                // 3. Delete Entries
                const eStore = tx.objectStore("acct_entries");
                const idx = eStore.index("voucher_id");
                const keyRange = IDBKeyRange.only(id);
                
                idx.openCursor(keyRange).onsuccess = (cursorEvent) => {
                    const cursor = cursorEvent.target.result;
                    if (cursor) { cursor.delete(); cursor.continue(); }
                };

                // 4. Audit Log
                tx.objectStore("audit_logs").add({
                    timestamp: new Date().toISOString(),
                    action: "DELETE",
                    desc: `${voucher.type} #${voucher.voucher_no} - ₹${voucher.amount}`,
                    user: this.currentUser.username
                });
            };

            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 6. AUTO NUMBERING ---
    async getNextVoucherNo(type) {
        if (!this.db) await this.init();
        const tx = this.db.transaction('vouchers', 'readonly');
        const req = tx.objectStore('vouchers').index('type').getAll(type);

        return new Promise(resolve => {
            req.onsuccess = (e) => {
                const list = e.target.result;
                if(list.length === 0) resolve(1);
                const max = list.reduce((m, v) => {
                    const parts = v.voucher_no.split('-');
                    const num = parseInt(parts[parts.length-1]) || 0;
                    return num > m ? num : m;
                }, 0);
                resolve(max + 1);
            };
        });
    }

    // --- UTILS ---
    async getAll(storeName) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    }
}

const DB = new ArthBookDB();