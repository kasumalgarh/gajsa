/* FILENAME: db.js
   PURPOSE: Core Engine (v11.0 - GST Ready)
*/

class ArthBookDB {
    constructor() {
        this.dbName = "ArthBook_DB";
        this.dbVersion = 28; 
        this.db = null;
        this.currentUser = JSON.parse(sessionStorage.getItem('user_session')) || { role: 'admin', username: 'Owner' };
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("vouchers")) {
                    const s = db.createObjectStore("vouchers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("type", "type"); s.createIndex("date", "date"); s.createIndex("voucher_no", "voucher_no", { unique: true });
                }
                if (!db.objectStoreNames.contains("acct_entries")) {
                    const s = db.createObjectStore("acct_entries", { keyPath: "id", autoIncrement: true });
                    s.createIndex("voucher_id", "voucher_id"); s.createIndex("ledger_id", "ledger_id");
                }
                if (!db.objectStoreNames.contains("ledgers")) {
                    const s = db.createObjectStore("ledgers", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                }
                if (!db.objectStoreNames.contains("groups")) {
                    const s = db.createObjectStore("groups", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                }
                if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                if (!db.objectStoreNames.contains("audit_logs")) db.createObjectStore("audit_logs", { keyPath: "id", autoIncrement: true });
                if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
                if (!db.objectStoreNames.contains("users")) {
                    const s = db.createObjectStore("users", { keyPath: "id", autoIncrement: true });
                    s.createIndex("username", "username", { unique: true });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                await this.seedInitialData();
                resolve(this.db);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async seedInitialData() {
        const groups = await this.getAll('groups');
        if (groups.length === 0) {
            const tx = this.db.transaction(['groups', 'ledgers'], 'readwrite');
            const gStore = tx.objectStore('groups');
            const lStore = tx.objectStore('ledgers');

            const defaultGroups = [
                { id: 1, name: "Capital Account", nature: "Liability" },
                { id: 2, name: "Loans (Liability)", nature: "Liability" },
                { id: 3, name: "Current Liabilities", nature: "Liability" },
                { id: 4, name: "Fixed Assets", nature: "Asset" },
                { id: 5, name: "Current Assets", nature: "Asset" },
                { id: 6, name: "Sales Accounts", nature: "Income" },
                { id: 7, name: "Purchase Accounts", nature: "Expense" },
                { id: 8, name: "Direct Expenses", nature: "Expense" },
                { id: 9, name: "Indirect Expenses", nature: "Expense" },
                { id: 10, name: "Indirect Incomes", nature: "Income" },
                { id: 11, name: "Duties & Taxes", nature: "Liability" }, 
                { id: 12, name: "Sundry Creditors", nature: "Liability" }, 
                { id: 13, name: "Sundry Debtors", nature: "Asset" }, 
                { id: 14, name: "Cash-in-Hand", nature: "Asset" }, 
                { id: 15, name: "Bank Accounts", nature: "Asset" } 
            ];
            defaultGroups.forEach(g => gStore.put(g));

            // --- GST LEDGERS (UPDATED) ---
            const defaultLedgers = [
                { name: "Cash", group_id: 14, opening_balance: 0 },
                { name: "Profit & Loss A/c", group_id: 1, opening_balance: 0 },
                { name: "Local Sales", group_id: 6, opening_balance: 0 },
                { name: "Inter-State Sales", group_id: 6, opening_balance: 0 }, // For IGST Sales
                { name: "Local Purchase", group_id: 7, opening_balance: 0 },
                { name: "Inter-State Purchase", group_id: 7, opening_balance: 0 }, // For IGST Purchase
                
                // DUTIES & TAXES (Split Logic)
                { name: "Input CGST", group_id: 11, opening_balance: 0 },
                { name: "Input SGST", group_id: 11, opening_balance: 0 },
                { name: "Input IGST", group_id: 11, opening_balance: 0 },
                
                { name: "Output CGST", group_id: 11, opening_balance: 0 },
                { name: "Output SGST", group_id: 11, opening_balance: 0 },
                { name: "Output IGST", group_id: 11, opening_balance: 0 }
            ];
            defaultLedgers.forEach(l => lStore.put(l));
        }
    }

    // --- STANDARD METHODS ---
    async getAll(storeName) {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction(storeName, 'readonly');
            tx.objectStore(storeName).getAll().onsuccess = (e) => resolve(e.target.result || []);
        });
    }

    async getOne(storeName, id) {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction(storeName, 'readonly');
            tx.objectStore(storeName).get(id).onsuccess = (e) => resolve(e.target.result);
        });
    }

