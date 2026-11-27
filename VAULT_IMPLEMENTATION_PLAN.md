# 🔐 Vault Mode — Implementation Plan

> **Status:** Phases 0–4 implemented (2026-11-27). Phase 0 is on branch `vault-phase0-auth-hardening`; Phases 1–4 are stacked on `vault-phase1-core`. How it works now is documented in PROJECT_FLOW.md §17.
> **Scope:** A third mode in Notespace, next to Simple and Section, for storing credentials with zero-knowledge encryption.
> **Workflow rule:** This document is the source of truth. Any change is proposed first, and the document is updated only after approval.

---

## 1. Concept

**Problem:** many site logins and other credentials, mostly forgotten.
**Solution:** a **Vault** mode on the home screen. Every credential is encrypted **in the browser** before it reaches the server. You unlock with a fingerprint or passkey on phones and tablets, or with an authenticator code plus master password on a PC.

The server and MongoDB only ever hold ciphertext. Neither a database leak nor a server compromise reveals any password.

---

## 2. Locked decisions

| # | Area | Decision |
|---|------|----------|
| 1 | Encryption | Client-side, zero-knowledge. Envelope encryption: one random **Vault Key** wrapped by the master password, by each device passkey (WebAuthn PRF), and by a recovery key |
| 2 | PC unlock | Authenticator (TOTP) code, then master password. Phone passkey over QR (hybrid) also works on Linux and Windows |
| 3 | Recovery | Printable **recovery key** generated at setup |
| 4 | Lock rule | Unlock once per vault session, then re-verify before reveal/copy (60 s grace). Auto-lock is user-settable (1/5/15/30 min) and also fires immediately when the tab or app is hidden |
| 5 | Clipboard | Masked `••••` by default. Clipboard auto-clears after 30 s |
| 6 | Search | Local only, by site name, after unlock. Global server search excludes the vault |
| 7 | AI solve | Disabled in the vault |
| 8 | Export | Encrypted backup file, plus plain CSV (Bitwarden/Chrome format) behind master-password re-verify and a warning |
| 9 | Sharing | User to user only, end-to-end encrypted, **read-only** for the receiver. Revoking prompts the owner to change the password. No public links |
| 10 | Structure | Flat list with categories: **Login, Card/Bank, Wi-Fi/Device, API key/Secure note**, plus **custom categories with field templates** |
| 11 | Fields | Site name, username, password, URL, notes, custom fields (each can be marked secret), password generator, favourite, last-changed date |
| 12 | Extras | CSV import (Chrome/Firefox/Bitwarden), weak/reused alerts, password history, breach check (HIBP k-anonymity) |
| 13 | Delete | Re-verify, then a 30-day Trash |
| 14 | Conflicts | Each item has a version number. A conflict shows a warning instead of silently overwriting |
| 15 | Offline | Encrypted vault cached on the device (IndexedDB). Edits queue and sync later |
| 16 | Devices | Android, iPhone, tablets, Linux, Windows, Mac. Mobile and desktop usage is roughly 50/50 |
| 17 | Hardening | Phase 0 fixes the existing auth gaps first. Strict CSP across the whole app. Vault key kept in memory only |

---

## 3. Cryptography design

All crypto uses the **WebCrypto API** (AES-GCM, HKDF, ECDH P-256) plus **Argon2id** via `hash-wasm`. No custom algorithms.

### 3.1 Keys

```
Master password ──Argon2id(salt, m=64MiB, t=3, p=1)──► KEK_pwd ─┐
Passkey PRF(salt) ──HKDF──────────────────────────────► KEK_prf ─┼─ each wraps ─► VAULT KEY (random 256-bit AES)
Recovery key (random 256-bit, shown as 13×4 base32) ──HKDF──► KEK_rec ─┘                │
                                                                                         ├─ wraps ─► ITEM KEY (one per item, random 256-bit)
                                                                                         │                └─ encrypts item JSON (AES-GCM, AAD = itemId + version)
                                                                                         └─ wraps ─► ECDH private key (for sharing)
```

- **Per-item keys** let one item be shared without exposing anything else.
- **AAD = itemId + version.** If the server swaps or replays ciphertext between items, decryption fails.
- **Changing the master password** only re-wraps the Vault Key. Items are not re-encrypted.
- **Master password strength:** the minimum is a zxcvbn score of 3, checked in the browser.
- **Argon2id parameters** are stored with the vault, so they can be raised later.

