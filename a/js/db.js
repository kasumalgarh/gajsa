// FILE: js/db.js (Database Engine)
const DB_NAME = 'ArthBook_Ent_DB';
const DB_VERSION = 2;

const ArthDB = {
    db: null,

    // 1. Connection
    init: async () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Tables create karo
                if (!db.objectStoreNames.contains('ledgers')) db.createObjectStore('ledgers', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('vouchers')) db.createObjectStore('vouchers', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
            };

            request.onsuccess = async (e) => {
                ArthDB.db = e.target.result;
                await ArthDB.seed(); // Default data
                console.log("Database Connected ✅");
                resolve(true);
            };
            request.onerror = (e) => {
                console.error("DB Error:", e.target.error);
                reject("DB Connection Failed");
            };
        });
    },

    // 2. Default Data (Seed)
    seed: async () => {
        const l = await ArthDB.getAll('ledgers');
        if (l.length === 0) {
            const tx = ArthDB.db.transaction(['ledgers'], 'readwrite');
            const defaults = [
                {id:'cash', name:'Cash Account', group:'Cash-in-hand'},
                {id:'sales', name:'Sales Account', group:'Sales Accounts'},
                {id:'purchase', name:'Purchase Account', group:'Purchase Accounts'}
            ];
            defaults.forEach(x => tx.objectStore('ledgers').add(x));
        }
    },

    // 3. Common Functions
    getAll: async (table) => {
        return new Promise((resolve) => {
            try {
                const tx = ArthDB.db.transaction([table], 'readonly');
                const req = tx.objectStore(table).getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            } catch(e) { resolve([]); }
        });
    },

    add: async (table, data) => {
        return new Promise((resolve) => {
            const tx = ArthDB.db.transaction([table], 'readwrite');
            tx.objectStore(table).add(data);
            tx.oncomplete = () => resolve(data);
        });
    },

    update: async (table, data) => {
        return new Promise((resolve) => {
            const tx = ArthDB.db.transaction([table], 'readwrite');
            tx.objectStore(table).put(data);
            tx.oncomplete = () => resolve(data);
        });
    }
};

window.ArthDB = ArthDB;