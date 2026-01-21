/* FILENAME: tally_bridge.js
   PURPOSE: Export Arth Book Data to Tally Prime XML
   FEATURES: Ledger Mapping, Voucher Conversion, Proper XML Structure
   VERSION: 1.1 (Fixed: Amount signs, ISDEEMEDPOSITIVE, Party Ledger, Separate Masters/Vouchers, Accurate Mapping)
*/

class TallyBridge {
    constructor() {
        this.version = "1.1";
    }

    // --- 1. MAIN EXPORT FUNCTION ---
    async exportToTally(fromDate, toDate) {
        console.log(`🌉 TallyBridge v${this.version}: Exporting from ${fromDate} to ${toDate}...`);
        
        await DB.init();
        const tx = DB.db.transaction(['vouchers', 'ledgers', 'acct_entries', 'groups', 'voucher_items'], 'readonly');
        const [vouchers, ledgers, entries, groups, voucherItems] = await Promise.all([
            DB.getAll(tx.objectStore('vouchers')),
            DB.getAll(tx.objectStore('ledgers')),
            DB.getAll(tx.objectStore('acct_entries')),
            DB.getAll(tx.objectStore('groups')),
            tx.objectStore('voucher_items') ? DB.getAll(tx.objectStore('voucher_items')) : []
        ]);

        // Filter vouchers by date
        const filteredVouchers = vouchers.filter(v => v.date >= fromDate && v.date <= toDate);
        
        if(filteredVouchers.length === 0) {
            alert("No entries found in selected date range.");
            return;
        }

        // Collect unique ledger IDs used in filtered period
        const usedLedgerIds = new Set();
        const voucherIds = new Set(filteredVouchers.map(v => v.id));
        entries.forEach(e => {
            if(voucherIds.has(e.voucher_id)) usedLedgerIds.add(e.ledger_id);
        });

        // Generate separate XML for Masters (Ledgers) and Vouchers
        let ledgerXML = "";
        usedLedgerIds.forEach(lid => {
            const ledger = ledgers.find(l => l.id === lid);
            if(ledger) ledgerXML += this._generateLedgerXML(ledger, groups);
        });

        let voucherXML = "";
        for(const voucher of filteredVouchers) {
            const vEntries = entries.filter(e => e.voucher_id === voucher.id);
            const vItems = voucherItems.filter(i => i.voucher_id === voucher.id);
            voucherXML += this._generateVoucherXML(voucher, vEntries, vItems, ledgers);
        }

        // Combine with separate envelopes: Masters first, then Vouchers
        let fullXML = "";
        if(ledgerXML) fullXML += this._wrapEnvelope(ledgerXML, "Ledgers");
        if(voucherXML) fullXML += this._wrapEnvelope(voucherXML, "Vouchers");

        this._downloadFile(fullXML, `ArthBook_to_Tally_${fromDate}_to_${toDate}.xml`);
        alert("Tally XML generated & downloaded successfully!\nImport in Tally → Gateway of Tally → Import Data → Vouchers/Masters");
    }

    // --- 2. XML GENERATORS ---

