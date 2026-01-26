// FILE: js/app.js (Complete Accounting + GST + Settings + Date Filters + Excel Export)
const App = {
    state: { currentScreen: 'gateway', cart: [], tempVouchers: [] },

    init: async () => { 
        try {
            await ArthDB.init(); 
            App.Shortcuts(); 
            App.renderGateway(); 
            console.log("Arth Book Professional Ready 🚀");
        } catch(e) { console.error(e); }
    },

    // --- 1. SMART DASHBOARD (GATEWAY) ---
    renderGateway: async () => {
        App.state.currentScreen = 'gateway';
        const vchs = await ArthDB.getAll('vouchers');
        const profile = JSON.parse(localStorage.getItem('company_profile')) || {name: 'My Business'};

        let cashDr=0, cashCr=0, bankDr=0, bankCr=0, todaySale=0;
        const todayStr = new Date().toLocaleDateString('en-IN');

        vchs.forEach(v => {
            if(v.type === 'Sales' && v.date === todayStr) todaySale += parseFloat(v.total);
            v.rows.forEach(r => {
                if(r.ledger === 'Cash-in-hand') { if(r.type === 'Dr') cashDr += parseFloat(r.amount); else cashCr += parseFloat(r.amount); }
                if(r.ledger === 'Bank Account') { if(r.type === 'Dr') bankDr += parseFloat(r.amount); else bankCr += parseFloat(r.amount); }
            });
        });

        const cashBal = cashDr - cashCr;
        const bankBal = bankDr - bankCr;
        const recent = vchs.slice(-7).reverse(); 
        const safeTotal = (amt) => (parseFloat(amt) || 0).toFixed(2);

        document.querySelector('.workspace').innerHTML = `
            <div class="panel" style="flex: 3; background:#f8fafc;">
                <div class="panel-head" style="background:#1e293b; color:white;">
                    <span>📊 ${profile.name} (Dashboard)</span>
                    <span style="font-size:11px; color:#cbd5e1;">FY: 2026-27</span>
                </div>
                <div style="display:flex; gap:15px; padding:15px;">
                    <div class="card" style="flex:1; background:white; padding:15px; border-radius:8px; border-left:4px solid #16a34a; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-size:12px; color:#64748b; font-weight:bold;">CASH IN HAND</div>
                        <div style="font-size:20px; font-weight:bold; color:#16a34a;">₹ ${cashBal.toFixed(2)}</div>
                    </div>
                    <div class="card" style="flex:1; background:white; padding:15px; border-radius:8px; border-left:4px solid #2563eb; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-size:12px; color:#64748b; font-weight:bold;">BANK BALANCE</div>
                        <div style="font-size:20px; font-weight:bold; color:#2563eb;">₹ ${bankBal.toFixed(2)}</div>
                    </div>
                    <div class="card" style="flex:1; background:white; padding:15px; border-radius:8px; border-left:4px solid #f59e0b; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                        <div style="font-size:12px; color:#64748b; font-weight:bold;">TODAY'S SALES</div>
                        <div style="font-size:20px; font-weight:bold; color:#f59e0b;">₹ ${todaySale.toFixed(2)}</div>
                    </div>
                </div>
                <div class="panel-body">
                    <div style="padding:15px;">
                        <h4 style="margin-top:0; color:#334155; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">Recent Transactions</h4>
                        <table style="width:100%; border-collapse:collapse; font-size:13px;">
                            <thead><tr style="background:#f1f5f9; text-align:left;"><th style="padding:8px;">Type</th><th style="padding:8px;">Party</th><th style="padding:8px;">Vch No</th><th style="padding:8px; text-align:right;">Amount</th></tr></thead>
                            <tbody>
                                ${recent.length ? recent.map(v => `
                                    <tr onclick="App.Logic.printPreview('${v.id}')" title="View Voucher" style="cursor:pointer; border-bottom:1px solid #f1f5f9;">
                                        <td style="padding:8px;"><span style="font-weight:600; font-size:11px; padding:2px 6px; border-radius:4px; background:${v.type==='Sales'?'#dcfce7':(v.type==='Purchase'?'#ffedd5':'#e2e8f0')}; color:${v.type==='Sales'?'#166534':(v.type==='Purchase'?'#9a3412':'#475569')}">${(v.type || 'VCH').toUpperCase()}</span></td>
                                        <td style="padding:8px;">${v.rows[0].ledger}</td>
                                        <td style="padding:8px;">${v.no}</td>
                                        <td style="padding:8px; text-align:right; font-weight:600;">₹ ${safeTotal(v.total)}</td>
                                    </tr>`).join('') : '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8">No Entries Yet</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="panel" style="flex: 1; max-width: 280px; display:flex; flex-direction:column;">
                <div class="panel-head">Quick Menu</div>
                <div class="panel-body" style="flex:1; overflow-y:auto;">
                    <div class="menu-list">
                        <div class="menu-head">ENTRY</div>
                        <div class="menu-item" onclick="App.navigate('sales')"><span class="label"><span class="hotkey">V</span> Sales Invoice</span></div>
                        <div class="menu-item" onclick="App.navigate('purchase')"><span class="label"><span class="hotkey">F9</span> Purchase Bill</span></div>
                        <div class="menu-item" onclick="App.navigate('receipt')"><span class="label"><span class="hotkey">F6</span> Receipt (In)</span></div>
                        <div class="menu-item" onclick="App.navigate('payment')"><span class="label"><span class="hotkey">F5</span> Payment (Out)</span></div>
                        <div class="menu-head">REPORTS</div>
                        <div class="menu-item" onclick="App.navigate('report_gst')"><span class="label" style="color:#7c3aed; font-weight:bold;">🏛️ GST Report (GSTR-1)</span></div>
                        <div class="menu-item" onclick="App.navigate('report_pnl')"><span class="label" style="color:#0f766e; font-weight:bold;">📈 Profit & Loss</span></div>
                        <div class="menu-item" onclick="App.navigate('report_ledger')"><span class="label">📄 Ledger Report</span></div>
                        <div class="menu-item" onclick="App.navigate('stock')"><span class="label"><span class="hotkey">S</span> Stock Summary</span></div>
                        <div class="menu-item" onclick="App.navigate('daybook')"><span class="label"><span class="hotkey">D</span> Day Book</span></div>
                        <hr style="border:0; border-top:1px solid #e2e8f0; margin:10px 0;">
                        <div class="menu-item" onclick="App.navigate('settings')"><span class="label" style="color:#e11d48; font-weight:bold;">⚙️ Company Settings</span></div>
                        <div class="menu-item" onclick="App.navigate('create')"><span class="label"><span class="hotkey">C</span> Create Ledger</span></div>
                        <div class="menu-item" onclick="App.navigate('create_item')"><span class="label"><span class="hotkey">I</span> Create Item</span></div>
                        <div style="margin-top:20px;">
                            <button onclick="App.Logic.backupData()" style="width:100%; padding:8px; margin-bottom:5px; background:#f1f5f9; border:1px solid #cbd5e1; cursor:pointer;">⬇️ Backup</button>
                            <input type="file" id="restore-file" style="display:none" onchange="App.Logic.restoreData(this)">
                            <button onclick="document.getElementById('restore-file').click()" style="width:100%; padding:8px; background:#f1f5f9; border:1px solid #cbd5e1; cursor:pointer;">⬆️ Restore</button>
                            <button onclick="App.Logic.masterReset()" style="width:100%; padding:8px; margin-top:5px; background:#fee2e2; color:#dc2626; border:1px solid #fecaca; cursor:pointer; font-weight:bold;">⚠️ RESET ALL</button>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    navigate: async (page) => {
        App.state.currentScreen = page;

        // --- SALES INVOICE ---
        if(page === 'sales') {
            App.state.cart = [];
            const ledgers = await ArthDB.getAll('ledgers');
            const items = await ArthDB.getAll('items');
            const parties = ledgers.filter(l => (l.group && l.group.includes('Debtor')) || l.group === 'Cash-in-hand').map(l=>`<option value="${l.name}">`).join('');
            const stockItems = items.map(i=>`<option value="${i.name}">`).join('');
            document.querySelector('.workspace').innerHTML = `<div class="panel"><div class="panel-head">Sales Invoice <span style="font-size:11px; cursor:pointer; color:#ef4444;" onclick="location.reload()">[ESC]</span></div><div class="panel-body" style="padding:20px;"><div style="display:flex; justify-content:space-between; margin-bottom:15px; background:#f8fafc; padding:10px; border:1px solid #e2e8f0;"><div>Inv No: <b>${Date.now().toString().slice(-4)}</b></div><div>Date: <b>${new Date().toLocaleDateString('en-IN')}</b></div></div><div style="margin-bottom:20px;"><label style="font-weight:600; color:#475569;">Party Name (Dr)</label><input list="parties" id="inv-party" placeholder="Select Customer" autofocus style="width:100%; border:1px solid #cbd5e1; padding:8px;"><datalist id="parties">${parties}</datalist></div><table style="border:1px solid #e2e8f0;"><thead><tr><th>Item Name</th><th style="width:80px; text-align:right">Qty</th><th style="width:100px; text-align:right">Rate</th><th style="width:60px; text-align:right">GST%</th><th style="width:120px; text-align:right">Total</th></tr></thead><tbody id="inv-rows"><tr><td><input list="items" id="i-name" placeholder="Item" onchange="App.Logic.itemSelected(this.value)" style="border:none; width:100%; outline:none;"></td><td><input type="number" id="i-qty" placeholder="1" class="text-right" onchange="App.Logic.calcRow()" style="border:none; width:100%; outline:none;"></td><td><input type="number" id="i-rate" placeholder="0" class="text-right" onchange="App.Logic.calcRow()" style="border:none; width:100%; outline:none;"></td><td><input type="number" id="i-tax" placeholder="0" class="text-right" readonly style="border:none; width:100%; outline:none; background:#f1f5f9;"></td><td class="text-right" id="i-amt" style="padding-right:12px; font-weight:bold;">0.00</td></tr></tbody><datalist id="items">${stockItems}</datalist></table><div id="added-list" style="height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-top:none; background:#fff;"></div></div><div style="padding:15px; background:#f1f5f9; text-align:right; font-size:16px; font-weight:bold; border-top:1px solid #cbd5e1;">Grand Total: ₹ <span id="inv-total">0.00</span><div style="margin-top:10px;"><button onclick="App.Logic.saveInvoice()" class="action-btn" style="background:#1e293b; color:white;">SAVE BILL</button></div></div></div>`;
            setTimeout(()=>document.getElementById('inv-party').focus(), 100);
        }
        else if(page === 'purchase') {
            App.state.cart = [];
            const ledgers = await ArthDB.getAll('ledgers');
            const items = await ArthDB.getAll('items');
            const parties = ledgers.filter(l => (l.group && l.group.includes('Creditor')) || l.group === 'Cash-in-hand').map(l=>`<option value="${l.name}">`).join('');
            const stockItems = items.map(i=>`<option value="${i.name}">`).join('');
            document.querySelector('.workspace').innerHTML = `<div class="panel"><div class="panel-head" style="background:#fff7ed; color:#9a3412;">Purchase Voucher <span style="float:right; cursor:pointer" onclick="location.reload()">[ESC]</span></div><div class="panel-body" style="padding:20px;"><div style="display:flex; justify-content:space-between; margin-bottom:15px; background:#fff7ed; padding:10px; border:1px solid #fed7aa;"><div style="display:flex; gap:10px; align-items:center;"><label>Ref No:</label><input id="sup-inv-no" placeholder="e.g. 123" style="width:150px; font-weight:bold;"></div><div>Date: <b>${new Date().toLocaleDateString('en-IN')}</b></div></div><div style="margin-bottom:20px;"><label style="font-weight:600; color:#475569;">Party Name (Supplier)</label><input list="parties" id="inv-party" placeholder="Select Supplier" autofocus style="width:100%; border:1px solid #cbd5e1; padding:8px;"><datalist id="parties">${parties}</datalist></div><table style="border:1px solid #e2e8f0;"><thead><tr><th>Item Name</th><th style="width:80px; text-align:right">Qty</th><th style="width:100px; text-align:right">Rate</th><th style="width:60px; text-align:right">GST%</th><th style="width:120px; text-align:right">Total</th></tr></thead><tbody id="inv-rows"><tr><td><input list="items" id="i-name" placeholder="Item" onchange="App.Logic.itemSelected(this.value)" style="border:none; width:100%; outline:none;"></td><td><input type="number" id="i-qty" placeholder="1" class="text-right" onchange="App.Logic.calcRow()" style="border:none; width:100%; outline:none;"></td><td><input type="number" id="i-rate" placeholder="0" class="text-right" onchange="App.Logic.calcRow()" style="border:none; width:100%; outline:none;"></td><td><input type="number" id="i-tax" placeholder="0" class="text-right" readonly style="border:none; width:100%; outline:none; background:#f1f5f9;"></td><td class="text-right" id="i-amt" style="padding-right:12px; font-weight:bold;">0.00</td></tr></tbody><datalist id="items">${stockItems}</datalist></table><div id="added-list" style="height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-top:none; background:#fff;"></div></div><div style="padding:15px; background:#fff7ed; text-align:right; font-size:16px; font-weight:bold; border-top:1px solid #fed7aa;">Grand Total: ₹ <span id="inv-total">0.00</span><div style="margin-top:10px;"><button onclick="App.Logic.savePurchase()" class="action-btn" style="background:#ea580c; color:white; border-bottom:2px solid #9a3412;">SAVE PURCHASE</button></div></div></div>`;
            setTimeout(()=>document.getElementById('sup-inv-no').focus(), 100);
        }
        else if(page === 'receipt') {
            const ledgers = await ArthDB.getAll('ledgers');
            const parties = ledgers.filter(l => l.group !== 'Cash-in-hand').map(l=>`<option value="${l.name}">`).join('');
            document.querySelector('.workspace').innerHTML = `<div class="panel" style="max-width:500px; margin:auto; align-self:center; border-top:4px solid #16a34a;"><div class="panel-head">Receipt Voucher (F6) <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div><div class="panel-body" style="padding:20px;"><div style="margin-bottom:15px;"><label style="font-weight:600; color:#16a34a;">Account (Debit)</label><select id="r-ac" style="width:100%; padding:8px; border:1px solid #cbd5e1;"><option>Cash-in-hand</option><option>Bank Account</option></select></div><div style="margin-bottom:15px;"><label style="font-weight:600; color:#475569;">Payer / Party (Credit)</label><input list="parties" id="r-party" placeholder="Select Party" style="width:100%; padding:8px; border:1px solid #cbd5e1;"><datalist id="parties">${parties}</datalist></div><div style="margin-bottom:15px;"><label style="font-weight:600; color:#475569;">Amount (₹)</label><input type="number" id="r-amt" placeholder="0.00" style="width:100%; padding:8px; border:1px solid #cbd5e1; font-weight:bold; font-size:16px;"></div><div style="margin-bottom:20px;"><label style="font-weight:600; color:#94a3b8;">Narration</label><input type="text" id="r-nar" placeholder="Being cash received..." style="width:100%; padding:8px; border:1px solid #cbd5e1;"></div><div style="text-align:right;"><button onclick="App.Logic.saveReceipt()" class="action-btn" style="background:#16a34a; color:white;">SAVE RECEIPT</button></div></div></div>`;
            setTimeout(()=>document.getElementById('r-party').focus(), 100);
        }
        else if(page === 'payment') {
            const ledgers = await ArthDB.getAll('ledgers');
            const parties = ledgers.filter(l => l.group !== 'Cash-in-hand').map(l=>`<option value="${l.name}">`).join('');
            document.querySelector('.workspace').innerHTML = `<div class="panel" style="max-width:500px; margin:auto; align-self:center; border-top:4px solid #dc2626;"><div class="panel-head">Payment Voucher (F5) <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div><div class="panel-body" style="padding:20px;"><div style="margin-bottom:15px;"><label style="font-weight:600; color:#475569;">Account (Credit)</label><select id="p-ac" style="width:100%; padding:8px; border:1px solid #cbd5e1;"><option>Cash-in-hand</option><option>Bank Account</option></select></div><div style="margin-bottom:15px;"><label style="font-weight:600; color:#dc2626;">Paid To / Party (Debit)</label><input list="parties" id="p-party" placeholder="Select Party" style="width:100%; padding:8px; border:1px solid #cbd5e1;"><datalist id="parties">${parties}</datalist></div><div style="margin-bottom:15px;"><label style="font-weight:600; color:#475569;">Amount (₹)</label><input type="number" id="p-amt" placeholder="0.00" style="width:100%; padding:8px; border:1px solid #cbd5e1; font-weight:bold; font-size:16px;"></div><div style="margin-bottom:20px;"><label style="font-weight:600; color:#94a3b8;">Narration</label><input type="text" id="p-nar" placeholder="Being cash paid..." style="width:100%; padding:8px; border:1px solid #cbd5e1;"></div><div style="text-align:right;"><button onclick="App.Logic.savePayment()" class="action-btn" style="background:#dc2626; color:white;">SAVE PAYMENT</button></div></div></div>`;
            setTimeout(()=>document.getElementById('p-party').focus(), 100);
        }

        // --- PROFIT & LOSS REPORT ---
        else if(page === 'report_pnl') {
            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">Profit & Loss Account <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div>
                    <div class="panel-body" style="padding:20px; max-width:800px; margin:auto;">
                        <div style="background:#f1f5f9; padding:15px; border-radius:5px; margin-bottom:20px; display:flex; gap:10px; align-items:center;">
                            <label style="font-weight:bold;">From:</label><input type="date" id="pnl-from" style="padding:5px;">
                            <label style="font-weight:bold;">To:</label><input type="date" id="pnl-to" style="padding:5px;">
                            <button onclick="App.Logic.renderPnL()" class="action-btn" style="background:#475569; color:white; padding:5px 15px;">Go</button>
                        </div>
                        <div id="pnl-content">Click 'Go' to load report...</div>
                    </div>
                </div>`;
            App.Logic.renderPnL();
        }

        // ➤ [UPDATED] GST REPORT (With Excel)
        else if(page === 'report_gst') {
            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">GSTR-1 Report <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div>
                    <div class="panel-body" style="padding:20px;">
                        <div style="background:#f1f5f9; padding:15px; border-radius:5px; margin-bottom:20px; display:flex; gap:10px; align-items:center;">
                            <label style="font-weight:bold;">From:</label><input type="date" id="gst-from" style="padding:5px;">
                            <label style="font-weight:bold;">To:</label><input type="date" id="gst-to" style="padding:5px;">
                            <button onclick="App.Logic.renderGST()" class="action-btn" style="background:#7c3aed; color:white; padding:5px 15px;">Generate Report</button>
                            <button onclick="App.Logic.exportGST()" class="action-btn" style="background:#16a34a; color:white; padding:5px 15px; margin-left:10px;">📥 Excel</button>
                        </div>
                        <div id="gst-content">Click 'Generate' to view data...</div>
                    </div>
                </div>`;
            App.Logic.renderGST();
        }

        // ➤ [UPDATED] LEDGER REPORT (With Excel)
        else if(page === 'report_ledger') {
            const ledgers = await ArthDB.getAll('ledgers');
            const parties = ledgers.map(l=>`<option value="${l.name}">`).join('');
            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">Party Ledger Report <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div>
                    <div class="panel-body" style="padding:20px;">
                        <div style="background:#f1f5f9; padding:15px; border-radius:5px; margin-bottom:20px; display:flex; gap:10px; align-items:flex-end;">
                            <div style="flex:2;">
                                <label style="font-weight:bold; font-size:12px;">Party Account</label>
                                <input list="parties" id="rep-party" placeholder="Select Party..." style="width:100%; padding:8px; border:1px solid #cbd5e1;">
                                <datalist id="parties">${parties}</datalist>
                            </div>
                            <div style="flex:1;"><label style="font-weight:bold; font-size:12px;">From</label><input type="date" id="rep-from" style="width:100%; padding:7px; border:1px solid #cbd5e1;"></div>
                            <div style="flex:1;"><label style="font-weight:bold; font-size:12px;">To</label><input type="date" id="rep-to" style="width:100%; padding:7px; border:1px solid #cbd5e1;"></div>
                            <button onclick="App.Logic.generateLedgerReport()" class="action-btn" style="background:#2563eb; color:white; padding:8px 15px;">GO</button>
                            <button onclick="App.Logic.exportLedger()" class="action-btn" style="background:#16a34a; color:white; padding:8px 15px; margin-left:5px;">📥 Excel</button>
                        </div>
                        <div id="rep-data" style="min-height:300px; border:1px solid #e2e8f0; padding:20px; text-align:center; color:#94a3b8;">Select party and dates to view statement</div>
                        <div style="text-align:right; margin-top:10px; font-weight:bold; font-size:18px;">Closing Balance: <span id="rep-bal">---</span></div>
                    </div></div>`;
            setTimeout(()=>document.getElementById('rep-party').focus(), 100);
        }

        // ➤ [UPDATED] STOCK SUMMARY (With Excel)
        else if(page === 'stock') {
            const items = await ArthDB.getAll('items');
            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">
                        Stock Summary 
                        <span style="float:right;">
                            <button onclick="App.Logic.exportStock()" style="background:#16a34a; color:white; border:none; padding:2px 8px; cursor:pointer; font-size:12px; margin-right:10px;">📥 Excel</button>
                            <span onclick="location.reload()" style="cursor:pointer">[ESC]</span>
                        </span>
                    </div>
                    <div class="panel-body">
                        <table><thead><tr><th>Item Name</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Value</th></tr></thead><tbody>${items.map(i => { const val = (parseFloat(i.qty)||0)*(parseFloat(i.rate)||0); return `<tr><td>${i.name}</td><td class="text-right">${i.qty} ${i.unit}</td><td class="text-right">₹ ${i.rate}</td><td class="text-right" style="font-weight:bold;">₹ ${val.toFixed(2)}</td></tr>`; }).join('')}</tbody></table>
                    </div>
                </div>`;
        }

        // --- FORMS ---
        else if(page === 'create_item') { App.renderForm('Stock Item Creation', [{label:'Item Name', id:'i-name'}, {label:'Unit', id:'i-unit'}, {label:'GST %', id:'i-tax', type:'select', opts:['0','5','12','18','28']}, {label:'Opening Qty', id:'i-qty', type:'number'}, {label:'Rate', id:'i-rate', type:'number'}], 'App.Logic.saveItemAux()'); }
        else if(page === 'create') { App.renderForm('Ledger Creation (Professional)', [{label:'Ledger Name', id:'l-name'}, {label:'Group', id:'l-group', type:'select', opts:['Sundry Debtors (Customer)','Sundry Creditors (Supplier)','Sales Accounts','Purchase Accounts','Cash-in-hand','Bank Accounts','Indirect Expenses','Capital Account']}, {label:'GSTIN (Optional)', id:'l-gst'}, {label:'State', id:'l-state', type:'select', opts:['Rajasthan','Delhi','Maharashtra','Gujarat','Other']}, {label:'Address', id:'l-addr'}, {label:'Opening Balance', id:'l-open', type:'number'}], 'App.Logic.saveLedgerAux()'); }
        else if(page === 'settings') {
            const p = JSON.parse(localStorage.getItem('company_profile')) || {name:'', address:'', mobile:'', gstin:''};
            document.querySelector('.workspace').innerHTML = `<div class="panel"><div class="panel-head">Company Settings & Branding <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div><div class="panel-body" style="padding:30px; max-width:600px; margin:auto;"><div style="margin-bottom:15px;"><label style="font-weight:bold;">Company Name</label><input id="c-name" value="${p.name}" style="width:100%; padding:10px; border:1px solid #cbd5e1;"></div><div style="margin-bottom:15px;"><label style="font-weight:bold;">Address</label><input id="c-addr" value="${p.address}" style="width:100%; padding:10px; border:1px solid #cbd5e1;"></div><div style="display:flex; gap:10px; margin-bottom:15px;"><div style="flex:1;"><label style="font-weight:bold;">Mobile</label><input id="c-mob" value="${p.mobile}" style="width:100%; padding:10px; border:1px solid #cbd5e1;"></div><div style="flex:1;"><label style="font-weight:bold;">GSTIN</label><input id="c-gst" value="${p.gstin}" style="width:100%; padding:10px; border:1px solid #cbd5e1;"></div></div><div style="margin-bottom:15px;"><label style="font-weight:bold;">Company Logo (Image)</label><input type="file" id="c-logo" accept="image/*" style="width:100%;"><div style="font-size:11px; color:grey;">Leave empty to keep current logo.</div></div><div style="margin-bottom:20px;"><label style="font-weight:bold;">Digital Signature (Image)</label><input type="file" id="c-sign" accept="image/*" style="width:100%;"></div><div style="text-align:right;"><button onclick="App.Logic.saveSettings()" class="action-btn" style="background:#2563eb; color:white; padding:10px 20px;">SAVE SETTINGS</button></div></div></div>`;
        }

        // ➤ [UPDATED] DAYBOOK (With Excel)
        else if(page === 'daybook') {
            const vchs = await ArthDB.getAll('vouchers');
            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">Day Book <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div>
                    <div class="panel-body">
                        <div style="padding:10px; background:#f1f5f9; border-bottom:1px solid #e2e8f0; display:flex; gap:10px; align-items:center;">
                            <input id="db-search" placeholder="🔍 Search Party / Bill No..." style="flex:2; padding:8px; border:1px solid #cbd5e1;" onkeyup="App.Logic.filterDaybook()">
                            <input type="date" id="db-from" style="flex:1; padding:8px; border:1px solid #cbd5e1;" onchange="App.Logic.filterDaybook()">
                            <input type="date" id="db-to" style="flex:1; padding:8px; border:1px solid #cbd5e1;" onchange="App.Logic.filterDaybook()">
                            <button onclick="App.Logic.exportDaybook()" class="action-btn" style="background:#16a34a; color:white; padding:5px 15px; margin-left:10px;">📥 Excel</button>
                        </div>
                        <div style="max-height:400px; overflow-y:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                                <thead style="background:#e2e8f0; position:sticky; top:0;"><tr><th style="padding:8px;">Date</th><th style="padding:8px;">Particulars</th><th style="padding:8px;">Vch No</th><th style="padding:8px;">Type</th><th style="padding:8px; text-align:right;">Amount</th><th style="padding:8px; text-align:center;">Action</th></tr></thead>
                                <tbody id="db-rows"></tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
            App.state.tempVouchers = vchs.reverse(); 
            App.Logic.renderDaybookRows(App.state.tempVouchers);
        }
        else { App.renderGateway(); }
    },

    renderForm: (title, fields, saveFunc) => {
        let html = `<div class="panel" style="max-width:500px; margin:auto; align-self:center;"><div class="panel-head">${title} <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div><div class="panel-body" style="padding:20px;">`;
        fields.forEach(f => { html += `<div style="margin-bottom:10px;"><label style="font-weight:600; font-size:12px; color:#64748b">${f.label}</label>`; if(f.type==='select') html += `<select id="${f.id}" style="width:100%; border:1px solid #cbd5e1; padding:8px;">${f.opts.map(o=>`<option>${o}</option>`).join('')}</select>`; else html += `<input id="${f.id}" type="${f.type||'text'}" style="width:100%; border:1px solid #cbd5e1; padding:8px;">`; html += `</div>`; });
        html += `<div style="text-align:right; margin-top:15px;"><button onclick="${saveFunc}" class="action-btn" style="background:#1e293b; color:white;">SAVE</button></div></div></div>`;
        document.querySelector('.workspace').innerHTML = html; setTimeout(()=>document.getElementById(fields[0].id).focus(), 100);
    },

    Logic: {
        // --- HELPER: DATE PARSER & EXPORTER ---
        parseDate: (dStr) => { const [d, m, y] = dStr.split('/'); return new Date(`${y}-${m}-${d}`); },
        exportToCSV: (filename, rows) => {
            const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\n");
            const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", filename);
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        },

        // --- EXPORT FUNCTIONS ---
        exportDaybook: () => {
            const rows = [["Date", "Particulars", "Vch No", "Type", "Amount"]];
            App.state.tempVouchers.forEach(v => rows.push([v.date, v.rows[0].ledger, v.no, v.type, v.total.toFixed(2)]));
            App.Logic.exportToCSV("Daybook.csv", rows);
        },
        exportGST: async () => {
            // Re-calc logic for export
            const vchs = await ArthDB.getAll('vouchers');
            const ledgers = await ArthDB.getAll('ledgers');
            const fDate = document.getElementById('gst-from') ? document.getElementById('gst-from').value : '';
            const tDate = document.getElementById('gst-to') ? document.getElementById('gst-to').value : '';
            const salesVchs = vchs.filter(v => {
                if(v.type !== 'Sales') return false;
                if(fDate && App.Logic.parseDate(v.date) < new Date(fDate)) return false;
                if(tDate && App.Logic.parseDate(v.date) > new Date(tDate)) return false;
                return true;
            });
            const rows = [["Tax Rate", "Taxable Value", "IGST", "CGST", "SGST", "Total Amount"]];
            const taxBuckets = {'0':{t:0,i:0,c:0,s:0,tot:0}, '5':{t:0,i:0,c:0,s:0,tot:0}, '12':{t:0,i:0,c:0,s:0,tot:0}, '18':{t:0,i:0,c:0,s:0,tot:0}, '28':{t:0,i:0,c:0,s:0,tot:0}};
            salesVchs.forEach(v => {
                if(!v.inventory) return;
                const partyName = v.rows[0].ledger; const party = ledgers.find(l => l.name === partyName); const isInterState = party && party.state && party.state !== 'Rajasthan';
                v.inventory.forEach(i => {
                    const r = i.tax.toString(); if(!taxBuckets[r]) taxBuckets[r]={t:0,i:0,c:0,s:0,tot:0};
                    const b = parseFloat(i.base)||0, tAmt = parseFloat(i.taxAmt)||0;
                    taxBuckets[r].t+=b; if(isInterState) taxBuckets[r].i+=tAmt; else {taxBuckets[r].c+=tAmt/2; taxBuckets[r].s+=tAmt/2;} taxBuckets[r].tot+=(b+tAmt);
                });
            });
            Object.keys(taxBuckets).forEach(r => { const b=taxBuckets[r]; if(b.tot>0) rows.push([r+"% GST", b.t.toFixed(2), b.i.toFixed(2), b.c.toFixed(2), b.s.toFixed(2), b.tot.toFixed(2)]); });
            App.Logic.exportToCSV("GST_Report.csv", rows);
        },
        exportLedger: async () => {
            const partyName = document.getElementById('rep-party').value; if(!partyName) return alert("Select Party!");
            const vchs = await ArthDB.getAll('vouchers');
            const partyVouchers = vchs.filter(v => v.rows.some(r => r.ledger === partyName));
            const rows = [["Date", "Particulars", "Vch Type", "Debit", "Credit"]];
            partyVouchers.forEach(v => {
                const row = v.rows.find(r => r.ledger === partyName);
                if(row) {
                    let dr = 0, cr = 0; if(row.type === 'Dr') dr = parseFloat(row.amount); else cr = parseFloat(row.amount);
                    rows.push([v.date, v.type==='Sales'?'Sales A/c':(v.type==='Purchase'?'Purchase A/c':'Bank/Cash'), v.type, dr?dr.toFixed(2):'', cr?cr.toFixed(2):'']);
                }
            });
            App.Logic.exportToCSV(`Ledger_${partyName}.csv`, rows);
        },
        exportStock: async () => {
            const items = await ArthDB.getAll('items');
            const rows = [["Item Name", "Quantity", "Unit", "Rate", "Value"]];
            items.forEach(i => {
                const val = (parseFloat(i.qty)||0)*(parseFloat(i.rate)||0);
                rows.push([i.name, i.qty, i.unit, i.rate, val.toFixed(2)]);
            });
            App.Logic.exportToCSV("Stock_Summary.csv", rows);
        },

        // --- EXISTING LOGIC ---
        itemSelected: async (name) => { const i = (await ArthDB.getAll('items')).find(x => x.name === name); if(i) { document.getElementById('i-rate').value = i.rate; document.getElementById('i-tax').value = i.tax || 0; document.getElementById('i-qty').focus(); } },
        calcRow: () => { const q = parseFloat(document.getElementById('i-qty').value)||0, r = parseFloat(document.getElementById('i-rate').value)||0, t = parseFloat(document.getElementById('i-tax').value)||0; document.getElementById('i-amt').innerText = ((q*r) + (q*r*(t/100))).toFixed(2); },
        addItem: () => {
            const name = document.getElementById('i-name').value, qty = parseFloat(document.getElementById('i-qty').value);
            if(!name || !qty) return false;
            const rate = parseFloat(document.getElementById('i-rate').value), tax = parseFloat(document.getElementById('i-tax').value)||0;
            const base = qty*rate, taxAmt = base*(tax/100), total = base+taxAmt;
            App.state.cart.push({name, qty, rate, tax, base, taxAmt, total});
            document.getElementById('added-list').innerHTML = `<table><tbody>${App.state.cart.map(x=>`<tr><td>${x.name}</td><td class="text-right">${x.qty}</td><td class="text-right">${x.rate}</td><td class="text-right">₹ ${x.total.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
            document.getElementById('inv-total').innerText = App.state.cart.reduce((a,b)=>a+b.total,0).toFixed(2);
            document.getElementById('i-name').value=''; document.getElementById('i-qty').value=''; document.getElementById('i-amt').innerText='0.00'; document.getElementById('i-name').focus();
            return true;
        },
        saveInvoice: async () => {
            const party = document.getElementById('inv-party').value;
            const iName = document.getElementById('i-name').value; if(iName) App.Logic.addItem();
            if(!party || !App.state.cart.length) return alert("Error: Data Missing!");
            const total = App.state.cart.reduce((a,b)=>a+b.total,0);
            await ArthDB.add('vouchers', {id:`v_${Date.now()}`, no:Date.now().toString().slice(-4), date:new Date().toLocaleDateString('en-IN'), type:'Sales', total, rows:[{ledger:party, type:'Dr', amount:total}, {ledger:'Sales Account', type:'Cr', amount:total}], inventory:App.state.cart});
            const items = await ArthDB.getAll('items'); for(let l of App.state.cart) { const i = items.find(x=>x.name===l.name); if(i) { i.qty -= l.qty; await ArthDB.update('items', i); }}
            alert("Sales Bill Saved! ✅"); location.reload();
        },
        savePurchase: async () => {
            const party = document.getElementById('inv-party').value, sup = document.getElementById('sup-inv-no').value;
            const iName = document.getElementById('i-name').value; if(iName) App.Logic.addItem();
            if(!party || !App.state.cart.length) return alert("Error: Data Missing!");
            const total = App.state.cart.reduce((a,b)=>a+b.total,0);
            await ArthDB.add('vouchers', {id:`vp_${Date.now()}`, no:sup||'NA', date:new Date().toLocaleDateString('en-IN'), type:'Purchase', total, rows:[{ledger:'Purchase Account', type:'Dr', amount:total}, {ledger:party, type:'Cr', amount:total}], inventory:App.state.cart});
            const items = await ArthDB.getAll('items'); for(let l of App.state.cart) { const i = items.find(x=>x.name===l.name); if(i) { i.qty = (parseFloat(i.qty)||0)+(parseFloat(l.qty)||0); await ArthDB.update('items', i); }}
            alert("Purchase Saved! Stock Updated. ✅"); location.reload();
        },
        saveReceipt: async () => {
            const party = document.getElementById('r-party').value, ac = document.getElementById('r-ac').value, amt = parseFloat(document.getElementById('r-amt').value), nar = document.getElementById('r-nar').value;
            if(!party || !amt) return alert("Fill Party and Amount!");
            await ArthDB.add('vouchers', {id: `vr_${Date.now()}`, no: 'NA', date: new Date().toLocaleDateString('en-IN'), type: 'Receipt', total: amt, rows: [{ledger: ac, type: 'Dr', amount: amt}, {ledger: party, type: 'Cr', amount: amt}], narration: nar});
            alert("Receipt Saved! ✅"); location.reload();
        },
        savePayment: async () => {
            const party = document.getElementById('p-party').value, ac = document.getElementById('p-ac').value, amt = parseFloat(document.getElementById('p-amt').value), nar = document.getElementById('p-nar').value;
            if(!party || !amt) return alert("Fill Party and Amount!");
            await ArthDB.add('vouchers', {id: `vpymt_${Date.now()}`, no: 'NA', date: new Date().toLocaleDateString('en-IN'), type: 'Payment', total: amt, rows: [{ledger: party, type: 'Dr', amount: amt}, {ledger: ac, type: 'Cr', amount: amt}], narration: nar});
            alert("Payment Saved! ✅"); location.reload();
        },
        saveSettings: async () => {
            const profile = JSON.parse(localStorage.getItem('company_profile')) || {};
            profile.name = document.getElementById('c-name').value; profile.address = document.getElementById('c-addr').value; profile.mobile = document.getElementById('c-mob').value; profile.gstin = document.getElementById('c-gst').value;
            const readFile = (file) => new Promise((resolve)=>{ const r = new FileReader(); r.onload=e=>resolve(e.target.result); r.readAsDataURL(file); });
            if(document.getElementById('c-logo').files[0]) profile.logo = await readFile(document.getElementById('c-logo').files[0]);
            if(document.getElementById('c-sign').files[0]) profile.sign = await readFile(document.getElementById('c-sign').files[0]);
            localStorage.setItem('company_profile', JSON.stringify(profile)); alert("Settings Saved!"); location.reload();
        },

        // --- RENDER GST (With Filters) ---
        renderGST: async () => {
            const vchs = await ArthDB.getAll('vouchers');
            const ledgers = await ArthDB.getAll('ledgers');
            const fDate = document.getElementById('gst-from') ? document.getElementById('gst-from').value : '';
            const tDate = document.getElementById('gst-to') ? document.getElementById('gst-to').value : '';

            // Filter Vouchers
            const salesVchs = vchs.filter(v => {
                if(v.type !== 'Sales') return false;
                if(fDate && App.Logic.parseDate(v.date) < new Date(fDate)) return false;
                if(tDate && App.Logic.parseDate(v.date) > new Date(tDate)) return false;
                return true;
            });

            const taxBuckets = {'0':{t:0,i:0,c:0,s:0,tot:0}, '5':{t:0,i:0,c:0,s:0,tot:0}, '12':{t:0,i:0,c:0,s:0,tot:0}, '18':{t:0,i:0,c:0,s:0,tot:0}, '28':{t:0,i:0,c:0,s:0,tot:0}};
            salesVchs.forEach(v => {
                if(!v.inventory) return;
                const partyName = v.rows[0].ledger; const party = ledgers.find(l => l.name === partyName); const isInterState = party && party.state && party.state !== 'Rajasthan';
                v.inventory.forEach(i => {
                    const r = i.tax.toString(); if(!taxBuckets[r]) taxBuckets[r]={t:0,i:0,c:0,s:0,tot:0};
                    const b = parseFloat(i.base)||0, tAmt = parseFloat(i.taxAmt)||0;
                    taxBuckets[r].t+=b; if(isInterState) taxBuckets[r].i+=tAmt; else {taxBuckets[r].c+=tAmt/2; taxBuckets[r].s+=tAmt/2;} taxBuckets[r].tot+=(b+tAmt);
                });
            });
            const rows = Object.keys(taxBuckets).map(r => { const b=taxBuckets[r]; if(b.tot===0)return ''; return `<tr><td style="padding:10px;">${r}% GST</td><td style="text-align:right;">${b.t.toFixed(2)}</td><td style="text-align:right;">${b.i.toFixed(2)}</td><td style="text-align:right;">${b.c.toFixed(2)}</td><td style="text-align:right;">${b.s.toFixed(2)}</td><td style="text-align:right;font-weight:bold;">${b.tot.toFixed(2)}</td></tr>`; }).join('');
            document.getElementById('gst-content').innerHTML = `<table style="width:100%; border:1px solid #e2e8f0; font-size:14px; border-collapse:collapse;"><thead style="background:#f1f5f9; font-weight:bold;"><tr><td style="padding:10px;">Rate</td><td style="text-align:right;">Taxable</td><td style="text-align:right;">IGST</td><td style="text-align:right;">CGST</td><td style="text-align:right;">SGST</td><td style="text-align:right;">Total</td></tr></thead><tbody>${rows || '<tr><td colspan="6" style="padding:20px;text-align:center;">No Data</td></tr>'}</tbody></table>`;
        },

        // --- RENDER DAYBOOK (With Filters) ---
        renderDaybookRows: (list) => {
            const safeTotal = (amt) => (parseFloat(amt) || 0).toFixed(2);
            document.getElementById('db-rows').innerHTML = list.map(v => `
                <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px;">${v.date}</td>
                    <td style="padding:8px; font-weight:600; color:#334155;">${v.rows[0].ledger}</td>
                    <td style="padding:8px;">${v.no}</td>
                    <td style="padding:8px;">${v.type}</td>
                    <td style="padding:8px; text-align:right;">₹ ${safeTotal(v.total)}</td>
                    <td style="padding:8px; text-align:center;"><button onclick="App.Logic.printPreview('${v.id}')">🖨️</button> <button onclick="App.Logic.deleteVoucher('${v.id}')" style="color:#dc2626;">🗑️</button></td>
                </tr>`).join('');
        },
        filterDaybook: () => {
            const q = document.getElementById('db-search').value.toLowerCase();
            const fDate = document.getElementById('db-from').value;
            const tDate = document.getElementById('db-to').value;
            
            const filtered = App.state.tempVouchers.filter(v => {
                const matchesText = v.rows[0].ledger.toLowerCase().includes(q) || v.no.toLowerCase().includes(q) || v.type.toLowerCase().includes(q);
                let matchesDate = true;
                if(fDate && App.Logic.parseDate(v.date) < new Date(fDate)) matchesDate = false;
                if(tDate && App.Logic.parseDate(v.date) > new Date(tDate)) matchesDate = false;
                return matchesText && matchesDate;
            });
            App.Logic.renderDaybookRows(filtered);
        },
        deleteVoucher: async (id) => {
            if(!confirm("Delete this Entry? Stock will be reversed.")) return;
            const v = (await ArthDB.getAll('vouchers')).find(x => x.id === id); if(!v) return;
            if(v.inventory) {
                const items = await ArthDB.getAll('items');
                for(let l of v.inventory) {
                    const i = items.find(x => x.name === l.name);
                    if(i) { if(v.type === 'Sales') i.qty += parseFloat(l.qty); if(v.type === 'Purchase') i.qty -= parseFloat(l.qty); await ArthDB.update('items', i); }
                }
            }
            const req = indexedDB.open('ArthBook_Ent_DB', 1);
            req.onsuccess = (e) => { e.target.result.transaction(['vouchers'], 'readwrite').objectStore('vouchers').delete(id).oncomplete = () => { alert("Deleted!"); App.navigate('daybook'); }; };
        },
        editVoucher: async (id) => { if(confirm("Edit mode requires deleting first. Continue?")) await App.Logic.deleteVoucher(id); },

        // --- RENDER P&L (With Filters) ---
        renderPnL: async () => {
            const vchs = await ArthDB.getAll('vouchers');
            const items = await ArthDB.getAll('items');
            const fDate = document.getElementById('pnl-from') ? document.getElementById('pnl-from').value : '';
            const tDate = document.getElementById('pnl-to') ? document.getElementById('pnl-to').value : '';

            let sales = 0, purchase = 0;
            let closingStock = items.reduce((acc, i) => acc + ((parseFloat(i.qty)||0) * (parseFloat(i.rate)||0)), 0);

            vchs.forEach(v => {
                if(fDate && App.Logic.parseDate(v.date) < new Date(fDate)) return;
                if(tDate && App.Logic.parseDate(v.date) > new Date(tDate)) return;

                v.rows.forEach(r => {
                    if(r.ledger === 'Sales Account' && r.type === 'Cr') sales += parseFloat(r.amount);
                    if(r.ledger === 'Purchase Account' && r.type === 'Dr') purchase += parseFloat(r.amount);
                });
            });

            const grossProfit = (sales + closingStock) - purchase;
            const color = grossProfit >= 0 ? 'green' : 'red';

            document.getElementById('pnl-content').innerHTML = `
                <table style="width:100%; border:1px solid #e2e8f0; font-size:16px;">
                    <tr style="background:#f8fafc;"><td style="padding:10px;">Sales</td><td style="text-align:right; padding:10px;">${sales.toFixed(2)}</td></tr>
                    <tr style="background:#f8fafc;"><td style="padding:10px;">Purchase</td><td style="text-align:right; padding:10px;">(-) ${purchase.toFixed(2)}</td></tr>
                    <tr style="background:#f1f5f9; font-weight:bold;"><td style="padding:10px;">Closing Stock</td><td style="text-align:right; padding:10px;">(+) ${closingStock.toFixed(2)}</td></tr>
                    <tr style="background:${grossProfit>=0?'#dcfce7':'#fee2e2'}; font-weight:bold; font-size:20px; color:${color};"><td style="padding:20px;">NET PROFIT</td><td style="text-align:right; padding:20px;">₹ ${grossProfit.toFixed(2)}</td></tr>
                </table>`;
        },

        // --- LEDGER REPORT (With Date & Opening Balance Calculation) ---
        generateLedgerReport: async () => {
            const partyName = document.getElementById('rep-party').value;
            const fDateStr = document.getElementById('rep-from').value;
            const tDateStr = document.getElementById('rep-to').value;
            
            if(!partyName) return;

            const vchs = await ArthDB.getAll('vouchers');
            const ledgers = await ArthDB.getAll('ledgers');
            const ledgerMeta = ledgers.find(l=>l.name === partyName);
            if(!ledgerMeta) return;

            // 1. Calculate Previous Balance (Transactions before From Date)
            let prevBal = ledgerMeta.openingBalance || 0;
            const fDate = fDateStr ? new Date(fDateStr) : null;
            const tDate = tDateStr ? new Date(tDateStr) : null;

            vchs.forEach(v => {
                if(fDate && App.Logic.parseDate(v.date) < fDate) {
                    const row = v.rows.find(r => r.ledger === partyName);
                    if(row) {
                        if(row.type === 'Dr') prevBal += parseFloat(row.amount);
                        else prevBal -= parseFloat(row.amount);
                    }
                }
            });

            // 2. Filter Current Period Transactions
            const partyVouchers = vchs.filter(v => {
                if(!v.rows.some(r => r.ledger === partyName)) return false;
                const vDate = App.Logic.parseDate(v.date);
                if(fDate && vDate < fDate) return false;
                if(tDate && vDate > tDate) return false;
                return true;
            });

            let html = `<table style="width:100%; border-collapse:collapse; font-size:13px;"><thead style="background:#f1f5f9; color:#475569;"><tr><th style="padding:8px; border:1px solid #e2e8f0;">Date</th><th style="padding:8px; border:1px solid #e2e8f0;">Particulars</th><th style="padding:8px; border:1px solid #e2e8f0;">Type</th><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">Debit</th><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">Credit</th></tr></thead><tbody>`;
            
            // Show Brought Forward Balance
            html += `<tr style="background:#fffbeb;"><td colspan="3" style="padding:8px; font-weight:bold;">B/F Balance</td><td class="text-right" style="padding:8px; font-weight:bold;">${prevBal > 0 ? prevBal.toFixed(2) : ''}</td><td class="text-right" style="padding:8px; font-weight:bold;">${prevBal < 0 ? Math.abs(prevBal).toFixed(2) : ''}</td></tr>`;

            let runningBal = prevBal;
            let totalDr = prevBal > 0 ? prevBal : 0;
            let totalCr = prevBal < 0 ? Math.abs(prevBal) : 0;

            partyVouchers.forEach(v => {
                const row = v.rows.find(r => r.ledger === partyName);
                let dr = 0, cr = 0;
                if(row.type === 'Dr') { dr = parseFloat(row.amount); runningBal += dr; totalDr += dr; }
                else { cr = parseFloat(row.amount); runningBal -= cr; totalCr += cr; }
                
                html += `<tr><td style="padding:8px; border:1px solid #e2e8f0;">${v.date}</td><td style="padding:8px; border:1px solid #e2e8f0;">${v.type} <span style="color:grey;font-size:10px">(${v.no})</span></td><td style="padding:8px; border:1px solid #e2e8f0;">${v.type}</td><td style="padding:8px; border:1px solid #e2e8f0; text-align:right;">${dr ? dr.toFixed(2) : ''}</td><td style="padding:8px; border:1px solid #e2e8f0; text-align:right;">${cr ? cr.toFixed(2) : ''}</td></tr>`;
            });

            html += `<tr style="background:#f8fafc; font-weight:bold;"><td colspan="3" style="padding:8px; text-align:right;">Total:</td><td style="padding:8px; text-align:right;">${totalDr.toFixed(2)}</td><td style="padding:8px; text-align:right;">${totalCr.toFixed(2)}</td></tr></tbody></table>`;
            
            document.getElementById('rep-data').innerHTML = html;
            const suffix = runningBal >= 0 ? 'Dr (Receivable)' : 'Cr (Payable)';
            const color = runningBal >= 0 ? '#16a34a' : '#dc2626';
            document.getElementById('rep-bal').innerHTML = `<span style="color:${color}">₹ ${Math.abs(runningBal).toFixed(2)} ${suffix}</span>`;
        },

        saveItemAux: async () => { await ArthDB.add('items', {id:`i_${Date.now()}`, name:document.getElementById('i-name').value, unit:document.getElementById('i-unit').value, qty:document.getElementById('i-qty').value, rate:document.getElementById('i-rate').value, tax:document.getElementById('i-tax').value}); alert("Item Created!"); location.reload(); },
        saveLedgerAux: async () => { await ArthDB.add('ledgers', {id:`l_${Date.now()}`, name:document.getElementById('l-name').value, group:document.getElementById('l-group').value, gst:document.getElementById('l-gst').value, state:document.getElementById('l-state').value, address:document.getElementById('l-addr').value, openingBalance:parseFloat(document.getElementById('l-open').value)||0}); alert("Ledger Saved!"); location.reload(); },
        
        backupData: async () => { const data={ledgers:await ArthDB.getAll('ledgers'), items:await ArthDB.getAll('items'), vouchers:await ArthDB.getAll('vouchers')}; const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:"application/json"})); a.download=`ArthBook_Backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); },
        restoreData: async (input) => { const f=input.files[0]; if(!f)return; const r=new FileReader(); r.onload=async(e)=>{try{const d=JSON.parse(e.target.result); if(confirm("Overwrite Data?")){ for(let x of d.ledgers)await ArthDB.update('ledgers',x); for(let x of d.items)await ArthDB.update('items',x); for(let x of d.vouchers)await ArthDB.update('vouchers',x); alert("Restored! ♻️"); location.reload();}}catch(er){alert("Invalid File!");}}; r.readAsText(f); },
        masterReset: async () => { if(confirm("DELETE ALL DATA??")) { if(confirm("Final Warning!")) { indexedDB.deleteDatabase('ArthBook_Ent_DB').onsuccess=()=>location.reload(); } } },

        printPreview: async (id) => {
            try {
                const vchs = await ArthDB.getAll('vouchers'); const v = vchs.find(x => x.id === id); if(!v) return;
                const partyName = v.rows[0].ledger; 
                const p = JSON.parse(localStorage.getItem('company_profile')) || {name: 'ARTH BOOK ENTERPRISE', address: 'Jaipur, Rajasthan', mobile: '', gstin: '', logo: '', sign: ''};
                let bodyHTML = '';
                if(v.inventory) {
                    bodyHTML = `<table class="bill-table"><thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Total</th></tr></thead><tbody>${v.inventory.map(i=>`<tr><td>${i.name}</td><td class="text-right">${i.qty}</td><td class="text-right">${i.rate}</td><td class="text-right">${i.total.toFixed(2)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3" class="text-right">Total:</td><td class="text-right">${v.total.toFixed(2)}</td></tr></tfoot></table>`;
                } else {
                    bodyHTML = `<div style="padding:20px; font-size:18px; text-align:center; border:1px dashed #ccc; margin:20px;">Amount: <b>₹ ${v.total.toFixed(2)}</b><br><br>Narration: ${v.narration || 'NA'}</div>`;
                }
                document.body.innerHTML = `<div id="print-area"><div class="bill-box"><div class="bill-header">${p.logo ? `<img src="${p.logo}" style="height:60px; float:left; margin-right:15px;">` : ''}<div class="bill-org">${p.name}</div><div style="font-size:12px; color:#555;">${p.address} | Mob: ${p.mobile}</div>${p.gstin ? `<div style="font-size:12px; font-weight:bold;">GSTIN: ${p.gstin}</div>` : ''}<div class="bill-title">${v.type.toUpperCase()} VOUCHER</div></div><div class="bill-info"><div><strong>${v.type==='Sales'?'Bill To':'Party'}:</strong><br>${partyName}</div><div style="text-align:right"><strong>No:</strong> ${v.no}<br><strong>Date:</strong> ${v.date}</div></div>${bodyHTML}<div class="bill-footer">${p.sign ? `<div class="sign-box"><img src="${p.sign}" style="height:50px;"><br>Authorized Signatory</div>` : '<div class="sign-box">Authorized Signatory</div>'}</div><div class="no-print" style="text-align:center; margin-top:30px;"><button onclick="window.print()">PRINT</button> <button onclick="location.reload()">CLOSE</button></div></div></div>`;
            } catch(e){console.error(e);}
        }
    },

    Shortcuts: () => {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); location.reload(); }
            if (e.ctrlKey && e.key === 'Enter') {
                if (App.state.currentScreen === 'sales') App.Logic.saveInvoice();
                if (App.state.currentScreen === 'purchase') App.Logic.savePurchase(); 
                if (App.state.currentScreen === 'receipt') App.Logic.saveReceipt();
                if (App.state.currentScreen === 'payment') App.Logic.savePayment();
                if (App.state.currentScreen === 'create') App.Logic.saveLedgerAux();
                if (App.state.currentScreen === 'create_item') App.Logic.saveItemAux();
                if (App.state.currentScreen === 'settings') App.Logic.saveSettings();
            }
            if (e.key === 'Enter' && e.target.id === 'i-rate') App.Logic.addItem();
            const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT';
            if (App.state.currentScreen === 'gateway' && !isTyping) {
                const k = e.key.toLowerCase();
                if(e.key === 'F9') App.navigate('purchase'); 
                if(e.key === 'F6') App.navigate('receipt'); 
                if(e.key === 'F5') App.navigate('payment');
                if(k==='v') App.navigate('sales'); 
                if(k==='c') App.navigate('create'); 
                if(k==='i') App.navigate('create_item'); 
                if(k==='s') App.navigate('stock'); 
                if(k==='d') App.navigate('daybook');
            }
        });
    }
};
window.onload = App.init;