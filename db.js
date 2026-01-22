/* FILENAME: db.js
   PURPOSE: Arth Book Core Engine (Double Entry System)
   VERSION: 3.6 (Feature: Auto-Seed Default Groups & Ledgers + Stock Reversal)
*/

class ArthBookDB {
    constructor() {
        this.dbName = "ArthBook_DB";
        this.dbVersion = 27; 
        this.db = null;
        this.currentUser = JSON.parse(sessionStorage.getItem('user_session')) || { role: 'admin', username: 'Owner' };
    }

    // --- 1. INITIALIZATION ---
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create Stores if they don't exist
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
                    s.createIndex("name", "name", { unique: true });
                }
                if (!db.objectStoreNames.contains("groups")) { // New: Groups Store
                    const s = db.createObjectStore("groups", { keyPath: "id", autoIncrement: true });
                    s.createIndex("name", "name", { unique: true });
                }
                if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", { keyPath: "id" });
                if (!db.objectStoreNames.contains("audit_logs")) db.createObjectStore("audit_logs", { keyPath: "id", autoIncrement: true });
                
                if (!db.objectStoreNames.contains("items")) {
                    db.createObjectStore("items", { keyPath: "id", autoIncrement: true });
                }
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                // CALL SEED DATA HERE
                await this.seedInitialData();
                resolve(this.db);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 1.5 DATA SEEDING (AUTO SETUP) ---
    async seedInitialData() {
        // Check if groups exist
        const groups = await this.getAll('groups');
        if (groups.length > 0) return; // Already setup

        console.log("⚙️ System: First Run - Seeding Default Accounts...");

        const tx = this.db.transaction(['groups', 'ledgers'], 'readwrite');
        const gStore = tx.objectStore('groups');
        const lStore = tx.objectStore('ledgers');

        // 1. STANDARD GROUPS (Tally Style)
        // We use manual IDs to ensure linking is correct
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
            // Sub-Groups (Linked via Parent logic if needed, but keeping flat for simplicity first)
            { id: 11, name: "Duties & Taxes", nature: "Liability" }, // Under Curr Liab
            { id: 12, name: "Sundry Creditors", nature: "Liability" }, // Under Curr Liab
            { id: 13, name: "Sundry Debtors", nature: "Asset" }, // Under Curr Asset
            { id: 14, name: "Cash-in-Hand", nature: "Asset" }, // Under Curr Asset
            { id: 15, name: "Bank Accounts", nature: "Asset" } // Under Curr Asset
        ];

        defaultGroups.forEach(g => gStore.put(g));

        // 2. ESSENTIAL LEDGERS
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

        return new Promise(resolve => {
            tx.oncomplete = () => {
                console.log("✅ System: Default Accounts Created!");
                resolve();
            };
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
        
        // Nature Check
        // Groups 1(Cap), 2(Loan), 3(CL), 6(Sales), 10(Ind Inc), 11(Tax), 12(Creditors) are Credit Nature
        const creditNatureGroups = [1, 2, 3, 6, 10, 11, 12]; 
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

    // --- 4. SAVE TRANSACTION (With Stock Logic) ---
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
            const yy = parseInt(voucherData.date.slice(4,6));
            const fullYear = 2000 + yy;
            voucherData.date = `${fullYear}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
        }

        return new Promise(async (resolve, reject) => {
            // FIX: Transaction must include 'items' for stock update
            const tx = this.db.transaction(["vouchers", "acct_entries", "audit_logs", "items"], "readwrite");
            
            const vStore = tx.objectStore("vouchers");
            const eStore = tx.objectStore("acct_entries");
            const iStore = tx.objectStore("items");

            // --- CRITICAL FIX: If Editing, Reverse Old Stock First ---
            if(voucherData.id) {
                const idx = eStore.index("voucher_id");
                const oldReq = idx.getAll(voucherData.id);
                
                oldReq.onsuccess = (ev) => {
                    const oldEntries = ev.target.result;
                    // REVERSE OLD STOCK
                    oldEntries.forEach(entry => {
                        if(entry.meta_data) {
                            let meta = (typeof entry.meta_data === 'string') ? JSON.parse(entry.meta_data) : entry.meta_data;
                            if(meta.item_id) {
                                // Need to reverse item stock
                                const itemId = parseInt(meta.item_id);
                                const qty = parseFloat(meta.qty) || 0;
                                const iReq = iStore.get(itemId);
                                iReq.onsuccess = (iEv) => {
                                    const item = iEv.target.result;
                                    if(item) {
                                        // LOGIC: Reverse of what happened before
                                        if(voucherData.type === 'Sales') item.current_stock += qty;
                                        else if(voucherData.type === 'Purchase') item.current_stock -= qty;
                                        else if(voucherData.type === 'Credit Note') item.current_stock -= qty;
                                        else if(voucherData.type === 'Debit Note') item.current_stock += qty;
                                        iStore.put(item);
                                    }
                                };
                            }
                        }
                        eStore.delete(entry.id); // Clear old entry
                    });
                };
            }

            // 1. Save Header
            const vRequest = voucherData.id ? vStore.put(voucherData) : vStore.add(voucherData);

            vRequest.onsuccess = (e) => {
                const voucherId = voucherData.id || e.target.result;

                // 2. Save Rows & UPDATE STOCK
                entriesData.forEach(entry => {
                    entry.voucher_id = voucherId;
                    
                    // --- STOCK UPDATE LOGIC (FORWARD) ---
                    let meta = entry.meta_data;
                    
                    if(meta && typeof meta === 'object' && meta.item_id) {
                        const itemId = parseInt(meta.item_id);
                        const qty = parseFloat(meta.qty) || 0;
                        
                        const itemReq = iStore.get(itemId);
                        itemReq.onsuccess = (ev) => {
                            const item = ev.target.result;
                            if(item) {
                                let currentStock = parseFloat(item.current_stock) || 0;
                                
                                if(voucherData.type === 'Sales') currentStock -= qty;
                                else if(voucherData.type === 'Purchase') currentStock += qty;
                                else if(voucherData.type === 'Credit Note') currentStock += qty; // Return In
                                else if(voucherData.type === 'Debit Note') currentStock -= qty;  // Return Out
                                
                                item.current_stock = currentStock;
                                iStore.put(item); 
                            }
                        };
                    }

                    if(entry.meta_data && typeof entry.meta_data === 'object') {
                        entry.meta_data = JSON.stringify(entry.meta_data);
                    }
                    eStore.add(entry);
                });

                // 3. Audit Log
                tx.objectStore("audit_logs").add({
                    timestamp: new Date().toISOString(),
                    action: voucherData.id ? "EDIT" : "CREATE",
                    desc: `${voucherData.type} #${voucherData.voucher_no} - ₹${voucherData.amount.toFixed(2)}`,
                    user: this.currentUser.username
                });
            };

            tx.oncomplete = () => resolve(true);
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // --- 5. DELETE VOUCHER (Fixed: Stock Reversal) ---
    async deleteVoucher(id) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(["vouchers", "acct_entries", "audit_logs", "items"], "readwrite");
            
            const vStore = tx.objectStore("vouchers");
            const eStore = tx.objectStore("acct_entries");
            const iStore = tx.objectStore("items");
            
            // 1. Get Voucher Info
            const vReq = vStore.get(id);
            
            vReq.onsuccess = (e) => {
                const voucher = e.target.result;
                if (!voucher) { reject("Voucher not found"); return; }

                // 2. Get All Entries
                const idx = eStore.index("voucher_id");
                const entReq = idx.getAll(id);

                entReq.onsuccess = (ev) => {
                    const entries = ev.target.result;

                    // 3. REVERSE STOCK LOOP
                    entries.forEach(entry => {
                        if(entry.meta_data) {
                            let meta = (typeof entry.meta_data === 'string') ? JSON.parse(entry.meta_data) : entry.meta_data;
                            
                            // If this entry has an Item ID, we must reverse stock
                            if(meta.item_id) {
                                const itemId = parseInt(meta.item_id);
                                const qty = parseFloat(meta.qty) || 0;
                                
                                const iReq = iStore.get(itemId);
                                iReq.onsuccess = (iEv) => {
                                    const item = iEv.target.result;
                                    if(item) {
                                        // REVERSE LOGIC (Opposite of Save)
                                        if(voucher.type === 'Sales') item.current_stock += qty; // Add back
                                        else if(voucher.type === 'Purchase') item.current_stock -= qty; // Remove
                                        else if(voucher.type === 'Credit Note') item.current_stock -= qty; 
                                        else if(voucher.type === 'Debit Note') item.current_stock += qty;
                                        iStore.put(item);
                                    }
                                };
                            }
                        }
                        // 4. Delete entry
                        eStore.delete(entry.id);
                    });
                };

                // 5. Delete Header
                vStore.delete(id);

                // 6. Log
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
    
    // --- 7. GET VOUCHER BY NO ---
    async getVoucherByNo(vNo) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('vouchers', 'readonly');
            const index = tx.objectStore('vouchers').index('voucher_no');
            const req = index.get(vNo);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // --- 8. GET ENTRIES BY VOUCHER ID ---
    async getEntriesByVoucherId(vid) {
        if (!this.db) await this.init();
        return new Promise((resolve) => {
            const tx = this.db.transaction('acct_entries', 'readonly');
            const idx = tx.objectStore('acct_entries').index('voucher_id');
            idx.getAll(vid).onsuccess = (e) => resolve(e.target.result || []);
        });
    }

    // --- 9. STOCK CHECK HELPER ---
    async getItemStock(itemId) {
        if (!this.db) await this.init();
        return new Promise(r => {
            const tx = this.db.transaction('items', 'readonly');
            tx.objectStore('items').get(itemId).onsuccess = e => r(e.target.result?.current_stock || 0);
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

} // CLASS ENDS HERE

// GLOBAL INSTANCE
const DB = new ArthBookDB();