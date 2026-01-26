// FILE: js/app.js (Professional GST + Auto-Add + Backup/Restore + Purchase + Master Reset)
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
                    <span>Dashboard (GST Edition)</span>
                    <span style="font-size:11px; color:#64748b;">FY: 2026-27</span>
                </div>
                <div class="panel-body">
                    <div style="padding:15px;">
                        <h4 style="margin-top:0; color:#334155; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">Recent Transactions</h4>
                        <table>
                            <thead><tr><th>Type</th><th>Party Name</th><th>Vch No</th><th class="text-right">Total Amount</th></tr></thead>
                            <tbody>
                                ${recent.length ? recent.map(v => `
                                    <tr onclick="App.Logic.printPreview('${v.id}')" title="Print Bill" style="cursor:pointer">
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
                    Total Vouchers: ${vchs.length} | Status: <span style="color:#16a34a; font-weight:bold">Active</span>
                </div>
            </div>

            <div class="panel" style="flex: 1; max-width: 280px;">
                <div class="panel-head">Quick Actions</div>
                <div class="panel-body">
                    <div class="menu-list">
                        <div class="menu-item" onclick="App.navigate('sales')"><span class="label"><span class="hotkey">V</span> Sales Invoice</span></div>
                        <div class="menu-item" onclick="App.navigate('purchase')"><span class="label"><span class="hotkey">F9</span> Purchase Entry</span></div>
                        
                        <div class="menu-item" onclick="App.navigate('create')"><span class="label"><span class="hotkey">C</span> Create Ledger</span></div>
                        <div class="menu-item" onclick="App.navigate('create_item')"><span class="label"><span class="hotkey">I</span> Create Item (GST)</span></div>
                        <hr style="border:0; border-top:1px solid #e2e8f0; margin:5px 0;">
                        <div class="menu-item" onclick="App.navigate('stock')"><span class="label"><span class="hotkey">S</span> Stock Summary</span></div>
                        <div class="menu-item" onclick="App.navigate('daybook')"><span class="label"><span class="hotkey">D</span> Day Book</span></div>
                        
                        <div style="margin-top:20px; padding-top:10px; border-top:2px dashed #cbd5e1;">
                            <div class="menu-item" onclick="App.Logic.backupData()" style="color:#0f766e;"><span class="label">⬇️ Backup Data</span></div>
                            <div class="menu-item" onclick="document.getElementById('restore-file').click()" style="color:#b91c1c;"><span class="label">⬆️ Restore Data</span></div>
                            <input type="file" id="restore-file" style="display:none" onchange="App.Logic.restoreData(this)">
                            
                            <div class="menu-item" onclick="App.Logic.masterReset()" style="color:#dc2626; font-weight:bold; border-top:1px solid #fee2e2; margin-top:10px; padding-top:10px;">
                                <span class="label">⚠️ Master Reset (Data Clear)</span>
                            </div>
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
            const parties = ledgers.filter(l => l.group === 'Sundry Debtors' || l.group === 'Cash-in-hand').map(l=>`<option value="${l.name}">`).join('');
            const stockItems = items.map(i=>`<option value="${i.name}">`).join('');

            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">Sales Invoice <span style="font-size:11px; cursor:pointer; color:#ef4444;" onclick="location.reload()">[ESC to Exit]</span></div>
                    <div class="panel-body" style="padding:20px;">
                        
                        <div style="display:flex; justify-content:space-between; margin-bottom:15px; background:#f8fafc; padding:10px; border:1px solid #e2e8f0;">
                            <div>Inv No: <b>${Date.now().toString().slice(-4)}</b></div>
                            <div>Date: <b>${new Date().toLocaleDateString('en-IN')}</b></div>
                        </div>
                        
                        <div style="margin-bottom:20px;">
                            <label style="font-weight:600; color:#475569;">Party A/c Name</label>
                            <input list="parties" id="inv-party" placeholder="Select Party" autofocus style="width:100%; border:1px solid #cbd5e1; padding:8px;">
                            <datalist id="parties">${parties}</datalist>
                        </div>

                        <table style="border:1px solid #e2e8f0;">
                            <thead><tr>
                                <th>Item Name</th>
                                <th style="width:80px; text-align:right">Qty</th>
                                <th style="width:100px; text-align:right">Rate</th>
                                <th style="width:60px; text-align:right">GST%</th>
                                <th style="width:120px; text-align:right">Total</th>
                            </tr></thead>
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
                        
                        <div id="added-list" style="height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-top:none; background:#fff;"></div>
                    </div>
                    
                    <div style="padding:15px; background:#f1f5f9; text-align:right; font-size:16px; font-weight:bold; border-top:1px solid #cbd5e1;">
                        Grand Total: ₹ <span id="inv-total">0.00</span>
                        <div style="margin-top:10px;">
                            <button onclick="App.Logic.saveInvoice()" class="action-btn" style="background:#1e293b; color:white;">SAVE BILL</button>
                        </div>
                    </div>
                </div>`;
            setTimeout(()=>document.getElementById('inv-party').focus(), 100);
        }

        // --- PURCHASE ENTRY (F9) ---
        else if(page === 'purchase') {
            App.state.cart = [];
            const ledgers = await ArthDB.getAll('ledgers');
            const items = await ArthDB.getAll('items');
            
            // सिर्फ Sundry Creditors (लेनदार) दिखाओ
            const parties = ledgers.filter(l => l.group === 'Sundry Creditors' || l.group === 'Cash-in-hand').map(l=>`<option value="${l.name}">`).join('');
            const stockItems = items.map(i=>`<option value="${i.name}">`).join('');

            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head" style="background:#fff7ed; color:#9a3412;">
                        Purchase Voucher (Inward) 
                        <span style="font-size:11px; cursor:pointer; float:right; color:#ef4444;" onclick="location.reload()">[ESC to Exit]</span>
                    </div>
                    <div class="panel-body" style="padding:20px;">
                        
                        <div style="display:flex; justify-content:space-between; margin-bottom:15px; background:#fff7ed; padding:10px; border:1px solid #fed7aa;">
                            <div style="display:flex; gap:10px; align-items:center;">
                                <label>Supplier Inv No:</label>
                                <input id="sup-inv-no" placeholder="e.g. GST/001" style="width:150px; font-weight:bold;">
                            </div>
                            <div>Date: <b>${new Date().toLocaleDateString('en-IN')}</b></div>
                        </div>
                        
                        <div style="margin-bottom:20px;">
                            <label style="font-weight:600; color:#475569;">Party A/c Name (Supplier)</label>
                            <input list="parties" id="inv-party" placeholder="Select Supplier" autofocus style="width:100%; border:1px solid #cbd5e1; padding:8px;">
                            <datalist id="parties">${parties}</datalist>
                        </div>

                        <table style="border:1px solid #e2e8f0;">
                            <thead><tr>
                                <th>Item Name</th>
                                <th style="width:80px; text-align:right">Qty</th>
                                <th style="width:100px; text-align:right">Rate (Buy)</th>
                                <th style="width:60px; text-align:right">GST%</th>
                                <th style="width:120px; text-align:right">Total</th>
                            </tr></thead>
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
                        
                        <div id="added-list" style="height:200px; overflow-y:auto; border:1px solid #e2e8f0; border-top:none; background:#fff;"></div>
                    </div>
                    
                    <div style="padding:15px; background:#fff7ed; text-align:right; font-size:16px; font-weight:bold; border-top:1px solid #fed7aa;">
                        Grand Total: ₹ <span id="inv-total">0.00</span>
                        <div style="margin-top:10px;">
                            <button onclick="App.Logic.savePurchase()" class="action-btn" style="background:#ea580c; color:white; border-bottom:2px solid #9a3412;">SAVE PURCHASE</button>
                        </div>
                    </div>
                </div>`;
            setTimeout(()=>document.getElementById('sup-inv-no').focus(), 100);
        }
        
        // --- STOCK SUMMARY ---
        else if(page === 'stock') {
            const items = await ArthDB.getAll('items');
            document.querySelector('.workspace').innerHTML = `
                <div class="panel">
                    <div class="panel-head">Stock Summary <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div>
                    <div class="panel-body">
                        <table>
                            <thead><tr><th>Item Name</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">GST %</th><th class="text-right">Value</th></tr></thead>
                            <tbody>${items.map(i => {
                                const val = (parseFloat(i.qty)||0)*(parseFloat(i.rate)||0);
                                return `<tr><td>${i.name}</td><td class="text-right">${i.qty} ${i.unit}</td><td class="text-right">₹ ${i.rate}</td><td class="text-right">${i.tax || 0}%</td><td class="text-right" style="font-weight:bold;">₹ ${val.toFixed(2)}</td></tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>
                </div>`;
        }

        // --- FORMS ---
        else if(page === 'create_item') App.renderForm('Stock Item Creation', [
            {label:'Item Name', id:'i-name'}, 
            {label:'Unit (e.g. Nos, Kg)', id:'i-unit'}, 
            {label:'GST Rate (%)', id:'i-tax', type:'select', opts:['0','5','12','18','28']}, 
            {label:'Opening Qty', id:'i-qty', type:'number'}, 
            {label:'Rate (Price)', id:'i-rate', type:'number'}
        ], 'App.Logic.saveItemAux()');

        else if(page === 'create') App.renderForm('Ledger Creation', [{label:'Ledger Name', id:'l-name'}, {label:'Under Group', id:'l-group', type:'select', opts:['Sundry Debtors','Sundry Creditors','Sales Accounts','Purchase Accounts','Cash-in-hand']}], 'App.Logic.saveLedgerAux()');
        else if(page === 'daybook') { const vchs = await ArthDB.getAll('vouchers'); const safeTotal = (amt) => (parseFloat(amt) || 0).toFixed(2); document.querySelector('.workspace').innerHTML = `<div class="panel"><div class="panel-head">Day Book <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div><div class="panel-body"><table><thead><tr><th>Date</th><th>Particulars</th><th>Vch No</th><th class="text-right">Amount</th></tr></thead><tbody>${vchs.map(v=>`<tr onclick="App.Logic.printPreview('${v.id}')" title="Print" style="cursor:pointer"><td>${v.date}</td><td>${v.rows[0].ledger}</td><td>${v.no}</td><td class="text-right">₹ ${safeTotal(v.total)}</td></tr>`).join('')}</tbody></table></div></div>`; }
        else { App.renderGateway(); }
    },

    renderForm: (title, fields, saveFunc) => {
        let html = `<div class="panel" style="max-width:500px; margin:auto; align-self:center;"><div class="panel-head">${title} <span onclick="location.reload()" style="float:right; cursor:pointer">[ESC]</span></div><div class="panel-body" style="padding:20px;">`;
        fields.forEach(f => { html += `<div style="margin-bottom:10px;"><label style="font-weight:600; font-size:12px; color:#64748b">${f.label}</label>`; if(f.type==='select') html += `<select id="${f.id}" style="width:100%; border:1px solid #cbd5e1; padding:8px;">${f.opts.map(o=>`<option>${o}</option>`).join('')}</select>`; else html += `<input id="${f.id}" type="${f.type||'text'}" style="width:100%; border:1px solid #cbd5e1; padding:8px;">`; html += `</div>`; });
        html += `<div style="text-align:right; margin-top:15px;"><button onclick="${saveFunc}" class="action-btn" style="background:#1e293b; color:white;">SAVE</button></div></div></div>`;
        document.querySelector('.workspace').innerHTML = html; setTimeout(()=>document.getElementById(fields[0].id).focus(), 100);
    },

    Logic: {
        itemSelected: async (name) => { 
            const i = (await ArthDB.getAll('items')).find(x => x.name === name); 
            if(i) { 
                document.getElementById('i-rate').value = i.rate; 
                document.getElementById('i-tax').value = i.tax || 0; 
                document.getElementById('i-qty').focus(); 
            } 
        },
        calcRow: () => { 
            const q = parseFloat(document.getElementById('i-qty').value) || 0;
            const r = parseFloat(document.getElementById('i-rate').value) || 0;
            const t = parseFloat(document.getElementById('i-tax').value) || 0;
            const base = q * r;
            const taxAmt = base * (t / 100);
            const total = base + taxAmt;
            document.getElementById('i-amt').innerText = total.toFixed(2);
        },
        addItem: () => {
            const name = document.getElementById('i-name').value;
            const qty = parseFloat(document.getElementById('i-qty').value);
            const rate = parseFloat(document.getElementById('i-rate').value);
            const tax = parseFloat(document.getElementById('i-tax').value) || 0;
            
            if(!name || !qty) return false;
            
            const base = qty * rate;
            const taxAmt = base * (tax / 100);
            const total = base + taxAmt;

            App.state.cart.push({name, qty, rate, tax, base, taxAmt, total});
            
            document.getElementById('added-list').innerHTML = `<table><tbody>${App.state.cart.map(x => `<tr><td>${x.name} <span style="font-size:10px;color:grey">(${x.tax}%)</span></td><td class="text-right">${x.qty}</td><td class="text-right">${x.rate}</td><td class="text-right" style="color:#64748b">+${x.taxAmt.toFixed(2)}</td><td class="text-right">₹ ${x.total.toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
            
            const grandTotal = App.state.cart.reduce((a,b)=>a+b.total,0);
            document.getElementById('inv-total').innerText = grandTotal.toFixed(2);
            
            // Clear inputs for next item
            document.getElementById('i-name').value = ''; 
            document.getElementById('i-qty').value = ''; 
            document.getElementById('i-amt').innerText = '0.00'; 
            document.getElementById('i-name').focus();
            return true;
        },
        saveInvoice: async () => {
            const party = document.getElementById('inv-party').value; 
            
            // --- Auto Add Item if left in input box ---
            const currentItemName = document.getElementById('i-name').value;
            const currentItemQty = document.getElementById('i-qty').value;
            if(currentItemName && currentItemQty) { App.Logic.addItem(); }

            if(!party || App.state.cart.length === 0) return alert("Error: Items list is empty! Add items first.");
            
            const total = App.state.cart.reduce((a,b)=>a+b.total,0);
            
            await ArthDB.add('vouchers', {
                id:`v_${Date.now()}`, no:Date.now().toString().slice(-4), 
                date:new Date().toLocaleDateString('en-IN'), type:'Sales', 
                total:total, 
                rows:[{ledger:party, type:'Dr', amount:total}, {ledger:'Sales Account', type:'Cr', amount:total}], 
                inventory:App.state.cart
            });
            
            const items = await ArthDB.getAll('items');
            for(let l of App.state.cart) { 
                const i = items.find(x=>x.name===l.name); 
                if(i) { i.qty -= l.qty; await ArthDB.update('items', i); } 
            }
            alert("Bill Saved Successfully! ✅"); location.reload();
        },

        savePurchase: async () => {
            const party = document.getElementById('inv-party').value; 
            const supInv = document.getElementById('sup-inv-no').value;
        
            // अगर आइटम बॉक्स में कुछ लिखा है तो उसे भी लिस्ट में जोड़ लो
            const currentItemName = document.getElementById('i-name').value;
            const currentItemQty = document.getElementById('i-qty').value;
            if(currentItemName && currentItemQty) { App.Logic.addItem(); }
        
            if(!party) return alert("Error: Select a Supplier Party!");
            if(App.state.cart.length === 0) return alert("Error: No items to purchase!");
            
            const total = App.state.cart.reduce((a,b)=>a+b.total,0);
            
            await ArthDB.add('vouchers', {
                id:`vp_${Date.now()}`, 
                no: supInv || 'NA', // सप्लायर का बिल नंबर
                date:new Date().toLocaleDateString('en-IN'), 
                type:'Purchase', 
                total:total, 
                rows:[
                    {ledger:'Purchase Account', type:'Dr', amount:total}, // खर्चा (Debit)
                    {ledger:party, type:'Cr', amount:total}               // उधारी (Credit)
                ], 
                inventory:App.state.cart
            });
            
            // --- STOCK EFFECT (ADD) ---
            const items = await ArthDB.getAll('items');
            for(let l of App.state.cart) { 
                const i = items.find(x=>x.name===l.name); 
                if(i) { 
                    i.qty = (parseFloat(i.qty) || 0) + (parseFloat(l.qty) || 0); // ➤ यहाँ Stock + (Plus) हो रहा है
                    await ArthDB.update('items', i); 
                } 
            }
            alert("Purchase Saved! Stock Updated. ✅"); location.reload();
        },
        
        saveItemAux: async () => { 
            await ArthDB.add('items', {
                id:`i_${Date.now()}`, 
                name:document.getElementById('i-name').value, 
                unit:document.getElementById('i-unit').value, 
                qty:document.getElementById('i-qty').value, 
                rate:document.getElementById('i-rate').value,
                tax:document.getElementById('i-tax').value
            }); 
            alert("Item Created!"); location.reload(); 
        },
        saveLedgerAux: async () => { await ArthDB.add('ledgers', {id:`l_${Date.now()}`, name:document.getElementById('l-name').value, group:document.getElementById('l-group').value}); alert("Saved!"); location.reload(); },
        
        // --- BACKUP & RESTORE LOGIC ---
        backupData: async () => {
            const data = {
                ledgers: await ArthDB.getAll('ledgers'),
                items: await ArthDB.getAll('items'),
                vouchers: await ArthDB.getAll('vouchers')
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `ArthBook_Backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        },
        restoreData: async (input) => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if(confirm("Warning: This will replace/merge current data. Continue?")) {
                        for(let x of data.ledgers) await ArthDB.update('ledgers', x);
                        for(let x of data.items) await ArthDB.update('items', x);
                        for(let x of data.vouchers) await ArthDB.update('vouchers', x);
                        alert("Data Restored Successfully! ♻️");
                        location.reload();
                    }
                } catch(err) { alert("Invalid Backup File!"); }
            };
            reader.readAsText(file);
        },

        masterReset: async () => {
            // उस्ताद, पहले यूजर से पक्की पुष्टि (Confirmation) करेंगे
            const confirm1 = confirm("सावधान! क्या आप वाकई सारा डेटा डिलीट करना चाहते हैं?");
            if (confirm1) {
                const confirm2 = confirm("अंतिम चेतावनी: इसके बाद आपका सारा हिसाब-किताब, आइटम और लेजर हमेशा के लिए खत्म हो जाएंगे। क्या आप तैयार हैं?");
                if (confirm2) {
                    try {
                        // यह सीधे पूरे डेटाबेस को डिलीट कर देगा
                        const req = indexedDB.deleteDatabase('ArthBook_Ent_DB');
                        
                        req.onsuccess = () => {
                            alert("डेटा पूरी तरह साफ़ हो गया है। सॉफ्टवेयर अब रीस्टार्ट होगा। ✅");
                            location.reload(); // पेज रीलोड होते ही नया डेटाबेस बन जाएगा
                        };
                        
                        req.onerror = () => { alert("Error: डेटा साफ़ नहीं हो पाया।"); };
                        req.onblocked = () => { alert("Error: डेटाबेस ब्लॉक है। कृपया सारे टैब बंद करके दोबारा खोलें।"); };
                    } catch (e) {
                        console.error(e);
                        alert("रिसेट करने में कोई समस्या आई।");
                    }
                }
            }
        },

        printPreview: async (id) => {
            try {
                const vchs = await ArthDB.getAll('vouchers');
                const v = vchs.find(x => x.id === id);
                if(!v) { alert("Bill Not Found!"); return; }
                const partyName = v.rows && v.rows[0] ? v.rows[0].ledger : 'Cash';
                const totalAmt = parseFloat(v.total) || 0;

                let totalBase = 0, totalTax = 0;
                let rowsHTML = v.inventory.map(i => {
                    totalBase += (i.base || 0); totalTax += (i.taxAmt || 0);
                    return `<tr><td>${i.name}</td><td style="text-align:right">${i.qty}</td><td style="text-align:right">${i.rate}</td><td style="text-align:right">${i.tax}%</td><td style="text-align:right">${(i.base || 0).toFixed(2)}</td></tr>`;
                }).join('');

                const printHTML = `
                    <div id="print-area">
                        <div class="bill-box">
                            <div class="bill-header">
                                <div class="bill-org">ARTH BOOK ENTERPRISE</div>
                                <div style="font-size:12px; color:#555;">GSTIN: 08AAAAA0000A1Z5 | Jaipur, Rajasthan</div>
                                <div class="bill-title">TAX INVOICE</div>
                            </div>
                            <div class="bill-info">
                                <div><strong>Bill To:</strong><br>${partyName}</div>
                                <div style="text-align:right"><strong>Inv No:</strong> ${v.no}<br><strong>Date:</strong> ${v.date}</div>
                            </div>
                            <table class="bill-table">
                                <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">GST%</th><th style="text-align:right">Amount</th></tr></thead>
                                <tbody>${rowsHTML}</tbody>
                                <tfoot>
                                    <tr><td colspan="4" style="text-align:right">Sub Total:</td><td style="text-align:right">${totalBase.toFixed(2)}</td></tr>
                                    <tr><td colspan="4" style="text-align:right">Tax Amount:</td><td style="text-align:right">${totalTax.toFixed(2)}</td></tr>
                                    <tr class="bill-total-row"><td colspan="4" style="text-align:right">Grand Total:</td><td style="text-align:right">₹ ${totalAmt.toFixed(2)}</td></tr>
                                </tfoot>
                            </table>
                            <div class="bill-footer"><div class="sign-box">Authorized Signatory</div></div>
                            <div class="no-print" style="text-align:center; margin-top:30px;">
                                <button onclick="window.print()" style="padding:10px 20px; background:#1e293b; color:white; border:none; cursor:pointer;">PRINT</button>
                                <button onclick="location.reload()" style="padding:10px 20px; background:#64748b; color:white; border:none; cursor:pointer; margin-left:10px;">CLOSE</button>
                            </div>
                        </div>
                    </div>`;
                document.body.innerHTML = printHTML;
            } catch(err) { alert("Error: " + err.message); }
        }
    },

    Shortcuts: () => {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.preventDefault(); location.reload(); }
            if (e.ctrlKey && e.key === 'Enter') {
                if (App.state.currentScreen === 'sales') App.Logic.saveInvoice();
                if (App.state.currentScreen === 'purchase') App.Logic.savePurchase(); // Purchase Save Shortcut
                if (App.state.currentScreen === 'create') App.Logic.saveLedgerAux();
                if (App.state.currentScreen === 'create_item') App.Logic.saveItemAux();
            }
            if (e.key === 'Enter' && e.target.id === 'i-rate') App.Logic.addItem();
            const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT';
            if (App.state.currentScreen === 'gateway' && !isTyping) {
                const k = e.key.toLowerCase();
                if(e.key === 'F9') App.navigate('purchase'); // Purchase Screen
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