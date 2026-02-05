# Unified Poster System - Implementation Plan

**Created:** 2026-02-05  
**Status:** Planning  
**Goal:** Consolidate three poster types into one unified system with a single editor

---

## Design Decisions (Confirmed)

| Decision | Choice |
|----------|--------|
| Categories | Dynamic (directories in JSON_Posters), support creation |
| Image Storage | Centralize to `/images/` at project root for reuse |
| Markdown Support | Yes, for back-side text |
| Link Behavior | Always new window |
| Future Links | Internal (to other posters), files, desktop apps |
| Migration | All at once |

---

## Unified Poster Schema v2

```json
{
  "version": 2,
  "uid": "poster-{timestamp}",
  
  "front": {
    "title": "Required - Main poster title",
    "subtitle": "Optional - Secondary line",
    "chronology": {
      "epochStart": 2020,
      "epochEnd": null,
      "epochEvents": [
        { "year": 2023, "name": "Milestone description" }
      ]
    }
  },
  
  "back": {
    "layout": "auto",
    "text": "Markdown-supported text content.\n\n**Bold** and *italic* work.\n\n- Lists too",
    "image": {
      "src": "images/example.jpg",
      "alt": "Image description",
      "position": "top"
    },
    "links": [
      {
        "type": "external",
        "url": "https://example.com",
        "label": "Visit Website",
        "primary": true
      },
      {
        "type": "internal",
        "target": "poster:Pioneers/Alan_Turing.json",
        "label": "Related: Alan Turing"
      },
      {
        "type": "file",
        "path": "C:/Users/docs/report.pdf",
        "label": "Open Report"
      },
      {
        "type": "app",
        "command": "code",
        "args": ["--new-window"],
        "label": "Open VS Code"
      }
    ]
  },
  
  "meta": {
    "created": "2026-02-05T12:00:00Z",
    "modified": "2026-02-05T12:00:00Z",
    "tags": ["ai", "history"]
  }
}
```

### Schema Notes

- **`version`**: Enables backward compatibility detection
- **`front.chronology`**: Same structure as current, proven to work well
- **`back.layout`**: `"auto"` | `"image-top"` | `"image-left"` | `"image-right"` | `"text-only"`
- **`back.links[].type`**: 
  - `"external"` - Opens URL in new window
  - `"internal"` - Navigates to another poster (format: `poster:Category/Filename.json`)
  - `"file"` - Opens local file with system default app
  - `"app"` - Launches application with optional arguments
- **`meta`**: Optional metadata for future features (search, filtering)

---

## Phase 1: Foundation ✅ COMPLETE

### 1.1 Create Schema Definition
- [x] Create `JSON_Posters/poster_schemas/poster_v2.schema.json` (JSON Schema for validation)
- [x] Document all fields and constraints

### 1.2 Centralize Images
- [x] Create `/images/` directory at project root
- [x] Create `/images/thumbnails/` for auto-generated thumbnails
- [ ] Update `.gitignore` if needed
- [x] Add image serving route to `server.js` (images served as static files)

### 1.3 Migration Script
Create `scripts/migrate-to-v2.js` that:
- [x] Scans all `JSON_Posters/*/` directories
- [x] Identifies poster type by current structure:
  - Has `type: "website"` → website poster
  - Has `type: "image"` → image poster  
  - Has `figure` field → JSON/text poster
- [x] Transforms each to v2 format
- [x] Moves images from `JSON_Posters/*/images/` to centralized `/images/`
- [x] Updates image paths in converted posters
- [x] Creates backup before migration
- [x] Outputs migration report

**Migration Results (2026-02-05):**
- 127 files migrated successfully
- 73 JSON/Text, 28 Website, 15 Image wrapper, 11 Direct image
- 20 images centralized to `/images/originals/`
- Backups saved to `/backups/migration-1770319435886/`

### 1.4 Backward-Compatible Loader
Update `loadPosters.js`:
- [x] Detect `version` field (in server.js)
- [x] Route to v1 renderer (existing) or v2 renderer (new)
- [x] Add `poster-v2` type handling
- [x] Add CSS for v2 back-side layouts

**Deliverables:** Schema file, migration script, updated loader, v2 CSS

