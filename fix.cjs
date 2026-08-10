const fs = require('fs');
const content = fs.readFileSync('src/components/SalesReportDashboard.tsx', 'utf8');
const lines = content.split('\n');
const fixed = lines.slice(0, 468).concat(lines.slice(489)).join('\n');
fs.writeFileSync('src/components/SalesReportDashboard.tsx', fixed);
