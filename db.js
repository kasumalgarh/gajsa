/* FILENAME: db.js
   PURPOSE: Arth Book Core Engine (Ultimate - With Settings & Backup)
   VERSION: 3.10 (Google Drive Integration Added)
*/

class ArthBookDB {
    constructor() {
        this.dbName = "ArthBook_DB";
        this.dbVersion = 28; // Incremented for Users store
        this.db = null;
        this.currentUser = JSON.parse(sessionStorage.getItem('user_session')) || { role: 'admin', username: 'Owner' };
    }

    // --- 1. INITIALIZATION ---
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
                
                // NEW: Users Store for Security
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

    // --- 2. SETTINGS MANAGER ---
    async getSettings() {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction('settings', 'readonly');
            tx.objectStore('settings').get('config').onsuccess = (e) => resolve(e.target.result || {});
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

    // --- 3. SECURITY & LOGIN ---
    async login(username, password) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('users', 'readonly');
            const store = tx.objectStore('users');
            const request = store.getAll();

            request.onsuccess = (e) => {
                const users = e.target.result;
                const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
                
                if (user) {
                    this.currentUser = user;
                    sessionStorage.setItem('user_session', JSON.stringify(user));
                    resolve(true);
                } else {
                    reject("Invalid Username or Password");
                }
            };
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

            const defaultLedgers = [
                { name: "Cash", group_id: 14, opening_balance: 0 },
                { name: "Profit & Loss A/c", group_id: 1, opening_balance: 0 },
                { name: "Local Sales", group_id: 6, opening_balance: 0 },
                { name: "Local Purchase", group_id: 7, opening_balance: 0 },
                { name: "Input CGST", group_id: 11, opening_balance: 0 },
                { name: "Input SGST", group_id: 11, opening_balance: 0 },
                { name: "Output CGST", group_id: 11, opening_balance: 0 },
                { name: "Output SGST", group_id: 11, opening_balance: 0 }
            ];
            defaultLedgers.forEach(l => lStore.put(l));
        }

        const users = await this.getAll('users');
        if (users.length === 0) {
            const uTx = this.db.transaction('users', 'readwrite');
            uTx.objectStore('users').add({
                username: 'admin',
                password: '123',
                role: 'admin',
                name: 'System Admin'
            });
            console.log("🚀 DB: Genesis Admin created (admin/123)");
        }
    }

    // --- 4. BACKUP & CLOUD MANAGER (NEW & IMPROVED) ---
    
    // Original JSON Download Function
    async exportBackup() {
        if (!this.db) await this.init();
        const stores = ['vouchers', 'acct_entries', 'ledgers', 'groups', 'items', 'settings', 'users'];
        const backup = {};
        for (const name of stores) { backup[name] = await this.getAll(name); }
        const blob = new Blob([JSON.stringify(backup, null, 2)], {type : 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ArthBook_Backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    }

    // NEW: GOOGLE DRIVE BACKUP ENGINE
    async backupToGoogleDrive(accessToken) {
        if (!this.db) await this.init();
        const stores = ['vouchers', 'acct_entries', 'ledgers', 'groups', 'items', 'settings', 'users'];
        const backupData = {};
        
        for (const name of stores) {
            backupData[name] = await this.getAll(name);
        }

        const fileName = `ArthBook_Backup_${new Date().toISOString().slice(0,10)}.json`;
        const fileContent = JSON.stringify(backupData, null, 2);

        // Google Drive Multipart Upload
        const metadata = {
            name: fileName,
            mimeType: 'application/json'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        try {
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + accessToken },
                body: form
            });
            const result = await response.json();
            console.log("✅ Drive Backup Success:", result);
            return result;
        } catch (err) {
            console.error("❌ Google Drive Upload Error:", err);
            throw err;
        }
    }

    // Placeholder for Github (Kept as requested)
    async syncToGithub(token, repo, filename, message) {
        console.log("Simulating GitHub Sync...", token, repo);
        return new Promise(r => setTimeout(() => r(true), 1500)); 
    }

    // --- 5. DATA HANDLING ---
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

    async getLedgerBalance(ledgerId) {
        if (!this.db) await this.init();
        const ledger = await this.getOne('ledgers', parseInt(ledgerId));
        let opening = parseFloat(ledger?.opening_balance) || 0;
        const creditNatureGroups = [1, 2, 3, 6, 10, 11, 12]; 
        if (creditNatureGroups.includes(ledger?.group_id)) opening = -Math.abs(opening); 

        return new Promise((resolve) => {
            const tx = this.db.transaction(['acct_entries'], 'readonly');
            tx.objectStore('acct_entries').index('ledger_id').getAll(parseInt(ledgerId)).onsuccess = (e) => {
                const entries = e.target.result;
                let dr = 0, cr = 0;
                entries.forEach(entry => { dr += parseFloat(entry.debit)||0; cr += parseFloat(entry.credit)||0; });
                const net = opening + dr - cr;
                resolve({ dr_total: dr, cr_total: cr, net: net, abs: Math.abs(net), type: net >= 0 ? 'Dr' : 'Cr' });
            };
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
                    if(meta && meta.item_id) {
                        const qty = parseFloat(meta.qty) || 0;
                        iStore.get(meta.item_id).onsuccess = (iEv) => {
                            const item = iEv.target.result;
                            if(item) {
                                if(voucherData.type === 'Sales') item.current_stock -= qty;
                                else if(voucherData.type === 'Purchase') item.current_stock += qty;
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

    async deleteVoucher(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["vouchers", "acct_entries", "audit_logs", "items"], "readwrite");
            const vStore = tx.objectStore("vouchers");
            const eStore = tx.objectStore("acct_entries");
            const iStore = tx.objectStore("items");

            vStore.get(id).onsuccess = (e) => {
                const voucher = e.target.result;
                if(!voucher) { reject("Not found"); return; }
                eStore.index("voucher_id").getAll(id).onsuccess = (ev) => {
                    ev.target.result.forEach(entry => {
                        if(entry.meta_data) {
                            let meta = typeof entry.meta_data === 'string' ? JSON.parse(entry.meta_data) : entry.meta_data;
                            if(meta.item_id) {
                                iStore.get(meta.item_id).onsuccess = (iEv) => {
                                    const item = iEv.target.result;
                                    if(item) {
                                        const qty = parseFloat(meta.qty);
                                        if(voucher.type === 'Sales') item.current_stock += qty;
                                        else if(voucher.type === 'Purchase') item.current_stock -= qty;
                                        iStore.put(item);
                                    }
                                };
                            }
                        }
                        eStore.delete(entry.id);
                    });
                };
                vStore.delete(id);
                tx.objectStore("audit_logs").add({ timestamp: new Date().toISOString(), action: "DELETE", desc: `${voucher.type} #${voucher.voucher_no}`, user: this.currentUser.username });
            };
            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }
}
const DB = new ArthBookDB();