import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

// Runs against an already running Next server and its configured PostgreSQL database.
// Creates uniquely named test documents and deletes only those IDs in finally.
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const prisma = new PrismaClient();
const created: string[] = [];
let checks = 0;
function check(name: string, fn: () => void) { fn(); checks++; console.log(`PASS ${name}`); }
type Result = { response: Response; body: Record<string, unknown> };
async function request(path: string, method = "GET", cookie = "", data?: unknown): Promise<Result> {
  const response = await fetch(`${base}/api/${path}`, { method, headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...(data !== undefined ? { "Content-Type": "application/json" } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  return { response, body: await response.json() };
}
type Doc = { id: string; title: string; contentJson: object; ownerId: string; revision: number };
const docOf = (result: Result) => result.body.document as Doc;
const paragraph = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A persistent first draft", marks: [{ type: "bold" }, { type: "underline" }] }] }, { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "A thoughtful heading", marks: [{ type: "italic" }] }] }] };
async function main() {
  const usersResult = await request("users");
  assert.equal(usersResult.response.status, 200);
  const users = usersResult.body.users as { id: string; name: string }[];
  const usersByName = Object.fromEntries(users.map(user => [user.name, user.id]));
  const cookies: Record<string, string> = {};
  for (const name of ["Alice", "Bob", "Charlie"]) {
    const session = await request("session", "POST", "", { userId: usersByName[name] });
    assert.equal(session.response.status, 200);
    const setCookie = session.response.headers.get("set-cookie")!;
    cookies[name] = setCookie.split(";")[0];
    check(`${name} receives an HTTP-only signed session`, () => { assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=lax/i); assert.match(cookies[name], /\./); });
  }
  check("anonymous document list denied", () => {});
  assert.equal((await request("documents")).response.status, 401);
  assert.equal((await request("documents", "GET", "draftly_session=demo-alice")).response.status, 401);
  check("unsigned impersonation denied", () => {});
  const spoof = await request("documents", "POST", cookies.Alice, { title: "spoof", contentJson: paragraph, ownerId: usersByName.Bob });
  check("client ownership injection rejected", () => assert.equal(spoof.response.status, 400));
  const result = await request("documents", "POST", cookies.Alice, { title: `Acceptance ${randomUUID()}`, contentJson: paragraph });
  assert.equal(result.response.status, 201); const doc = docOf(result); created.push(doc.id);
  check("document owner comes from the signed session", () => assert.equal(doc.ownerId, usersByName.Alice));
  const persisted = await prisma.document.findUniqueOrThrow({ where: { id: doc.id } });
  check("formatted document persisted in PostgreSQL", () => assert.deepEqual(persisted.contentJson, paragraph));
  const refresh = await request(`documents/${doc.id}`, "GET", cookies.Alice);
  check("formatting survives a fresh HTTP fetch", () => assert.deepEqual(docOf(refresh).contentJson, paragraph));
  assert.equal((await request(`documents/${doc.id}`, "GET", cookies.Charlie)).response.status, 404);
  assert.equal((await request(`documents/${doc.id}/shares`, "GET", cookies.Charlie)).response.status, 404);
  check("unshared Charlie denied document and collaborator reads", () => {});
  const charlieList = await request("documents", "GET", cookies.Charlie);
  check("dashboard filtered server-side", () => assert.equal((charlieList.body.documents as Doc[]).some(item => item.id === doc.id), false));
  assert.equal((await request(`documents/${doc.id}`, "PATCH", cookies.Charlie, { title: "hacked", contentJson: paragraph, revision: 1 })).response.status, 404);
  check("unshared Charlie denied direct mutation", () => {});
  const grant = await request(`documents/${doc.id}/shares`, "POST", cookies.Alice, { userId: usersByName.Bob, role: "EDITOR" });
  check("owner can grant Editor access", () => assert.equal(grant.response.status, 201));
  assert.equal((await request(`documents/${doc.id}/shares`, "POST", cookies.Alice, { userId: usersByName.Bob, role: "VIEWER" })).response.status, 409);
  check("duplicate shares rejected", () => {});
  const bobRead = await request(`documents/${doc.id}`, "GET", cookies.Bob);
  check("Bob can read a shared document", () => assert.equal(bobRead.response.status, 200));
  const bobEdit = await request(`documents/${doc.id}`, "PATCH", cookies.Bob, { title: "Edited by Bob", contentJson: paragraph, revision: 1 });
  check("Editor can edit and rename", () => { assert.equal(bobEdit.response.status, 200); assert.equal(docOf(bobEdit).revision, 2); });
  assert.equal((await request(`documents/${doc.id}/shares`, "POST", cookies.Bob, { userId: usersByName.Charlie, role: "EDITOR" })).response.status, 403);
  assert.equal((await request(`documents/${doc.id}/shares/${usersByName.Bob}`, "DELETE", cookies.Bob)).response.status, 403);
  check("Editor cannot grant or revoke access", () => {});
  const stale = await request(`documents/${doc.id}`, "PATCH", cookies.Alice, { title: "Stale write", contentJson: paragraph, revision: 1 });
  check("stale revision receives 409", () => assert.equal(stale.response.status, 409));
  const races = await Promise.all(["A", "B"].map(title => request(`documents/${doc.id}`, "PATCH", cookies.Alice, { title, contentJson: paragraph, revision: 2 })));
  check("concurrent writes cannot silently overwrite", () => assert.deepEqual(races.map(r => r.response.status).sort(), [200, 409]));
  assert.equal((await request(`documents/${doc.id}/shares/${usersByName.Bob}`, "PATCH", cookies.Alice, { role: "VIEWER" })).response.status, 200);
  check("owner can downgrade Bob to Viewer", () => {});
  assert.equal((await request(`documents/${doc.id}`, "PATCH", cookies.Bob, { title: "Viewer write", contentJson: paragraph, revision: 3 })).response.status, 403);
  assert.equal((await request(`documents/${doc.id}`, "GET", cookies.Bob)).response.status, 200);
  check("Viewer retains read access but mutation is denied", () => {});
  assert.equal((await request(`documents/${doc.id}/shares/${usersByName.Bob}`, "DELETE", cookies.Alice)).response.status, 200);
  assert.equal((await request(`documents/${doc.id}`, "GET", cookies.Bob)).response.status, 404);
  check("revocation removes Bob’s access", () => {});
  const crossOrigin = await fetch(`${base}/api/documents`, { method: "POST", headers: { Origin: "https://evil.example", Cookie: cookies.Alice, "Content-Type": "application/json" }, body: "{}" });
  check("cross-origin mutation rejected", () => assert.equal(crossOrigin.status, 403));
  async function upload(name: string, bytes: BlobPart[]) {
    const form = new FormData(); form.append("file", new File(bytes, name));
    const response = await fetch(`${base}/api/documents/import`, { method: "POST", headers: { Cookie: cookies.Alice, Origin: base }, body: form });
    return { response, body: await response.json() } as Result;
  }
  const imported = await upload("A new idea.md", ["# A new idea\n\n**Strong** and *thoughtful*.\n\n- One\n- Two"]);
  assert.equal(imported.response.status, 201); const importedDoc = docOf(imported); created.push(importedDoc.id);
  check("Markdown import creates an owned editable document", () => { assert.equal(importedDoc.ownerId, usersByName.Alice); assert.equal(importedDoc.title, "A new idea"); });
  assert.equal((await request(`documents/${importedDoc.id}`, "PATCH", cookies.Alice, { title: "Imported and edited", contentJson: importedDoc.contentJson, revision: 1 })).response.status, 200);
  check("imported document supports editing", () => {});
  assert.equal((await upload("bad.docx", ["test"])).response.status, 400);
  assert.equal((await upload("big.txt", [new Uint8Array(2 * 1024 * 1024 + 1)])).response.status, 413);
  assert.equal((await upload("bad.txt", [new Uint8Array([255, 254])])).response.status, 400);
  check("upload API rejects unsupported, oversized, and invalid UTF-8 files", () => {});
  console.log(`\n${checks} integration checks passed against real HTTP routes and PostgreSQL.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.document.deleteMany({ where: { id: { in: created } } }); await prisma.$disconnect(); });