    async saveItem(itemData) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('items', 'readwrite');
            const store = tx.objectStore('items');
            const request = itemData.id ? store.put(itemData) : store.add(itemData);
            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getNextVoucherNo(type) {
        if (!this.db) await this.init();
        return new Promise(resolve => {
            const tx = this.db.transaction('vouchers', 'readonly');
            tx.objectStore('vouchers').index('type').getAll(type).onsuccess = (e) => {
                const list = e.target.result;
                if(list.length === 0) resolve(1);
                const max = list.reduce((m, v) => {
                    const num = parseInt(v.voucher_no.split('-')[1]) || 0;
                    return num > m ? num : m;
                }, 0);
                resolve(max + 1);
            };
        });
    }

    async saveVoucherTransaction(voucherData, entriesData) {
        if (!this.db) await this.init();
        if (voucherData.date && voucherData.date.length === 6) {
            const dd = voucherData.date.slice(0,2), mm = voucherData.date.slice(2,4), yy = voucherData.date.slice(4,6);
            voucherData.date = `20${yy}-${mm}-${dd}`;
        }
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["vouchers", "acct_entries", "audit_logs", "items"], "readwrite");
            const vStore = tx.objectStore("vouchers");
            const eStore = tx.objectStore("acct_entries");
            const iStore = tx.objectStore("items");

            if(voucherData.id) { 
                eStore.index("voucher_id").getAll(voucherData.id).onsuccess = (ev) => {
                    ev.target.result.forEach(entry => {
                        if(entry.meta_data) {
                            let meta = typeof entry.meta_data === 'string' ? JSON.parse(entry.meta_data) : entry.meta_data;
                            if(meta.item_id) {
                                iStore.get(meta.item_id).onsuccess = (iEv) => {
                                    const item = iEv.target.result;
                                    if(item) {
                                        const qty = parseFloat(meta.qty) || 0;
                                        if(voucherData.type === 'Sales') item.current_stock += qty;
                                        else if(voucherData.type === 'Purchase') item.current_stock -= qty;
                                        iStore.put(item);
                                    }
                                };
                            }
                        }
                        eStore.delete(entry.id);
                    });
                };
            }

            const vRequest = voucherData.id ? vStore.put(voucherData) : vStore.add(voucherData);
            vRequest.onsuccess = (e) => {
                const voucherId = voucherData.id || e.target.result;
                entriesData.forEach(entry => {
                    entry.voucher_id = voucherId;
                    let meta = entry.meta_data;
                    if(typeof meta === 'string') { try { meta = JSON.parse(meta); } catch(e){} }

                    if(meta && meta.item_id) {
                        const qty = parseFloat(meta.qty) || 0;
                        iStore.get(meta.item_id).onsuccess = (iEv) => {
                            const item = iEv.target.result;
                            if(item) {
                                let current = parseFloat(item.current_stock) || 0;
                                if(voucherData.type === 'Sales') current -= qty;
                                else if(voucherData.type === 'Purchase') current += qty;
                                item.current_stock = current;
                                iStore.put(item);
                            }
                        };
                    }
                    if(typeof entry.meta_data === 'object') entry.meta_data = JSON.stringify(entry.meta_data);
                    eStore.add(entry);
                });
                tx.objectStore("audit_logs").add({ timestamp: new Date().toISOString(), action: voucherData.id ? "EDIT" : "CREATE", desc: `${voucherData.type} #${voucherData.voucher_no}`, user: this.currentUser.username });
            };
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async saveSettings(data) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('settings', 'readwrite');
            data.id = 'config'; 
            tx.objectStore('settings').put(data);
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e);
        });
    }
    
    async getSettings() {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction('settings', 'readonly');
            tx.objectStore('settings').get('config').onsuccess = (e) => resolve(e.target.result || {});
        });
    }
}
const DB = new ArthBookDB();