import fs from 'fs';

const content = fs.readFileSync('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\bank-soal\\index.html', 'utf8');
const start = content.indexOf('function renderQuestionEditorFields');
console.log(content.slice(start, start + 4000));
