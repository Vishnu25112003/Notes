NOTE: mostily i will use this application on both mobile and desktop 50/50 . so make it perfect format.

# 📘 Notes App — Detailed Implementation Plan

> **Status:** Planning locked. Build NOT started — awaiting explicit go-ahead per phase.
> **Project name:** _TBD (you decide)_
> **Type:** Personal, single-user notes app. No login. Online-first (offline deferred).
> **Last updated:** Planning phase.

---

## 0. Document Purpose

This is the single source of truth for building the app. Every locked decision, the data model, API contracts, folder structure, integration details, and the phase-by-phase build order live here. Build only after explicit approval, one phase at a time.

> **Workflow rule (all Dev4 projects):** The stated flow is the source of truth. No silent changes — any suggestion is proposed first, and the flow/doc is updated only after explicit approval.

---

## 1. Concept

A personal notes app with **two modes**, chosen from a home screen:

- **Simple Mode** — quick, basic notes. Fast jot-down + store.
- **Section Mode** — a nested knowledge workspace. Tree-structured pages (unlimited depth) with a rich block editor, image uploads, and an editable drawing/handwriting canvas.

### Section Mode mental model (the Blockchain example)
- Create a **Section** → `Blockchain`
- Inside it → many **topics**, each topic is a **page**
- A page holds **content blocks** (title, headings, paragraphs, images, drawings)
- A page can hold **sub-pages**, those can hold more pages → **unlimited tree**
- Example: `Blockchain` → page `Consensus` → sub-page `PoW` → sub-page `Mining` → …

---

## 2. Locked Decisions

| # | Decision | Choice | Notes |
|---|----------|--------|-------|
| 1 | Drawing storage | **Editable strokes (JSON) + PNG export** | Reopen & keep editing; export image when needed |
| 2 | Image / export storage | **Cloudinary** | Only the URL is stored in the note |
| 3 | Users / auth | **Personal only, no login** | No auth layer |
| 4 | Offline support | **Online first, offline later (Phase 10)** | Data model kept sync-friendly |
| 5 | Tree depth | **Unlimited** | Parent-reference model |
| 6 | Simple vs Section | **Same backend + DB**, two entry points | Home screen has two buttons |
| 7 | Search | **Yes, from the start** | DB designed/indexed for it |
| 8 | Content editor | **TipTap** | Block-based, custom blocks |
| 9 | Drawing canvas | **Excalidraw** | Embedded as a TipTap block |
| 10 | Handwriting | **Saved as editable drawing (no OCR)** | Free, fully editable |

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite + Tailwind CSS |
| Routing | React Router |
| Editor | TipTap (ProseMirror-based) |
| Drawing | Excalidraw |
| State/data fetching | React hooks + lightweight fetch layer (axios or fetch) |
| Backend | Node.js + Express |
| Database | MongoDB (Mongoose ODM) |
| File storage | Cloudinary |
| Real-time | **None** (no Socket.IO needed) |

---

## 4. Cost & Free-Tier Breakdown

**The entire app builds and runs at ₹0 / $0. No payment, no credit card.**

| Component | Free? | Detail / Limit |
|-----------|-------|----------------|
| React, Vite, Tailwind, Node, Express | ✅ Free forever | Open source |
| Excalidraw | ✅ Free forever | MIT open source |
| TipTap | ✅ Free for us | Core editor is MIT open source. Paid plans ($49+/mo) are ONLY for Cloud Platform (collaboration, comments, AI, hosting) — we use none of it |
| MongoDB Atlas (M0) | ✅ Free forever | 512 MB storage, shared RAM, no card. Plenty for text notes |
| Cloudinary | ✅ Free tier | 25 credits/month (~25 GB storage/bandwidth), no card |

### Honest limits (won't hit for personal use)
- **Cloudinary:** On the free fixed tier, exceeding quota **suspends** the account rather than billing. One personal user with images/drawings stays far under 25 GB.
- **MongoDB M0:** 512 MB. Text is tiny; images live on Cloudinary not in DB, so the DB stays small.
- **Hosting (later):** Running locally is free. Deploying online uses free tiers (Render/Railway for backend, Vercel/Netlify for frontend) with their own limits. Not a concern until a deploy phase.

---

## 5. Data Model (MongoDB / Mongoose)

Unlimited nesting uses the **parent-reference model** — each page stores its `parentId`. No deep document nesting → never hits the 16 MB document limit, scales cleanly, and is easy to query.