---

## Phase 2: Unified Front-Side Rendering ✅ COMPLETE

### 2.1 Front-Side HTML Structure
```html
<article data-category="pioneers" data-poster-id="poster-xxx">
  <header><!-- Back side content --></header>
  <figure>
    <div class="poster-front">
      <div class="poster-title">Alan Turing</div>
      <div class="poster-subtitle">Father of Computer Science</div>
      <div class="chronology-display">
        <div class="timeline-dates">
          <span class="timeline-span">1912 — 1954</span>
        </div>
        <div class="timeline-events">
          <div class="event"><span class="year">1936</span>: Turing Machine</div>
          <div class="event"><span class="year">1950</span>: Turing Test</div>
        </div>
      </div>
      <img class="poster-thumbnail" src="images/thumbnails/turing.jpg" alt="">
    </div>
  </figure>
</article>
```

### 2.2 Category Theming
```css
/* Category accent colors - auto-generated from directory names */
article[data-category="pioneers"] { --accent-color: #FFD700; --accent-bg: #FFF8DC; }
article[data-category="tools"] { --accent-color: #4A90E2; --accent-bg: #E8F4FD; }
article[data-category="philosophers"] { --accent-color: #9B59B6; --accent-bg: #F5EEF8; }
/* ... generated dynamically or via CSS variables */
```

### 2.3 Tasks
- [x] Create `css/poster-v2.css` with base styles (includes category theming)
- [x] Create v2 front-side renderer in `loadPosters.js`
- [x] Apply category-based accent colors via CSS custom properties
- [x] Handle subtitle and chronology display
- [x] Ensure responsive sizing

**Deliverables:** `css/poster-v2.css`, updated `loadPosters.js`

---

## Phase 3: Flexible Back-Side Rendering ✅ COMPLETE

### 3.1 Layout System

**Layout: `image-top`**
```
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │      IMAGE (40%)    │ │
│ └─────────────────────┘ │
│                         │
│ Text content (45%)      │
│ Markdown rendered...    │
│                         │
│ [🔗 Link] [🔗 Link]     │  ← Links footer (15%)
└─────────────────────────┘
```

**Layout: `image-left`**
```
┌─────────────────────────┐
│ ┌──────┐ Text content   │
│ │ IMG  │ flows around   │  ← 40/60 split
│ │ 40%  │ the image...   │
│ └──────┘                │
│ [🔗 Link] [🔗 Link]     │
└─────────────────────────┘
```

**Layout: `text-only`**
```
┌─────────────────────────┐
│                         │
│ Full text area (85%)    │
│ More room for longer    │
│ content when no image.  │
│                         │
│ [🔗 Link] [🔗 Link]     │
└─────────────────────────┘
```

**Layout: `auto`** (Smart detection)
- Has image + text → `image-top`
- Has image only → centered image with links
- Has text only → `text-only`
- Has links only → centered links

### 3.2 Markdown Rendering
Use a lightweight markdown parser:
- **Option A:** `marked` (full-featured, ~30KB)
- **Option B:** `snarkdown` (minimal, ~1KB, covers basics)
- **Recommendation:** `snarkdown` for simplicity, upgrade later if needed

Supported syntax:
- `**bold**`, `*italic*`
- `- list items`
- `[links](url)` (converted to our link handler)
- `## headings`

### 3.3 Link Rendering
```html
<div class="poster-links">
  <a class="poster-link primary" onclick="openExternal('https://...')">
    <i class="fas fa-external-link-alt"></i> Visit Website
  </a>
  <a class="poster-link" onclick="navigateToPoster('Pioneers/Alan_Turing.json')">
    <i class="fas fa-link"></i> Related: Alan Turing
  </a>
  <a class="poster-link" onclick="openFile('C:/...')">
    <i class="fas fa-file"></i> Open Report
  </a>
</div>
```

### 3.4 Tasks
- [x] Create `css/poster-v2.css` with layout variants (image-top, image-left, image-right, text-only)
- [x] Implement v2 back-side renderer in `loadPosters.js`
- [x] Add `snarkdown` for markdown parsing (`js/lib/snarkdown.min.js`)
- [x] Create link handler functions in `script.js`:
  - [x] External links - new window via onclick
  - [x] `navigateToPoster(path)` - scroll/highlight in gallery
  - [x] `openLocalFile(path)` - stub for server-side support
  - [x] `launchApp(command, args)` - stub for server-side support
