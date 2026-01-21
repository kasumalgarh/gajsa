/* FILENAME: tally_bridge.js
   PURPOSE: Convert Arth Book Data to Tally Prime XML Format
*/

const TallyExport = {
    
    // Main Entry Point
    exportToTally: async function(fromDate, toDate) {
        try {
            const vouchers = await DB.getAll('vouchers');
            const ledgers = await DB.getAll('ledgers');
            const entries = await DB.getAll('acct_entries');

            // Filter by date
            const filtered = vouchers.filter(v => v.date >= fromDate && v.date <= toDate);
            
            if(filtered.length === 0) return alert("No vouchers found in date range!");

            let xml = `<ENVELOPE>\n<HEADER>\n<TALLYREQUEST>Import Data</TALLYREQUEST>\n</HEADER>\n<BODY>\n<IMPORTDATA>\n<REQUESTDESC>\n<REPORTNAME>Vouchers</REPORTNAME>\n</REQUESTDESC>\n<REQUESTDATA>\n`;

            filtered.forEach(v => {
                xml += this.generateVoucherXML(v, entries, ledgers);
            });

            xml += `</REQUESTDATA>\n</IMPORTDATA>\n</BODY>\n</ENVELOPE>`;

            this.downloadFile(xml, `Tally_Export_${fromDate}_to_${toDate}.xml`);
            
        } catch(e) {
            console.error(e);
            alert("Export Failed: " + e.message);
        }
    },

    generateVoucherXML: function(v, allEntries, allLedgers) {
        const typeMap = {
            'Sales': 'Sales',
            'Purchase': 'Purchase',
            'Receipt': 'Receipt',
            'Payment': 'Payment',
            'Contra': 'Contra',
            'Journal': 'Journal'
        };

        const vType = typeMap[v.type] || 'Journal';
        const vDate = v.date.replace(/-/g, ''); // YYYYMMDD

        let xml = `<TALLYMESSAGE xmlns:UDF="TallyUDF">\n<VOUCHER VCHTYPE="${vType}" ACTION="Create" OBJVIEW="Accounting Voucher View">\n`;
        xml += `<DATE>${vDate}</DATE>\n`;
        xml += `<VOUCHERTYPENAME>${vType}</VOUCHERTYPENAME>\n`;
        xml += `<VOUCHERNUMBER>${v.voucher_no}</VOUCHERNUMBER>\n`;
        xml += `<NARRATION>${v.narration || ''}</NARRATION>\n`;

        // Get Ledger Entries for this voucher
        const vEntries = allEntries.filter(e => e.voucher_id === v.id);

        vEntries.forEach(e => {
            const ledger = allLedgers.find(l => l.id === e.ledger_id);
            if(!ledger) return;

            const amount = (e.credit > 0) ? e.credit : -e.debit; // Tally logic: Credit (+), Debit (-)

            xml += `<ALLLEDGERENTRIES.LIST>\n`;
            xml += `<LEDGERNAME>${this.escapeXml(ledger.name)}</LEDGERNAME>\n`;
            xml += `<ISDEEMEDPOSITIVE>${e.debit > 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>\n`;
            xml += `<AMOUNT>${amount}</AMOUNT>\n`;
            xml += `</ALLLEDGERENTRIES.LIST>\n`;
        });

        xml += `</VOUCHER>\n</TALLYMESSAGE>\n`;
        return xml;
    },

    escapeXml: function(unsafe) {
        return unsafe.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    },

    downloadFile: function(content, filename) {
        const blob = new Blob([content], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
};