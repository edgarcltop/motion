import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Copy package.json to dist folder
const sourcePath = path.join(__dirname, '..', 'package.json');
const destPath = path.join(__dirname, '..', 'dist', 'package.json');

try {
  fs.copyFileSync(sourcePath, destPath);
  console.log('✅ package.json copied to dist/');
} catch (error) {
  console.error('❌ Failed to copy package.json:', error.message);
  process.exit(1);
} 