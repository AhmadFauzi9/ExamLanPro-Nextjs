import fs from 'fs';
import path from 'path';

function findModalsAndForms(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const ids = [];
  const regex = /id=["']([^"']+)["']/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    if (m[1].includes('modal') || m[1].includes('dialog') || m[1].includes('form') || m[1].includes('btn') || m[1].includes('tab')) {
      ids.push(m[1]);
    }
  }
  return ids;
}

const pages = [
  'bank-soal',
  'data-siswa',
  'hasil-ujian',
  'monitoring',
  'notifikasi',
  'audit-log',
  'pengaturan'
];

console.log('=== ADMIN PAGES AUDIT ===');
for (const p of pages) {
  const file = `C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\${p}\\index.html`;
  if (fs.existsSync(file)) {
    const ids = findModalsAndForms(file);
    console.log(`Page: ${p} (${ids.length} key element IDs found)`);
    const modals = ids.filter(id => id.includes('modal') || id.includes('dialog'));
    console.log(`  Modals:`, modals);
  }
}
