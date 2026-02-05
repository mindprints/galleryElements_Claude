#!/usr/bin/env node
/**
 * Migration Script: Convert v1 posters to v2 unified format
 * 
 * This script:
 * 1. Scans all JSON_Posters directories for poster files
 * 2. Identifies poster type (json/text, website, image, direct-image)
 * 3. Converts each to the unified v2 format
 * 4. Moves images to centralized /images/ directory
 * 5. Creates backups before modifying
 * 
 * Usage: node scripts/migrate-to-v2.js [--dry-run] [--backup-dir <path>]
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    postersDir: path.join(__dirname, '..', 'JSON_Posters'),
    imagesDir: path.join(__dirname, '..', 'images'),
    backupDir: path.join(__dirname, '..', 'backups', `migration-${Date.now()}`),
    dryRun: process.argv.includes('--dry-run'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    // Directories to skip (not poster categories)
    skipDirs: ['poster_schemas', 'Journeys'],
    // Image extensions to detect direct images
    imageExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
};

// Stats tracking
const stats = {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    imagesMoved: 0,
    byType: {
        json: 0,
        website: 0,
        image: 0,
        'direct-image': 0,
        'already-v2': 0
    }
};

/**
 * Log message with optional verbose-only flag
 */
function log(message, verboseOnly = false) {
    if (!verboseOnly || CONFIG.verbose) {
        console.log(message);
    }
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Generate a unique image filename for centralized storage
 */
function generateCentralImagePath(originalPath, category) {
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    // Prefix with category to avoid name collisions
    const newName = `${category.toLowerCase()}_${baseName}${ext}`;
    return path.join(CONFIG.imagesDir, 'originals', newName);
}

/**
 * Move or copy image to centralized location
 */
function centralizeImage(sourcePath, category) {
    if (!fs.existsSync(sourcePath)) {
        log(`  Warning: Image not found: ${sourcePath}`, true);
        return null;
    }

    const centralPath = generateCentralImagePath(sourcePath, category);
    // Always use forward slashes for web paths
    const relativePath = path.relative(path.join(__dirname, '..'), centralPath).replace(/\\/g, '/');

    if (CONFIG.dryRun) {
        log(`  [DRY RUN] Would move: ${sourcePath} -> ${centralPath}`, true);
        return relativePath;
    }

    ensureDir(path.dirname(centralPath));

    // Copy (not move) to preserve originals during testing
    fs.copyFileSync(sourcePath, centralPath);
    stats.imagesMoved++;
    log(`  Centralized image: ${relativePath}`, true);

    return relativePath;
}

/**
 * Detect v1 poster type from content
 */
function detectPosterType(content, filePath) {
    // Already v2
    if (content.version === 2) {
        return 'already-v2';
    }

    // Explicit type field
    if (content.type === 'website') {
        return 'website';
    }
    if (content.type === 'image') {
        return 'image';
    }

    // JSON/text poster (has figure field, legacy format)
    if (content.figure !== undefined || content.header !== undefined) {
        return 'json';
    }

    return 'unknown';
}

/**
 * Convert v1 JSON/text poster to v2
 */
function migrateJsonPoster(content, category) {
    const v2 = {
        version: 2,
        uid: content.uid || `poster-${Date.now()}`,
        front: {
            title: content.figure || 'Untitled'
        },
        back: {
            layout: 'auto'
        },
        meta: {
            modified: new Date().toISOString(),
            migratedFrom: 'json'
        }
    };

    // Migrate chronology
    if (content.chronology) {
        v2.front.chronology = {
            epochStart: content.chronology.epochStart ?? null,
            epochEnd: content.chronology.epochEnd ?? null,
            epochEvents: content.chronology.epochEvents || []
        };
    }

    // Migrate header to back text
    if (content.header) {
        v2.back.text = content.header;
    }

    // Migrate thumbnail if present
    if (content.thumbnail) {
        const centralPath = centralizeImage(
            path.join(CONFIG.postersDir, category, content.thumbnail),
            category
        );
        if (centralPath) {
            v2.front.thumbnail = centralPath;
        }
    }

    return v2;
}

/**
 * Convert v1 website poster to v2
 */
function migrateWebsitePoster(content, category) {
    const v2 = {
        version: 2,
        uid: content.uid || `poster-${Date.now()}`,
        front: {
            title: content.title || 'Website'
        },
        back: {
            layout: 'auto',
            links: [{
                type: 'external',
                url: content.url,
                label: 'Open Website',
                primary: true
            }]
        },
        meta: {
            modified: new Date().toISOString(),
            migratedFrom: 'website'
        }
    };

    // Migrate description to back text
    if (content.description) {
        v2.back.text = content.description;
    }

    // Migrate thumbnail if present
    if (content.thumbnail) {
        const thumbPath = content.thumbnail.startsWith('http')
            ? content.thumbnail  // Keep external URLs as-is
            : centralizeImage(
                path.join(CONFIG.postersDir, category, content.thumbnail),
                category
            );
        if (thumbPath) {
            v2.front.thumbnail = thumbPath;
        }
    }

    return v2;
}

/**
 * Convert v1 image wrapper poster to v2
 */
function migrateImagePoster(content, category) {
    const v2 = {
        version: 2,
        uid: content.uid || `poster-${Date.now()}`,
        front: {
            title: content.title || 'Image'
        },
        back: {
            layout: 'image-top'
        },
        meta: {
            modified: new Date().toISOString(),
            migratedFrom: 'image'
        }
    };

    // Migrate image to back
    if (content.imagePath) {
        const imagePath = content.imagePath.startsWith('images/')
            ? path.join(CONFIG.postersDir, category, content.imagePath)
            : path.join(CONFIG.postersDir, category, 'images', content.imagePath);

        const centralPath = centralizeImage(imagePath, category);
        if (centralPath) {
            v2.back.image = {
                src: centralPath,
                alt: content.alt || content.title || 'Image',
                position: 'top'
            };
        }
    }

    // Migrate description
    if (content.description) {
        v2.back.text = content.description;
    }

    // Migrate annotations as text if present
    if (content.annotations && content.annotations.length > 0) {
        const annotationText = content.annotations
            .map(a => `- ${a.text || a}`)
            .join('\n');
        v2.back.text = (v2.back.text ? v2.back.text + '\n\n' : '') + '**Notes:**\n' + annotationText;
    }

    return v2;
}

/**
 * Convert direct image file to v2 poster
 */
function migrateDirectImage(filePath, category) {
    const filename = path.basename(filePath);
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const title = baseName.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const centralPath = centralizeImage(filePath, category);

    const v2 = {
        version: 2,
        uid: `poster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        front: {
            title: title
        },
        back: {
            layout: 'image-top',
            image: centralPath ? {
                src: centralPath,
                alt: title,
                position: 'top'
            } : undefined
        },
        meta: {
            modified: new Date().toISOString(),
            migratedFrom: 'direct-image'
        }
    };

    return v2;
}

/**
 * Migrate a single poster file
 */
function migratePoster(filePath, category) {
    stats.scanned++;
    const ext = path.extname(filePath).toLowerCase();
    const filename = path.basename(filePath);

    log(`Processing: ${category}/${filename}`, true);

    try {
        // Handle direct image files
        if (CONFIG.imageExtensions.includes(ext)) {
            const v2 = migrateDirectImage(filePath, category);

            // Create new JSON file for the image
            const newJsonPath = filePath.replace(ext, '.json');

            if (CONFIG.dryRun) {
                log(`  [DRY RUN] Would create: ${newJsonPath}`);
                stats.byType['direct-image']++;
                stats.migrated++;
                return true;
            }

            fs.writeFileSync(newJsonPath, JSON.stringify(v2, null, 2));
            // Optionally remove original image after migration (keeping for now)
            // fs.unlinkSync(filePath);

            stats.byType['direct-image']++;
            stats.migrated++;
            log(`  Migrated direct image -> ${path.basename(newJsonPath)}`);
            return true;
        }

        // Handle JSON files
        if (ext !== '.json') {
            log(`  Skipped: not a JSON or image file`, true);
            stats.skipped++;
            return false;
        }

        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const posterType = detectPosterType(content, filePath);

        if (posterType === 'already-v2') {
            log(`  Already v2, skipping`, true);
            stats.byType['already-v2']++;
            stats.skipped++;
            return false;
        }

        if (posterType === 'unknown') {
            log(`  Warning: Unknown poster type, skipping`, true);
            stats.skipped++;
            return false;
        }

        // Migrate based on type
        let v2;
        switch (posterType) {
            case 'json':
                v2 = migrateJsonPoster(content, category);
                break;
            case 'website':
                v2 = migrateWebsitePoster(content, category);
                break;
            case 'image':
                v2 = migrateImagePoster(content, category);
                break;
            default:
                log(`  Error: Unhandled poster type: ${posterType}`);
                stats.errors++;
                return false;
        }

        if (CONFIG.dryRun) {
            log(`  [DRY RUN] Would migrate ${posterType} poster`);
            log(`  Preview: ${JSON.stringify(v2.front, null, 2)}`, true);
            stats.byType[posterType]++;
            stats.migrated++;
            return true;
        }

        // Backup original
        const backupPath = path.join(CONFIG.backupDir, category, filename);
        ensureDir(path.dirname(backupPath));
        fs.copyFileSync(filePath, backupPath);

        // Write migrated version
        fs.writeFileSync(filePath, JSON.stringify(v2, null, 2));

        stats.byType[posterType]++;
        stats.migrated++;
        log(`  Migrated: ${posterType} -> v2`);
        return true;

    } catch (error) {
        log(`  Error: ${error.message}`);
        stats.errors++;
        return false;
    }
}

/**
 * Process a category directory
 */
function processCategory(categoryPath, categoryName) {
    log(`\nCategory: ${categoryName}`);

    const files = fs.readdirSync(categoryPath);

    for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const stat = fs.statSync(filePath);

        // Skip subdirectories (like 'images' folders - we'll handle those via the wrapper JSONs)
        if (stat.isDirectory()) {
            // But DO process direct images in the images subdirectory
            if (file === 'images') {
                const imageFiles = fs.readdirSync(filePath);
                for (const imgFile of imageFiles) {
                    const imgPath = path.join(filePath, imgFile);
                    const imgStat = fs.statSync(imgPath);
                    if (!imgStat.isDirectory()) {
                        // Only migrate direct images that don't have a corresponding JSON wrapper
                        const parentDir = categoryPath;
                        const possibleWrapper = path.join(parentDir, imgFile.replace(path.extname(imgFile), '.json'));
                        if (!fs.existsSync(possibleWrapper)) {
                            // Check in the category for a wrapper that references this image
                            // For now, just centralize the image but don't create a poster for it
                            // These are usually referenced by JSON wrappers
                            log(`  [Image in subdir] ${imgFile} - will be centralized when referenced`, true);
                        }
                    }
                }
            }
            continue;
        }

        migratePoster(filePath, categoryName);
    }
}

/**
 * Main migration function
 */
function main() {
    console.log('='.repeat(60));
    console.log('Poster Migration: v1 -> v2 Unified Format');
    console.log('='.repeat(60));

    if (CONFIG.dryRun) {
        console.log('\n*** DRY RUN MODE - No files will be modified ***\n');
    }

    // Ensure directories exist
    ensureDir(CONFIG.imagesDir);
    ensureDir(path.join(CONFIG.imagesDir, 'originals'));
    ensureDir(path.join(CONFIG.imagesDir, 'thumbnails'));

    if (!CONFIG.dryRun) {
        ensureDir(CONFIG.backupDir);
        console.log(`Backups will be saved to: ${CONFIG.backupDir}\n`);
    }

    // Get all category directories
    const categories = fs.readdirSync(CONFIG.postersDir)
        .filter(name => {
            const fullPath = path.join(CONFIG.postersDir, name);
            return fs.statSync(fullPath).isDirectory() && !CONFIG.skipDirs.includes(name);
        });

    console.log(`Found ${categories.length} categories to process:`);
    console.log(categories.map(c => `  - ${c}`).join('\n'));

    // Process each category
    for (const category of categories) {
        const categoryPath = path.join(CONFIG.postersDir, category);
        processCategory(categoryPath, category);
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary');
    console.log('='.repeat(60));
    console.log(`Files scanned:    ${stats.scanned}`);
    console.log(`Files migrated:   ${stats.migrated}`);
    console.log(`Files skipped:    ${stats.skipped}`);
    console.log(`Errors:           ${stats.errors}`);
    console.log(`Images centralized: ${stats.imagesMoved}`);
    console.log('\nBy original type:');
    console.log(`  JSON/Text:      ${stats.byType.json}`);
    console.log(`  Website:        ${stats.byType.website}`);
    console.log(`  Image wrapper:  ${stats.byType.image}`);
    console.log(`  Direct image:   ${stats.byType['direct-image']}`);
    console.log(`  Already v2:     ${stats.byType['already-v2']}`);

    if (CONFIG.dryRun) {
        console.log('\n*** This was a DRY RUN. Run without --dry-run to apply changes. ***');
    } else {
        console.log(`\nBackup location: ${CONFIG.backupDir}`);
    }
}

// Run migration
main();
