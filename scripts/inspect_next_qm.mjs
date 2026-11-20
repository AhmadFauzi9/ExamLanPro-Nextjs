import fs from 'fs';

const content = fs.readFileSync('src/components/admin/AdminModules.tsx', 'utf8');
const start = content.indexOf('questionModalOpen');
console.log(content.slice(start, start + 3000));
