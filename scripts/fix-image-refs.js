#!/usr/bin/env node
/**
 * Fix Image References Script
 * 
 * This script:
 * 1. Finds centralized images with wrong category prefixes
 * 2. Renames them to simple names (without category prefix)
 * 3. Updates any poster references to use the new paths
 * 4. Links images to matching posters that don't have images set
 * 
 * Usage: node scripts/fix-image-refs.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    imagesDir: path.join(__dirname, '..', 'images', 'originals'),
    postersDir: path.join(__dirname, '..', 'JSON_Posters'),
    dryRun: process.argv.includes('--dry-run'),
    skipDirs: ['poster_schemas', 'Journeys']
};

const stats = {
    imagesRenamed: 0,
    postersUpdated: 0,
    postersLinked: 0,
    errors: 0
};

function log(msg) {
    console.log(msg);
}

/**
 * Get all poster files
 */
function getAllPosters() {
    const posters = [];
    const categories = fs.readdirSync(CONFIG.postersDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !CONFIG.skipDirs.includes(d.name));

    for (const cat of categories) {
        const catPath = path.join(CONFIG.postersDir, cat.name);
        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.json'));
        for (const file of files) {
            posters.push({
                path: path.join(catPath, file),
                category: cat.name,
                filename: file,
                baseName: file.replace('.json', '')
            });
        }
    }
    return posters;
}

/**
 * Get all images
 */
function getAllImages() {
    if (!fs.existsSync(CONFIG.imagesDir)) return [];

    return fs.readdirSync(CONFIG.imagesDir)
        .filter(f => /\.(webp|png|jpg|jpeg|gif|svg)$/i.test(f))
        .map(f => ({
            filename: f,
            path: path.join(CONFIG.imagesDir, f),
            relativePath: `images/originals/${f}`
        }));
}

/**
 * Rename images: remove category prefix
 */
function renameImages(images) {
    const renamed = new Map();

    for (const img of images) {
        // Check if it has a category prefix (word_)
        const match = img.filename.match(/^([a-z_]+)_(.+)$/);
        if (match) {
            const prefix = match[1];
            const baseName = match[2];

            // Check if there's a conflict (same base name exists)
            const newPath = path.join(CONFIG.imagesDir, baseName);
            const newRelative = `images/originals/${baseName}`;

            if (fs.existsSync(newPath) && newPath !== img.path) {
                log(`  Conflict: ${baseName} already exists, keeping ${img.filename}`);
                renamed.set(img.relativePath, img.relativePath);
                continue;
            }

            log(`  Renaming: ${img.filename} -> ${baseName}`);

            if (!CONFIG.dryRun) {
                fs.renameSync(img.path, newPath);
            }

            renamed.set(img.relativePath, newRelative);
            stats.imagesRenamed++;
        } else {
            renamed.set(img.relativePath, img.relativePath);
        }
    }

    return renamed;
}

/**
 * Update poster image references
 */
function updatePosterRefs(posters, renamedMap) {
    for (const poster of posters) {
        try {
            const content = JSON.parse(fs.readFileSync(poster.path, 'utf8'));
            if (content.version !== 2) continue;

            let modified = false;

            // Update back.image.src if it exists and was renamed
            if (content.back?.image?.src) {
                const oldPath = content.back.image.src;
                const newPath = renamedMap.get(oldPath);
                if (newPath && newPath !== oldPath) {
                    log(`  Updating ${poster.filename}: ${oldPath} -> ${newPath}`);
                    content.back.image.src = newPath;
                    modified = true;
                    stats.postersUpdated++;
                }
            }

            if (modified && !CONFIG.dryRun) {
                content.meta.modified = new Date().toISOString();
                fs.writeFileSync(poster.path, JSON.stringify(content, null, 2));
            }
        } catch (e) {
            log(`  Error updating ${poster.filename}: ${e.message}`);
            stats.errors++;
        }
    }
}

/**
 * Link matching images to posters without images
 */
function linkMatchingImages(posters) {
    const currentImages = getAllImages();
    const imagesByBaseName = new Map();

    for (const img of currentImages) {
        // Remove extension to get base name
        const baseName = img.filename.replace(/\.(webp|png|jpg|jpeg|gif|svg)$/i, '');
        imagesByBaseName.set(baseName.toLowerCase(), img);
    }

    for (const poster of posters) {
        try {
            const content = JSON.parse(fs.readFileSync(poster.path, 'utf8'));
            if (content.version !== 2) continue;

            // Skip if already has an image
            if (content.back?.image?.src) continue;

            // Look for matching image by poster base name
            const matchKey = poster.baseName.toLowerCase();
            const matchedImage = imagesByBaseName.get(matchKey);

            if (matchedImage) {
                log(`  Linking: ${poster.filename} <- ${matchedImage.filename}`);

                if (!content.back) content.back = {};
                if (!content.back.image) content.back.image = {};

                content.back.image.src = matchedImage.relativePath;
                content.back.image.alt = content.front?.title || poster.baseName;
                content.back.image.position = 'top';

                if (!CONFIG.dryRun) {
                    content.meta.modified = new Date().toISOString();
                    fs.writeFileSync(poster.path, JSON.stringify(content, null, 2));
                }

                stats.postersLinked++;
            }
        } catch (e) {
            log(`  Error linking ${poster.filename}: ${e.message}`);
            stats.errors++;
        }
    }
}

function main() {
    console.log('='.repeat(60));
    console.log('Fix Image References');
    console.log('='.repeat(60));

    if (CONFIG.dryRun) {
        console.log('\n*** DRY RUN MODE ***\n');
    }

    const posters = getAllPosters();
    const images = getAllImages();

    console.log(`\nFound ${images.length} images and ${posters.length} posters\n`);

    // Step 1: Rename images (remove category prefix)
    console.log('Step 1: Renaming images...');
    const renamedMap = renameImages(images);

    // Step 2: Update references in posters
    console.log('\nStep 2: Updating poster references...');
    updatePosterRefs(posters, renamedMap);

    // Step 3: Link matching images to posters without images
    console.log('\nStep 3: Linking matching images to posters...');
    linkMatchingImages(posters);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Images renamed:    ${stats.imagesRenamed}`);
    console.log(`Posters updated:   ${stats.postersUpdated}`);
    console.log(`Posters linked:    ${stats.postersLinked}`);
    console.log(`Errors:            ${stats.errors}`);

    if (CONFIG.dryRun) {
        console.log('\n*** This was a DRY RUN. Run without --dry-run to apply changes. ***');
    }
}

main();