- [x] Implement layout auto-detection
- [x] Add highlight flash animation for navigation

**Deliverables:** `css/poster-v2.css`, updated `loadPosters.js`, `js/lib/snarkdown.min.js`, navigation utilities in `script.js`

---

## Phase 4: Unified Editor

### 4.1 Editor Interface Structure

```
┌─────────────────────────────────────────────────────────────┐
│  📝 Poster Editor                    [Preview] [Save] [New] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────────────────────────┐ │
│ │ POSTER LIST     │ │ EDITOR FORM                         │ │
│ │                 │ │                                     │ │
│ │ Category: [▼]   │ │ ═══ FRONT SIDE ═══════════════════ │ │
│ │                 │ │ Title*:     [_____________________] │ │
│ │ • Alan Turing   │ │ Subtitle:   [_____________________] │ │
│ │ • Ada Lovelace  │ │                                     │ │
│ │ • Charles Babbe │ │ ┌─ Chronology ───────────────────┐  │ │
│ │                 │ │ │ Start: [____] End: [____]      │  │ │
│ │ [+ New Poster]  │ │ │ Events:                        │  │ │
│ │                 │ │ │  [1936] [Turing Machine    ] ✕ │  │ │
│ │                 │ │ │  [1950] [Turing Test       ] ✕ │  │ │
│ │                 │ │ │  [+ Add Event]                 │  │ │
│ │                 │ │ └────────────────────────────────┘  │ │
│ │                 │ │                                     │ │
│ │                 │ │ ═══ BACK SIDE ════════════════════ │ │
│ │                 │ │ Layout: [▼ Auto]                    │ │
│ │                 │ │                                     │ │
│ │                 │ │ ┌─ Text (Markdown) ──────────────┐  │ │
│ │                 │ │ │ Alan Turing was a British      │  │ │
│ │                 │ │ │ mathematician and **pioneer**  │  │ │
│ │                 │ │ │ of computer science...         │  │ │
│ │                 │ │ └────────────────────────────────┘  │ │
│ │                 │ │                                     │ │
│ │                 │ │ ┌─ Image ────────────────────────┐  │ │
│ │                 │ │ │ [📷 Choose] [🗑️ Remove]         │  │ │
│ │                 │ │ │ Position: [▼ Top]              │  │ │
│ │                 │ │ │ ┌──────────┐                   │  │ │
│ │                 │ │ │ │ preview  │                   │  │ │
│ │                 │ │ │ └──────────┘                   │  │ │
│ │                 │ │ └────────────────────────────────┘  │ │
│ │                 │ │                                     │ │
│ │                 │ │ ┌─ Links ────────────────────────┐  │ │
│ │                 │ │ │ [+ Add Link]                   │  │ │
│ │                 │ │ │ 🌐 https://wiki... [Edit] [✕]  │  │ │
│ │                 │ │ │ 📌 poster:Pioneers/... [✕]    │  │ │
│ │                 │ │ └────────────────────────────────┘  │ │
│ │                 │ │                                     │ │
│ └─────────────────┘ └─────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ ═══ LIVE PREVIEW ══════════════════════════════════════════ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │         [Interactive 3D flip preview of poster]         │ │
│ │              Click to flip front/back                   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Image Picker Modal
```
┌───────────────────────────────────────────────────┐
│  📷 Choose Image                              [✕] │
├───────────────────────────────────────────────────┤
│ [🔍 Search...                                   ] │
│                                                   │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│ │     │ │     │ │     │ │     │ │     │ │     │ │
│ │ img1│ │ img2│ │ img3│ │ img4│ │ img5│ │ img6│ │
│ │     │ │     │ │     │ │     │ │     │ │     │ │
│ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ │
│                                                   │
│ ─────────────── OR ─────────────────────────────  │
│                                                   │
│ [📤 Upload New Image]  Drag & drop here           │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 4.3 Link Editor Modal
```
┌───────────────────────────────────────────────────┐
│  🔗 Add/Edit Link                             [✕] │
├───────────────────────────────────────────────────┤
│ Type: (●) External URL  ( ) Internal Poster       │
│       ( ) Local File    ( ) Application           │
│                                                   │
│ ┌─ External URL ─────────────────────────────────┐│
│ │ URL:   [https://en.wikipedia.org/wiki/...   ]  ││
│ │ Label: [Wikipedia Article                   ]  ││
│ │ ☑ Primary link (styled prominently)            ││
│ └────────────────────────────────────────────────┘│
│                                                   │
│                          [Cancel] [Save Link]     │
└───────────────────────────────────────────────────┘
```

