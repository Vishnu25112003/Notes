# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The owner plus a small circle of friends/teammates, each with their own account. They capture notes, organise study/work material, and store credentials. They actively share notes and pages with each other. Usage is split about 50/50 between phone and desktop, plus tablets.

## Product Purpose
Notespace is a personal knowledge workspace with three modes:
- **Simple:** flat quick notes.
- **Section:** a Sections → Pages → Sub-pages tree with rich text, images and drawings.
- **Vault:** an end-to-end encrypted credentials store (planned in `VAULT_IMPLEMENTATION_PLAN.md`).

Success means you can capture something fast, find it again, and trust that secrets are safe.

## Positioning
Notes, freehand drawing with AI auto-solve, and a zero-knowledge credential vault live in one passwordless app, unlocked with passkeys or an authenticator.

## Operating Context
- Login is passwordless: WebAuthn passkey or a TOTP authenticator.
- The frontend is deployed on Vercel (psnnotes.vercel.app) and the API on Render. Render's free tier sleeps, which causes cold starts.
- Data lives in MongoDB Atlas, images in Cloudinary, and AI solve runs on Groq.

## Capabilities and Constraints
- Rich text (TipTap), drawing (Excalidraw), sharing with view/edit/clone and access requests, search, and export to PDF/DOC/MD/TXT. Dark and light themes.
- The Vault must never send plaintext secrets to the server or to any third-party service.
- The stack is React 19, Vite, Tailwind 4, Express 5 and Mongoose.

## Evidence on Hand
No testimonials, metrics or press. Don't fabricate any.

## Product Principles
1. Security over convenience where secrets are involved, with no silent weakening.
2. It has to work equally well with a thumb on a phone and with a keyboard on desktop.
3. Fast capture: keep the steps between opening the app and writing to a minimum.
4. Be honest about limits. Tell the user what the app cannot protect.

## Accessibility & Inclusion
- WCAG AA contrast in both light and dark themes.
- Large touch targets on phone and tablet.
- Full keyboard operation on desktop.
- Respect `prefers-reduced-motion`.
