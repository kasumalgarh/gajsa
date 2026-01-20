/* FILENAME: tally_bridge.js
   PURPOSE: Export Arth Book Data to Tally Prime XML
   FEATURES: Ledger Mapping, Voucher Conversion, XML Generation
*/

class TallyBridge {
    constructor() {
        this.version = "1.0";
    }

    // --- 1. MAIN EXPORT FUNCTION ---
    // User clicks "Export to Tally" -> Downloads XML file
    async exportToTally(fromDate, toDate) {
        console.log(`🌉 TallyBridge: Exporting from ${fromDate} to ${toDate}...`);
        
        const tx = DB.db.transaction(['vouchers', 'ledgers', 'acct_entries', 'groups'], 'readonly');
        const [vouchers, ledgers, entries, groups] = await Promise.all([
            DB.getAll(tx.objectStore('vouchers')),
            DB.getAll(tx.objectStore('ledgers')),
            DB.getAll(tx.objectStore('acct_entries')),
            DB.getAll(tx.objectStore('groups'))
        ]);

        // Filter by Date
        const filteredVouchers = vouchers.filter(v => v.date >= fromDate && v.date <= toDate);
        
        if(filteredVouchers.length === 0) {
            alert("No entries found in this date range.");
            return;
        }

        // Generate XML Content
        let xmlBody = "";

        // A. Export Masters (Ledgers) involved in these vouchers
        // (Simplified: We export all used ledgers to be safe)
        const usedLedgerIds = new Set();
        entries.forEach(e => usedLedgerIds.add(e.ledger_id));
        
        usedLedgerIds.forEach(lid => {
            const l = ledgers.find(lg => lg.id === lid);
            if(l) xmlBody += this._generateLedgerXML(l, groups);
        });

        // B. Export Vouchers
        filteredVouchers.forEach(v => {
            // Find entries for this voucher
            const vEntries = entries.filter(e => e.voucher_id === v.id);
            xmlBody += this._generateVoucherXML(v, vEntries, ledgers);
        });

        const fullXML = this._wrapEnvelope(xmlBody);
        this._downloadFile(fullXML, `Tally_Export_${fromDate}_to_${toDate}.xml`);
    }

    // --- 2. XML GENERATORS ---

    _generateLedgerXML(ledger, groups) {
        const groupName = groups.find(g => g.id === ledger.group_id)?.name || "Sundry Debtors";
        // Tally XML for Ledger Creation
        return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
         <LEDGER NAME="${this._clean(ledger.name)}" ACTION="Create">
          <NAME.LIST>
           <NAME>${this._clean(ledger.name)}</NAME>
          </NAME.LIST>
          <PARENT>${this._clean(groupName)}</PARENT>
          <OPENINGBALANCE>${ledger.opening_balance || 0}</OPENINGBALANCE>
         </LEDGER>
        </TALLYMESSAGE>`;
    }

    _generateVoucherXML(voucher, entries, ledgers) {
        const tallyDate = voucher.date.replace(/-/g, ''); // 2026-01-20 -> 20260120
        const vType = this._mapVoucherType(voucher.type);
        
        let entryXML = "";
        entries.forEach(e => {
            const lName = ledgers.find(l => l.id === e.ledger_id)?.name || "Unknown";
            const amount = e.credit > 0 ? e.credit : -e.debit; // Negative for Debit in Tally XML logic often varies, but standard is absolute with IsDeemedPositive
            
            // Logic: Debit = Positive in code, Credit = Negative? 
            // Tally Logic: 
            // ISDEEMEDPOSITIVE = "Yes" (Debit) / "No" (Credit)
            const isDebit = e.debit > 0;
            
            entryXML += `
            <ALLLEDGERENTRIES.LIST>
             <LEDGERNAME>${this._clean(lName)}</LEDGERNAME>
             <ISDEEMEDPOSITIVE>${isDebit ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
             <AMOUNT>${isDebit ? -e.debit : e.credit}</AMOUNT> 
            </ALLLEDGERENTRIES.LIST>`;
        });

        return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
         <VOUCHER VCHTYPE="${vType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${tallyDate}</DATE>
          <VOUCHERTYPENAME>${vType}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${voucher.voucher_no}</VOUCHERNUMBER>
          <NARRATION>${this._clean(voucher.narration || "")}</NARRATION>
          ${entryXML}
         </VOUCHER>
        </TALLYMESSAGE>`;
    }

    // --- 3. UTILITIES ---

    _wrapEnvelope(body) {
        return `<ENVELOPE>
        <HEADER>
         <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
         <IMPORTDATA>
          <REQUESTDESC>
           <REPORTNAME>All Masters</REPORTNAME>
          </REQUESTDESC>
          <REQUESTDATA>
           ${body}
          </REQUESTDATA>
         </IMPORTDATA>
        </BODY>
       </ENVELOPE>`;
    }

    _mapVoucherType(type) {
        // Map Arth Book types to Tally types
        if(type === 'Sales') return 'Sales';
        if(type === 'Purchase') return 'Purchase';
        if(type === 'Payment') return 'Payment';
        if(type === 'Receipt') return 'Receipt';
        return 'Journal';
    }

    _clean(str) {
        // Escape special chars for XML
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _downloadFile(content, fileName) {
        const blob = new Blob([content], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Global Instance
const TallyExport = new TallyBridge();