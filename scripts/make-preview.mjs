// Builds a shareable, static copy of the dashboard: same UI file, real data
// swapped for a frozen snapshot, and the page skeleton stripped for publishing.
import { readFileSync, writeFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
snapshot.project = 'acme-mobile';

let html = readFileSync('src/dashboard-ui.html', 'utf8');
html = html.replace('const SEED = /*__SEED__*/ null;', `const SEED = ${JSON.stringify(snapshot)};`);
html = html.replace('__PROJECT__', snapshot.project);
html = html.replace('<title>leas · builds</title>', '<title>leas Build Dashboard</title>');

// The artifact host supplies its own doctype/head/body wrapper.
html = html
  .replace(/^[\s\S]*?<meta name="viewport"[^>]*>\n/, '')
  .replace(/<\/head>\n<body>\n/, '')
  .replace(/<\/body>\n<\/html>\n?$/, '');

writeFileSync('leas-dashboard-preview.html', html);
console.log('wrote leas-dashboard-preview.html ·', html.length, 'bytes');