### 3.2 What the server can see
Only: owner userId, categoryId, timestamps, version, deletedAt, and ciphertext sizes.
Everything else is encrypted, including site name, URL, username, favourite flag and custom field names.

### 3.3 Two-gate unlock
1. **Server gate (step-up):** before the server releases the wrapped Vault Key or any item ciphertext, it requires a fresh WebAuthn assertion with `userVerification: 'required'` **or** a valid TOTP code. This issues a short-lived **vault ticket** (an httpOnly cookie with the same TTL as auto-lock, max 30 min). A stolen login session alone cannot even download the vault.
2. **Client gate (decrypt):** PRF output or the master password unwraps the Vault Key in memory.

> Offline limitation: the offline cache already holds the wrapped key on the device, so offline unlock relies only on gate 2. This is acceptable, and the same as Bitwarden's offline mode.

### 3.4 Device passkeys (PRF)
- The vault registers its **own passkey per device** (the existing login passkeys may not have PRF).
- A new device can only be enrolled from a session where the vault is already unlocked, or by using the master password or recovery key on that device.
- If PRF is unsupported (old iOS, some Windows/Linux setups), the app falls back to the master password automatically and shows a hint.

### 3.5 Sharing crypto
- Each vault has an **ECDH P-256 key pair**. The public key is stored readable, and the private key is wrapped by the Vault Key.
- To share: ephemeral ECDH with the recipient's public key → HKDF → wrap the **item key** for the recipient.
- **Safety code:** both users can compare a short fingerprint of the recipient's public key, so a malicious server cannot substitute its own key.
- **Revoke:** delete the recipient's wrapped key, **rotate the item key** on the next save, and show a "change this password" reminder.

---

## 4. Phase 0 — Fix the existing auth (before any vault work)

Problems found in the current code:

| Problem | Where | Fix |
|---|---|---|
| No rate limit on TOTP or WebAuthn login (6-digit brute force) | `server/src/routes/auth.js` | `express-rate-limit`: limits per IP and per username on `/login/*`, `/register/*` and vault step-up. `app.set('trust proxy', …)` for Vercel → Render |
| TOTP codes can be replayed | `loginTotp` | Store `totpLastStep` and reject a reused step |
| `totpSecret` stored in plaintext | `models/User.js` | AES-256-GCM with a server env key `TOTP_ENC_KEY`, plus a migration script |
| Session tokens stored in plaintext | `models/User.js`, `requireAuth.js` | Store `sha256(token)` and look up by the hash |
| Token in `localStorage` (stealable via XSS) | `api/client.js`, `AuthContext.jsx` | **httpOnly, Secure, SameSite=Strict cookie**. The client stops handling the token |
| Cross-site cookie would be blocked by Safari (frontend on Vercel, API on onrender.com) | `client/vercel.json`, `.env.production` | Vercel **rewrite `/api/*` → Render** so the API is same-origin, and set `VITE_API_URL` to empty |
| CSRF once cookies are used | server | SameSite=Strict plus an `Origin` check on state-changing requests |
| No security headers | `server.js` | `helmet` on the API, and CSP plus other headers in `vercel.json` for the SPA |
| `userVerification: 'preferred'` | WebAuthn options | Keep for login. **`required`** for vault step-up |

**CSP (app-wide)** — draft:
```
default-src 'self'; script-src 'self' 'sha256-<theme-inline-script>' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https://res.cloudinary.com; connect-src 'self' https://api.pwnedpasswords.com;
frame-ancestors 'none'; base-uri 'self'; object-src 'none'
```
- `style-src 'unsafe-inline'` is needed because the app uses inline React `style={}` attributes and styled-components.
- Excalidraw loads fonts from a CDN by default. **Self-host them** via `window.EXCALIDRAW_ASSET_PATH`, or allow the CDN host in `font-src`. Decide after testing.

**Side effects:** every user is logged out once. Notes, drawings, image uploads, sharing and AI solve must all be retested.

---

## 5. Phase 1 — Core vault

### 5.1 Data models (server, Mongoose)

