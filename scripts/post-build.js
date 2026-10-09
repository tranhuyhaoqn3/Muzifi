import fs from 'fs';
import path from 'path';

// 1. Copy standalone pages from web/ into dist/
const distDir = path.resolve('dist');
const serverPublicDir = path.resolve('server/public');
const webDir = path.resolve('web');

for (const file of ['about.html', 'install.html', 'sw.js']) {
  const src = path.join(webDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, file));
    console.log(`[post-build] Copied ${file} to dist/`);
  }
}

// 2. Sync dist to server/public
fs.rmSync(path.join(serverPublicDir, 'assets'), { recursive: true, force: true });
fs.cpSync(distDir, serverPublicDir, { recursive: true });

// 2. Discover generated assets and inject into sw.js SHELL_ASSETS
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  const assetFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js') || f.endsWith('.css'));
  const assetPaths = assetFiles.map(f => `/assets/${f}`);

  const swPaths = [
    path.join(distDir, 'sw.js'),
    path.join(serverPublicDir, 'sw.js'),
  ];

  for (const swPath of swPaths) {
    if (fs.existsSync(swPath)) {
      let swContent = fs.readFileSync(swPath, 'utf8');
      const shellAssetsRegex = /const SHELL_ASSETS = \[([\s\S]*?)\];/;
      const match = swContent.match(shellAssetsRegex);
      if (match) {
        const currentItems = match[1]
          .split(',')
          .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean && (s => !s.startsWith('/assets/')));

        const combined = Array.from(new Set([...currentItems, ...assetPaths]));
        const formatted = '[\n' + combined.map(item => `  '${item}'`).join(',\n') + '\n];';
        swContent = swContent.replace(shellAssetsRegex, `const SHELL_ASSETS = ${formatted}`);
        fs.writeFileSync(swPath, swContent, 'utf8');
        console.log(`[post-build] Injected ${assetPaths.length} assets into ${swPath}`);
      }
    }
  }
}
