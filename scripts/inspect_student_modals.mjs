import fs from 'fs';

const content = fs.readFileSync('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\data-siswa\\index.html', 'utf8');

function extractTag(tagId) {
  const start = content.indexOf(`id="${tagId}"`);
  if (start === -1) return null;
  const tagStart = content.lastIndexOf('<div', start);
  return content.slice(tagStart, tagStart + 2500);
}

console.log('--- modal-student-form ---');
console.log(extractTag('modal-student-form')?.slice(0, 1500));

console.log('--- modal-import-students ---');
console.log(extractTag('modal-import-students')?.slice(0, 1500));
