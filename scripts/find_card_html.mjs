import fs from 'fs';

const html = fs.readFileSync('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\bank-soal\\index.html', 'utf8');

// Find where quiz cards are created
const matches = [...html.matchAll(/function\s+([a-zA-Z0-9_]+)\s*\(/g)].map(m => m[1]);
console.log('Functions in bank-soal:', matches);

const idx = html.indexOf('quiz-cards-container');
console.log('Index of quiz-cards-container:', idx);

const search = 'renderQuizCards';
const idx2 = html.indexOf(search);
console.log('Index of renderQuizCards:', idx2);

if (idx2 !== -1) {
  console.log(html.substring(idx2, idx2 + 4000));
} else {
  // Let's search for "Kelola Soal"
  const idx3 = html.indexOf('Kelola Soal');
  console.log('Index of Kelola Soal:', idx3);
  if (idx3 !== -1) {
    console.log(html.substring(idx3 - 1000, idx3 + 2000));
  }
}