**`VaultMeta`** (one per user)
```js
{ userId (unique), kdf: { alg:'argon2id', salt, m, t, p },
  wrappedKeyPwd: { iv, ct },  wrappedKeyRecovery: { iv, ct },
  passkeys: [{ credentialID, publicKey, counter, transports, prfSalt, wrappedKey:{iv,ct}, deviceName, addedAt }],
  ecdhPublicKey, wrappedEcdhPrivate: { iv, ct },
  settings: { autoLockMinutes: 5 },          // readable, not secret
  createdAt, updatedAt }
```

**`VaultItem`**
```js
{ userId, categoryId, wrappedItemKey:{iv,ct}, data:{iv,ct}, version, deletedAt|null, createdAt, updatedAt }
// encrypted JSON inside `data`:
{ title, url, username, password, notes, favorite, passwordChangedAt,
  fields:[{ name, value, secret:bool }], history:[{ password, changedAt }] /* last 10 */ }
```

**`VaultCategory`** (custom categories only, because the 4 built-in ones live in code)
```js
{ userId, data:{iv,ct} /* { name, icon, template:[{name, secret}] } */, createdAt }
```

### 5.2 API (`/api/vault`, all routes `requireAuth`, data routes also need the vault ticket)
| Method | Route | Purpose |
|---|---|---|
| GET | `/meta/status` | Is a vault set up? Which unlock methods exist? (no secrets) |
| POST | `/setup` | Save VaultMeta for the first time |
| POST | `/stepup/webauthn-options` · `/stepup/webauthn-verify` | Passkey step-up (with PRF), returns the matching wrapped key plus the vault ticket |
| POST | `/stepup/totp` | TOTP step-up, returns the password-wrapped key plus the vault ticket |
| POST | `/lock` | Clear the vault ticket |
| GET | `/items` · `/categories` | Bulk-fetch ciphertext (for client-side search and offline cache) |
| POST/PUT | `/items`, `/items/:id` | Create / update. PUT sends `expectedVersion` and gets **409** on a conflict |
| POST/PUT/DELETE | `/categories…` | Custom categories |
| POST | `/passkeys/add-options` · `/passkeys/add-verify` | Enroll this device's vault passkey |
| PUT | `/meta/password` · `/meta/recovery` · `/meta/settings` | Re-wrap after a password change / new recovery key / auto-lock setting |

### 5.3 Client structure
```
client/src/vault/
  crypto/        keys.js (argon2, hkdf, wrap/unwrap), items.js (encrypt/decrypt w/ AAD), recovery.js, ecdh.js
  VaultContext.jsx   in-memory Vault Key, lock state, idle timer, visibilitychange → lock
  hooks/         useVaultItems, useRevealGuard (60s grace), useClipboardClear
  pages/         VaultSetup, VaultUnlock, VaultList, VaultItemEditor, VaultSettings
  components/    PasswordField (mask/eye/copy), PasswordGenerator, CategoryChips, StrengthMeter, CustomFieldsEditor
client/src/api/vault.js
```
- Routes: `/vault`, `/vault/setup`, `/vault/unlock`, `/vault/item/:id`, `/vault/settings` (and later `/vault/trash`, `/vault/health`).
- **Home screen:** a 4th card, "Vault", with a lock icon. The grid becomes 2×2 on phones/tablets and 4 columns on wide screens.
- **Setup wizard:** master password with a strength meter → recovery key screen (copy/print, then "type the last group to confirm") → register this device's passkey (skippable).
- **Unlock screen:** "Unlock with fingerprint" (PRF) as the primary button. Secondary: "Use authenticator code + master password".
- **Password generator:** `crypto.getRandomValues`, length 8–64, toggles for upper/lower/digits/symbols, and a passphrase option.
- The Vault Key is held as a **non-extractable `CryptoKey`** in React context, never in localStorage or sessionStorage. Lock drops the reference and clears all decrypted state.

## 6. Phase 2 — Safety: Trash, history, conflicts, offline
- **Trash:** delete sets `deletedAt` after re-verify. `/vault/trash` restores items or deletes them permanently. The server purges items older than 30 days (a daily check on startup or request, since Render has no cron).
- **Password history:** on save, if the password changed, push the old one into `history` (max 10) and update `passwordChangedAt`.
- **Conflicts:** a 409 response shows a dialog: "Changed on another device — keep mine / keep theirs / view both".
- **Offline cache:** IndexedDB (`idb`) stores VaultMeta plus encrypted items. An **outbox** queues edits and flushes them when back online. The app shell is cached by a service worker (`vite-plugin-pwa`). AuthContext must treat a *network error* (not a 401) as "offline, allow vault".
- Note: iOS Safari can evict site storage after about 7 days without use unless the app is installed to the Home Screen. The UI will suggest installing it.

