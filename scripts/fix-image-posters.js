#!/usr/bin/env node
/**
 * Fix Image Posters Script
 * 
 * This script:
 * 1. Finds posters with migratedFrom: "image" or "direct-image" that lack back.image.src
 * 2. Searches for matching image files in the poster's directory or images/ subdirectory
 * 3. Moves found images to /images/originals/ with proper naming
 * 4. Updates poster JSON with correct image path and improved title
 * 5. Adds meta.categories based on folder location
 * 
 * Usage: node scripts/fix-image-posters.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    postersDir: path.join(__dirname, '..', 'JSON_Posters'),
    imagesDir: path.join(__dirname, '..', 'images', 'originals'),
    dryRun: process.argv.includes('--dry-run'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    imageExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    skipDirs: ['poster_schemas', 'Journeys']
};

const stats = {
    postersScanned: 0,
    postersFixed: 0,
    imagesFound: 0,
    imagesMoved: 0,
    titlesImproved: 0,
    categoriesAdded: 0,
    orphanImages: [],
    errors: 0
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

/**
 * Improve auto-generated titles like "Top50" -> "Top 50"
 */
function improveTitle(title) {
    if (!title) return 'Untitled';

    return title
        // Add space before capital letters: "RealGDP" -> "Real GDP"
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        // Add space between letters and numbers: "Top50" -> "Top 50"
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')
        // Replace underscores and hyphens with spaces
        .replace(/[_-]/g, ' ')
        // Clean up multiple spaces
        .replace(/\s+/g, ' ')
        // Handle common abbreviations
        .replace(/\bGdp\b/gi, 'GDP')
        .replace(/\bUs\b/g, 'US')
        .replace(/\bAi\b/g, 'AI')
        .replace(/\bApi\b/g, 'API')
        .trim();
}

/**
 * Search for an image file matching the poster
 */
function findMatchingImage(posterPath, posterName, category) {
    const baseName = path.basename(posterName, '.json');
    const categoryDir = path.dirname(posterPath);
    const imagesSubdir = path.join(categoryDir, 'images');

    // Search locations in order of priority
    const searchLocations = [
        categoryDir,                    // Same directory as poster
        imagesSubdir,                   // images/ subdirectory
    ];

    for (const searchDir of searchLocations) {
        if (!fs.existsSync(searchDir)) continue;

        for (const ext of CONFIG.imageExtensions) {
            const imagePath = path.join(searchDir, baseName + ext);
            if (fs.existsSync(imagePath)) {
                log(`  Found image: ${imagePath}`, true);
                return imagePath;
            }
        }
    }

    return null;
}

/**
 * Move image to centralized location
 */
function centralizeImage(imagePath, category) {
    const ext = path.extname(imagePath);
    const baseName = path.basename(imagePath, ext);
    const newName = `${category.toLowerCase()}_${baseName}${ext}`;
    const destPath = path.join(CONFIG.imagesDir, newName);
    const relativePath = `images/originals/${newName}`;

    if (CONFIG.dryRun) {
        log(`  [DRY RUN] Would move: ${imagePath} -> ${destPath}`);
        return relativePath;
    }

    ensureDir(CONFIG.imagesDir);

    // Check if destination already exists
    if (fs.existsSync(destPath)) {
        log(`  Image already centralized: ${relativePath}`, true);
        return relativePath;
    }

    fs.copyFileSync(imagePath, destPath);
    stats.imagesMoved++;
    log(`  Moved image to: ${relativePath}`);

    return relativePath;
}

/**
 * Process a single poster
 */