### 5.1 Collection: `simpleNotes`
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `title` | String | Note title |
| `content` | Object (JSON) | TipTap document JSON |
| `searchText` | String | Flattened plain text (regenerated on save) for search |
| `createdAt` | Date | Auto |
| `updatedAt` | Date | Auto |

### 5.2 Collection: `sections`
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `title` | String | e.g. "Blockchain" |
| `createdAt` | Date | Auto |
| `updatedAt` | Date | Auto |

### 5.3 Collection: `pages` (the unlimited tree)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `sectionId` | ObjectId → sections | Which section it belongs to |
| `parentId` | ObjectId → pages \| null | `null` = top-level page in section; else parent page |
| `title` | String | Editable page title |
| `content` | Object (JSON) | TipTap document JSON (text, headings, image blocks, drawing refs) |
| `order` | Number | Sibling ordering within same parent |
| `searchText` | String | Flattened plain text for search |
| `createdAt` | Date | Auto |
| `updatedAt` | Date | Auto |

### 5.4 Collection: `drawings` (Excalidraw scenes, kept separate to keep pages light)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | PK |
| `pageId` | ObjectId → pages \| null | Owner page (or note) |
| `sceneData` | Object (JSON) | Excalidraw elements + appState — editable, reopenable |
| `exportUrl` | String | Cloudinary PNG export URL (optional) |
| `createdAt` | Date | Auto |
| `updatedAt` | Date | Auto |

> Inside a page's TipTap content, a drawing block stores only a reference: `{ type: "drawing", drawingId: "<id>" }`. This keeps page documents small and fast.

### 5.5 Images
Stored on **Cloudinary**. The TipTap image node holds the **secure URL**. (Optional future `assets` collection to track uploads for orphan cleanup.)

### 5.6 Indexes
- `simpleNotes`: **text index** on `title` + `searchText`.
- `pages`: **text index** on `title` + `searchText`; regular index on `sectionId`, `parentId`.
- `sections`: index on `updatedAt` (for recent ordering).
- `drawings`: index on `pageId`.

---

## 6. Backend API Contract

Base path: `/api`

### Simple Notes
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/notes` | List all simple notes |
| POST | `/notes` | Create a note |
| GET | `/notes/:id` | Get one note |
| PUT | `/notes/:id` | Update note (regenerates `searchText`) |
| DELETE | `/notes/:id` | Delete note |

### Sections
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/sections` | List all sections |
| POST | `/sections` | Create a section |
| PUT | `/sections/:id` | Rename a section |
| DELETE | `/sections/:id` | Delete section **+ cascade** its pages + drawings |

### Pages (tree)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/sections/:id/pages` | Get full page tree for a section |
| POST | `/pages` | Create page (`sectionId`, `parentId`, `title`) |
| GET | `/pages/:id` | Get one page (with content) |
| PUT | `/pages/:id` | Update page title/content (regenerates `searchText`) |
| DELETE | `/pages/:id` | Delete page **+ cascade** child pages + their drawings |
| PATCH | `/pages/:id/move` | Change `parentId` / `order` (reorder/move in tree) |

### Drawings
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/drawings` | Create drawing (returns `drawingId`) |
| GET | `/drawings/:id` | Load scene for editing |
| PUT | `/drawings/:id` | Save edited scene JSON |
| POST | `/drawings/:id/export` | Render PNG → upload to Cloudinary → save `exportUrl` |
| DELETE | `/drawings/:id` | Delete drawing |

### Uploads
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/upload/image` | Upload image → Cloudinary → returns secure URL |

