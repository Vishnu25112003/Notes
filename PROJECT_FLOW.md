# Notespace — Complete Project Flow Documentation

> A full-stack personal notes workspace. This document explains the **theory and end-to-end flow** of the entire application — every layer, every module, and how a request travels from a user's tap all the way to the database and back.

---

## Table of Contents

1. [What Notespace Is](#1-what-notespace-is)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Repository & Folder Structure](#4-repository--folder-structure)
5. [The Data Model (Theory)](#5-the-data-model-theory)
6. [Backend Flow — Deep Dive](#6-backend-flow--deep-dive)
7. [Frontend Flow — Deep Dive](#7-frontend-flow--deep-dive)
8. [Authentication Flow (End-to-End)](#8-authentication-flow-end-to-end)
9. [Note Editing & Autosave Flow](#9-note-editing--autosave-flow)
10. [Drawing & AI Auto-Solve Flow](#10-drawing--ai-auto-solve-flow)
11. [Sharing Flow (End-to-End)](#11-sharing-flow-end-to-end)
12. [Search Flow](#12-search-flow)
13. [Image Upload & Cloudinary Flow](#13-image-upload--cloudinary-flow)
14. [Export Flow](#14-export-flow)
15. [Deployment & Environment](#15-deployment--environment)
16. [End-to-End Request Lifecycle (Summary)](#16-end-to-end-request-lifecycle-summary)

---

## 1. What Notespace Is

Notespace is a **single-user-centric, multi-account personal notes application** ("Notespace"). It lets a person capture thoughts in two organizational styles, draw freehand, solve handwritten math/questions with AI, and share notes with other users Google-Docs style.

### Core capabilities
- **Two note modes:**
  - **Simple Mode** — a flat list of standalone notes (like sticky notes).
  - **Section Mode** — a hierarchical tree: *Sections → Pages → Sub-pages* (like a notebook with chapters).
- **Rich text editing** via TipTap (headings, bold/italic/underline, lists, colors, images).
- **Freehand drawing** via Excalidraw, embedded inline inside a note.
- **AI auto-solve** — the app can read a handwritten math problem or question from a drawing and write the answer directly back onto the canvas.
- **Passwordless authentication** — biometric (WebAuthn/passkey) + Authenticator app (TOTP). No passwords anywhere.
- **Sharing** — share a note or page by link, grant access to specific users, allow view/edit/clone, and approve access requests.
- **Full-text search** across all notes and pages.
- **Export** — to PDF, DOC, Markdown, and plain text.
- **Dark/light theme.**

---

## 2. High-Level Architecture

Notespace is a classic **client–server SPA** with a clean separation:

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                          │
│  React 19 SPA (Vite)                                               │
│   • Pages/Routes  • Contexts (Auth, Theme)  • TipTap  • Excalidraw │
│   • axios API layer (auto-attaches Bearer token)                   │
└───────────────────────────────┬───────────────────────────────────┘
                                 │  HTTPS  /api/*   (JSON, Bearer token)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SERVER (Express 5, Node)                      │
│   CORS → JSON parser → Route mount → requireAuth → Controller      │
│   • Auth (WebAuthn + TOTP)   • Notes/Sections/Pages/Drawings       │
│   • Share   • Search   • Solve (AI)   • Upload                     │
└──────────┬─────────────────────┬──────────────────┬───────────────┘
           │                     │                  │
           ▼                     ▼                  ▼
   ┌──────────────┐     ┌────────────────┐   ┌──────────────┐
   │ MongoDB Atlas│     │   Cloudinary   │   │   Groq API   │
   │ (Mongoose)   │     │ (images / PNG) │   │ (vision LLM) │
   └──────────────┘     └────────────────┘   └──────────────┘
```

**Key architectural principles:**
- **Stateless HTTP with token auth.** Every protected request carries a `Bearer` session token; the server looks it up on the `User` document.
- **Per-user ownership scoping.** Every database query is filtered by `userId`. A user can only ever touch their own data — except through the explicit sharing paths.
- **Thin controllers, fat models are avoided.** Business logic lives in controllers; models are schema definitions with indexes.
- **The frontend never talks to Cloudinary/Groq directly.** All third-party calls are proxied through the backend so secrets stay on the server.

---

## 3. Technology Stack

### Frontend (`client/`)
| Concern | Technology |
|---|---|
| Framework | React 19 |
| Build tool | Vite 8 |
| Routing | react-router-dom 7 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) + CSS variables |
| Rich text editor | TipTap 3 (StarterKit, Underline, TextStyle, Color, Image, Placeholder) |
| Drawing | Excalidraw 0.18 (lazy-loaded) |
| Auth (browser) | `@simplewebauthn/browser` 13 |
| HTTP client | axios 1.18 |
| Animation | framer-motion |
| Styled components | styled-components (neumorphic power button) |
| Export | turndown (Markdown), html2pdf.js (PDF) |

### Backend (`server/`)
| Concern | Technology |
|---|---|
| Runtime | Node.js ≥ 18 (ES Modules) |
| Web framework | Express 5 |
| Database ODM | Mongoose 9 → MongoDB Atlas |
| Auth (server) | `@simplewebauthn/server` 13 (WebAuthn), `otplib` 13 (TOTP), `qrcode` |
| File uploads | multer (memory storage) |
| Media storage | Cloudinary |
| AI provider | Groq (OpenAI-compatible REST via `fetch`) |
| Config | dotenv |

---

## 4. Repository & Folder Structure

```
notes/
├── package.json            # Root: build + start scripts for deployment
├── render.yaml             # Render.com deployment config
├── client/                 # React SPA
│   └── src/
│       ├── main.jsx        # Entry point
│       ├── App.jsx         # Providers + routing
│       ├── index.css       # Global styles + theme CSS variables
│       ├── api/            # axios modules (one per domain)
│       ├── context/        # AuthContext, ThemeContext
│       ├── hooks/          # useAutosave, useDebounce
│       ├── lib/            # flattenTipTap
│       ├── utils/          # exportNote
│       ├── pages/          # Route-level screens
│       └── components/     # common/, editor/, drawing/, tree/, share/, ui/
└── server/                 # Express API
    └── src/
        ├── server.js       # Bootstrap: middleware, routes, static serving
        ├── db.js           # Mongoose connection
        ├── middleware/     # requireAuth, errorHandler
        ├── lib/            # cloudinary, challengeStore, flattenTipTap
        ├── models/         # Mongoose schemas
        ├── routes/         # Express routers (one per domain)
        ├── controllers/    # Request handlers (business logic)
        └── scripts/        # backfillUserId (maintenance)
```

**Naming convention:** each domain has a matching triplet — `routes/<x>.js` (URL → handler mapping), `controllers/<x>Controller.js` (logic), `models/<X>.js` (schema). The frontend mirrors this with `api/<x>.js`.

---

## 5. The Data Model (Theory)

Everything hangs off a **User**. Below is how the entities relate.

```
User (1)
 ├──< SimpleNote      (flat notes)
 ├──< Section (1)
 │      └──< Page (tree via parentId)
 │              └──< Page (sub-page)  ... recursive
 └──< Drawing        (belongs to a Page or standalone; referenced inside note content)

Sharing is embedded (not a separate collection):
 SimpleNote.share  and  Page.share  hold visibility, permission, sharedWith[], requests[]
```

### Entity summary

| Model | Purpose | Key fields |
|---|---|---|
| **User** | Account + credentials | `username` (unique, `[a-zA-Z0-9]{3,20}`), `totpSecret`, `totpVerified`, `webAuthnCredentials[]`, `sessions[]` |
| **SimpleNote** | A standalone note | `userId`, `title`, `content` (TipTap JSON), `searchText`, `share` |
| **Section** | Top-level notebook | `userId`, `title` |
| **Page** | A page inside a section, tree-structured | `userId`, `sectionId`, `parentId` (null = top-level), `title`, `content`, `order`, `searchText`, `share` |
| **Drawing** | An Excalidraw scene | `userId`, `pageId`, `sceneData` (scene JSON), `exportUrl` (Cloudinary PNG) |
| **share** (embedded) | Access control on a note/page | `visibility` (private/public), `permission` (view/edit), `allowClone`, `sharedWith[]`, `requests[]` |

**Important design choices:**
- **`content` is stored as raw TipTap JSON** (an object). This preserves formatting, embedded images, and drawing blocks exactly.
- **`searchText` is a denormalized flat-text copy** of the content, recomputed on every save via `flattenTipTap()`. This powers the MongoDB text index for search.
- **Drawings are referenced from inside note content** as `drawingBlock` nodes (carrying a `drawingId` + `exportUrl`), while the actual scene lives in the `Drawing` collection.
- **Sharing is embedded, not a join table** — a note is "not shared" simply when `visibility=private` and `sharedWith` is empty. `sharedWith` entries carry a denormalized `username` (usernames are immutable) and a `via` tag: `granted` (owner added you), `approved` (owner approved your request), or `public` (you opened a public link).
- **Sessions are embedded in the User** as `{ token, expiresAt, createdAt }`, capped at 10, pruned on each login. A 7-day lifetime, no sliding refresh.

### Indexes (why they exist)
- Text indexes on `{title, searchText}` for SimpleNote and Page → full-text search.
- `{ userId, updatedAt: -1 }` → fast "my recent notes" listing.
- `{ 'sessions.token': 1 }` and `{ 'webAuthnCredentials.credentialID': 1 }` → fast auth lookups.
- `{ 'share.sharedWith.userId': 1 }` → fast "shared with me" queries.

---

## 6. Backend Flow — Deep Dive

### 6.1 Server bootstrap (`server/src/server.js`)

The server starts up in this exact order:

1. **`import 'dotenv/config'`** — load environment variables first, before anything reads them.
2. Compute paths and build the **allowed CORS origins** list from `CLIENT_ORIGIN` (comma-separated, trailing slashes stripped, defaults to `http://localhost:5173`).
3. **Register middleware in order:**
   1. **CORS** — a dynamic origin check. Requests with no origin (curl, same-origin) pass; otherwise the origin must be in the allow-list. `credentials: true`. Blocked origins are logged and rejected softly.
   2. **`express.json({ limit: '20mb' })`** — the large limit exists because drawings and images arrive as base64 payloads.
   3. **`GET /api/health`** → `{ ok: true }` (uptime probe).
   4. **`/api/auth`** router — mounted **without** global auth (it handles its own).
   5. **Protected routers**, each wrapped in `requireAuth`: `/api/notes`, `/api/sections`, `/api/pages`, `/api/drawings`, `/api/upload`, `/api/search`, `/api/share`, `/api/solve`.
   6. **`errorHandler`** — the last middleware; catches thrown/rejected errors.
   7. **Static SPA serving** — if `client/dist` exists (production build), serve it and fall back to `index.html` for any non-`/api` route.
4. **Connect to MongoDB** (`connectDB()`), then **`app.listen(PORT)`**. If the DB fails, log and `process.exit(1)`.

### 6.2 The request pipeline (every protected call)

```
Incoming request
   → CORS check
   → JSON body parse
   → Route match  (e.g. PUT /api/notes/:id)
   → requireAuth middleware
        • read "Authorization: Bearer <token>"       → 401 if missing
        • User.findOne({ 'sessions.token': token })   → 401 if not found
        • check session.expiresAt > now               → 401 if expired
        • set req.user = { id, username }
   → Controller function
        • query scoped by userId: req.user.id
        • do the work
        • res.json(result)
   → (on throw/reject) errorHandler → { error: message }
```

**Ownership is enforced at the query layer.** Controllers never do `if (doc.userId === req.user.id)` for their own data — instead they query `findOne({ _id, userId })`, so a wrong owner simply gets a 404. This is a robust default that makes cross-user data leaks structurally hard.

### 6.3 Error handling (`middleware/errorHandler.js`)

A single terminal handler: logs the error, then responds `res.status(err.status || 500).json({ error: err.message || 'Internal server error' })`. Because Express 5 auto-forwards rejected async handlers, most controllers can skip try/catch and still reach this handler. Only the **solve** and **upload** controllers do explicit error handling because they talk to fragile third parties.

### 6.4 Domain controllers (what each does)

**Notes (`/api/notes`)** — flat CRUD on `SimpleNote`, always scoped by `userId`:
- `GET /` list (recent first, minimal fields) · `POST /` create · `GET /:id` read · `PUT /:id` update · `DELETE /:id` delete.
- On create/update, `searchText` is recomputed via `flattenTipTap(content)`.

**Sections (`/api/sections`)** — CRUD on `Section` + `GET /:id/pages` (flat page list, client builds the tree). `DELETE` is a **cascade**: it deletes all child pages, all drawings belonging to those pages, then the section.

**Pages (`/api/pages`)** — `POST /` (verifies section ownership, computes `order` = count of existing siblings so new pages append at the end), `GET/PUT/DELETE /:id`, `PATCH /:id/move` (reparent/reorder). `updatePage` is **conditional** — it only writes a field if it was actually provided (avoids nulling title/content). `DELETE` recursively deletes descendant pages and their drawings.

**Drawings (`/api/drawings`)** — `POST /` create (optionally tied to a page), `GET/PUT /:id`, `POST /:id/export` (upload PNG to Cloudinary, save `exportUrl`), `DELETE /:id` (also destroys the Cloudinary asset best-effort).

**Upload, Search, Solve, Share** — covered in their own sections below (§13, §12, §10, §11).

---

## 7. Frontend Flow — Deep Dive

### 7.1 Bootstrap & providers (`main.jsx`, `App.jsx`)

`main.jsx` mounts `<App/>` in `<StrictMode>`. `App.jsx` nests providers **outer → inner**:

```
ThemeProvider          (theme applies even before auth resolves)
  └ BrowserRouter      (router available to Auth)
      └ AuthProvider   (uses router hooks like useLocation)
          └ AppRoutes
```

### 7.2 Routing & guards

| Path | Screen | Guarded? |
|---|---|---|
| `/auth` | AuthScreen | No (redirects away if already logged in) |
| `/` | HomeScreen | Yes |
| `/simple` | SimpleList | Yes |
| `/simple/:id` | SimpleEditor | Yes |
| `/sections` | SectionList | Yes |
| `/sections/:sectionId` | SectionWorkspace | Yes |
| `/sections/:sectionId/pages/:pageId` | PageEditor (nested in SectionWorkspace) | Yes |
| `/shared` | SharedList | Yes |
| `/shared/:type/:id` | SharedViewer | Yes |
| `*` | redirect to `/` | — |

- **`ProtectedRoute`**: while auth `status === 'loading'` shows a full-screen loader; if `unauthenticated` redirects to `/auth` **remembering the intended URL** in navigation state (so a shared link survives the login detour); otherwise renders the page.
- **`AuthRoute`**: if already authenticated, bounces to the remembered `next` URL (or `/`).

### 7.3 The API layer (`api/client.js`)

A single axios instance is the choke point for all server communication:
- **Base URL:** `${VITE_API_URL || ''}/api` — empty in dev, so requests hit `/api/...` and Vite proxies them to `:5000`.
- **Request interceptor:** reads `ns_token` from localStorage and sets `Authorization: Bearer <token>` automatically. *Individual API functions never think about tokens.*
- **Response interceptor:** returns `response.data` directly (so callers get the body, not the axios envelope). On **401**, it clears the token and dispatches a global `window` event `auth:expired`, then rejects with a plain error string.

The **`auth:expired` event** is the key decoupling mechanism: any 401 anywhere in the app instantly logs the user out app-wide, because `AuthContext` listens for it.

### 7.4 Contexts

- **AuthContext** — holds `status` (`loading`/`unauthenticated`/`authenticated`) and `username`. On mount it verifies any stored token via `POST /auth/session/verify`. Exposes `login(token, user)` (persists token), `logout()` (best-effort server logout + clears token). Listens for `auth:expired`.
- **ThemeContext** — holds `theme` (default `dark`), writes `data-theme` onto `<html>`, persists to localStorage. All colors are CSS variables that switch on that attribute.

---

## 8. Authentication Flow (End-to-End)

Notespace is **passwordless**. Identity = a username + two factors: a **passkey (WebAuthn)** and an **Authenticator code (TOTP)**. TOTP is mandatory; the passkey is optional but preferred.

### 8.1 Registration (new user)

```
AuthScreen (entry) → checkUserExists → "User not found" → register-webauthn view
   │
   ├─ (A) Register biometric (optional)
   │     client: registerWebAuthn(username)
   │       1. POST /auth/register/webauthn-options   → server generates options, stores challenge (reg:<username>)
   │       2. browser startRegistration(options)      → creates passkey, user does Face/Touch ID
   │       3. POST /auth/register/webauthn-verify     → server verifies, stashes credential in pendingRegistrations
   │
   └─ (B) Set up Authenticator (mandatory)
         1. POST /auth/register/totp-setup   → server generates TOTP secret + QR code (qrcode)
         2. user scans QR in Google Authenticator, types 6-digit code
         3. POST /auth/register/totp-verify  → server verifies code, THEN creates the User document
                                              (username + totpSecret + verified + any passkey), issues a session token
   → client login(token, username) → authenticated
```

**Theory notes:**
- The **User is only created at the final TOTP verify step.** Until then, partial state (passkey, secret) lives in an in-memory `pendingRegistrations` map with a 30-minute TTL. This ensures no half-registered accounts pollute the database.
- A username is only "claimed" once `totpVerified` is true — unverified duplicates are allowed until someone completes verification.
- **Challenges** (the random bytes the authenticator must sign) are held in a separate in-memory `challengeStore` with a 5-minute TTL and a periodic sweeper.

### 8.2 Login (returning user)

```
AuthScreen (entry) → type username → POST /auth/login/check → { exists, hasWebAuthn }
   │
   ├─ hasWebAuthn AND device supports it → login-webauthn view (auto-fires)
   │     1. POST /auth/login/webauthn-options   → options + challenge (auth:<username>)
   │     2. browser startAuthentication          → user does Face/Touch ID
   │     3. POST /auth/login/webauthn-verify      → server verifies signature, updates counter, issues session token
   │        • Lockout: after 3 failed attempts (5-min window) → forces TOTP fallback
   │        • RP-ID / domain errors → silently fall back to TOTP
   │
   └─ otherwise → login-totp view
         POST /auth/login/totp → server verifies 6-digit code → issues session token
```

### 8.3 Session lifecycle

- On success the client stores the token in `localStorage['ns_token']` and every subsequent request carries it as a Bearer token.
- `requireAuth` looks the token up on `User.sessions`, checks `expiresAt` (7 days), and attaches `req.user`.
- Sessions are pruned (expired removed, capped at 10) on each new login.
- **Logout** pulls the session from the array (`$pull`) and clears the local token.
- **Add device** (authenticated): an existing user can register an extra passkey via `/auth/device/add-options` + `/device/add-verify` (using `excludeCredentials` so the same authenticator isn't added twice).

**Security caveat (by design/limitation):** the challenge store, `pendingRegistrations`, and login-failure counters are **in-memory** — they don't survive a restart and won't work across multiple server replicas. Fine for a single-instance deployment.

---

## 9. Note Editing & Autosave Flow

All three editors (`SimpleEditor`, `PageEditor`, `SharedViewer`) share the same machinery; they differ only in which API pair they save through and in permission gating.

### 9.1 The editor (`components/editor/Editor.jsx`)

- Wraps TipTap's `useEditor` with extensions: StarterKit, Underline, TextStyle, Color, Placeholder, **ImageBlock** (custom), **DrawingBlock** (custom).
- On every change, `onUpdate` fires `onChange(editor.getJSON())` → the parent page holds the content in state.
- A DOM **CustomEvent bridge** connects the custom node views to React:
  - `open-drawing` → opens the Excalidraw canvas for that drawing.
  - `delete-drawing` / `delete-image` → confirm dialog → remove node + delete backing record.
  - `drawing-saved` (window event) → refresh the inline drawing preview with the new `exportUrl`.
- `setEditable(editable)` is synced live so permission changes (e.g. shared access revoked mid-session) instantly make the editor read-only.

### 9.2 The autosave hook (`hooks/useAutosave.js`)

```
useAutosave(saveFn, [title, JSON.stringify(content)], delay=900ms)
```

- Skips the very first run (initial load isn't a change).
- On any dependency change: sets status `saving` → debounces 900 ms → calls the latest `saveFn` → sets `saved` (with timestamp) or `error`.
- The returned status drives the `SaveStatus` pill in the header.
- Pages use `refs` kept current each render so the debounced closure always saves the **latest** title/content, not a stale snapshot.

### 9.3 Full save round-trip (Simple Mode example)

```
User types
  → Editor.onUpdate → setContent(json)
  → useAutosave detects change → 900ms idle
  → updateNote(id, { title, content })
  → PUT /api/notes/:id  (Bearer token attached)
  → requireAuth → notesController.updateNote
  → findOneAndUpdate({ _id, userId }, { title, content, searchText: flattenTipTap(content) })
  → returns updated doc → SaveStatus shows "saved · 12:34"
```

**PageEditor** additionally calls `onRefresh()` after saving so the sidebar tree and breadcrumb reflect a renamed page immediately.

---

## 10. Drawing & AI Auto-Solve Flow

### 10.1 Creating & editing a drawing

```
Editor toolbar "Draw" button
  → createDrawing({ pageId, sceneData:{} })  → POST /api/drawings → new Drawing
  → insert a drawingBlock node into the note (holds drawingId + exportUrl)
  → onOpenDrawing(drawingId) → DrawingCanvas opens (full-screen overlay)
```

`DrawingCanvas` lazy-loads Excalidraw. On open it fetches the scene (`getDrawing`) and hands it to Excalidraw as `initialData`.

### 10.2 Saving a drawing (two artifacts)

When the user hits SAVE:
1. **Scene JSON** → `updateDrawing(id, { sceneData: { elements, appState } })` (so it's editable later).
2. **Rendered PNG** → `exportToBlob` → base64 → `exportDrawing(id, { pngBase64 })` → server uploads to Cloudinary → returns `exportUrl`.
3. Dispatches a `drawing-saved` window event → the Editor updates the inline `drawingBlock` preview image.

So a drawing has **two representations**: the editable scene (Mongo) and a flat PNG (Cloudinary) used for inline preview, export, and AI solving.

### 10.3 AI auto-solve (the signature feature)

The canvas has a neumorphic **power button** that toggles "Auto mode". The flow:

```
User writes on canvas
  → Excalidraw onChange → scheduleAutoSolve (debounced 1500ms of pen-idle)
  → runSolve({ auto:true })
      1. Filter to USER strokes only (exclude deleted + prior AI answers tagged customData.aiAnswer)
      2. Compute a signature (id:version per element); skip if unchanged since last attempt
      3. Export just the user strokes to PNG base64
      4. solveDrawing({ pngBase64, auto:true })  → POST /api/solve
          → solveController → Groq vision model
             • model list: [GROQ_MODEL env, 'qwen/qwen3.6-27b']; on 404 auto-discovers an active vision model
             • sends the image + a prompt: "find the question/math, solve it, reply JSON {answer, solution}"
             • auto mode adds a suffix: only answer if the expression ends with '=' / '=?' / '?',
               otherwise return empty (the user is still writing)
          → returns { answer, solution }
      5. If answer non-empty → place it back on the canvas:
          • short answer (≤30 chars) → inline, to the right of the question, vertically centered, sized to handwriting height
          • long answer → wrapped paragraph below the question
          • styled orange (#e8590c), tagged customData.aiAnswer
      6. Replace-not-stack: re-fetch live scene, mark any previous AI answer isDeleted, then updateScene
```

**Theory notes:**
- **Idle detection** (1.5 s) means solving fires naturally when the user pauses, not on every stroke.
- **Signature skipping** avoids re-solving an unchanged canvas (saves API calls).
- **User-strokes-only filtering** ensures the AI's own previous answer isn't fed back into the next solve.
- **Replace-not-stack** keeps exactly one AI answer on the canvas, and re-fetching the live scene first means strokes drawn *during* the API call aren't lost.
- The whole third-party call is **server-side** — the Groq API key never reaches the browser.
- There is also a **manual solve** path (`auto:false`) with user-facing alerts for empty canvas / unreadable question / errors.

---

## 11. Sharing Flow (End-to-End)

Sharing is **polymorphic** over `:type` ∈ {`note`, `page`} and driven by the embedded `share` sub-document.

### 11.1 The access model (theory)

- **Visibility:** `private` (default) or `public`.
- **Permission:** `view` or `edit` — applies to everyone who has access.
- **`allowClone`:** whether a viewer may copy the note into their own account.
- **`sharedWith[]`:** users who have access, each tagged `via`:
  - `granted` — the owner explicitly added them.
  - `approved` — the owner approved their access request.
  - `public` — they merely opened a public link (this alone grants nothing when private; it just keeps the doc in their "Shared with me" list).
- **`requests[]`:** pending access requests awaiting the owner's decision.
- **`hasAccess`** = `visibility === public` OR the user has a `granted`/`approved` entry.

### 11.2 Owner side (`ShareModal.jsx`)

The owner opens the Share modal on any note/page and can:
- Copy the **share link** `${origin}/shared/${type}/${id}`.
- Set **visibility** (private/public) → `PUT /share/:type/:id/settings`.
- Set **permission** (view/edit) and **allow clone**.
- **Add a user** by username → `POST /share/:type/:id/users` (`via: granted`).
- **Remove a user** → `DELETE .../users/:userId`.
- **Approve / deny** pending requests → `POST .../requests/:userId/approve` / `DELETE .../requests/:userId`.

The editor's SHARE button shows a **badge** with the pending-request count. The Home screen "Shared" card shows a badge summing pending requests across all the owner's notes/pages (`GET /share/requests/count`).

### 11.3 Receiver side (`SharedList.jsx`, `SharedViewer.jsx`)

```
Open /shared/:type/:id → resolveShared → GET /share/:type/:id
   ├─ status:'owner'  → redirect to the native editor (owner shouldn't use the shared view)
   ├─ status:'denied' → "You need access" → Request access → POST /share/:type/:id/request
   │                     (server adds to requests[]; owner sees it in their inbox)
   └─ status:'ok'     → render the note; editable if permission==='edit'
         • edits autosave via PUT /share/:type/:id/content
         • if the owner revoked access mid-session, the next save re-resolves → flips to the denied view
         • Clone (if allowClone) → POST /share/:type/:id/clone → copies into requester's account as a new SimpleNote
```

**Theory notes:**
- **Cloning sanitizes content:** `drawingBlock` nodes are converted to plain `imageBlock` nodes (using the drawing's `exportUrl`), so the clone doesn't reference the original owner's `Drawing` records. Both note and page clones become **SimpleNotes** in the requester's account.
- Opening a public link **records a `via: public` entry** so the doc appears in the opener's "Shared with me" list — without granting edit rights.
- `SharedList` shows everything shared with you, with chips for type, `CAN EDIT`/`VIEW ONLY`, and a `REQUEST ACCESS` button when you don't yet have access.

---

## 12. Search Flow

```
SectionWorkspace header → SearchBar (debounced 350ms)
  → search(q) → GET /api/search?q=...
  → searchController runs TWO parallel MongoDB $text searches (scoped by userId):
       • SimpleNote.find({ userId, $text:{ $search:q } })  sorted by textScore, limit 20
       • Page.find(...) same, plus sectionId
  → unified result array:
       notes → { type:'note', id, title, snippet }
       pages → { type:'page', id, title, snippet, sectionId }
  → dropdown; selecting navigates to /simple/:id or /sections/:sectionId/pages/:id
```

- Search relies on the **text indexes** over `{title, searchText}`. Because `searchText` is the flattened plain-text version of the content (recomputed on every save), the search covers the full body of every note and page.
- Drawings are not searched directly — any text near them lives in the parent note/page's `searchText`.

---

## 13. Image Upload & Cloudinary Flow

```
Editor toolbar "Image" → file picker → uploadImage(file)
  → FormData field "image" → POST /api/upload/image
  → multer memory storage (10MB cap) → req.file.buffer
  → cloudinary.uploader.upload_stream({ folder:'notes-images' })  (buffer piped in)
  → { url: secure_url }
  → Editor inserts an imageBlock node { src, alt }
```

Cloudinary is used in **three places**:
1. **Inline note images** → folder `notes-images`.
2. **Drawing PNG exports** → folder `notes-drawings` (data-URI upload).
3. **Cleanup** — deleting a drawing extracts the public_id from its `exportUrl` and calls `cloudinary.uploader.destroy` (best-effort, non-fatal).

The image/drawing blocks in TipTap are **atom node views** with a pointer-drag **resize handle** that stores width as a percentage (persisted as `data-width`).

---

## 14. Export Flow

```
Editor header "EXPORT" → ExportModal → choose PDF / DOC / MD / TXT
  → utils/exportNote.js
      1. noteToHTML(content): TipTap generateHTML(...) with the same extensions,
         then replace each drawingBlock <div> with its exported <img> (drop if no image), cap images at 100% width
      2. format-specific conversion:
          • TXT → innerText of rendered HTML
          • MD  → Turndown (atx headings, fenced code)
          • DOC → HTML wrapped with Word namespaces, saved as .doc (application/msword)
          • PDF → dynamic import('html2pdf.js'), render styled HTML offscreen, save A4 PDF
      3. downloadBlob → trigger <a download>, revoke object URL after 4s
```

- All export is **client-side** — no server round-trip. The note's TipTap JSON is rehydrated to HTML using the same extension set, guaranteeing fidelity.
- Drawings appear in exports as their exported PNGs.

---

## 15. Deployment & Environment

### Root scripts (`package.json`)
- **`build`** → `npm ci` in both `server` and `client`, then `npm run build` in client (produces `client/dist`).
- **`start`** → `node server/src/server.js` (the server also serves the built SPA from `client/dist` in production).

### Render.com (`render.yaml`)
A single **web service** (`notespace-backend`, Node runtime, `rootDir: server`). Environment variables (all `sync:false`, set in the dashboard):

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `CLIENT_ORIGIN` | Allowed CORS origin(s) |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | Cloudinary credentials |
| `GROQ_API_KEY` | AI solver key |
| `RP_ID` | WebAuthn Relying Party ID (e.g. `psnnotes.vercel.app`) |
| `RP_ORIGIN` | WebAuthn expected origin (`https://psnnotes.vercel.app`) |

### Dev setup
- **Client:** `cd client && npm run dev` (Vite on port 5173, proxies `/api` → `:5000`).
- **Server:** `cd server && npm run dev` (nodemon on port 5000).
- **`server/.env`** holds all secrets locally; `RP_ID` defaults to `localhost` and `RP_ORIGIN` to `http://localhost:5173` for local WebAuthn.

---

## 16. End-to-End Request Lifecycle (Summary)

Bringing it all together — a single representative action, **"user renames a page,"** flows like this:

```
1. User edits the title input in PageEditor
        ↓
2. React state updates; useAutosave sees the change, waits 900ms of idle
        ↓
3. updatePage(pageId, { title, content }) called
        ↓
4. api/client.js axios interceptor attaches "Authorization: Bearer <ns_token>"
        ↓
5. PUT /api/pages/:id  →  Vite proxy (dev) / same origin (prod)
        ↓
6. Express: CORS → JSON parse → route match → requireAuth
        • token looked up on User.sessions, expiry checked, req.user set
        ↓
7. pagesController.updatePage
        • findOneAndUpdate({ _id, userId }, { title, searchText: flattenTipTap(content) })
        • returns the updated document
        ↓
8. errorHandler is skipped (success); response body returned
        ↓
9. axios response interceptor unwraps response.data
        ↓
10. useAutosave sets status 'saved'; SaveStatus pill shows "saved · <time>"
        ↓
11. PageEditor calls onRefresh() → sidebar tree + breadcrumb reflect the new title
```

Every other feature — creating notes, drawing, AI-solving, sharing, searching, uploading, exporting — follows the same disciplined pipeline: **typed API module → token-injecting axios → CORS/JSON → requireAuth → userId-scoped controller → Mongoose/Cloudinary/Groq → JSON back → React state → UI**.

---

*This document describes the theory and complete flow of Notespace as implemented across the `client/` (React) and `server/` (Express) codebases.*

---

## Deployment Ops — Keep-Alive (Render free tier)

**Problem:** The backend runs on Render's **free web service** (`https://notes-4yey.onrender.com`).
Render spins a free service down after ~15 min of inactivity. The next request must
cold-boot Node + reconnect to MongoDB Atlas → **30–60s "loading" on app open**.

**Fix:** An external cron pings the public, auth-free health endpoint so the server
never sleeps during active hours.

- **Endpoint pinged:** `https://notes-4yey.onrender.com/api/health`
  - Defined in `server/src/server.js` before `requireAuth` → public, no token needed.
  - Returns `{ ok: true }`; no DB call → negligible load.
- **Service:** [cron-job.org](https://cron-job.org) (free) — or UptimeRobot.
- **Interval:** every **10 minutes** (Render sleeps at 15 min; 10 leaves margin).
- **Active window:** **07:00 – 00:00 (midnight)** local time only.
  - Cron expression: `*/10 7-23 * * *`
  - ~17h/day × 31 ≈ **527 instance-hours/month** → safely under Render's **750h** free cap.
  - Server sleeps overnight (00:00–07:00) when unused → saves hours.

**⚠️ Watch-outs:**
- The 750h/month cap is **shared across all free services on the account** — keep only
  one free service, or the cap blows and Render suspends it until next month.
- Don't ping more often than ~10 min; no benefit, and some pingers rate-limit.

**Permanent alternative:** add `plan: starter` ($7/mo) to `render.yaml` → no spin-down,
delete the cron.
