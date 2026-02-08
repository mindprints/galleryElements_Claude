#!/usr/bin/env node
/**
 * Update Script: Normalize all posters to v2 format
 *
 * This script:
 * - Scans JSON_Posters directories for poster JSON files
 * - Ensures each poster conforms to the v2 structure
 * - Fills missing fields with real or safe dummy data
 * - Preserves existing content whenever possible
 *
 * Usage: node scripts/update-v2-posters.js [--dry-run] [--verbose]
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    postersDir: path.join(__dirname, '..', 'JSON_Posters'),
    centralDirName: 'Posters',
    dryRun: process.argv.includes('--dry-run'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    skipDirs: ['poster_schemas', 'Journeys']
};

const stats = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    filled: {
        uid: 0,
        title: 0,
        subtitle: 0,
        layout: 0,
        text: 0,
        imageAlt: 0,
        imagePosition: 0,
        imageList: 0,
        links: 0,
        metaCreated: 0,
        metaModified: 0,
        metaCategories: 0
    }
};

function log(message, verboseOnly = false) {
    if (!verboseOnly || CONFIG.verbose) {
        console.log(message);
    }
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function titleFromFilename(filename) {
    const base = path.basename(filename, path.extname(filename));
    return base
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

function altFromSrc(src, fallbackTitle) {
    if (!src) return fallbackTitle || 'Poster Image';
    const name = path.basename(src, path.extname(src));
    const alt = name
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return alt ? alt.replace(/\b\w/g, c => c.toUpperCase()) : (fallbackTitle || 'Poster Image');
}

function coerceString(value) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    return '';
}

function dummyBackText(title, categoryName) {
    const category = categoryName ? ` in ${categoryName.replace(/_/g, ' ')}` : '';
    return `Overview for ${title}${category}. Details coming soon.`;
}

function normalizeLinks(links) {
    if (!Array.isArray(links)) return [];
    const normalized = [];

    for (const link of links) {
        if (!link || typeof link !== 'object') continue;

        const type = link.type || (link.url ? 'external' : link.target ? 'internal' : link.path ? 'file' : 'external');
        const url = coerceString(link.url) || coerceString(link.target) || coerceString(link.path);
        let label = coerceString(link.label);

        if (!label) {
            if (url) {
                label = url.replace(/^https?:\/\//, '').split('/')[0] || 'Learn more';
            } else {
                label = 'Learn more';
            }
        }

        const normalizedLink = { type, label };
        if (type === 'external') {
            normalizedLink.url = url || 'https://example.com';
        } else if (type === 'internal') {
            normalizedLink.target = url || '/';
        } else if (type === 'file') {
            normalizedLink.path = url || 'files/example.pdf';
        }

        if (link.primary) normalizedLink.primary = true;
        normalized.push(normalizedLink);
    }

    return normalized;
}

function migrateLegacy(content, filename) {
    const title = content.figure || content.title || content.name || titleFromFilename(filename) || 'Untitled';
    const text = content.header || content.description || content.text || '';

    const v2 = {
        version: 2,
        uid: content.uid || `poster-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        front: {
            title
        },
        back: {
            layout: 'auto'
        },
        meta: {
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        }
    };

    if (content.subtitle) v2.front.subtitle = content.subtitle;
    if (content.chronology) v2.front.chronology = content.chronology;

    if (text) v2.back.text = text;

    if (content.imagePath) {
        v2.back.image = {
            src: content.imagePath,
            alt: content.alt || title,
            position: 'top'
        };
    }

    if (content.url) {
        v2.back.links = [{
            type: 'external',
            url: content.url,
            label: 'Visit Website',
            primary: true
        }];
    }

    return v2;
}

function normalizePoster(content, filePath, categoryName) {
    let poster = content;
    let changed = false;
    const filename = path.basename(filePath);
    const now = new Date().toISOString();
    const maxImages = 5;

    if (!poster || typeof poster !== 'object') {
        return { changed: false, poster: null };
    }

    if (poster.version !== 2) {
        poster = migrateLegacy(poster, filename);
        changed = true;
    }

    if (!poster.type || poster.type !== 'poster-v2') {
        poster.type = 'poster-v2';
        changed = true;
    }

    if (!poster.uid) {
        poster.uid = `poster-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
        stats.filled.uid++;
        changed = true;
    }

    if (!poster.front || typeof poster.front !== 'object') {
        poster.front = {};
        changed = true;
    }

    if (!poster.front.title) {
        poster.front.title = titleFromFilename(filename) || 'Untitled';
        stats.filled.title++;
        changed = true;
    }

    if (!poster.back || typeof poster.back !== 'object') {
        poster.back = {};
        changed = true;
    }

    if (!poster.back.layout) {
        poster.back.layout = 'auto';
        stats.filled.layout++;
        changed = true;
    }

    if (!coerceString(poster.back.text)) {
        const legacyText = coerceString(poster.header) || coerceString(poster.description) || coerceString(poster.text);
        poster.back.text = legacyText || dummyBackText(poster.front.title, categoryName);
        stats.filled.text++;
        changed = true;
    }

    if (poster.back.image && typeof poster.back.image === 'object') {
        if (!poster.back.image.alt) {
            poster.back.image.alt = altFromSrc(poster.back.image.src, poster.front.title);
            stats.filled.imageAlt++;
            changed = true;
        }
        if (!poster.back.image.position) {
            poster.back.image.position = 'top';
            stats.filled.imagePosition++;
            changed = true;
        }
    }

    if (Array.isArray(poster.back.images)) {
        const normalizedImages = poster.back.images
            .filter(img => img && img.src)
            .map(img => ({
                src: img.src,
                alt: img.alt || altFromSrc(img.src, poster.front.title)
            }));

        let imageList = normalizedImages;
        if (poster.back.image && poster.back.image.src) {
            const primaryAlt = poster.back.image.alt || altFromSrc(poster.back.image.src, poster.front.title);
            const primary = { src: poster.back.image.src, alt: primaryAlt };
            imageList = [primary, ...normalizedImages.filter(img => img.src !== primary.src)];
        }

        imageList = imageList.slice(0, maxImages);

        if (imageList.length) {
            poster.back.images = imageList;
            if (!poster.back.image || !poster.back.image.src || poster.back.image.src !== imageList[0].src) {
                poster.back.image = {
                    src: imageList[0].src,
                    alt: imageList[0].alt || altFromSrc(imageList[0].src, poster.front.title),
                    position: poster.back.image?.position || 'top'
                };
                stats.filled.imageList++;
                changed = true;
            }
        } else {
            delete poster.back.images;
        }
    }

    if (Array.isArray(poster.back.links)) {
        const normalizedLinks = normalizeLinks(poster.back.links);
        if (normalizedLinks.length) {
            poster.back.links = normalizedLinks;
        } else {
            delete poster.back.links;
        }
        stats.filled.links++;
        changed = true;
    }

    if (!poster.meta || typeof poster.meta !== 'object') {
        poster.meta = {};
        changed = true;
    }

    if (poster.meta.migratedFrom) {
        delete poster.meta.migratedFrom;
        changed = true;
    }

    if (!Array.isArray(poster.meta.categories) || poster.meta.categories.length === 0) {
        if (categoryName) {
            poster.meta.categories = [categoryName];
        } else {
            poster.meta.categories = ['Uncategorized'];
        }
        stats.filled.metaCategories++;
        changed = true;
    }

    if (!poster.meta.created) {
        poster.meta.created = now;
        stats.filled.metaCreated++;
        changed = true;
    }

    if (changed) {
        poster.meta.modified = now;
        stats.filled.metaModified++;
    }

    return { changed, poster };
}

function processCategory(categoryPath, categoryName) {
    const files = fs.readdirSync(categoryPath);
    const displayName = categoryName || path.basename(categoryPath);

    for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) continue;
        if (!file.toLowerCase().endsWith('.json')) continue;

        stats.scanned++;
        log(`Processing: ${displayName}/${file}`, true);

        try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const parsed = JSON.parse(raw);
            const { changed, poster } = normalizePoster(parsed, filePath, categoryName);

            if (!poster) {
                stats.skipped++;
                continue;
            }

            if (!changed) {
                stats.skipped++;
                continue;
            }

            if (CONFIG.dryRun) {
                log(`  [DRY RUN] Would update: ${file}`);
                stats.updated++;
                continue;
            }

            fs.writeFileSync(filePath, JSON.stringify(poster, null, 2));
            stats.updated++;
        } catch (error) {
            stats.errors++;
            log(`  Error: ${error.message}`);
        }
    }
}

function main() {
    console.log('='.repeat(60));
    console.log('Poster Update: Normalize to v2 format');
    console.log('='.repeat(60));

    if (CONFIG.dryRun) {
        console.log('\n*** DRY RUN MODE - No files will be modified ***\n');
    }

    ensureDir(CONFIG.postersDir);

    const centralDirPath = path.join(CONFIG.postersDir, CONFIG.centralDirName);
    const useCentral = fs.existsSync(centralDirPath);

    const categories = useCentral
        ? [CONFIG.centralDirName]
        : fs.readdirSync(CONFIG.postersDir)
            .filter(name => {
                const fullPath = path.join(CONFIG.postersDir, name);
                return fs.statSync(fullPath).isDirectory() && !CONFIG.skipDirs.includes(name);
            });

    console.log(`Found ${categories.length} categories to process:`);
    console.log(categories.map(c => `  - ${c}`).join('\n'));

    for (const category of categories) {
        const categoryPath = path.join(CONFIG.postersDir, category);
        const categoryName = category === CONFIG.centralDirName ? null : category;
        processCategory(categoryPath, categoryName);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Update Summary');
    console.log('='.repeat(60));
    console.log(`Files scanned:    ${stats.scanned}`);
    console.log(`Files updated:    ${stats.updated}`);
    console.log(`Files skipped:    ${stats.skipped}`);
    console.log(`Errors:           ${stats.errors}`);
    console.log('\nFilled fields:');
    console.log(`  uid:            ${stats.filled.uid}`);
    console.log(`  title:          ${stats.filled.title}`);
    console.log(`  subtitle:       ${stats.filled.subtitle}`);
    console.log(`  layout:         ${stats.filled.layout}`);
    console.log(`  text:           ${stats.filled.text}`);
    console.log(`  imageAlt:       ${stats.filled.imageAlt}`);
    console.log(`  imagePosition:  ${stats.filled.imagePosition}`);
    console.log(`  imageList:      ${stats.filled.imageList}`);
    console.log(`  links:          ${stats.filled.links}`);
    console.log(`  metaCreated:    ${stats.filled.metaCreated}`);
    console.log(`  metaModified:   ${stats.filled.metaModified}`);
    console.log(`  metaCategories: ${stats.filled.metaCategories}`);

    if (CONFIG.dryRun) {
        console.log('\n*** This was a DRY RUN. Run without --dry-run to apply changes. ***');
    }
}

main();
