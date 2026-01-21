/* FILENAME: ai_engine.js
   PURPOSE: The "Brain" of Arth Book – learns from real data + fallback rules
*/

class ArthIntelligence {
    constructor() {
        this.keywordToLedgerId = new Map(); // "chai" → ledgerId (more reliable than object)
        this.isReady = false;
    }

    // ─── 1. Learn from ALL historical vouchers ───
    async initBrain() {
        if (this.isReady) return;

        console.log("🧠 AI: Learning from past transactions...");

        try {
           const vouchers = await DB.getAll('vouchers');      // .getAllFromStore हटाकर .getAll करें
const entries   = await DB.getAll('acct_entries');
const ledgers   = await DB.getAll('ledgers');
            if (vouchers.length === 0) {
                console.log("🧠 AI: No vouchers found → skipping learning");
                this.isReady = true;
                return;
            }

            // Build keyword → ledgerId map (last seen wins – simple & effective)
            for (const v of vouchers) {
                if (!v.narration || typeof v.narration !== 'string') continue;

                // Find debit entry (usually the expense/asset side)
                const debitEntry = entries.find(e => e.voucher_id === v.id && Number(e.debit) > 0);
                if (!debitEntry) continue;

                const ledger = ledgers.find(l => l.id === debitEntry.ledger_id);
                if (!ledger) continue;

                const words = v.narration.toLowerCase()
                    .split(/\W+/)                   // better split (handles punctuation)
                    .filter(w => w.length >= 4);    // skip very short tokens

                for (const word of words) {
                    this.keywordToLedgerId.set(word, ledger.id);
                }
            }

            this.isReady = true;
            console.log(`🧠 AI: Learned ${this.keywordToLedgerId.size} keyword → ledger mappings from ${vouchers.length} vouchers`);
        } catch (err) {
            console.error("🧠 AI init failed:", err);
            // Still mark ready so we can fall back to rules
            this.isReady = true;
        }
    }

    // ─── 2. Predict ledger for new narration ───
    async predictCategory(narration) {
        if (!narration || typeof narration !== 'string' || !this.isReady) {
            return null;
        }

        const text = narration.toLowerCase();
        const words = text.split(/\W+/).filter(w => w.length >= 4);

        // A. Strongest signal: learned keyword match (most recent wins)
        for (const word of words) {
            const ledgerId = this.keywordToLedgerId.get(word);
            if (ledgerId) {
                const ledger = await DB.getLedgerById(ledgerId); // ← you should add this helper
                if (ledger) return ledger;
            }
        }

        // B. Fallback – rule-based matching (ordered by priority)
        const rules = [
            { keywords: ['tea', 'chai', 'coffee', 'snack', 'breakfast', 'canteen'],              category: 'Staff Welfare'   },
            { keywords: ['petrol', 'diesel', 'fuel', 'cng', 'uber', 'ola', 'auto', 'taxi'],     category: 'Travelling'      },
            { keywords: ['print', 'xerox', 'photocopy', 'paper', 'stationery', 'pen', 'ink'],   category: 'Printing & Stationery' },
            { keywords: ['jio', 'airtel', 'bsnl', 'wifi', 'broadband', 'recharge', 'mobile'],   category: 'Telephone & Internet' },
            { keywords: ['rent', 'lease', 'shop rent', 'office rent', 'building'],              category: 'Rent'            },
            { keywords: ['electricity', 'bill', 'eb', 'discom'],                                category: 'Electricity'     },
        ];

        for (const rule of rules) {
            if (rule.keywords.some(kw => text.includes(kw))) {
                // Try to find ledger whose name contains the category (case-insensitive)
                const ledgers = await DB.getLedgers();
                const match = ledgers.find(l =>
                    l.name?.toLowerCase().includes(rule.category.toLowerCase())
                );
                if (match) return match;
            }
        }

        // C. Ultimate fallback – most frequently used expense ledger (optional)
        // You can implement this later when you have enough stats

        return null;
    }

    // ─── 3. Simple next-month revenue forecast ───
    async predictCashFlow() {
        try {
            const vouchers = await DB.getAllFromStore('vouchers');

            const today = new Date();
            const ninetyDaysAgo = new Date(today);
            ninetyDaysAgo.setDate(today.getDate() - 90);

            const sales = vouchers.filter(v =>
                v.type === 'Sales' &&
                v.date &&
                new Date(v.date) >= ninetyDaysAgo
            );

            if (sales.length === 0) {
                return { prediction: "0.00", daily_avg: "0.00", status: "No data", days: 0 };
            }

            const totalRevenue = sales.reduce((sum, v) => sum + Number(v.amount || 0), 0);
            const daysCovered  = 90; // simplistic – can improve later

            const dailyAvg = totalRevenue / daysCovered;
            const next30d  = dailyAvg * 30;

            return {
                prediction: next30d.toFixed(2),
                daily_avg: dailyAvg.toFixed(2),
                status: "Active",
                based_on_days: daysCovered,
                transaction_count: sales.length
            };
        } catch (err) {
            console.warn("Cash flow prediction failed:", err);
            return { prediction: "0.00", daily_avg: "0.00", status: "Error" };
        }
    }
}

// ─── Global singleton + auto-init ───
const AI = new ArthIntelligence();

// Better init timing – wait for DB ready signal if possible
// For now, conservative delay + retry once
setTimeout(async () => {
    await AI.initBrain();
    // Optional: second attempt after 6 seconds if DB is still loading
    if (!AI.isReady) {
        setTimeout(() => AI.initBrain(), 4000);
    }
}, 1500);

// Optional: expose for debugging
window.ArthAI = AI;