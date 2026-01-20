/* FILENAME: ai_engine.js
   PURPOSE: The "Brain" of Arth Book (Now with Permanent Memory)
*/

class ArthIntelligence {
    constructor() {
        this.categoryMap = {}; // Will allow { "tea": "Office Exp", "petrol": "Travel" }
        this.isReady = false;
    }

    // --- 1. REAL LEARNING (No Placeholders) ---
    // Reads ALL past vouchers to build a probability map
    async initBrain() {
        console.log("🧠 AI: Scanning history for patterns...");
        
        try {
            const tx = DB.db.transaction(['vouchers', 'acct_entries', 'ledgers'], 'readonly');
            const vouchers = await DB.getAll(tx.objectStore('vouchers'));
            const entries = await DB.getAll(tx.objectStore('acct_entries'));
            const ledgers = await DB.getAll(tx.objectStore('ledgers'));

            // Build Knowledge Graph
            vouchers.forEach(v => {
                if(!v.narration) return;
                
                // Find which ledger was debited (Expense/Asset)
                const entry = entries.find(e => e.voucher_id === v.id && e.debit > 0);
                if(entry) {
                    const ledger = ledgers.find(l => l.id === entry.ledger_id);
                    if(ledger) {
                        // Map keywords from narration to ledger
                        const words = v.narration.toLowerCase().split(' ');
                        words.forEach(w => {
                            if(w.length > 3) { // Ignore 'to', 'the', etc.
                                this.categoryMap[w] = ledger.id;
                            }
                        });
                    }
                }
            });
            
            this.isReady = true;
            console.log("🧠 AI: I have learned from " + vouchers.length + " transactions.");
        } catch(e) {
            console.warn("AI Init failed (Database might be empty):", e);
        }
    }

    // --- 2. AUTO-CATEGORIZATION ---
    async predictCategory(text) {
        if (!text || !this.isReady) return null;
        text = text.toLowerCase();

        // A. Check Learned Patterns
        const words = text.split(' ');
        for(let w of words) {
            if(this.categoryMap[w]) {
                const ledgers = await DB.getLedgers();
                return ledgers.find(l => l.id === this.categoryMap[w]);
            }
        }

        // B. Hardcoded Rules (Fallback)
        const rules = [
            { keywords: ['tea', 'coffee', 'snack', 'food', 'chai'], cat: 'Staff Welfare' },
            { keywords: ['petrol', 'diesel', 'fuel', 'uber', 'ola', 'auto'], cat: 'Travelling' },
            { keywords: ['print', 'paper', 'pen', 'ink', 'xerox'], cat: 'Printing' },
            { keywords: ['jio', 'airtel', 'wi-fi', 'net', 'mobile'], cat: 'Telephone' },
            { keywords: ['rent', 'shop', 'office'], cat: 'Rent' }
        ];

        for (let rule of rules) {
            if (rule.keywords.some(k => text.includes(k))) {
                const ledgers = await DB.getLedgers();
                // Fuzzy match ledger name
                const match = ledgers.find(l => l.name.toLowerCase().includes(rule.cat.toLowerCase()));
                if (match) return match;
            }
        }
        return null;
    }

    // --- 3. PREDICTIVE CASH FLOW (Real Math) ---
    async predictCashFlow() {
        const tx = DB.db.transaction(['vouchers'], 'readonly');
        const allVouchers = await DB.getAll(tx.objectStore('vouchers'));
        
        // Filter Sales for last 90 days
        const today = new Date();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(today.getDate() - 90);

        const sales = allVouchers.filter(v => v.type === 'Sales' && new Date(v.date) >= ninetyDaysAgo);
        
        let totalRevenue = 0;
        sales.forEach(v => totalRevenue += (parseFloat(v.amount) || 0));

        // Avoid divide by zero
        const dailyAvg = totalRevenue / 90;
        const nextMonthForecast = dailyAvg * 30;
        
        return {
            prediction: nextMonthForecast.toFixed(2),
            daily_avg: dailyAvg.toFixed(2),
            status: "Active"
        };
    }
}

// Initialize AI immediately
const AI = new ArthIntelligence();
setTimeout(() => AI.initBrain(), 2000); // Wait for DB to load