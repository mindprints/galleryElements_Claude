#!/usr/bin/env node
/**
 * Fix All Image Paths
 * 
 * This script finds all posters with image references and ensures
 * they point to the correct centralized location (images/originals/).
 * 
 * Usage: node scripts/fix-all-image-paths.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    postersDir: path.join(__dirname, '..', 'JSON_Posters'),
    journeysDir: path.join(__dirname, '..', 'JSON_Posters', 'Journeys'),
    imagesDir: path.join(__dirname, '..', 'images', 'originals'),
    dryRun: process.argv.includes('--dry-run'),
    skipDirs: ['poster_schemas']  // Process Journeys now
};

const stats = {
    postersScanned: 0,
    postersFixed: 0,
    journeysScanned: 0,
    journeysFixed: 0,
    imagesNotFound: [],
    errors: 0
};

// Get all available images in centralized folder
function getAvailableImages() {
    const images = new Map();
    if (!fs.existsSync(CONFIG.imagesDir)) return images;

    const files = fs.readdirSync(CONFIG.imagesDir);
    for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(ext)) {
            // Store by lowercase name for case-insensitive matching
            images.set(file.toLowerCase(), file);
            // Also store without extension
            const baseName = file.replace(/\.[^.]+$/, '');
            images.set(baseName.toLowerCase(), file);
        }
    }
    return images;
}

// Find the best matching image for a broken path
function findMatchingImage(brokenPath, availableImages) {
    // Extract just the filename from the path
    const filename = path.basename(brokenPath);
    const baseName = filename.replace(/\.[^.]+$/, '');
    const ext = path.extname(filename).toLowerCase();

    // Try exact match first
    if (availableImages.has(filename.toLowerCase())) {
        return `images/originals/${availableImages.get(filename.toLowerCase())}`;
    }

    // Try without category prefix (e.g., competitors_Chatbots -> Chatbots)
    const withoutPrefix = baseName.replace(/^[a-z]+_/i, '');
    if (availableImages.has(withoutPrefix.toLowerCase())) {
        return `images/originals/${availableImages.get(withoutPrefix.toLowerCase())}`;
    }

    // Try with common extensions
    for (const tryExt of ['.webp', '.png', '.jpg']) {
        const tryName = (withoutPrefix + tryExt).toLowerCase();
        if (availableImages.has(tryName)) {
            return `images/originals/${availableImages.get(tryName)}`;
        }
    }

    return null;
}

// Check if a path needs fixing
function needsFixing(imagePath) {
    if (!imagePath) return false;
    if (imagePath.startsWith('http')) return false;
    if (imagePath.startsWith('images/originals/')) return false;
    return true;
}

// Process a single poster file
function processPoster(filePath, availableImages) {
    stats.postersScanned++;

    try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let modified = false;

        // Handle v2 posters
        if (content.version === 2) {
            // Check back.image.src
            if (content.back?.image?.src && needsFixing(content.back.image.src)) {
                const newPath = findMatchingImage(content.back.image.src, availableImages);
                if (newPath) {
                    console.log(`  ${path.basename(filePath)}: ${content.back.image.src} -> ${newPath}`);
                    content.back.image.src = newPath;
                    modified = true;
                } else {
                    console.log(`  ${path.basename(filePath)}: [NOT FOUND] ${content.back.image.src}`);
                    stats.imagesNotFound.push({ poster: filePath, path: content.back.image.src });
                }
            }

            // Check front.thumbnail
            if (content.front?.thumbnail && needsFixing(content.front.thumbnail)) {
                const newPath = findMatchingImage(content.front.thumbnail, availableImages);
                if (newPath) {
                    console.log(`  ${path.basename(filePath)}: thumbnail ${content.front.thumbnail} -> ${newPath}`);
                    content.front.thumbnail = newPath;
                    modified = true;
                } else {
                    stats.imagesNotFound.push({ poster: filePath, path: content.front.thumbnail });
                }
            }
        }

        // Handle legacy image type
        if (content.type === 'image' && content.imagePath && needsFixing(content.imagePath)) {
            const newPath = findMatchingImage(content.imagePath, availableImages);
            if (newPath) {
                console.log(`  ${path.basename(filePath)}: imagePath ${content.imagePath} -> ${newPath}`);
                content.imagePath = newPath;
                modified = true;
            } else {
                console.log(`  ${path.basename(filePath)}: [NOT FOUND] ${content.imagePath}`);
                stats.imagesNotFound.push({ poster: filePath, path: content.imagePath });
            }
        }

        // Handle legacy thumbnail
        if (content.thumbnail && needsFixing(content.thumbnail)) {
            const newPath = findMatchingImage(content.thumbnail, availableImages);
            if (newPath) {
                console.log(`  ${path.basename(filePath)}: thumbnail ${content.thumbnail} -> ${newPath}`);
                content.thumbnail = newPath;
                modified = true;
            } else {
                stats.imagesNotFound.push({ poster: filePath, path: content.thumbnail });
            }
        }

        // Save if modified
        if (modified) {
            if (content.meta) {
                content.meta.modified = new Date().toISOString();
            }
            if (!CONFIG.dryRun) {
                fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
            }
            stats.postersFixed++;
        }

    } catch (e) {
        console.error(`  Error processing ${filePath}: ${e.message}`);
        stats.errors++;
    }
}

// Process a journey file (updates thumbnail paths in poster references)
function processJourney(filePath, availableImages) {
    stats.journeysScanned++;

    try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        let modified = false;

        if (content.posters && Array.isArray(content.posters)) {
            for (const posterRef of content.posters) {
                // Fix thumbnail path in journey poster reference
                if (posterRef.thumbnail && needsFixing(posterRef.thumbnail)) {
                    const newPath = findMatchingImage(posterRef.thumbnail, availableImages);
                    if (newPath) {
                        console.log(`  ${path.basename(filePath)}: poster "${posterRef.title}" thumbnail -> ${newPath}`);
                        posterRef.thumbnail = newPath;
                        modified = true;
                    } else if (!posterRef.thumbnail.includes('path/to/optional')) {
                        console.log(`  ${path.basename(filePath)}: [NOT FOUND] poster "${posterRef.title}" thumbnail ${posterRef.thumbnail}`);
                        stats.imagesNotFound.push({ poster: filePath, path: posterRef.thumbnail });
                    }
                }
            }
        }

        if (modified) {
            content.dateModified = new Date().toISOString();
            if (!CONFIG.dryRun) {
                fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
            }
            stats.journeysFixed++;
        }

    } catch (e) {
        console.error(`  Error processing journey ${filePath}: ${e.message}`);
        stats.errors++;
    }
}

function main() {
    console.log('='.repeat(60));
    console.log('Fix All Image Paths');
    console.log('='.repeat(60));

    if (CONFIG.dryRun) {
        console.log('\n*** DRY RUN MODE ***\n');
    }

    // Get available images
    const availableImages = getAvailableImages();
    console.log(`Found ${availableImages.size / 2} images in centralized folder\n`);

    // Process all poster directories
    const categories = fs.readdirSync(CONFIG.postersDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !CONFIG.skipDirs.includes(d.name) && d.name !== 'Journeys');

    for (const cat of categories) {
        console.log(`\nProcessing ${cat.name}...`);
        const catPath = path.join(CONFIG.postersDir, cat.name);
        const files = fs.readdirSync(catPath).filter(f => f.endsWith('.json'));

        for (const file of files) {
            processPoster(path.join(catPath, file), availableImages);
        }
    }

    // Process journey files
    console.log('\n\nProcessing Journeys...');
    if (fs.existsSync(CONFIG.journeysDir)) {
        const journeyFiles = fs.readdirSync(CONFIG.journeysDir).filter(f => f.endsWith('.json'));
        for (const file of journeyFiles) {
            processJourney(path.join(CONFIG.journeysDir, file), availableImages);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Posters scanned:  ${stats.postersScanned}`);
    console.log(`Posters fixed:    ${stats.postersFixed}`);
    console.log(`Journeys scanned: ${stats.journeysScanned}`);
    console.log(`Journeys fixed:   ${stats.journeysFixed}`);
    console.log(`Images not found: ${stats.imagesNotFound.length}`);
    console.log(`Errors:           ${stats.errors}`);

    if (stats.imagesNotFound.length > 0) {
        console.log('\nImages not found:');
        stats.imagesNotFound.forEach(item => {
            console.log(`  - ${path.basename(item.poster)}: ${item.path}`);
        });
    }

    if (CONFIG.dryRun) {
        console.log('\n*** This was a DRY RUN. Run without --dry-run to apply changes. ***');
    }
}

main();

