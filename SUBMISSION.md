# Draftly submission

Live URL: **https://collaborative-editor-neon-alpha.vercel.app**

Walkthrough URL: **TODO — add the uploaded video link**

## Delivered source

- One Next.js App Router + TypeScript application with server route handlers.
- Tailwind styling, reusable shadcn-style Radix Button/Dialog controls and Lucide icons.
- Dashboard with demo-user switching, ownership/shared filters, title search, grid/list view, sorting, document creation and import.
- Tiptap editor with editable titles, formatting, undo/redo, autosave status, viewer mode, owner information and sharing.
- Sharing management: grant Editor/Viewer, list collaborators, modify permission, revoke access and copy restricted links.
- Signed HTTP-only demo cookies, database identity validation, authorization on reads and writes, same-origin mutation checks and consistent API errors.
- Prisma PostgreSQL schema, migration, private-schema Supabase configuration and idempotent Alice/Bob/Charlie seed.
- Revision checks with HTTP 409, document-row locking, queued saves and unsaved-draft recovery UI.
- UTF-8 TXT/Markdown import with extension, size, encoding, content and schema validation.
- Unit/component tests and a real HTTP/PostgreSQL acceptance script.
- README, architecture/Mermaid documentation, workflow record, this submission manifest, `.env.example`, and walkthrough placeholder.

## Verification record

Verified on October 29, 2026:

| Command / check | Actual outcome |
| --- | --- |
| `npm run db:generate` | Prisma client generated successfully |
| `npm run db:migrate` | Migration applied to isolated PostgreSQL 18, then to the real Supabase project |
| `npm run db:seed` | Succeeded locally and on Supabase; repeated Supabase seed preserved 3 users, 7 sample documents, and 2 shares |
| `npm test` | **28 tests passed in 4 files**, including actual Tiptap and Radix component rendering |
| `npm run typecheck` | Passed with no TypeScript errors |
| `npm run lint` | Passed with no lint errors or warnings |
| `npm run build` | Passed; final contrast adjustment included in a second successful production build |
| `npm run test:integration` against local PostgreSQL | **26 checks passed** through real Next.js HTTP routes and database persistence |
| `npm start` + `npm run test:integration` against Supabase | **26 checks passed** against the production build and the actual Supabase database, including the complete Alice/Bob/Charlie scenario, formatting persistence, concurrent writes and Markdown import |
| Production HTTP smoke check | Dashboard and document-editor routes both returned **200**; dashboard HTML referenced its stylesheet |
| Supabase configuration inspection | Confirmed the runtime uses `draftly_app` in private `draftly` schema; RLS enabled on all three application tables |
| npm dependency audit during final installation | **0 vulnerabilities reported** |
| Vercel production deployment (October 29, 2026) | Functions run in `pdx1`, next to the us-west-2 Supabase database. `npm run test:integration` with `TEST_BASE_URL` set to the live URL: **26 checks passed** against the deployment |
| Browser visual walkthrough | **Not completed**: the browser host was unavailable, and native Computer Use later stopped because it could not reliably verify Chrome's current URL |

All mandatory automated checks passed. Browser/manual visual verification is not implied by those results. The temporary verification servers were stopped; the Supabase-backed `.env` remains configured locally and is ignored by version control.

## Next command

From this configured Windows workspace, run `npm.cmd run dev`, then open **http://127.0.0.1:3000**. No further Supabase credential setup is needed for this workspace. A fresh checkout needs the environment setup in `README.md`.

## Deliberately incomplete / excluded

- Production authentication, real-time simultaneous editing, CRDTs, email delivery, attachment storage, DOCX import and document deletion are not implemented.
- No claim of exhaustive browser/mobile/accessibility auditing is made.
- The dashboard returns at most 100 matching documents. No pagination or content search.
- Draft download exports JSON for manual recovery; re-importing JSON is not supported.

## Acceptance walkthrough

1. Open the dashboard as Alice and create a new document. Set a title, type content, apply bold/italic/underline, a heading and a list. Wait for All changes saved and refresh.
2. Share with Bob as Editor. Switch to Bob from the dashboard; open, edit and rename it.
3. Switch to Charlie. Confirm it is absent from his dashboard and the copied document URL is unavailable. The integration script also checks direct API denial.
4. Return to Alice and change Bob to Viewer. Switch to Bob, verify read-only UI; the integration script confirms a forged PATCH receives 403.
5. Alice revokes access. Bob loses access, including direct API requests.
6. Import a UTF-8 `.md` file, confirm heading/formatting/list structure, edit, wait for saving, and refresh.
7. Optional conflict demonstration: two independent browser sessions open the same revision; save in one and then the other. The second receives a recoverable conflict instead of silently overwriting.
