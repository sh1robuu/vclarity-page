import { cpSync, mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('dist', { recursive:true });
for (const file of ['index.html','styles.css','app.js']) copyFileSync(file, `dist/${file}`);
cpSync('assets','dist/assets',{recursive:true});
mkdirSync('dist/docs', {recursive:true});
copyFileSync('docs/preview-guide.html','dist/docs/preview-guide.html');
console.log('Built static landing page in dist/');
