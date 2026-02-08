/**
 * Consolidate poster JSON files into JSON_Posters/Posters
 *
 * Usage: node scripts/consolidate-posters.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const JSON_POSTERS_DIR = path.join(ROOT_DIR, 'JSON_Posters');
const TARGET_DIR_NAME = 'Posters';
const TARGET_DIR = path.join(JSON_POSTERS_DIR, TARGET_DIR_NAME);
const DRY_RUN = process.argv.includes('--dry-run');

const skipDirs = new Set(['Journeys', 'poster_schemas', TARGET_DIR_NAME]);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function nextAvailableName(fileName, dirName) {
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  let candidate = `${base}__${dirName}${ext}`;
  let counter = 1;

  while (fs.existsSync(path.join(TARGET_DIR, candidate))) {
    candidate = `${base}__${dirName}_${counter}${ext}`;
    counter += 1;
  }

  return candidate;
}

function consolidate() {
  ensureDir(TARGET_DIR);

  const sourceDirs = fs.readdirSync(JSON_POSTERS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !skipDirs.has(dirent.name))
    .map(dirent => dirent.name);

  let moved = 0;
  let skipped = 0;
  let renamed = 0;

  console.log(`Target directory: ${TARGET_DIR}`);
  console.log(`Source directories: ${sourceDirs.join(', ') || 'None'}`);

  for (const dirName of sourceDirs) {
    const dirPath = path.join(JSON_POSTERS_DIR, dirName);
    const files = fs.readdirSync(dirPath).filter(file => file.toLowerCase().endsWith('.json'));

    for (const file of files) {
      const sourcePath = path.join(dirPath, file);
      let targetName = file;
      let targetPath = path.join(TARGET_DIR, targetName);

      if (fs.existsSync(targetPath)) {
        targetName = nextAvailableName(file, dirName);
        targetPath = path.join(TARGET_DIR, targetName);
        renamed += 1;
      }

      if (DRY_RUN) {
        console.log(`[DRY RUN] ${sourcePath} -> ${targetPath}`);
        moved += 1;
        continue;
      }

      try {
        fs.renameSync(sourcePath, targetPath);
        moved += 1;
      } catch (error) {
        console.error(`Failed to move ${sourcePath}: ${error.message}`);
        skipped += 1;
      }
    }
  }

  console.log('\nConsolidation Summary');
  console.log(`Moved:   ${moved}`);
  console.log(`Renamed: ${renamed}`);
  console.log(`Skipped: ${skipped}`);

  if (DRY_RUN) {
    console.log('\n*** DRY RUN - no files were modified ***');
  }
}

consolidate();
