import fs from 'fs';

const content = fs.readFileSync('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\bank-soal\\index.html', 'utf8');
const start = content.indexOf('id="modal-mass-import"');
console.log(content.slice(start, start + 3500));
