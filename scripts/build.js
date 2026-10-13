import { mkdir, copyFile, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist');
for (const file of ['index.html', 'styles.css', 'app.js', 'totp.js', 'favicon.svg']) {
  await copyFile(file, `dist/${file}`);
}
console.log('静态页面已构建至 dist/');