function processPoster(posterPath, category) {
    stats.postersScanned++;

    try {
        const content = JSON.parse(fs.readFileSync(posterPath, 'utf8'));

        // Skip non-v2 posters
        if (content.version !== 2) return;

        let modified = false;
        const posterName = path.basename(posterPath);

        // Check if this poster needs image fixing
        const needsImage = (
            (content.meta?.migratedFrom === 'image' || content.meta?.migratedFrom === 'direct-image') &&
            !content.back?.image?.src
        );

        if (needsImage) {
            log(`Fixing: ${category}/${posterName}`);

            const imagePath = findMatchingImage(posterPath, posterName, category);
            if (imagePath) {
                stats.imagesFound++;
                const centralPath = centralizeImage(imagePath, category);

                if (!content.back) content.back = {};
                if (!content.back.image) content.back.image = {};

                content.back.image.src = centralPath;
                content.back.image.alt = content.front?.title || '';
                content.back.image.position = content.back.image.position || 'top';

                modified = true;
            } else {
                log(`  Warning: No matching image found for ${posterName}`);
                stats.orphanImages.push(`${category}/${posterName}`);
            }
        }

        // Improve title if it looks auto-generated
        const currentTitle = content.front?.title || '';
        const improvedTitle = improveTitle(currentTitle);
        if (currentTitle !== improvedTitle) {
            log(`  Title: "${currentTitle}" -> "${improvedTitle}"`);
            content.front.title = improvedTitle;

            // Also update image alt if it exists
            if (content.back?.image?.alt === currentTitle) {
                content.back.image.alt = improvedTitle;
            }

            stats.titlesImproved++;
            modified = true;
        }

        // Add categories based on folder location
        if (!content.meta) content.meta = {};
        if (!content.meta.categories || content.meta.categories.length === 0) {
            content.meta.categories = [category];
            stats.categoriesAdded++;
            modified = true;
            log(`  Added category: ${category}`, true);
        }

        // Save if modified
        if (modified) {
            content.meta.modified = new Date().toISOString();

            if (!CONFIG.dryRun) {
                fs.writeFileSync(posterPath, JSON.stringify(content, null, 2));
            }
            stats.postersFixed++;
        }

    } catch (error) {
        log(`  Error processing ${posterPath}: ${error.message}`);
        stats.errors++;
    }
}

/**
 * Find and centralize orphan images (images without poster JSONs)
 */
function findOrphanImages(categoryPath, category) {
    const files = fs.readdirSync(categoryPath);

    for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file === 'images') {
                // Check images subdirectory
                findOrphanImages(filePath, category);
            }
            continue;
        }

        const ext = path.extname(file).toLowerCase();
        if (!CONFIG.imageExtensions.includes(ext)) continue;

        // Check if there's a corresponding JSON
        const baseName = path.basename(file, ext);
        const jsonPath = path.join(path.dirname(filePath), baseName + '.json');
        const parentJsonPath = path.join(categoryPath, baseName + '.json');

        // Check if any poster references this image
        let isReferenced = false;
        const postersDir = categoryPath.endsWith('images')
            ? path.dirname(categoryPath)
            : categoryPath;

        const posterFiles = fs.readdirSync(postersDir).filter(f => f.endsWith('.json'));
        for (const pf of posterFiles) {
            try {
                const poster = JSON.parse(fs.readFileSync(path.join(postersDir, pf), 'utf8'));
                if (poster.back?.image?.src?.includes(baseName)) {
                    isReferenced = true;
                    break;
                }
            } catch (e) { }
        }

        if (!isReferenced) {
            // This image has no poster - centralize it anyway
            log(`Orphan image: ${category}/${file}`);
            centralizeImage(filePath, category);
        }
    }
}

/**
 * Main function
 */
function main() {
    console.log('='.repeat(60));
    console.log('Fix Image Posters & Centralize Images');
    console.log('='.repeat(60));

    if (CONFIG.dryRun) {
        console.log('\n*** DRY RUN MODE - No files will be modified ***\n');
    }

    ensureDir(CONFIG.imagesDir);

    // Get all category directories
    const categories = fs.readdirSync(CONFIG.postersDir)
        .filter(name => {
            const fullPath = path.join(CONFIG.postersDir, name);
            return fs.statSync(fullPath).isDirectory() && !CONFIG.skipDirs.includes(name);
        });

    console.log(`Processing ${categories.length} categories...\n`);

    // Process each category
    for (const category of categories) {
        const categoryPath = path.join(CONFIG.postersDir, category);
        log(`\nCategory: ${category}`);

        const files = fs.readdirSync(categoryPath);

        // Process poster JSONs
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            const posterPath = path.join(categoryPath, file);
            processPoster(posterPath, category);
        }

        // Find and centralize orphan images
        findOrphanImages(categoryPath, category);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary');
    console.log('='.repeat(60));
    console.log(`Posters scanned:     ${stats.postersScanned}`);
    console.log(`Posters fixed:       ${stats.postersFixed}`);
    console.log(`Images found:        ${stats.imagesFound}`);
    console.log(`Images centralized:  ${stats.imagesMoved}`);
    console.log(`Titles improved:     ${stats.titlesImproved}`);
    console.log(`Categories added:    ${stats.categoriesAdded}`);
    console.log(`Errors:              ${stats.errors}`);

    if (stats.orphanImages.length > 0) {
        console.log(`\nPosters without matching images:`);
        stats.orphanImages.forEach(p => console.log(`  - ${p}`));
    }

    if (CONFIG.dryRun) {
        console.log('\n*** This was a DRY RUN. Run without --dry-run to apply changes. ***');
    }
}

main();