## 7. Phase 3 — Import, export, health
- **CSV import** (`papaparse`): auto-detects Chrome / Firefox / Bitwarden column layouts, shows a preview table, then encrypts items one by one in the browser. Reminds you to delete the CSV file afterwards.
- **Encrypted backup export:** a `.nsvault` JSON file (wrapped keys plus ciphertext). It restores with the master password or recovery key.
- **Plain CSV export:** re-enter the master password, accept a red warning, then download a Bitwarden-format CSV. The warning tells you to delete the file.
- **Vault Health page:** weak (zxcvbn score < 3), reused (compared locally), old (> 1 year), and **breached**. For the breach check, the client computes SHA-1, sends the 5-character prefix to `api.pwnedpasswords.com/range/`, and matches the result locally. The breach check runs only when you tap "Check".

## 8. Phase 4 — Sharing
- Model **`VaultShare`**: `{ itemId, ownerId, recipientId, recipientUsername, wrappedItemKey, ephemeralPub, createdAt }`.
- The owner picks an existing Notespace user. The recipient must already have set up a vault (they get a "Set up your vault to receive this" notice).
- The recipient sees a **"Shared with me"** tab with read-only view and copy. Their items stay encrypted, and decryption uses their own ECDH private key.
- Safety-code comparison dialog. Revoke → rotate the item key → "Change this password" banner on the owner's item.
- This is separate from the existing `shareSchema` and never uses `visibility: 'public'`.

## 9. Known limits (shown to the user in the UI and help text)
- A browser can't clear the clipboard after you switch apps, and the Android keyboard's clipboard history keeps copies.
- A plain CSV export stays in Downloads until you delete it.
- JavaScript can't securely wipe memory. Auto-lock limits how long the key stays in memory.
- If the master password **and** the recovery key **and** all device passkeys are lost, the data cannot be recovered by anyone.
- This is a home-built vault, not an audited product. It uses only standard algorithms to reduce risk.

## 10. Verification (every phase)
- Run the mandatory skills from the global CLAUDE.md before and during the UI work, and use an awesome-design-md reference (1Password / Bitwarden-like clarity) for vault screens.
- **Playwright** on Chromium, Firefox and WebKit at phone, tablet and desktop widths, with screenshots of every new screen.
  - Chromium **virtual authenticator** (CDP `WebAuthn.addVirtualAuthenticator` with `hasPrf: true`) to test passkey unlock end to end.
  - Tests: setup → lock → unlock (PRF and password) → add/edit/reveal/copy → auto-lock on idle and on tab hide → wrong password fails → tampered ciphertext fails → 409 conflict → offline edit then sync.
- **DB check:** query MongoDB directly and confirm there is no plaintext title, URL, username or password in any vault document.
- **Regression:** Simple, Section, Shared, drawings, images and AI solve still work under the new CSP and cookie auth.

## 11. New dependencies
- Server: `helmet`, `express-rate-limit`, `cookie-parser`
- Client: `hash-wasm` (Argon2id), `@zxcvbn-ts/core` + `@zxcvbn-ts/language-common`
- Built in-house instead of adding packages: IndexedDB wrapper (instead of `idb`), CSV parser (instead of `papaparse`), a small service worker in `client/public/sw.js` (instead of `vite-plugin-pwa`)

## 12. Build order and checkpoints
| Phase | Deliverable | Checkpoint |
|---|---|---|
| 0 | Auth hardening + Vercel rewrite + CSP | You log in on phone and PC, and all Notes features work |
| 1 | Core vault | You set up the vault and save, unlock, reveal and copy credentials on phone and PC |
| 2 | Trash, history, conflicts, offline | Flight-mode test on phone |
| 3 | Import, exports, health | Import your real browser CSV |
| 4 | Sharing | Share one item with a second test account |

Each phase is its own commit series on its own branch, and you approve it before the next phase starts.
