import fs from 'fs';

const content = fs.readFileSync('C:\\xampp\\htdocs\\ExamLANPro\\index.html', 'utf8');

const start = content.indexOf('<!-- Active Exam Screen');
if (start !== -1) {
  console.log(content.slice(start, start + 3500));
} else {
  const start2 = content.indexOf('student-exam-screen');
  console.log(content.slice(start2 - 100, start2 + 3500));
}
