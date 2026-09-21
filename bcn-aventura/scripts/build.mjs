// Build: Tailwind → public/styles.css și sw.js cu versiune nouă (invalidează cache-ul offline la fiecare deploy).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
execSync('npx tailwindcss -i ./src/styles.css -o ./public/styles.css --minify', { stdio: 'inherit' });
const version = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
writeFileSync('./public/sw.js', readFileSync('./src/sw.js', 'utf8').replace('__BUILD__', version));
console.log('sw.js version', version);
