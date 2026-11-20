import fs from 'fs';

const content = fs.readFileSync('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\hasil-ujian\\index.html', 'utf8');

function extractTag(tagId) {
  const start = content.indexOf(`id="${tagId}"`);
  if (start === -1) return null;
  const tagStart = content.lastIndexOf('<div', start);
  return content.slice(tagStart, tagStart + 2500);
}

console.log('--- retake-modal ---');
console.log(extractTag('retake-modal')?.slice(0, 1500));

console.log('--- modal-student-detail ---');
console.log(extractTag('modal-student-detail')?.slice(0, 1500));
