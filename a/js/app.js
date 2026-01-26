// FILE: js/app.js (Complete Accounting: Sales, Purchase, Payment, Receipt, Ledger Report)
const App = {
    state: { currentScreen: 'gateway', cart: [] },

    init: async () => { 
        try {
            await ArthDB.init(); 
            App.Shortcuts(); 
            App.renderGateway(); 
            console.log("Arth Book Professional Ready 🚀");
        } catch(e) { console.error(e); }
    },

    // --- 1. DASHBOARD (GATEWAY) ---
    renderGateway: async () => {
        App.state.currentScreen = 'gateway';
        const vchs = await ArthDB.getAll('vouchers');
        const recent = vchs.slice(-7).reverse(); 
        const safeTotal = (amt) => (parseFloat(amt) || 0).toFixed(2);

        document.querySelector('.workspace').innerHTML = `
            <div class="panel" style="flex: 3;">
                <div class="panel-head">
                    <span>Dashboard (Complete Accounting)</span>
                    <span style="font-size:11px; color:#64748b;">FY: 2026-27</span>
                </div>
                <div class="panel-body">
                    <div style="padding:15px;">
                        <h4 style="margin-top:0; color:#334155; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">Recent Transactions</h4>
                        <table>
                            <thead><tr><th>Type</th><th>Party Name</th><th>Vch No</th><th class="text-right">Amount</th></tr></thead>
                            <tbody>
                                ${recent.length ? recent.map(v => `
                                    <tr onclick="App.Logic.printPreview('${v.id}')" title="View Voucher" style="cursor:pointer">
                                        <td><span style="font-weight:600; color:#475569">${(v.type || 'VCH').toUpperCase()}</span></td>
                                        <td>${v.rows[0].ledger}</td>
                                        <td>${v.no}</td>
                                        <td class="text-right" style="font-weight:600">₹ ${safeTotal(v.total)}</td>
                                    </tr>`).join('') : '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8">No Entries Yet</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="footer" style="border-top:1px solid #e2e8f0; background:#f8fafc;">
                    Total Vouchers: ${vchs.length} | System Status: <span style="color:#16a34a; font-weight:bold">Online</span>
                </div>
            </div>

            <div class="panel" style="flex: 1; max-width: 280px;">
                <div class="panel-head">Quick Actions</div>
                <div class="panel-body">
                    <div class="menu-list">
                        <div style="font-size:11px; font-weight:bold; color:#94a3b8; margin-bottom:5px;">TRANSACTIONS</div>
                        <div class="menu-item" onclick="App.navigate('sales')"><span class="label"><span class="hotkey">V</span> Sales (Invoice)</span></div>
                        <div class="menu-item" onclick="App.navigate('purchase')"><span class="label"><span class="hotkey">F9</span> Purchase</span></div>
                        <div class="menu-item" onclick="App.navigate('receipt')"><span class="label"><span class="hotkey">F6</span> Receipt (In)</span></div>
                        <div class="menu-item" onclick="App.navigate('payment')"><span class="label"><span class="hotkey">F5</span> Payment (Out)</span></div>
                        
                        <div style="font-size:11px; font-weight:bold; color:#94a3b8; margin:10px 0 5px;">REPORTS & MASTERS</div>
                        <div class="menu-item" onclick="App.navigate('report_ledger')"><span class="label" style="color:#2563eb; font-weight:bold;">📄 Ledger Report</span></div>
                        <div class="menu-item" onclick="App.navigate('stock')"><span class="label"><span class="hotkey">S</span> Stock Summary</span></div>
                        <div class="menu-item" onclick="App.navigate('daybook')"><span class="label"><span class="hotkey">D</span> Day Book</span></div>
                        <hr style="border:0; border-top:1px solid #e2e8f0; margin:5px 0;">
                        <div class="menu-item" onclick="App.navigate('create')"><span class="label"><span class="hotkey">C</span> Create Ledger</span></div>
                        <div class="menu-item" onclick="App.navigate('create_item')"><span class="label"><span class="hotkey">I</span> Create Item</span></div>
                        
                        <div style="margin-top:20px; padding-top:10px; border-top:2px dashed #cbd5e1;">
                            <div class="menu-item" onclick="App.Logic.backupData()" style="color:#0f766e;"><span class="label">⬇️ Backup Data</span></div>
                            <div class="menu-item" onclick="document.getElementById('restore-file').click()" style="color:#b91c1c;"><span class="label">⬆️ Restore Data</span></div>
                            <input type="file" id="restore-file" style="display:none" onchange="App.Logic.restoreData(this)">
                            <div class="menu-item" onclick="App.Logic.masterReset()" style="color:#dc2626; font-weight:bold; border-top:1px solid #fee2e2; margin-top:10px; padding-top:10px;"><span class="label">⚠️ Master Reset</span></div>
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

            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">Sales Invoice <span style="font-size:11px; cursor:pointer; color:#ef4444;" onclick="location.reload()">[ESC]</span></div>
                    <div class="panel-body" style="padding:20px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:15px; background:#f8fafc; padding:10px; border:1px solid #e2e8f0;">
                            <div>Inv No: <b>${Date.now().toString().slice(-4)}</b></div>
                            <div>Date: <b>${new Date().toLocaleDateString('en-IN')}</b></div>
                        </div>
                        <div style="margin-bottom:20px;">
                            <label style="font-weight:600; color:#475569;">Party Name (Dr)</label>
                            <input list="parties" id="inv-party" placeholder="Select Customer" autofocus style="width:100%; border:1px solid #cbd5e1; padding:8px;">
                            <datalist id="parties">${parties}</datalist>
                        </div>
                        <table style="border:1px solid #e2e8f0;">
                            <thead><tr><th>Item Name</th><th style="width:80px; text-align:right">Qty</th><th style="width:100px; text-align:right">Rate</th><th style="width:60px; text-align:right">GST%</th><th style="width:120px; text-align:right">Total</th></tr></thead>
                            <tbody id="inv-rows">
                                <tr>
                                    <td><input list="items" id="i-name" placeholder="Item" onchange="App.Logic.itemSelected(this.value)" style="border:none; width:100%; outline:none;"></td>
                                    <td><input type="number" id="i-qty" placeholder="1" class="text-right" onchange="App.Logic.calcRow()" style="border:none; width:100%; outline:none;"></td>
                                    <td><input type="number" id="i-rate" placeholder="0" class="text-right" onchange="App.Logic.calcRow()" style="border:none; width:100%; outline:none;"></td>
                                    <td><input type="number" id="i-tax" placeholder="0" class="text-right" readonly style="border:none; width:100%; outline:none; background:#f1f5f9;"></td>
                                    <td class="text-right" id="i-amt" style="padding-right:12px; font-weight:bold;">0.00</td>
                                </tr>
                            </tbody>
                            <datalist id="items">${stockItems}</datalist>
                        </table>
                        <div id="added-list" style="height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-top:none; background:#fff;"></div>
                    </div>
                    <div style="padding:15px; background:#f1f5f9; text-align:right; font-size:16px; font-weight:bold; border-top:1px solid #cbd5e1;">Grand Total: ₹ <span id="inv-total">0.00</span><div style="margin-top:10px;"><button onclick="App.Logic.saveInvoice()" class="action-btn" style="background:#1e293b; color:white;">SAVE BILL</button></div></div>
                </div>`;
            setTimeout(()=>document.getElementById('inv-party').focus(), 100);
        }

        // --- PURCHASE ENTRY ---
        else if(page === 'purchase') {
            App.state.cart = [];
            const ledgers = await ArthDB.getAll('ledgers');
            const items = await ArthDB.getAll('items');
            const parties = ledgers.filter(l => (l.group && l.group.includes('Creditor')) || l.group === 'Cash-in-hand').map(l=>`<option value="${l.name}">`).join('');
            const stockItems = items.map(i=>`<option value="${i.name}">`).join('');

            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head" style="background:#fff7ed; color:#9a3412;">Purchase Voucher <span style="float:right; cursor:pointer" onclick="location.reload()">[ESC]</span></div>
                    <div class="panel-body" style="padding:20px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:15px; background:#fff7ed; padding:10px; border:1px solid #fed7aa;">
                            <div style="display:flex; gap:10px; align-items:center;"><label>Ref No:</label><input id="sup-inv-no" placeholder="e.g. 123" style="width:150px; font-weight:bold;"></div>
                            <div>Date: <b>${new Date().toLocaleDateString('en-IN')}</b></div>
                        </div>
                        <div style="margin-bottom:20px;"><label style="font-weight:600; color:#475569;">Party Name (Supplier)</label><input list="parties" id="inv-party" placeholder="Select Supplier" autofocus style="width:100%; border:1px solid #cbd5e1; padding:8px;"><datalist id="parties">${parties}</datalist></div>
                        <table style="border:1px solid #e2e8f0;"><thead><tr><th>Item Name</th><th style="width:80px; text-align:right">Qty</th><th style="width:100px; text-align:right">Rate</th><th style="width:60px; text-align:right">GST%</th><th style="width:120px; text-align:right">Total</th></tr></thead><tbody id="inv-rows"><tr><td><input list="items" id="i-name" placeholder="Item" onchange="App.Logic.itemSelected(this.value)" style="border:none; width:100%; outline:none;"></td><td><input type="number" id="i-qty" placeholder="1" class="text-right" onchange="App.Logic.calcRow()" style="border:none; width:100%; outline:none;"></td><td><input type="number" id="i-rate" placeholder="0" class="text-right" onchange="App.Logic.calcRow()" style="border:none; width:100%; outline:none;"></td><td><input type="number" id="i-tax" placeholder="0" class="text-right" readonly style="border:none; width:100%; outline:none; background:#f1f5f9;"></td><td class="text-right" id="i-amt" style="padding-right:12px; font-weight:bold;">0.00</td></tr></tbody><datalist id="items">${stockItems}</datalist></table>
                        <div id="added-list" style="height:150px; overflow-y:auto; border:1px solid #e2e8f0; border-top:none; background:#fff;"></div>
                    </div>
                    <div style="padding:15px; background:#fff7ed; text-align:right; font-size:16px; font-weight:bold; border-top:1px solid #fed7aa;">Grand Total: ₹ <span id="inv-total">0.00</span><div style="margin-top:10px;"><button onclick="App.Logic.savePurchase()" class="action-btn" style="background:#ea580c; color:white; border-bottom:2px solid #9a3412;">SAVE PURCHASE</button></div></div>
                </div>`;
            setTimeout(()=>document.getElementById('sup-inv-no').focus(), 100);
        }

        // --- RECEIPT (F6) - पैसा आया ---
        else if(page === 'receipt') {
            const ledgers = await ArthDB.getAll('ledgers');
            const parties = ledgers.filter(l => l.group !== 'Cash-in-hand').map(l=>`<option value="${l.name}">`).join('');
            
            document.querySelector('.workspace').innerHTML = `
                <div class="panel" style="max-width:500px; margin:auto; align-self:center; border-top:4px solid #16a34a;">
                    <div class="panel-head">Receipt Voucher (F6) <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div>
                    <div class="panel-body" style="padding:20px;">
                        <div style="margin-bottom:15px;">
                            <label style="font-weight:600; color:#16a34a;">Account (Debit)</label>
                            <select id="r-ac" style="width:100%; padding:8px; border:1px solid #cbd5e1;"><option>Cash-in-hand</option><option>Bank Account</option></select>
                        </div>
                        <div style="margin-bottom:15px;">
                            <label style="font-weight:600; color:#475569;">Payer / Party (Credit)</label>
                            <input list="parties" id="r-party" placeholder="Select Party" style="width:100%; padding:8px; border:1px solid #cbd5e1;">
                            <datalist id="parties">${parties}</datalist>
                        </div>
                        <div style="margin-bottom:15px;">
                            <label style="font-weight:600; color:#475569;">Amount (₹)</label>
                            <input type="number" id="r-amt" placeholder="0.00" style="width:100%; padding:8px; border:1px solid #cbd5e1; font-weight:bold; font-size:16px;">
                        </div>
                        <div style="margin-bottom:20px;">
                            <label style="font-weight:600; color:#94a3b8;">Narration</label>
                            <input type="text" id="r-nar" placeholder="Being cash received..." style="width:100%; padding:8px; border:1px solid #cbd5e1;">
                        </div>
                        <div style="text-align:right;">
                            <button onclick="App.Logic.saveReceipt()" class="action-btn" style="background:#16a34a; color:white;">SAVE RECEIPT</button>
                        </div>
                    </div>
                </div>`;
            setTimeout(()=>document.getElementById('r-party').focus(), 100);
        }

        // --- PAYMENT (F5) - पैसा गया ---
        else if(page === 'payment') {
            const ledgers = await ArthDB.getAll('ledgers');
            const parties = ledgers.filter(l => l.group !== 'Cash-in-hand').map(l=>`<option value="${l.name}">`).join('');

            document.querySelector('.workspace').innerHTML = `
                <div class="panel" style="max-width:500px; margin:auto; align-self:center; border-top:4px solid #dc2626;">
                    <div class="panel-head">Payment Voucher (F5) <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div>
                    <div class="panel-body" style="padding:20px;">
                        <div style="margin-bottom:15px;">
                            <label style="font-weight:600; color:#475569;">Account (Credit)</label>
                            <select id="p-ac" style="width:100%; padding:8px; border:1px solid #cbd5e1;"><option>Cash-in-hand</option><option>Bank Account</option></select>
                        </div>
                        <div style="margin-bottom:15px;">
                            <label style="font-weight:600; color:#dc2626;">Paid To / Party (Debit)</label>
                            <input list="parties" id="p-party" placeholder="Select Party" style="width:100%; padding:8px; border:1px solid #cbd5e1;">
                            <datalist id="parties">${parties}</datalist>
                        </div>
                        <div style="margin-bottom:15px;">
                            <label style="font-weight:600; color:#475569;">Amount (₹)</label>
                            <input type="number" id="p-amt" placeholder="0.00" style="width:100%; padding:8px; border:1px solid #cbd5e1; font-weight:bold; font-size:16px;">
                        </div>
                        <div style="margin-bottom:20px;">
                            <label style="font-weight:600; color:#94a3b8;">Narration</label>
                            <input type="text" id="p-nar" placeholder="Being cash paid..." style="width:100%; padding:8px; border:1px solid #cbd5e1;">
                        </div>
                        <div style="text-align:right;">
                            <button onclick="App.Logic.savePayment()" class="action-btn" style="background:#dc2626; color:white;">SAVE PAYMENT</button>
                        </div>
                    </div>
                </div>`;
            setTimeout(()=>document.getElementById('p-party').focus(), 100);
        }

        // --- LEDGER REPORT (खाता बही) ---
        else if(page === 'report_ledger') {
            const ledgers = await ArthDB.getAll('ledgers');
            const parties = ledgers.map(l=>`<option value="${l.name}">`).join('');
            
            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">Party Ledger Report <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div>
                    <div class="panel-body" style="padding:20px;">
                        <div style="display:flex; gap:10px; margin-bottom:20px; align-items:flex-end;">
                            <div style="flex:1;">
                                <label style="font-weight:bold; color:#475569">Select Party Account</label>
                                <input list="parties" id="rep-party" placeholder="Type Party Name..." onchange="App.Logic.generateLedgerReport(this.value)" style="width:100%; padding:8px; border:1px solid #cbd5e1;">
                                <datalist id="parties">${parties}</datalist>
                            </div>
                            <div style="padding-bottom:10px; font-weight:bold; color:#1e293b;">
                                Current Balance: <span id="rep-bal" style="font-size:18px;">---</span>
                            </div>
                        </div>
                        <div id="rep-data" style="min-height:300px; border:1px solid #e2e8f0;">
                            <div style="padding:20px; text-align:center; color:#94a3b8;">Select a party to view statement</div>
                        </div>
                    </div>
                </div>`;
            setTimeout(()=>document.getElementById('rep-party').focus(), 100);
        }

        // --- STOCK SUMMARY ---
        else if(page === 'stock') {
            const items = await ArthDB.getAll('items');
            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">Stock Summary <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div>
                    <div class="panel-body"><table><thead><tr><th>Item Name</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Value</th></tr></thead>
                    <tbody>${items.map(i => {
                        const val = (parseFloat(i.qty)||0)*(parseFloat(i.rate)||0);
                        return `<tr><td>${i.name}</td><td class="text-right">${i.qty} ${i.unit}</td><td class="text-right">₹ ${i.rate}</td><td class="text-right" style="font-weight:bold;">₹ ${val.toFixed(2)}</td></tr>`;
                    }).join('')}</tbody></table></div></div>`;
        }

        // --- FORMS ---
        else if(page === 'create_item') { App.renderForm('Stock Item Creation', [{label:'Item Name', id:'i-name'}, {label:'Unit', id:'i-unit'}, {label:'GST %', id:'i-tax', type:'select', opts:['0','5','12','18','28']}, {label:'Opening Qty', id:'i-qty', type:'number'}, {label:'Rate', id:'i-rate', type:'number'}], 'App.Logic.saveItemAux()'); }
        
        else if(page === 'create') {
            App.renderForm('Ledger Creation (Professional)', [
                {label:'Ledger Name', id:'l-name'},
                {label:'Group', id:'l-group', type:'select', opts:['Sundry Debtors (Customer)','Sundry Creditors (Supplier)','Sales Accounts','Purchase Accounts','Cash-in-hand','Bank Accounts','Indirect Expenses','Capital Account']},
                {label:'GSTIN (Optional)', id:'l-gst'}, {label:'State', id:'l-state', type:'select', opts:['Rajasthan','Delhi','Maharashtra','Gujarat','Other']}, 
                {label:'Address', id:'l-addr'}, {label:'Opening Balance', id:'l-open', type:'number'}
            ], 'App.Logic.saveLedgerAux()');
        }

        else if(page === 'daybook') { const vchs = await ArthDB.getAll('vouchers'); const safeTotal = (amt) => (parseFloat(amt) || 0).toFixed(2); document.querySelector('.workspace').innerHTML = `<div class="panel"><div class="panel-head">Day Book <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div><div class="panel-body"><table><thead><tr><th>Date</th><th>Particulars</th><th>Vch No</th><th>Type</th><th class="text-right">Amount</th></tr></thead><tbody>${vchs.map(v=>`<tr onclick="App.Logic.printPreview('${v.id}')" style="cursor:pointer"><td>${v.date}</td><td>${v.rows[0].ledger}</td><td>${v.no}</td><td>${v.type}</td><td class="text-right">₹ ${safeTotal(v.total)}</td></tr>`).join('')}</tbody></table></div></div>`; }
        else { App.renderGateway(); }
    },

    renderForm: (title, fields, saveFunc) => {
        let html = `<div class="panel" style="max-width:500px; margin:auto; align-self:center;"><div class="panel-head">${title} <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div><div class="panel-body" style="padding:20px;">`;
        fields.forEach(f => { html += `<div style="margin-bottom:10px;"><label style="font-weight:600; font-size:12px; color:#64748b">${f.label}</label>`; if(f.type==='select') html += `<select id="${f.id}" style="width:100%; border:1px solid #cbd5e1; padding:8px;">${f.opts.map(o=>`<option>${o}</option>`).join('')}</select>`; else html += `<input id="${f.id}" type="${f.type||'text'}" style="width:100%; border:1px solid #cbd5e1; padding:8px;">`; html += `</div>`; });
        html += `<div style="text-align:right; margin-top:15px;"><button onclick="${saveFunc}" class="action-btn" style="background:#1e293b; color:white;">SAVE</button></div></div></div>`;
        document.querySelector('.workspace').innerHTML = html; setTimeout(()=>document.getElementById(fields[0].id).focus(), 100);
    },

    Logic: {
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

        // --- NEW LOGIC: RECEIPT ---
        saveReceipt: async () => {
            const party = document.getElementById('r-party').value;
            const ac = document.getElementById('r-ac').value;
            const amt = parseFloat(document.getElementById('r-amt').value);
            const nar = document.getElementById('r-nar').value;
            if(!party || !amt) return alert("Fill Party and Amount!");
            await ArthDB.add('vouchers', {
                id: `vr_${Date.now()}`, no: 'NA', date: new Date().toLocaleDateString('en-IN'), type: 'Receipt', total: amt,
                rows: [{ledger: ac, type: 'Dr', amount: amt}, {ledger: party, type: 'Cr', amount: amt}],
                narration: nar
            });
            alert("Receipt Saved! ✅"); location.reload();
        },

        // --- NEW LOGIC: PAYMENT ---
        savePayment: async () => {
            const party = document.getElementById('p-party').value;
            const ac = document.getElementById('p-ac').value;
            const amt = parseFloat(document.getElementById('p-amt').value);
            const nar = document.getElementById('p-nar').value;
            if(!party || !amt) return alert("Fill Party and Amount!");
            await ArthDB.add('vouchers', {
                id: `vpymt_${Date.now()}`, no: 'NA', date: new Date().toLocaleDateString('en-IN'), type: 'Payment', total: amt,
                rows: [{ledger: party, type: 'Dr', amount: amt}, {ledger: ac, type: 'Cr', amount: amt}],
                narration: nar
            });
            alert("Payment Saved! ✅"); location.reload();
        },

        // --- NEW LOGIC: LEDGER REPORT ---
        generateLedgerReport: async (partyName) => {
            const vchs = await ArthDB.getAll('vouchers');
            const ledgers = await ArthDB.getAll('ledgers');
            const ledgerMeta = ledgers.find(l=>l.name === partyName);
            if(!ledgerMeta) return;

            // Filter vouchers where this party is involved
            const partyVouchers = vchs.filter(v => v.rows.some(r => r.ledger === partyName));
            
            let bal = ledgerMeta.openingBalance || 0; // Assuming Dr opening for Debtors usually
            let html = `
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                    <thead style="background:#f1f5f9; color:#475569;">
                        <tr><th style="padding:8px; border:1px solid #e2e8f0;">Date</th><th style="padding:8px; border:1px solid #e2e8f0;">Particulars</th><th style="padding:8px; border:1px solid #e2e8f0;">Vch Type</th><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">Debit (₹)</th><th style="padding:8px; border:1px solid #e2e8f0; text-align:right;">Credit (₹)</th></tr>
                    </thead>
                    <tbody>
                        <tr style="background:#fffbeb;"><td colspan="3" style="padding:8px; font-weight:bold;">Opening Balance</td><td class="text-right" style="padding:8px; font-weight:bold;">${bal > 0 ? bal.toFixed(2) : ''}</td><td class="text-right" style="padding:8px; font-weight:bold;">${bal < 0 ? Math.abs(bal).toFixed(2) : ''}</td></tr>
            `;

            let totalDr = bal > 0 ? bal : 0;
            let totalCr = bal < 0 ? Math.abs(bal) : 0;

            partyVouchers.forEach(v => {
                const row = v.rows.find(r => r.ledger === partyName);
                if(!row) return;
                
                let dr = 0, cr = 0;
                if(row.type === 'Dr') dr = parseFloat(row.amount);
                else cr = parseFloat(row.amount);
                
                totalDr += dr; 
                totalCr += cr;
                
                html += `
                    <tr>
                        <td style="padding:8px; border:1px solid #e2e8f0;">${v.date}</td>
                        <td style="padding:8px; border:1px solid #e2e8f0;">${v.type === 'Sales' ? 'Sales A/c' : (v.type === 'Purchase' ? 'Purchase A/c' : (v.type==='Receipt'?'Cash/Bank':(v.type==='Payment'?'Cash/Bank':'Ref')))} <div style="font-size:10px; color:grey">${v.narration || ''}</div></td>
                        <td style="padding:8px; border:1px solid #e2e8f0;">${v.type}</td>
                        <td style="padding:8px; border:1px solid #e2e8f0; text-align:right;">${dr ? dr.toFixed(2) : ''}</td>
                        <td style="padding:8px; border:1px solid #e2e8f0; text-align:right;">${cr ? cr.toFixed(2) : ''}</td>
                    </tr>
                `;
            });

            const netBal = totalDr - totalCr;
            const balColor = netBal >= 0 ? '#16a34a' : '#dc2626'; // Green for Dr (Receivable), Red for Cr (Payable) - Simplified View
            const suffix = netBal >= 0 ? 'Dr' : 'Cr';

            html += `
                    <tr style="background:#f8fafc; font-weight:bold;">
                        <td colspan="3" style="padding:8px; text-align:right;">Closing Balance:</td>
                        <td style="padding:8px; text-align:right;">${totalDr.toFixed(2)}</td>
                        <td style="padding:8px; text-align:right;">${totalCr.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>`;
            
            document.getElementById('rep-data').innerHTML = html;
            document.getElementById('rep-bal').innerHTML = `<span style="color:${balColor}">₹ ${Math.abs(netBal).toFixed(2)} ${suffix}</span>`;
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
                // Simple Print Logic for all types
                let bodyHTML = '';
                if(v.inventory) {
                    bodyHTML = `<table class="bill-table"><thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Total</th></tr></thead><tbody>${v.inventory.map(i=>`<tr><td>${i.name}</td><td class="text-right">${i.qty}</td><td class="text-right">${i.rate}</td><td class="text-right">${i.total.toFixed(2)}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="3" class="text-right">Total:</td><td class="text-right">${v.total.toFixed(2)}</td></tr></tfoot></table>`;
                } else {
                    bodyHTML = `<div style="padding:20px; font-size:18px; text-align:center; border:1px dashed #ccc; margin:20px;">Amount: <b>₹ ${v.total.toFixed(2)}</b><br><br>Narration: ${v.narration || 'NA'}</div>`;
                }
                
                document.body.innerHTML = `<div id="print-area"><div class="bill-box"><div class="bill-header"><div class="bill-org">ARTH BOOK ENTERPRISE</div><div class="bill-title">${v.type.toUpperCase()} VOUCHER</div></div><div class="bill-info"><div><strong>${v.type==='Sales'?'Bill To':'Party'}:</strong><br>${partyName}</div><div style="text-align:right"><strong>No:</strong> ${v.no}<br><strong>Date:</strong> ${v.date}</div></div>${bodyHTML}<div class="no-print" style="text-align:center; margin-top:30px;"><button onclick="window.print()">PRINT</button> <button onclick="location.reload()">CLOSE</button></div></div></div>`;
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