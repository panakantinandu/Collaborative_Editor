# Draftly

A thoughtful workspace for writing and sharing. Built for the Ajaia take-home brief using one Next.js App Router project, TypeScript, Tailwind CSS, shadcn-style Radix UI components, Lucide, Tiptap, Prisma/PostgreSQL, and Zod. No paid APIs or AI services are used by the application.

## Requirements

- Node.js 24 LTS (development used 24.11.0) and npm.
- PostgreSQL 15+ or a Supabase PostgreSQL project.
- A database role that owns the application schema and can apply migrations.

## Local setup

```sh
npm ci
cp .env.example .env
```

PowerShell: use `Copy-Item .env.example .env` and `npm.cmd` if your shell blocks npm's PowerShell shim. Do not overwrite an already configured `.env`.

Set these server-only variables in `.env`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Runtime PostgreSQL connection; use Supabase transaction pooler on port 6543 with `pgbouncer=true&connection_limit=5` |
| `DIRECT_URL` | Direct or session-pooler connection (port 5432) for migrations |
| `SESSION_SECRET` | At least 32 random characters; shared by all server instances |
| `APP_ORIGIN` | Exact browser origin, e.g. `http://127.0.0.1:3000`, with no path |

Generate a session secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never put credentials in `NEXT_PUBLIC_*` variables or commit `.env`.

For local PostgreSQL, create a database with `createdb draftly`. Use a connection such as `postgresql://USER:PASSWORD@127.0.0.1:5432/draftly` for both database variables. Add `?schema=draftly` to both if using a dedicated schema. The migration enables RLS; connect as the schema/table owner through Prisma, not the anonymous Supabase API role.

