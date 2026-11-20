import fs from 'fs';

function extractModal(filePath, modalId) {
  const content = fs.readFileSync(filePath, 'utf8');
  const start = content.indexOf(`id="${modalId}"`);
  if (start === -1) return null;
  // find start of tag
  const tagStart = content.lastIndexOf('<div', start);
  // find closing div matching nesting
  let depth = 0;
  let pos = tagStart;
  while (pos < content.length) {
    if (content.substr(pos, 4) === '<div') {
      depth++;
      pos += 4;
    } else if (content.substr(pos, 6) === '</div>') {
      depth--;
      pos += 6;
      if (depth === 0) {
        return content.substring(tagStart, pos);
      }
    } else {
      pos++;
    }
  }
  return content.substring(tagStart, tagStart + 2000);
}

const qModal = extractModal('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\bank-soal\\index.html', 'quiz-modal');
console.log('--- quiz-modal length:', qModal?.length);

const qmDialog = extractModal('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\bank-soal\\index.html', 'qm-dialog');
console.log('--- qm-dialog length:', qmDialog?.length);

const questionModal = extractModal('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\bank-soal\\index.html', 'question-modal');
console.log('--- question-modal length:', questionModal?.length);

const massImport = extractModal('C:\\xampp\\htdocs\\ExamLANPro\\frontend\\admin\\bank-soal\\index.html', 'modal-mass-import');
console.log('--- modal-mass-import length:', massImport?.length);

fs.writeFileSync('scripts/extracted_modals.json', JSON.stringify({
  quizModal: qModal,
  qmDialog: qmDialog,
  questionModal: questionModal,
  massImport: massImport
}, null, 2));

console.log('Saved extracted modals to scripts/extracted_modals.json');
