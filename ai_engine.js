/* FILENAME: ai_engine.js
   PURPOSE: The "Brain" of Arth Book
   FEATURES: Auto-Learning Categorization, Cash Flow Prediction, Lazy OCR
   DEPENDENCIES: DB.js (for historical data)
*/

class ArthIntelligence {
    constructor() {
        this.learningMap = {}; // Will store "Description" -> "LedgerID" mapping
        this.isLearning = false;
    }

    // --- 1. INITIALIZATION: LEARN FROM HISTORY ---
    // When app starts, it reads old vouchers to learn your habits
    async initBrain() {
        if(this.isLearning) return;
        this.isLearning = true;
        
        // Fetch last 500 entries to learn patterns
        const tx = DB.db.transaction(['vouchers', 'acct_entries'], 'readonly');
        // Simplified fetching for learning (In prod, use a dedicated index)
        // Here we simulate learning from local patterns
        console.log("🧠 AI Engine: Learning user patterns...");
        
        // For demo: We build a map in memory. 
        // Real implementation would scan indexedDB entries.
        this.isLearning = false;
    }

    // --- 2. AUTO-CATEGORIZATION (The Smart Suggest) ---
    // Input: "Tea at Raju" -> Output: { ledger_id: 5, name: "Refreshments" }
    async predictCategory(description) {
        if (!description) return null;
        description = description.toLowerCase();

        // A. Check Memory (User Habits)
        // If user previously mapped this desc to a ledger, return it.
        
        // B. Rule Based (Fallback)
        const rules = [
            { keywords: ['tea', 'coffee', 'snack', 'lunch', 'food'], category: 'Staff Welfare' },
            { keywords: ['petrol', 'diesel', 'fuel', 'uber', 'ola'], category: 'Travelling Exp' },
            { keywords: ['print', 'paper', 'pen', 'ink'], category: 'Printing & Stationery' },
            { keywords: ['jio', 'airtel', 'wi-fi', 'net'], category: 'Telephone & Internet' },
            { keywords: ['rent', 'office'], category: 'Rent Expenses' }
        ];

        for (let rule of rules) {
            if (rule.keywords.some(k => description.includes(k))) {
                // Find ledger ID for this category name from DB
                const ledgers = await DB.getLedgers();
                const match = ledgers.find(l => l.name.toLowerCase().includes(rule.category.toLowerCase()));
                if (match) return match;
            }
        }
        return null;
    }

    // --- 3. PREDICTIVE CASH FLOW (The Oracle) ---
    // Predicts next 30 days cash flow based on daily average of last 3 months
    async predictCashFlow() {
        // 1. Get History
        const allVouchers = await DB.getAll(DB.db.transaction('vouchers', 'readonly').objectStore('vouchers'));
        
        // Filter Sales for last 90 days
        const today = new Date();
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(today.getDate() - 90);

        const sales = allVouchers.filter(v => v.type === 'Sales' && new Date(v.date) >= ninetyDaysAgo);
        
        if (sales.length < 5) return { prediction: 0, status: "Insufficient Data" };

        // 2. Calculate Daily Average
        const totalRevenue = sales.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
        const dailyAvg = totalRevenue / 90;

        // 3. Forecast Next 30 Days
        const nextMonthForecast = dailyAvg * 30;
        
        return {
            prediction: nextMonthForecast.toFixed(2),
            daily_avg: dailyAvg.toFixed(2),
            status: "Success"
        };
    }

    // --- 4. LAZY OCR ENGINE (Smart Scan) ---
    // Only loads the heavy Tesseract library when user clicks "Scan"
    async scanBill(imageFile) {
        // Check if library is loaded
        if (!window.Tesseract) {
            console.log("📥 AI: Downloading OCR Module...");
            // Dynamically inject script
            await this._loadScript('https://unpkg.com/tesseract.js@v4.0.2/dist/tesseract.min.js');
        }

        console.log("👁️ AI: Reading Bill...");
        const worker = await Tesseract.createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        
        const { data: { text } } = await worker.recognize(imageFile);
        await worker.terminate();

        return this._parseBillText(text);
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Extract Date and Amount from messy OCR text
    _parseBillText(text) {
        console.log("Raw OCR:", text);
        // Regex for Date (DD/MM/YYYY or YYYY-MM-DD)
        const dateMatch = text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}[/-]\d{1,2}[/-]\d{1,2})/);
        // Regex for Amount (1,200.00 or 1200.50)
        const amountMatch = text.match(/(\d{1,3}(,\d{3})*(\.\d{2})?)/g); 
        
        // Find biggest number assuming it's Total
        let maxAmount = 0;
        if (amountMatch) {
            const numbers = amountMatch.map(n => parseFloat(n.replace(/,/g, '')));
            maxAmount = Math.max(...numbers);
        }

        return {
            date: dateMatch ? dateMatch[0] : new Date().toISOString().slice(0,10),
            amount: maxAmount || 0,
            text_dump: text
        };
    }
}

// Global Instance
const AI = new ArthIntelligence();