```sh
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:3000**. Set `APP_ORIGIN` to that exact origin. `localhost` and `127.0.0.1` are distinct origins; using the wrong one produces a clear 403 error on mutations.

The seed is idempotent: Alice, Bob, and Charlie are upserted; example documents are created only when missing; existing content and changed/revoked sample permissions are preserved. Seed examples include private notebooks and documents shared between Alice and Bob.

## Supabase configuration

1. Open the intended project and use **Connect** to get the transaction and session pooler URLs. URL-encode special characters in passwords. See [Supabase connection documentation](https://supabase.com/docs/guides/database/connecting-to-postgres).
2. Use a dedicated `draftly` schema and preferably a dedicated login role. Both URLs must use the same schema and database. A private schema need not be exposed through the Supabase Data API.
3. Set `DATABASE_URL` with `?schema=draftly&pgbouncer=true&connection_limit=5&sslmode=require`, and `DIRECT_URL` with `?schema=draftly&sslmode=require` on port 5432.
4. Run the generation, migration, and seed commands above. `prisma migrate deploy` does not require a shadow database. Use `npx prisma migrate dev --name CHANGE` only with a development database and shadow-database privileges when authoring a new migration.
5. Supabase Auth, Storage, service-role API keys, and Realtime are not required. All access goes through server-side Prisma. The supplied migration enables row-level security without anonymous policies as defense against accidental Data API exposure. The table-owning backend role is responsible for application authorization.

This workspace's ignored `.env` was configured for the existing **Collaborative_Editor** project using a dedicated `draftly_app` role. The original project password was not reset. The management token remains in the user-provided file and is not needed to run the app. The isolated local test database is separate; its configuration backup is ignored under `.local/`.

## Demo accounts and permissions

**Demo authentication is intentionally non-production. Anyone using this application can select any of the three demo users. Do not store sensitive data.** The first dashboard visit initializes Alice using the session endpoint; use the sidebar switcher to become Bob or Charlie.

| Account | Email |
| --- | --- |
| Alice | alice@draftly.demo |
| Bob | bob@draftly.demo |
| Charlie | charlie@draftly.demo |

The server signs an expiring HMAC session cookie, sets `HttpOnly` and `SameSite=Lax`, sets `Secure` in production, and checks the identity against the database's demo allowlist. Arbitrary unsigned cookies and identity headers do not work. A client cannot choose a document owner when creating or importing.

| Permission | Read | Edit / rename | Manage sharing |
| --- | --- | --- | --- |
| Owner | Yes | Yes | Yes |
| Editor | Yes | Yes | No |
| Viewer | Yes | No | No |
| Unshared | No | No | No |

Sharing grants access to existing demo users; it does not send an email. Copying a link does not grant access. Unavailable and unshared documents both return 404 to avoid confirming document existence.

## Editing and imports

- Tiptap JSON persists bold, italic, underline, headings H1/H2, lists, quotes, code, and rules. Toolbar controls include undo/redo.
- Autosave waits approximately 700 ms and serializes in-flight saves. Saving/Saved/Error status reflects the latest local edit, not an old response.
- Each edit includes its last known revision. Stale revisions receive 409; the local draft remains available for a JSON download before loading the latest document. JSON recovery downloads are not import files; they preserve formatting for manual recovery.
- Back-to-workspace controls flush pending changes, failures offer stay/download/discard, and browser unloading/back navigation warns about unsaved changes. Abrupt process termination can still lose a pending draft.
- Access is enforced on every server operation; an open editor refreshes its permission on window focus and every 15 seconds. Previously downloaded content cannot be remotely erased.
- Import accepts one UTF-8 `.txt` or `.md` file, maximum 2 MB. Server checks extension, bytes, encoding, empty/binary data, and structure. Content JSON is limited to 3 MB, 24 levels, and 100,000 nodes.
- Markdown preserves basic headings, bold/italic, lists, blockquotes, code and rules. H3–H6 map to H2, links become labels, image URLs become alt text, and raw HTML is omitted. No HTML injection, images, tables, GFM extensions, attachments, or DOCX import is claimed.

## API

All private endpoints require a valid session. Mutations require `Origin` to equal `APP_ORIGIN`. JSON requests must specify `Content-Type: application/json`. Errors use `{ "error": { "code": "...", "message": "..." } }`; successful responses and errors are `Cache-Control: no-store`.

| Method and endpoint | Input / result |
| --- | --- |
| `GET /api/users` | Public demo directory; returns `users` |
| `GET /api/session` | Returns active `user` or null |
| `POST /api/session` | `{ userId }`; sets signed demo session |
| `GET /api/documents?scope=all&search=` | `all`, `mine`, or `shared`; authorized documents only, newest first, maximum 100 |
| `POST /api/documents` | `{ title?, contentJson? }`; owner comes from session |
| `GET /api/documents/:id` | Returns authorized `document` with content, role, and revision |
| `PATCH /api/documents/:id` | `{ title, contentJson, revision }`; owner/editor only |
| `POST /api/documents/import` | multipart `file`; returns a newly owned document |
| `GET /api/documents/:id/shares` | Authorized users may inspect collaborators |
| `POST /api/documents/:id/shares` | Owner only: `{ userId, role: "EDITOR" | "VIEWER" }` |
| `PATCH /api/documents/:id/shares/:userId` | Owner only: `{ role }` |
| `DELETE /api/documents/:id/shares/:userId` | Owner only; revokes access |

Validation is strict: unknown ownership fields are rejected. Status codes include 201 for creation, 400 for invalid input, 401 for missing/invalid authentication, 403 for denied mutations or origin, 404 for unavailable resources, 409 for stale revisions or duplicate sharing, 413 for excessive size, and 415 for invalid request media type. Document deletion is intentionally omitted (optional in the brief).

## Verification

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

With the server running against the same `.env` database:

```sh
npm run test:integration
```

The integration script calls real HTTP endpoints with separate Alice/Bob/Charlie cookie jars, confirms persistence directly in PostgreSQL, tests concurrent revisions and permission changes, and deletes only documents it creates. Use a demo/development database. `TEST_BASE_URL` can override the default local URL; it must match the running server's `APP_ORIGIN`. Unit/component tests use Vitest and React Testing Library. See `SUBMISSION.md` for the actual verified results and remaining limitations.

## Vercel deployment

1. Push the source and lockfile to a repository, excluding `.env`, `.local`, `node_modules`, and `.next`.
2. Import into Vercel as a Next.js project, choose Node.js 24, and use `npm ci` / `npm run build`.
3. Set all four environment variables in Vercel. Use a strong persistent `SESSION_SECRET`, Supabase connection strings, and the exact HTTPS production domain for `APP_ORIGIN`. No `NEXT_PUBLIC_*` secret is needed.
4. From a trusted environment with those database variables, run `npm run db:migrate` and `npm run db:seed`. Do not seed on every request or every preview build. The build runs Prisma generation but does not mutate the database.
5. Deploy, then run the acceptance walkthrough on the actual URL. A preview deployment needs its own matching `APP_ORIGIN`; do not weaken origin verification with a wildcard.
6. Record the verified URL and a human-recorded walkthrough in `SUBMISSION.md` and `walkthrough-video-url.txt`.

## Scope and limitations

This is saved-document collaboration, not simultaneous real-time editing. No CRDTs, production identity, email invitations, attachments, version history, deletion UI, or offline synchronization. Dashboard results cap at 100; pagination and full-text content search are future improvements. Demo sessions share a cookie across tabs, so use different browser profiles/incognito sessions to test independent simultaneous identities. Use separate demo databases for untrusted public testing; production auth, rate limiting, quotas and abuse controls are required before a real launch.

Design and security tradeoffs: [ARCHITECTURE.md](./ARCHITECTURE.md). Implementation workflow: [AI_WORKFLOW.md](./AI_WORKFLOW.md).
