import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const CONTENT_DIR = path.join(process.cwd(), 'content/docs'); // Adjust to match repo content path

// Ensure public folder exists
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// 1. Compile the brief /llms.txt roadmap catalog
const llmsBrief = `# SO4 Markets Interface Documentation

A high-performance trading interface protocol engineering catalog designed for programmatic automation and manual developer integration.

## Core Reference
- [/docs/getting-started](/docs/getting-started): Quickstart manual for protocol installation and workspace bootstrap.
- [/docs/api](/docs/api): Full structure blueprints for parameters, request wrappers, and server endpoints.
- [/docs/versioning](/docs/versioning): Schema definitions tracking structural modifications across active route version tags.
`;

// 2. Compile the exhaustive full text corpus /llms-full.txt
let llmsFull = `# SO4 Markets Full Corpus\n\n`;

function assembleFullCorpus(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      assembleFullCorpus(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Filter out drafts if marked in markdown frontmatter metadata
      if (content.includes('draft: true')) continue;

      // Clean out layout/navigation placeholders and isolate text content
      const cleanContent = content
        .replace(/---[\s\S]*?---/, '') // Strip frontmatter metadata blocks
        .trim();

      llmsFull += `\n--- START OF PAGE: ${entry.name} ---\n\n${cleanContent}\n--- END OF PAGE ---\n`;
    }
  }
}

assembleFullCorpus(CONTENT_DIR);

// Write out the compiled outputs to public folder targets
fs.writeFileSync(path.join(PUBLIC_DIR, 'llms.txt'), llmsBrief.trim());
fs.writeFileSync(path.join(PUBLIC_DIR, 'llms-full.txt'), llmsFull.trim());

console.log('Successfully compiled agent consumption text outputs for production build targets.');
