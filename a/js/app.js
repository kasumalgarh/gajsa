// FILE: js/app.js (Unified Architecture - No more toys)
const App = {
    state: { 
        currentScreen: 'login', 
        cart: [], 
        tempVouchers: [],
        isLoggedIn: sessionStorage.getItem('arth_user_login') === 'true' 
    },

    init: async () => { 
        try {
            await ArthDB.init(); 
            App.Shortcuts(); 
            if(App.state.isLoggedIn) App.renderGateway(); 
            else App.renderLogin();
            console.log("Arth Book Enterprise Engine: ONLINE");
        } catch(e) { console.error(e); }
    },

    // --- RENDERERS ---
    renderLogin: () => {
        const html = `
            <div style="display:flex; justify-content:center; align-items:center; height:100%; width:100%;">
                <div class="panel" style="max-width:350px; border-top:4px solid #fbd34d;">
                    <div class="panel-head" style="justify-content:center; background:#1b3a57; color:white;">AUTH CHECK</div>
                    <div class="panel-body" style="padding:30px;">
                        <input type="password" id="login-pass" placeholder="Password" style="width:100%; padding:10px; border:1px solid #ccc; margin-bottom:15px;">
                        <button onclick="App.Logic.login()" class="action-btn" style="width:100%; background:#1b3a57; color:white;">LOGIN</button>
                        <div style="text-align:center; font-size:10px; margin-top:10px; color:grey;">Pass: admin</div>
                    </div>
                </div>
            </div>`;
        document.getElementById('main-workspace').innerHTML = html;
        setTimeout(()=>document.getElementById('login-pass').focus(), 100);
    },

    renderGateway: async () => {
        App.state.currentScreen = 'gateway';
        const vchs = await ArthDB.getAll('vouchers');
        const profile = JSON.parse(localStorage.getItem('company_profile')) || {name: 'My Business Enterprise'};

        // Stats Logic
        let cash=0, bank=0, sales=0;
        const today = new Date().toLocaleDateString('en-IN');
        vchs.forEach(v => {
            if((v.type==='SALES'||v.type==='CASH SALES') && v.date===today) sales += parseFloat(v.total);
            v.rows.forEach(r => {
                if(r.ledger==='Cash-in-hand') r.type==='Dr' ? cash+=r.amount : cash-=r.amount;
                if(r.ledger==='Bank Account') r.type==='Dr' ? bank+=r.amount : bank-=r.amount;
            });
        });
        const recent = vchs.slice(-8).reverse();

        // PROFESSIONAL DASHBOARD (No Redundant Menus)
        const html = `
            <div style="display:flex; flex-direction:column; height:100%; width:100%; gap:20px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #1b3a57; padding-bottom:10px;">
                    <div>
                        <h1 style="margin:0; color:#1b3a57; font-size:24px;">${profile.name}</h1>
                        <span style="color:#64748b; font-size:12px;">Financial Year: 2026-2027</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:20px; font-weight:bold; color:#059669;">₹ ${cash.toFixed(2)}</div>
                        <span style="font-size:11px; color:#64748b;">Current Cash Balance</span>
                    </div>
                </div>

                <div style="display:flex; gap:20px;">
                    <div class="panel" style="flex:1; border-left:4px solid #2563eb; padding:15px;">
                        <span style="font-size:11px; color:#64748b;">BANK ACCOUNTS</span>
                        <div style="font-size:18px; font-weight:bold; color:#2563eb;">₹ ${bank.toFixed(2)}</div>
                    </div>
                    <div class="panel" style="flex:1; border-left:4px solid #ea580c; padding:15px;">
                        <span style="font-size:11px; color:#64748b;">TODAY'S SALES</span>
                        <div style="font-size:18px; font-weight:bold; color:#ea580c;">₹ ${sales.toFixed(2)}</div>
                    </div>
                    <div class="panel" style="flex:1; border-left:4px solid #64748b; padding:15px;">
                        <span style="font-size:11px; color:#64748b;">TOTAL VOUCHERS</span>
                        <div style="font-size:18px; font-weight:bold; color:#334155;">${vchs.length}</div>
                    </div>
                </div>

                <div class="panel" style="flex:1; display:flex; flex-direction:column;">
                    <div class="panel-head">Recent Activities</div>
                    <div class="panel-body" style="overflow:auto;">
                        <table>
                            <thead><tr style="background:#f1f5f9; position:sticky; top:0;"><th>Date</th><th>Particulars</th><th>Type</th><th>No</th><th class="amt">Amount</th></tr></thead>
                            <tbody>
                                ${recent.length ? recent.map(v => `
                                    <tr onclick="App.Logic.printPreview('${v.id}')">
                                        <td>${v.date}</td>
                                        <td style="font-weight:600;">${v.rows[0].ledger}</td>
                                        <td><span style="background:#e2e8f0; padding:2px 5px; border-radius:3px; font-size:10px;">${v.type}</span></td>
                                        <td>${v.no}</td>
                                        <td class="amt">₹ ${parseFloat(v.total).toFixed(2)}</td>
                                    </tr>`).join('') : '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8">No Data Found</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        document.getElementById('main-workspace').innerHTML = html;
    },

    navigate: async (page) => {
        if(!App.state.isLoggedIn && page !== 'login') return App.renderLogin();
        App.state.currentScreen = page;
        const ws = document.getElementById('main-workspace');

        // Load Data
        const ledgers = await ArthDB.getAll('ledgers');
        const items = await ArthDB.getAll('items');

        // ROUTER
        if(['sales','purchase','payment','receipt','contra','journal','credit_note','debit_note'].includes(page)) {
            App.renderVoucher(page, ledgers, items);
        } else if (page === 'daybook') App.renderDayBook();
        else if (page === 'report_ledger') App.renderLedgerReport(ledgers);
        else if (page === 'stock') App.renderStock(items);
        else if (page === 'report_pnl') App.renderPnL();
        else if (page === 'report_gst') App.renderGST();
        else if (page === 'create') App.renderForm('Create Ledger', [{lbl:'Name',id:'l-name'},{lbl:'Group',id:'l-group',tag:'select',opts:['Sundry Debtors','Sundry Creditors','Sales Accounts','Purchase Accounts','Cash-in-hand','Bank Accounts','Indirect Expenses']},{lbl:'GSTIN',id:'l-gst'},{lbl:'State',id:'l-state'},{lbl:'Op Bal',id:'l-open'}], 'App.Logic.saveLedger()');
        else if (page === 'create_item') App.renderForm('Create Item', [{lbl:'Name',id:'i-name'},{lbl:'Unit',id:'i-unit'},{lbl:'Rate',id:'i-rate'},{lbl:'GST %',id:'i-tax',tag:'select',opts:['0','5','12','18','28']},{lbl:'Op Qty',id:'i-qty'}], 'App.Logic.saveItem()');
        else if (page === 'settings') App.renderSettings();
        else App.renderGateway();
    },

    // --- VOUCHER ENGINE (Universal) ---
    renderVoucher: async (type, ledgers, items) => {
        App.state.cart = [];
        const vchs = await ArthDB.getAll('vouchers');
        const nextNo = vchs.filter(v => v.type === type.replace('_',' ').toUpperCase()).length + 1;
        
        const config = {
            'sales': {t:'Sales Voucher', c:'#1e293b', inv:true},
            'purchase': {t:'Purchase Voucher', c:'#9a3412', inv:true},
            'receipt': {t:'Receipt (In)', c:'#166534', inv:false},
            'payment': {t:'Payment (Out)', c:'#9f1239', inv:false},
            'contra': {t:'Contra (Bank)', c:'#1e40af', inv:false},
            'journal': {t:'Journal', c:'#475569', inv:false},
            'credit_note': {t:'Credit Note', c:'#065f46', inv:true},
            'debit_note': {t:'Debit Note', c:'#9f1239', inv:true}
        }[type];

        let content = '';
        if(config.inv) {
            content = `
                <div style="display:flex; gap:10px; margin-bottom:10px;">
                    <div style="flex:1"><label>Party A/c Name</label><input list="l-list" id="v-party" class="inp" placeholder="Select Party"></div>
                </div>
                <table style="border:1px solid #ccc; width:100%;">
                    <thead style="background:#eee;"><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Tax%</th><th class="text-right">Amount</th></tr></thead>
                    <tbody id="inv-rows">
                        <tr>
                            <td><input list="i-list" id="i-name" class="inp-clean" onchange="App.Logic.itemSel(this.value)"></td>
                            <td><input id="i-qty" class="inp-clean text-right" onkeyup="App.Logic.calc()"></td>
                            <td><input id="i-rate" class="inp-clean text-right" onkeyup="App.Logic.calc()"></td>
                            <td><input id="i-tax" class="inp-clean text-right" readonly></td>
                            <td class="text-right" id="i-amt" style="padding:5px; font-weight:bold;">0.00</td>
                        </tr>
                    </tbody>
                </table>
                <div id="cart-list" style="height:150px; overflow:auto; border:1px solid #ccc; border-top:none;"></div>
                <div style="text-align:right; font-size:18px; margin-top:10px;">Total: <b>₹ <span id="v-total">0.00</span></b></div>
                <datalist id="i-list">${items.map(i=>`<option value="${i.name}">`).join('')}</datalist>
            `;
        } else {
            content = `
                <div style="border:1px solid #ccc; padding:15px; background:white;">
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <div style="width:50px;"><b>${type==='receipt'?'Cr':'Dr'}</b></div>
                        <div style="flex:1;"><input list="l-list" id="ac-1" class="inp" placeholder="Select Account"></div>
                        <div style="width:120px;"><input id="amt-1" class="inp text-right" placeholder="0.00" onkeyup="document.getElementById('amt-2').value=this.value"></div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div style="width:50px;"><b>${type==='receipt'?'Dr':'Cr'}</b></div>
                        <div style="flex:1;"><input list="l-list" id="ac-2" class="inp" placeholder="Select Account"></div>
                        <div style="width:120px;"><input id="amt-2" class="inp text-right" readonly></div>
                    </div>
                </div>
            `;
        }

        document.getElementById('main-workspace').innerHTML = `
            <div class="panel">
                <div class="panel-head" style="background:${config.c}; color:white;">
                    <span>${config.t}</span> <span>No: ${nextNo}</span>
                </div>
                <div class="panel-body" style="padding:20px; background:#f8fafc;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                        <div>Date: <b>${new Date().toLocaleDateString('en-IN')}</b></div>
                        ${type==='purchase'?'<input id="ref-no" placeholder="Supplier Inv No" style="border:1px solid #ccc; padding:2px;">':''}
                    </div>
                    ${content}
                    <div style="margin-top:15px;"><input id="nar" class="inp" placeholder="Narration"></div>
                    <div style="margin-top:15px; text-align:right;">
                        <button onclick="App.Logic.save('${type}', ${nextNo})" class="action-btn" style="background:${config.c}; color:white; width:150px;">SAVE</button>
                    </div>
                </div>
                <datalist id="l-list">${ledgers.map(l=>`<option value="${l.name}">`).join('')}</datalist>
            </div>`;
    },

    // --- GENERIC FORM RENDERER ---
    renderForm: (title, fields, saveFn) => {
        const html = fields.map(f => `
            <div style="margin-bottom:10px;">
                <label style="font-weight:600; font-size:12px;">${f.lbl}</label>
                ${f.tag==='select' ? `<select id="${f.id}" class="inp">${f.opts.map(o=>`<option>${o}</option>`).join('')}</select>` : `<input id="${f.id}" class="inp">`}
            </div>`).join('');
        document.getElementById('main-workspace').innerHTML = `
            <div class="panel" style="max-width:500px; margin:auto;">
                <div class="panel-head">${title}</div>
                <div class="panel-body" style="padding:20px;">${html}<button onclick="${saveFn}" class="action-btn" style="width:100%; margin-top:10px; background:#1e293b; color:white;">SAVE</button></div>
            </div>`;
    },

    // --- BUSINESS LOGIC ---
    Logic: {
        login: () => {
            if(document.getElementById('login-pass').value === 'admin') {
                sessionStorage.setItem('arth_user_login', 'true');
                App.state.isLoggedIn = true;
                App.renderGateway();
            } else alert('Wrong Password');
        },
        logout: () => {
            if(confirm('Logout?')){ sessionStorage.clear(); location.reload(); }
        },
        
        // Item Logic
        itemSel: async (n) => {
            const i = (await ArthDB.getAll('items')).find(x=>x.name===n);
            if(i) { document.getElementById('i-rate').value=i.rate; document.getElementById('i-tax').value=i.tax||0; document.getElementById('i-qty').focus(); }
        },
        calc: () => {
            const q=parseFloat(document.getElementById('i-qty').value)||0, r=parseFloat(document.getElementById('i-rate').value)||0, t=parseFloat(document.getElementById('i-tax').value)||0;
            const amt = q*r; const tot = amt + (amt*(t/100));
            document.getElementById('i-amt').innerText = tot.toFixed(2);
            if(window.event.key === 'Enter') App.Logic.addCart(n,q,r,t,amt,tot); // Simplified trigger
            // Note: For full robustness, addCart needs DOM read
            if(window.event.key === 'Enter') {
                const n=document.getElementById('i-name').value;
                if(n && q) {
                    App.state.cart.push({name:n, qty:q, rate:r, tax:t, total:tot});
                    App.Logic.refreshCart();
                    document.getElementById('i-name').value=''; document.getElementById('i-qty').value=''; 
                    document.getElementById('i-name').focus();
                }
            }
        },
        refreshCart: () => {
             const h = App.state.cart.map(c=>`<div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee;"><span>${c.name}</span><span>${c.qty} x ${c.rate}</span><span style="font-weight:bold;">${c.total.toFixed(2)}</span></div>`).join('');
             document.getElementById('cart-list').innerHTML = h;
             document.getElementById('v-total').innerText = App.state.cart.reduce((a,b)=>a+b.total,0).toFixed(2);
        },

        save: async (type, no) => {
            let total = 0, rows = [];
            const isInv = ['sales','purchase','credit_note','debit_note'].includes(type);
            
            if(isInv) {
                const p = document.getElementById('v-party').value;
                if(!p || !App.state.cart.length) return alert('Data Missing');
                total = App.state.cart.reduce((a,b)=>a+b.total,0);
                // Ledger Logic
                if(type==='sales') rows=[{ledger:p,type:'Dr',amount:total},{ledger:'Sales Account',type:'Cr',amount:total}];
                if(type==='purchase') rows=[{ledger:'Purchase Account',type:'Dr',amount:total},{ledger:p,type:'Cr',amount:total}];
                // Stock Logic
                const items = await ArthDB.getAll('items');
                for(let c of App.state.cart) {
                    const i = items.find(x=>x.name===c.name);
                    if(i) {
                        if(type==='sales') i.qty -= c.qty; else i.qty += c.qty;
                        await ArthDB.update('items', i);
                    }
                }
            } else {
                const a1=document.getElementById('ac-1').value, a2=document.getElementById('ac-2').value, amt=parseFloat(document.getElementById('amt-1').value);
                if(!a1||!a2||!amt) return alert('Data Missing');
                total = amt;
                rows = [{ledger:a1, type:'Dr', amount:amt}, {ledger:a2, type:'Cr', amount:amt}]; // Simplified Dr/Cr for demo
            }

            await ArthDB.add('vouchers', {
                id: 'v_'+Date.now(), no: no, date: new Date().toLocaleDateString('en-IN'),
                type: type.replace('_',' ').toUpperCase(), total: total, rows: rows, 
                inventory: isInv ? App.state.cart : null,
                narration: document.getElementById('nar').value
            });
            alert('Saved'); App.renderGateway();
        },

        // --- MASTERS ---
        saveLedger: async () => {
            await ArthDB.add('ledgers', {
                id: 'l_'+Date.now(), name: document.getElementById('l-name').value, group: document.getElementById('l-group').value,
                gst: document.getElementById('l-gst').value, state: document.getElementById('l-state').value, openingBalance: document.getElementById('l-open').value
            }); alert('Saved'); App.renderGateway();
        },
        saveItem: async () => {
             await ArthDB.add('items', {
                id: 'i_'+Date.now(), name: document.getElementById('i-name').value, unit: document.getElementById('i-unit').value,
                rate: document.getElementById('i-rate').value, tax: document.getElementById('i-tax').value, qty: document.getElementById('i-qty').value
            }); alert('Saved'); App.renderGateway();
        },
        
        // --- UTILS ---
        printPreview: async (id) => {
            const v = (await ArthDB.getAll('vouchers')).find(x=>x.id===id);
            const p = JSON.parse(localStorage.getItem('company_profile')) || {name:'Company'};
            let body = v.inventory ? `<table class="bill-table"><thead><tr><th>Item</th><th class="text-right">Total</th></tr></thead><tbody>${v.inventory.map(i=>`<tr><td>${i.name} (${i.qty} x ${i.rate})</td><td class="text-right">${i.total}</td></tr>`).join('')}</tbody></table>` : `<div style="padding:20px; text-align:center; font-size:18px;">Amount: ₹ ${v.total}</div>`;
            
            document.body.innerHTML = `
                <div id="print-area" style="padding:30px; font-family:sans-serif;">
                    <div style="text-align:center; border-bottom:1px solid #000; padding-bottom:10px;">
                        <h2>${p.name}</h2><p>INVOICE: ${v.type}</p>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin:20px 0;">
                        <div><b>Party:</b> ${v.rows[0].ledger}</div>
                        <div><b>No:</b> ${v.no} <br> <b>Date:</b> ${v.date}</div>
                    </div>
                    ${body}
                    <div style="margin-top:20px; text-align:right;"><b>Total: ₹ ${v.total}</b></div>
                    <div style="text-align:center; margin-top:40px;"><button onclick="location.reload()">Close</button> <button onclick="window.print()">Print</button></div>
                </div>`;
        },
        backupData: async () => {
             const d = { l: await ArthDB.getAll('ledgers'), v: await ArthDB.getAll('vouchers'), i: await ArthDB.getAll('items') };
             const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d)],{type:'json'}));
             a.download = 'backup.json'; a.click();
        }
    },

    Shortcuts: () => {
        document.addEventListener('keydown', (e) => {
            if(e.key==='Escape') App.renderGateway();
            if(!App.state.isLoggedIn && e.key==='Enter') App.Logic.login();
            
            if(App.state.isLoggedIn && App.state.currentScreen==='gateway') {
                const k = e.key.toLowerCase();
                if(k==='v') App.navigate('sales'); if(k==='d') App.navigate('daybook'); if(k==='c') App.navigate('create');
                if(e.key==='F4') App.navigate('contra'); if(e.key==='F5') App.navigate('payment'); if(e.key==='F6') App.navigate('receipt');
                if(e.key==='F7') App.navigate('journal'); if(e.key==='F8') App.navigate('sales'); if(e.key==='F9') App.navigate('purchase');
            }
        });
    }
};
window.onload = App.init;