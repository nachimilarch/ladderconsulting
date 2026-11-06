// Turns pasted lines (straight from Excel/Sheets: tab separated, or comma separated) into contact objects.
const COLS = ['full_name', 'email', 'phone', 'company_name', 'designation', 'city'];
export function parsePasted(text) {
    return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
        const parts = (line.includes('\t') ? line.split('\t') : line.split(',')).map((p) => p.trim());
        return Object.fromEntries(COLS.map((c, i) => [c, parts[i] || '']));
    });
}

