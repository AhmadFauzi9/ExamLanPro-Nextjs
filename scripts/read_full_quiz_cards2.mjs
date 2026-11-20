import fs from 'fs';

const html = fs.readFileSync('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\bank-soal\\index.html', 'utf8');
const fnIdx = html.indexOf('function renderQuizCards');
console.log(html.substring(fnIdx + 2500, fnIdx + 5500));
