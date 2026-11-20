import fs from 'fs';

const js = fs.readFileSync('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\assets\\js\\modular-nav.js', 'utf8');
console.log(js.substring(7500, 10500));
