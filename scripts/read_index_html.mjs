import fs from 'fs';

const content = fs.readFileSync('C:\\xampp\\htdocs\\ExamLANPro\\index.html', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(150, 260).join('\n'));