### Search
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/search?q=...` | Full-text search across `simpleNotes` + `pages`, returns hits with type + id + snippet |

> All write endpoints that touch `content` must **regenerate `searchText`** server-side from the TipTap JSON (flatten all text nodes) before saving.

---

## 7. Frontend Architecture

### 7.1 Screens / Routes
| Route | Screen | Description |
|-------|--------|-------------|
| `/` | Home | Two buttons: **Simple** \| **Section** |
| `/simple` | Simple list | All simple notes + "add new" (corner button) |
| `/simple/:id` | Simple editor | TipTap editor for one note |
| `/sections` | Section list | All sections + "add new" |
| `/sections/:id` | Section workspace | Sidebar page tree + page editor |
| `/sections/:id/pages/:pageId` | Page view | Selected page open in editor |
| `/search` | Search results | (or a global search overlay) |

### 7.2 Key Components
- `HomeScreen` — mode selection.
- `SimpleList`, `SimpleEditor`.
- `SectionList`, `SectionWorkspace`.
- `PageTreeSidebar` — recursive tree renderer (unlimited depth), expand/collapse, add sub-page, breadcrumbs.
- `PageEditor` — wraps TipTap; title field + block toolbar.
- `Editor` (TipTap) with custom nodes: `ImageBlock`, `DrawingBlock`.
- `DrawingCanvas` — Excalidraw wrapper (modal or inline block).
- `SearchBar` / `SearchResults`.
- `AddButton` (reusable corner FAB).

### 7.3 State / Data
- Local component state + a thin API client (`/src/api/*.js`).
- Autosave on content change (debounced ~800ms–1s).
- Optimistic UI for tree operations where safe.

---

## 8. Folder Structure

```
notes-app/
├── client/                      # React + Vite frontend
│   ├── src/
│   │   ├── api/                 # axios/fetch wrappers (notes, sections, pages, drawings, upload, search)
│   │   ├── components/
│   │   │   ├── common/          # AddButton, Modal, Loader, EmptyState
│   │   │   ├── editor/          # TipTap setup, toolbar, ImageBlock, DrawingBlock
│   │   │   ├── drawing/         # Excalidraw wrapper
│   │   │   └── tree/            # PageTreeSidebar (recursive), Breadcrumbs
│   │   ├── pages/               # HomeScreen, SimpleList, SimpleEditor, SectionList, SectionWorkspace
│   │   ├── hooks/               # useAutosave, useDebounce, etc.
│   │   ├── lib/                 # helpers (flattenTipTap, etc.)
│   │   ├── App.jsx              # routes
│   │   └── main.jsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── server/                      # Node + Express backend
│   ├── src/
│   │   ├── models/              # SimpleNote, Section, Page, Drawing (Mongoose)
│   │   ├── routes/              # notes, sections, pages, drawings, upload, search
│   │   ├── controllers/         # business logic per route
│   │   ├── middleware/          # error handler, validation
│   │   ├── lib/                 # cloudinary config, searchText flattener, cascade-delete helper
│   │   ├── db.js                # Mongo connection
│   │   └── server.js            # Express app entry
│   ├── .env                     # secrets (NOT committed)
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 9. Integration Details

### 9.1 TipTap
- Use **free open-source core** + free community extensions only.
- Base extensions: `StarterKit` (paragraph, headings, bold, italic, lists), `Underline`, `TextStyle` + `Color`, `FontSize` (community), `Placeholder`.
- **Custom nodes:**
  - `ImageBlock` — atom node; attrs: `src` (Cloudinary URL), `alt`. Inserts on a new line.
  - `DrawingBlock` — atom node; attrs: `drawingId`. Renders a thumbnail/preview (from `exportUrl`) + "edit" to open Excalidraw.
- Content stored as TipTap JSON in `content`.
- On save: flatten JSON → `searchText`.

### 9.2 Excalidraw
- Wrapped as a React component, opened from a `DrawingBlock` (modal or inline).
- **Save:** serialize `elements` + minimal `appState` → `PUT /drawings/:id` (`sceneData`).
- **Reopen/edit:** load `sceneData` back into Excalidraw → fully editable.
- **Export PNG:** use Excalidraw's export → upload to Cloudinary via `POST /drawings/:id/export` → store `exportUrl` (used for previews / sharing).
- Handwriting = freehand draw + text tools, all saved as editable scene data (no OCR).

### 9.3 Cloudinary (Image upload)
- Backend holds API key/secret in `.env` (never exposed to client).
- Flow: client sends file → `POST /upload/image` → server uploads to Cloudinary → returns `secure_url` → inserted into TipTap `ImageBlock`.
- Same path used for drawing PNG exports.

### 9.4 Search
- `searchText` field on `simpleNotes` and `pages` = plain text flattened from TipTap JSON, regenerated every save.
- MongoDB text index on `title` + `searchText`.
- `GET /search?q=` runs `$text` search across both collections, returns: `{ type: 'note'|'page', id, title, snippet, sectionId? }`.
- Frontend search bar → results jump to the note/page.

---

## 10. Environment Variables (`server/.env`)

```
PORT=5000
MONGODB_URI=<atlas connection string>
CLOUDINARY_CLOUD_NAME=<...>
CLOUDINARY_API_KEY=<...>
CLOUDINARY_API_SECRET=<...>
CLIENT_ORIGIN=http://localhost:5173
```

---

## 11. Phase-by-Phase Implementation Plan

> Build one phase at a time. Each phase must meet its **Done criteria** before moving on.

### Phase 0 — Project Setup
**Goal:** Skeleton running end-to-end.
**Tasks:**
- Init `client` (Vite + React + Tailwind) and `server` (Node + Express).
- Connect MongoDB Atlas (M0). Configure Cloudinary. Set up `.env`.
- CORS, base Express app, health-check route, folder structure.
**Done:** Frontend loads, backend responds, DB connects, Cloudinary test upload works.

### Phase 1 — Home + Routing
**Goal:** Navigation shell.
**Tasks:** React Router; `HomeScreen` with **Simple** / **Section** buttons → route to `/simple` and `/sections`.
**Done:** Both buttons navigate to placeholder pages.

### Phase 2 — Simple Mode (CRUD)
**Goal:** Full simple notes flow.
**Tasks:** `SimpleNote` model + routes; list view with "add new" corner button; basic TipTap editor (text + basic formatting); create/edit/delete; autosave.
**Done:** Can create, view, edit, delete a simple note; persists in DB.

### Phase 3 — Section Foundation
**Goal:** Sections + top-level pages.
**Tasks:** `Section` + `Page` models + routes; section list + "add new"; section workspace shows top-level pages; create a page.
**Done:** Create a section, open it, add top-level pages.

### Phase 4 — Nested Page Tree (unlimited depth)
**Goal:** The tree.
**Tasks:** Recursive `PageTreeSidebar` (expand/collapse); create sub-pages (set `parentId`); breadcrumbs; cascade-delete on page/section delete; move/reorder (`PATCH /pages/:id/move`).
**Done:** Build a deep tree, navigate it, delete cascades correctly.

### Phase 5 — Rich Page Editor
**Goal:** Full block editor in pages.
**Tasks:** Editable page title; TipTap with headings/subtitle, paragraph, bold/italic/underline, font size, color; block toolbar; autosave + `searchText` regen.
**Done:** Rich formatted content saves and reloads exactly.

### Phase 6 — Image Block
**Goal:** Image upload inside content.
**Tasks:** `POST /upload/image` → Cloudinary; custom `ImageBlock` node; insert image on a new line; store URL; render.
**Done:** Upload an image into a page, it persists and displays.

### Phase 7 — Drawing Block (Excalidraw)
**Goal:** Editable drawings + handwriting.
**Tasks:** `Drawing` model + routes; `DrawingBlock` custom node; Excalidraw wrapper; save `sceneData`; reopen & edit; PNG export → Cloudinary → `exportUrl`; preview thumbnail.
**Done:** Draw a diagram, save, reopen and edit it, export PNG.

### Phase 8 — Search
**Goal:** Global search.
**Tasks:** Text indexes; `GET /search`; search bar + results; jump-to-result.
**Done:** Typing a keyword finds matching notes/pages and navigates to them.

### Phase 9 — Polish
**Goal:** Production-feel.
**Tasks:** Autosave indicators, loading/empty/error states, confirm dialogs, keyboard niceties, responsive layout, UI cleanup.
**Done:** App feels smooth and complete for daily personal use.

### Phase 10 — Offline + Sync _(deferred)_
**Goal:** Work offline, sync later.
**Tasks:** Local store (IndexedDB), offline write queue, conflict handling, sync on reconnect.
**Done:** Can read/write offline; changes sync when back online.

---

## 12. Open / Future Items
- **App name** — your call.
- Optional `assets` collection for orphaned-image cleanup.
- Handwriting → text (OCR) — only as a later free experiment; no quality promise (good handwriting OCR isn't free).
- Online deployment phase (free hosting tiers) — when ready.
- Export/backup (e.g., export a section to Markdown/PDF) — possible later.

---

## 13. Build Rules Recap
1. **Source of truth:** Dev4's stated flow. Propose → approve → then update.
2. **One phase at a time.** Don't start a phase without explicit go.
3. **Free only.** No paid services introduced without asking first.
4. **Secrets in `.env`**, never committed, never sent to client.
5. **`searchText` regenerated** on every content write.

---

_End of plan._