    _generateLedgerXML(ledger, groups) {
        const group = groups.find(g => g.id === ledger.group_id);
        const parent = group ? group.name : "Sundry Debtors";

        return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
         <LEDGER NAME="${this._clean(ledger.name)}" RESERVEDNAME="" ACTION="Create">
          <LANGUAGENAME.LIST>
           <NAME.LIST>
            <NAME>${this._clean(ledger.name)}</NAME>
           </NAME.LIST>
          </LANGUAGENAME.LIST>
          <PARENT>${this._clean(parent)}</PARENT>
          <OPENINGBALANCE>${(ledger.opening_balance || 0).toFixed(2)}</OPENINGBALANCE>
          <ISBILLWISEON>${parent.includes('Debtors') || parent.includes('Creditors') ? 'Yes' : 'No'}</ISBILLWISEON>
         </LEDGER>
        </TALLYMESSAGE>`;
    }

    _generateVoucherXML(voucher, acctEntries, itemEntries, ledgers) {
        const tallyDate = voucher.date.replace(/-/g, ''); // YYYYMMDD
        const vType = this._mapVoucherType(voucher.type);

        let partyLedgerName = "";
        if(voucher.party_id) {
            const party = ledgers.find(l => l.id === voucher.party_id);
            if(party) partyLedgerName = this._clean(party.name);
        }

        // Accounting Entries (ALLLEDGERENTRIES.LIST)
        let ledgerEntriesXML = "";
        acctEntries.forEach(e => {
            const ledger = ledgers.find(l => l.id === e.ledger_id);
            if(!ledger) return;
            const amount = Math.abs(e.debit || e.credit || 0).toFixed(2);
            const isDebit = (e.debit || 0) > 0;

            ledgerEntriesXML += `
            <ALLLEDGERENTRIES.LIST>
             <LEDGERNAME>${this._clean(ledger.name)}</LEDGERNAME>
             <ISDEEMEDPOSITIVE>${isDebit ? "No" : "Yes"}</ISDEEMEDPOSITIVE>
             <AMOUNT>${amount}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
        });

        // Inventory Entries (for Sales/Purchase - optional but recommended)
        let inventoryXML = "";
        if((voucher.type === 'Sales' || voucher.type === 'Purchase') && itemEntries.length > 0) {
            itemEntries.forEach(item => {
                const sign = voucher.type === 'Sales' ? -1 : 1; // Sales out, Purchase in
                inventoryXML += `
                <INVENTORYENTRIES.LIST>
                 <STOCKITEMNAME>${this._clean(item.item_name || 'Unknown Item')}</STOCKITEMNAME>
                 <ISDEEMEDPOSITIVE>${sign > 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
                 <RATE>${(item.rate || 0).toFixed(2)}/Unit</RATE>
                 <AMOUNT>${(item.amount || 0).toFixed(2)}</AMOUNT>
                 <ACTUALQTY>${sign * (item.qty || 0)} Unit</ACTUALQTY>
                 <BILLEDQTY>${sign * (item.qty || 0)} Unit</BILLEDQTY>
                </INVENTORYENTRIES.LIST>`;
            });
        }

        return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
         <VOUCHER VCHTYPE="${vType}" ACTION="Create">
          <DATE>${tallyDate}</DATE>
          <VOUCHERTYPENAME>${vType}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${this._clean(voucher.voucher_no || 'AUTO')}</VOUCHERNUMBER>
          ${partyLedgerName ? `<PARTYLEDGERNAME>${partyLedgerName}</PARTYLEDGERNAME>` : ''}
          <NARRATION>${this._clean(voucher.narration || '')}</NARRATION>
          ${ledgerEntriesXML}
          ${inventoryXML}
         </VOUCHER>
        </TALLYMESSAGE>`;
    }

    // --- 3. UTILITIES ---

    _wrapEnvelope(body, reportName = "Vouchers") {
        return `<ENVELOPE>
         <HEADER>
          <TALLYREQUEST>Import Data</TALLYREQUEST>
         </HEADER>
         <BODY>
          <IMPORTDATA>
           <REQUESTDESC>
            <REPORTNAME>${reportName}</REPORTNAME>
            <STATICVARIABLES>
             <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
           </REQUESTDESC>
           <REQUESTDATA>
            ${body}
           </REQUESTDATA>
          </IMPORTDATA>
         </BODY>
        </ENVELOPE>`;
    }

    _mapVoucherType(type) {
        const map = {
            'Sales': 'Sales',
            'Purchase': 'Purchase',
            'Payment': 'Payment',
            'Receipt': 'Receipt',
            'Contra': 'Contra',
            'Journal': 'Journal',
            'GRN': 'Receipt', // GRN as material receipt
            'Return': 'Debit Note'
        };
        return map[type] || 'Journal';
    }

    _clean(str = "") {
        if(typeof str !== 'string') str = String(str);
        return str.replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&apos;');
    }

    _downloadFile(content, fileName) {
        const blob = new Blob([content], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Global Instance
const TallyExport = new TallyBridge();