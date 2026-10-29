import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_EMAILS, MAX_FILE_BYTES } from "@/lib/constants";
import { SESSION_COOKIE, SESSION_SECONDS, signSession } from "@/lib/session";
import { route, jsonBody, readBody } from "@/lib/http";
import { fail } from "@/lib/errors";
import { createDocument, getDocument, listDocuments, manageShare, updateDocument, userSelect } from "@/lib/documents";
import { importDocument } from "@/lib/import";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const shareSchema = z.object({ userId: z.string().min(1).max(100), role: z.enum(["EDITOR", "VIEWER"]) }).strict();
const handler = route(async request => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\//, "").split("/");
  const method = request.method;
  if (path.length === 1 && path[0] === "users" && method === "GET") {
    return Response.json({ users: await db.user.findMany({ where: { email: { in: DEMO_EMAILS } }, select: userSelect, orderBy: { name: "asc" } }) });
  }
  if (path.length === 1 && path[0] === "session") {
    if (method === "GET") return Response.json({ user: await currentUser() });
    if (method === "POST") {
      const { userId } = z.object({ userId: z.string().min(1).max(100) }).strict().parse(await jsonBody(request, 2048));
      const user = await db.user.findFirst({ where: { id: userId, email: { in: DEMO_EMAILS } }, select: userSelect });
      if (!user) fail(404, "USER_NOT_FOUND", "This demo account is unavailable. Run the database seed.");
      const response = NextResponse.json({ user });
      response.cookies.set(SESSION_COOKIE, signSession(user.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS });
      return response;
    }
  }
  const user = await requireUser();
  if (path[0] !== "documents") fail(404, "NOT_FOUND", "This endpoint does not exist.");
  if (path.length === 1) {
    if (method === "GET") {
      const query = z.object({ scope: z.enum(["all", "mine", "shared"]).default("all"), search: z.string().max(180).default("") }).parse(Object.fromEntries(url.searchParams));
      return Response.json({ documents: await listDocuments(user.id, query.scope, query.search) });
    }
    if (method === "POST") return Response.json({ document: await createDocument(user.id, await jsonBody(request)) }, { status: 201 });
  }
  if (path.length === 2 && path[1] === "import" && method === "POST") {
    const type = request.headers.get("content-type") ?? "";
    if (!type.startsWith("multipart/form-data;")) fail(415, "INVALID_CONTENT_TYPE", "Upload a file using multipart/form-data.");
    const body = await readBody(request, MAX_FILE_BYTES + 16_384);
    let form: FormData;
    try { form = await new Request(request.url, { method: "POST", headers: { "content-type": type }, body: Buffer.from(body) }).formData(); }
    catch { return fail(400, "INVALID_FILE", "The upload could not be read."); }
    const entries = Array.from(form.entries());
    if (entries.length !== 1 || entries[0][0] !== "file" || typeof entries[0][1] === "string") fail(400, "INVALID_FILE", "Upload exactly one file in the file field.");
    const file = entries[0][1] as File;
    const input = importDocument(file.name, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ document: await createDocument(user.id, input) }, { status: 201 });
  }
  const id = z.string().min(1).max(100).parse(path[1]);
  if (path.length === 2) {
    if (method === "GET") return Response.json({ document: await getDocument(user.id, id) });
    if (method === "PATCH") return Response.json({ document: await updateDocument(user.id, id, await jsonBody(request)) });
  }
  if (path[2] === "shares" && path.length === 3) {
    if (method === "GET") {
      const doc = await getDocument(user.id, id);
      return Response.json({ owner: doc.owner, shares: doc.shares });
    }
    if (method === "POST") {
      const input = shareSchema.parse(await jsonBody(request, 2048));
      return Response.json({ share: await manageShare(user.id, id, input.userId, input.role, "create") }, { status: 201 });
    }
  }
  if (path[2] === "shares" && path.length === 4) {
    const targetId = z.string().min(1).max(100).parse(path[3]);
    if (method === "PATCH") {
      const { role } = shareSchema.omit({ userId: true }).parse(await jsonBody(request, 2048));
      return Response.json({ share: await manageShare(user.id, id, targetId, role, "update") });
    }
    if (method === "DELETE") {
      await manageShare(user.id, id, targetId, null, "delete");
      return Response.json({ success: true });
    }
  }
  return fail(405, "METHOD_NOT_ALLOWED", "This action is not supported.");
});
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