### 4.4 Tasks
- [x] Create `unified-editor.html` with responsive 3-column layout
- [x] Create `js/unified-editor.js` with:
  - [x] Category/directory management 
  - [x] Poster CRUD operations
  - [x] Form state management
  - [x] Live preview updates
- [x] Implement image picker modal
- [x] Implement link editor inline
- [x] Add markdown preview in text area (using snarkdown)
- [ ] Deprecate old editors (redirect with message)

**Deliverables:** New unified editor, supporting modals, CSS

---

## Phase 5: Image Management

### 5.1 Centralized Image Storage
```
/images/
├── originals/          # Full-size uploaded images
│   ├── turing.jpg
│   └── lovelace.png
├── thumbnails/         # Auto-generated thumbnails (200x200)
│   ├── turing.jpg
│   └── lovelace.png
└── index.json          # Image metadata (optional)
```

### 5.2 Server Routes
- `GET /api/images` - List all images with metadata
- `POST /api/images/upload` - Upload new image, auto-generate thumbnail
- `DELETE /api/images/:filename` - Delete image (if not in use)
- `GET /api/images/usage/:filename` - Check which posters use this image

### 5.3 Tasks
- [ ] Create centralized image directory structure
- [ ] Add image upload route with:
  - [ ] File validation (type, size)
  - [ ] Automatic thumbnail generation (use `sharp` npm package)
  - [ ] Unique filename handling
- [ ] Add image listing route
- [ ] Add usage checking route
- [ ] Update migration script to move images

**Deliverables:** Image API routes, thumbnail generation

---

## Phase 6: Cleanup & Polish

### 6.1 Deprecation
- [ ] Add redirect from `editor.html` → `poster-editor.html`
- [ ] Add redirect from `website-editor.html` → `poster-editor.html`
- [ ] Add redirect from `image-editor.html` → `poster-editor.html`
- [ ] Update navigation links
- [ ] Remove old editor files after transition period

### 6.2 Documentation
- [ ] Update README.md with new poster format
- [ ] Document link types and their usage
- [ ] Add migration guide for manual edits

### 6.3 Testing
- [ ] Test all poster types render correctly
- [ ] Test all link types work
- [ ] Test editor create/edit/delete flow
- [ ] Test image upload and selection
- [ ] Test category creation

**Deliverables:** Clean codebase, documentation

---

## File Changes Summary

### New Files
```
/images/                           # Centralized image storage
/images/thumbnails/                # Auto-generated
JSON_Posters/poster_schemas/poster_v2.schema.json
scripts/migrate-to-v2.js
css/poster-unified.css
css/poster-back.css
css/poster-editor.css
js/poster-editor.js
js/lib/snarkdown.min.js           # Markdown parser
poster-editor.html
```

### Modified Files
```
server.js                          # New image routes, v2 API
js/loadPosters.js                  # v2 rendering
index.html                         # Update nav links
```

### Deprecated Files (Phase 6)
```
js/editor.js                       # → poster-editor.js
js/website-editor.js               # → poster-editor.js  
js/image-editor.js                 # → poster-editor.js
editor.html                        # → poster-editor.html
website-editor.html                # → poster-editor.html
image-editor.html                  # → poster-editor.html
css/website-posters.css            # → poster-unified.css
```

---

## Next Steps

**Ready to begin Phase 1:**
1. Create `poster_v2.schema.json`
2. Create centralized `/images/` structure
3. Write migration script
4. Update `loadPosters.js` for v2 detection

Shall I proceed?
