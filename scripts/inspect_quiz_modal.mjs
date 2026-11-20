import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scripts/extracted_modals.json', 'utf8'));

console.log('=== QUIZ MODAL INPUTS & FEATURES ===');
const qInputs = data.quizModal.match(/<(input|select|textarea)[^>]+>/g) || [];
qInputs.forEach(inp => console.log('  ', inp.replace(/\s+/g, ' ')));

console.log('\n=== QUESTION MODAL INPUTS & FEATURES ===');
const qmInputs = data.questionModal.match(/<(input|select|textarea)[^>]+>/g) || [];
qmInputs.forEach(inp => console.log('  ', inp.replace(/\s+/g, ' ')));
