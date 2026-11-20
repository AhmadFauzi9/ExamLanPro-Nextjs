import fs from 'fs';
import path from 'path';

const filePath = path.resolve('src/components/admin/AdminModules.tsx');
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original AdminModules.tsx size:', content.length);
