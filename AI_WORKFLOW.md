# AI-assisted implementation record

The supplied brief was read from the user's attachment. The workspace was initially empty. The assistant implemented the application directly rather than submitting a plan or scaffold. No sub-agents were used.

## Work performed

- Created a Next.js App Router TypeScript app and installed the requested editor, persistence, validation and testing stack.
- Implemented Prisma models, SQL migration, idempotent demo seed, signed demo sessions, same-origin mutation checks, input limits and the permission service.
- Built the dashboard, editor, sharing dialog, user switching, search/views, JSON recovery download and TXT/Markdown import.
- Implemented serial autosave and database row locking with revision checks.
- Added Vitest / React Testing Library tests and a real HTTP/PostgreSQL acceptance script.
- Generated the documentation and environment example. No live URL or video recording is invented.

## Verification workflow and corrections

A separate PostgreSQL 18 instance under ignored workspace state was used initially. The migration and seed succeeded, and 26 HTTP/database integration checks passed against it. npm's initial security advisory was traced to Prisma's config dependency; a patched `deepmerge-ts` override removed the reported advisories. Initial lint findings were corrected rather than disabled.

The user supplied a local Supabase management-token file. The initial token parser truncated the newer underscore-containing token format and received 401; after correcting the parser, project discovery succeeded. The active `Collaborative_Editor` project had no application tables. A dedicated `draftly_app` login and private `draftly` schema were created; the existing postgres password was not reset. Connection strings were written only to ignored `.env`. The token itself is not in repository files.

The host blocked some sandboxed network/worker operations. Required operations were retried with scoped execution permissions. Vitest's initial worker timeouts were traced to jsdom 29 taking about a minute to import on this filesystem. Node tests were separated from the DOM suite, and jsdom was pinned to 26.1.0; all 28 tests then passed. No tests were skipped or disabled to obtain a pass.

Production build, TypeScript and ESLint succeeded. The Supabase migration and seed succeeded, and a second seed run completed without duplicates (verified: 3 users, 7 documents and 2 shares). A final CSS adjustment improved secondary-text contrast, followed by a successful production rebuild. All 26 acceptance checks then passed against that production build connected to Supabase, and HTTP smoke checks returned 200 for the dashboard and editor routes. The exact final command results are recorded in `SUBMISSION.md`.

Browser automation was attempted through the supported UI tools. The browser access host was unavailable; native browser selection later failed because the tool could not confidently determine the current Chrome URL and stopped Computer Use for the turn. No further UI actions were taken. This does not establish a visual acceptance pass, and no screenshot or video is presented as verified.

Official Next.js, Tiptap, Prisma and Supabase documentation was consulted. Next.js-generated repository guidance was read when it appeared. The Sites skill informed local implementation and preview workflow; the brief's explicit Next.js/Prisma/Supabase/Vercel requirements took precedence over the Sites-hosted stack.

## Deployment and production fixes

The assistant pushed the repository to GitHub, linked the Vercel project and connected it to the repository. The user entered the production environment variables in Vercel. Production checks then found three problems, which were fixed:

- `APP_ORIGIN` pointed at a Vercel domain owned by another project, so every mutation was rejected with 403. It was changed to the real production domain.
- Saves and sharing changes failed intermittently with 500. The row-lock query `SELECT ... FOR UPDATE` was raw SQL without a schema name. Supabase's transaction pooler does not keep the `search_path` Prisma sets, so the query sometimes failed with `relation "Document" does not exist` (16 of 30 concurrent attempts in a local reproduction). The query is now schema-qualified, the functions run in `pdx1` next to the database, and the transaction time limits were raised.
- Opening a document as a viewer showed a 403 save error. Tiptap's trailing-node plugin changes a document that ends in a list, which triggered autosave. Updates are now ignored while the editor is read-only.

After the fixes, all 26 integration checks passed against the live deployment.

## Human input still required

- TODO: Review the demo-authentication tradeoff and the acceptance scenario.
- TODO: Record and publish a walkthrough video, then replace its placeholder. No recording has been made.
- TODO: Perform manual visual, keyboard and responsive-browser review if automation remains unavailable.
- TODO: Replace demo account selection with production authentication before storing real data or launching a real product.

No external AI service is called by Draftly. The UI copy, CSS illustration, code, tests and documentation were authored during this session; no stock-image or generated-image service was needed.
