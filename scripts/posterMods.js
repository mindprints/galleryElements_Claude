#!/usr/bin/env node
/**
 * Poster Mods
 *
 * Traverse JSON_Posters and apply reusable modifications.
 *
 * Usage:
 *   node scripts/posterMods.js [--dry-run] [--mod <name>] [--list-mods]
 *   node scripts/posterMods.js --mod categories
 *
 * Options:
 *   --dry-run                 Preview changes without writing files
 *   --mod <name>              Run one or more mods (repeatable)
 *   --list-mods               List available mods and exit
 *   --ensure-folder-category  Always include folder category
 *   --default-category <name> Category to use when none exists
 *   --include-non-v2          Apply mods to non-v2 JSON posters
 *   --verbose                 Verbose logging
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const JSON_POSTERS_DIR = path.join(ROOT_DIR, 'JSON_Posters');

const argv = process.argv.slice(2);
const options = {
  dryRun: argv.includes('--dry-run'),
  listMods: argv.includes('--list-mods'),
  ensureFolderCategory: argv.includes('--ensure-folder-category'),
  includeNonV2: argv.includes('--include-non-v2'),
  verbose: argv.includes('--verbose') || argv.includes('-v'),
  defaultCategory: 'Uncategorized',
  selectedMods: []
};

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === '--mod' && argv[i + 1]) {
    options.selectedMods.push(argv[i + 1]);
    i++;
  } else if (arg === '--default-category' && argv[i + 1]) {
    options.defaultCategory = argv[i + 1];
    i++;
  }
}

const stats = {
  scanned: 0,
  modified: 0,
  unchanged: 0,
  skippedNonV2: 0,
  errors: 0,
  byMod: {},
  audits: {
    categoryFolderMismatch: []
  }
};

const SKIP_DIRS = new Set(['poster_schemas', 'Journeys']);

function log(message, verboseOnly = false) {
  if (!verboseOnly || options.verbose) {
    console.log(message);
  }
}

function listMods(mods) {
  console.log('Available mods:');
  Object.keys(mods).forEach((key) => {
    console.log(`  - ${key}: ${mods[key].description}`);
  });
}

function toCategoryArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [value];
  if (typeof value === 'number') return [String(value)];
  return [];
}

function normalizeCategoryList(input) {
  const seen = new Set();
  const result = [];

  for (const item of input) {
    if (item === null || item === undefined) continue;
    let value = item;
    if (typeof value === 'number') value = String(value);
    if (typeof value !== 'string') continue;

    const trimmed = value.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function getFolderCategory(filePath) {
  const relative = path.relative(JSON_POSTERS_DIR, filePath);
  const parts = relative.split(path.sep);
  return parts.length > 1 ? parts[0] : '';
}

const mods = {
  categories: {
    description: 'Normalize meta.categories and backfill from folder name',
    apply: (content, context) => {
      const folderCategory = context.folderCategory;

      const metaCategories = toCategoryArray(content.meta?.categories);
      const rootCategories = toCategoryArray(content.categories);
      const sourceCategories = metaCategories.length > 0 ? metaCategories : rootCategories;

      let normalized = normalizeCategoryList(sourceCategories);

      if (normalized.length === 0) {
        if (folderCategory) {
          normalized = [folderCategory];
        } else if (options.defaultCategory) {
          normalized = [options.defaultCategory];
        }
      }

      if (options.ensureFolderCategory && folderCategory) {
        const hasFolderCategory = normalized.some(
          (category) => category.toLowerCase() === folderCategory.toLowerCase()
        );
        if (!hasFolderCategory) {
          normalized.push(folderCategory);
        }
      }

      let changed = false;
      const existingMeta = content.meta?.categories;

      if (!content.meta) {
        content.meta = {};
        changed = true;
      }

      if (!arraysEqual(existingMeta, normalized)) {
        content.meta.categories = normalized;
        changed = true;
      }

      if (content.categories !== undefined) {
        delete content.categories;
        changed = true;
      }

      return { changed };
    }
  },
  categoryAudit: {
    description: 'Report posters whose categories do not include folder name',
    apply: (content, context) => {
      const folderCategory = context.folderCategory;
      if (!folderCategory) return { changed: false };

      const metaCategories = toCategoryArray(content.meta?.categories);
      const rootCategories = toCategoryArray(content.categories);
      const sourceCategories = metaCategories.length > 0 ? metaCategories : rootCategories;
      const normalized = normalizeCategoryList(sourceCategories);

      const hasFolderCategory = normalized.some(
        (category) => category.toLowerCase() === folderCategory.toLowerCase()
      );

      if (!hasFolderCategory) {
        stats.audits.categoryFolderMismatch.push({
          file: context.relativePath,
          folder: folderCategory,
          categories: normalized
        });
        log(`Category mismatch: ${context.relativePath} (folder: ${folderCategory})`, true);
      }

      return { changed: false };
    }
  }
};

function getSelectedMods() {
  if (options.selectedMods.length === 0) {
    return Object.keys(mods);
  }

  const unknown = options.selectedMods.filter((name) => !mods[name]);
  if (unknown.length > 0) {
    throw new Error(`Unknown mod(s): ${unknown.join(', ')}`);
  }

  return options.selectedMods;
}

function collectPosterFiles(dirPath) {
  const results = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...collectPosterFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      results.push(fullPath);
    }
  }

  return results;
}

function applyMods(filePath, selectedMods) {
  stats.scanned++;
  const relativePath = path.relative(JSON_POSTERS_DIR, filePath);

  let content;
  try {
    content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    log(`Error parsing ${relativePath}: ${error.message}`);
    stats.errors++;
    return;
  }

  if (!options.includeNonV2 && content.version !== 2) {
    stats.skippedNonV2++;
    return;
  }

  const context = {
    filePath,
    relativePath,
    folderCategory: getFolderCategory(filePath)
  };

  let modified = false;

  for (const modName of selectedMods) {
    const mod = mods[modName];
    const result = mod.apply(content, context) || { changed: false };
    if (!stats.byMod[modName]) stats.byMod[modName] = { changed: 0 };
    if (result.changed) {
      stats.byMod[modName].changed++;
      modified = true;
    }
  }

  if (modified) {
    if (!content.meta) content.meta = {};
    content.meta.modified = new Date().toISOString();
    stats.modified++;

    if (options.dryRun) {
      log(`[DRY RUN] Would update ${relativePath}`);
    } else {
      fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
      log(`Updated ${relativePath}`, true);
    }
  } else {
    stats.unchanged++;
  }
}

function main() {
  if (!fs.existsSync(JSON_POSTERS_DIR)) {
    console.error(`JSON_Posters directory not found: ${JSON_POSTERS_DIR}`);
    process.exit(1);
  }

  if (options.listMods) {
    listMods(mods);
    return;
  }

  let selectedMods;
  try {
    selectedMods = getSelectedMods();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('Poster Mods');
  console.log('='.repeat(60));
  console.log(`Mods: ${selectedMods.join(', ')}`);
  if (options.dryRun) console.log('Mode: DRY RUN');
  if (!options.includeNonV2) console.log('Skip: non-v2 posters');
  console.log('');

  const posterFiles = collectPosterFiles(JSON_POSTERS_DIR);
  posterFiles.forEach((filePath) => applyMods(filePath, selectedMods));

  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Posters scanned:   ${stats.scanned}`);
  console.log(`Posters modified:  ${stats.modified}`);
  console.log(`Posters unchanged: ${stats.unchanged}`);
  console.log(`Skipped non-v2:    ${stats.skippedNonV2}`);
  console.log(`Errors:            ${stats.errors}`);

  const modNames = Object.keys(stats.byMod);
  if (modNames.length > 0) {
    console.log('\nBy mod:');
    modNames.forEach((modName) => {
      console.log(`  ${modName}: ${stats.byMod[modName].changed} changed`);
    });
  }

  if (options.dryRun) {
    console.log('\n*** This was a DRY RUN. Run without --dry-run to apply changes. ***');
  }

  if (stats.audits.categoryFolderMismatch.length > 0) {
    console.log('\nCategory mismatches (folder not in categories):');
    stats.audits.categoryFolderMismatch.forEach((item) => {
      const categories = item.categories.length ? item.categories.join(', ') : '(none)';
      console.log(`- ${item.file} | folder: ${item.folder} | categories: ${categories}`);
    });
  }
}

main();
