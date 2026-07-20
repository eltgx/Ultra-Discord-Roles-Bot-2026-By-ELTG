'use strict';

/**
 * Build a ModVC-ready ZIP with preserved folder structure.
 * Output: dist/roles-bot-modvc.zip
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const STAGE = path.join(OUT_DIR, 'stage');
const OUT_ZIP = path.join(OUT_DIR, 'roles-bot-modvc.zip');

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'data',
  'dist',
  '.cursor',
]);

const EXCLUDE_FILES = new Set([
  '.env',
  'message.txt',
  'package-lock.json',
]);

function shouldSkip(relPosix) {
  const parts = relPosix.split('/');
  if (parts.some((p) => EXCLUDE_DIRS.has(p))) return true;
  const base = parts[parts.length - 1];
  if (EXCLUDE_FILES.has(base)) return true;
  if (base.endsWith('.sqlite') || base.endsWith('.log') || base.endsWith('.tmp')) return true;
  if (base.startsWith('.') && base !== '.env.example' && base !== '.gitignore') return true;
  return false;
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(abs, files);
    } else if (!shouldSkip(rel)) {
      files.push(rel);
    }
  }
  return files;
}

function rmrf(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  rmrf(STAGE);
  fs.mkdirSync(STAGE, { recursive: true });
  if (fs.existsSync(OUT_ZIP)) fs.unlinkSync(OUT_ZIP);

  const files = walk(ROOT);
  for (const rel of files) {
    const src = path.join(ROOT, rel);
    const dest = path.join(STAGE, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  if (!fs.existsSync(path.join(STAGE, 'index.js')) || !fs.existsSync(path.join(STAGE, 'package.json'))) {
    throw new Error('Staging missing index.js or package.json');
  }

  // Zip contents of STAGE so archive root = project root (index.js at top level)
  const ps = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $stage = '${STAGE.replace(/'/g, "''")}'
    $zipPath = '${OUT_ZIP.replace(/'/g, "''")}'
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    $zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
    try {
      Get-ChildItem -Path $stage -Recurse -File | ForEach-Object {
        $entry = $_.FullName.Substring($stage.Length).TrimStart('\\','/').Replace('\\','/')
        [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry, 'Optimal')
      }
    } finally {
      $zip.Dispose()
    }
  `;

  execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
  rmrf(STAGE);

  console.log(`Packed ${files.length} files → ${OUT_ZIP}`);
  console.log('Upload this ZIP to ModVC. Set DISCORD_TOKEN in the panel env vars.');
}

main();
