import fs from 'fs';
import path from 'path';

function parseCSV(filePath: string): any[] {
    const content = fs.readFileSync(filePath, 'latin1');
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];

    function parseLine(line: string): string[] {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { values.push(current); current = ''; }
            else current += char;
        }
        values.push(current);
        return values;
    }

    const header = parseLine(lines[0]).map(h => h.replace(/^\uFEFF/, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const row: any = {};
        header.forEach((key, index) => {
            row[key] = values[index] || '';
        });
        rows.push(row);
    }
    return rows;
}

function debug() {
    const registerPath = path.join(process.cwd(), '..', 'YNAB Export - Compartido COP as of 2026-02-07 06-12', 'Compartido COP as of 2026-02-07 06-12 - Register.csv');
    if (!fs.existsSync(registerPath)) { console.error('File not found'); return; }

    const data = parseCSV(registerPath);
    console.log(`Loaded ${data.length} rows.`);

    // Search for amount 60611
    console.log('\n--- Searching for Amount 60.611 ---');
    // Amount formatting in CSV might be "60,611.00" or "60.611,00" etc.
    // Try to clean and match.
    const matches = data.filter(r => {
        const outflow = r.Outflow.replace(/[^\d]/g, '');
        const inflow = r.Inflow.replace(/[^\d]/g, '');
        return outflow.includes('60611') || inflow.includes('60611');
    });

    matches.forEach(row => {
        console.log(`Date: ${row.Date}`);
        console.log(`Payee: ${row.Payee}`);
        console.log(`Memo: ${row.Memo}`);
        console.log(`Outflow: ${row.Outflow}`);
        console.log(`Category Group: '${row['Category Group']}'`);
        console.log(`Category: '${row.Category}'`);
        console.log('---');
    });
}

debug();
