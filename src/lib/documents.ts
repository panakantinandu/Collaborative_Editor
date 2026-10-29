import { Prisma, type ShareRole } from "@prisma/client";
import { db } from "@/lib/db";
import { fail } from "@/lib/errors";
import { DEMO_EMAILS, EMPTY_DOC } from "@/lib/constants";
import { contentSchema, titleSchema, plainText } from "@/lib/content";
import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
export const userSelect = { id: true, name: true, email: true, avatarColor: true } as const;
const include = { owner: { select: userSelect }, shares: { include: { user: { select: userSelect } } } } as const;
type Loaded = Prisma.DocumentGetPayload<{ include: typeof include }>;
export function permission(doc: Pick<Loaded, "ownerId" | "shares">, userId: string) {
  return doc.ownerId === userId ? "OWNER" : doc.shares.find(s => s.userId === userId)?.role ?? null;
}
function visible(doc: Loaded | null, userId: string) {
  if (!doc || !permission(doc, userId)) return fail(404, "NOT_FOUND", "This document is unavailable or you no longer have access.");
  return { ...doc, role: permission(doc, userId)! };
}
export const createSchema = z.object({ title: titleSchema.default("Untitled document"), contentJson: contentSchema.default(EMPTY_DOC) }).strict();
export const updateSchema = z.object({ title: titleSchema, contentJson: contentSchema, revision: z.number().int().positive() }).strict();
export async function listDocuments(userId: string, scope: string, search: string) {
  const access: Prisma.DocumentWhereInput = scope === "mine" ? { ownerId: userId } : scope === "shared" ? { shares: { some: { userId } } } : { OR: [{ ownerId: userId }, { shares: { some: { userId } } }] };
  const documents = await db.document.findMany({ where: { AND: [access, { title: { contains: search, mode: "insensitive" } }] }, include, orderBy: { updatedAt: "desc" }, take: 100 });
  return documents.map(doc => ({ ...visible(doc, userId), preview: plainText(doc.contentJson as JSONContent).slice(0, 220), contentJson: undefined }));
}
export async function getDocument(userId: string, id: string) { return visible(await db.document.findUnique({ where: { id }, include }), userId); }
export async function createDocument(userId: string, input: unknown) {
  const data = createSchema.parse(input);
  return db.document.create({ data: { title: data.title, contentJson: data.contentJson as Prisma.InputJsonValue, ownerId: userId }, include });
}
// All writes lock the same document row, including sharing changes. Access is re-read
// after acquiring the lock, so a concurrent revocation cannot race an edit.
async function withDocument<T>(userId: string, id: string, work: (tx: Prisma.TransactionClient, doc: Loaded, role: string) => Promise<T>) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "Document" WHERE "id" = ${id} FOR UPDATE`;
    const doc = visible(await tx.document.findUnique({ where: { id }, include }), userId);
    return work(tx, doc, doc.role);
  });
}
export async function updateDocument(userId: string, id: string, input: unknown) {
  const data = updateSchema.parse(input);
  return withDocument(userId, id, async (tx, doc, role) => {
    if (role === "VIEWER") fail(403, "READ_ONLY", "You have view-only access to this document.");
    if (doc.revision !== data.revision) fail(409, "REVISION_CONFLICT", "Someone else saved changes. Download your draft, then load the latest version.");
    return tx.document.update({ where: { id }, data: { title: data.title, contentJson: data.contentJson as Prisma.InputJsonValue, revision: { increment: 1 } }, include });
  });
}
export async function manageShare(userId: string, id: string, targetId: string, role: ShareRole | null, action: "create" | "update" | "delete") {
  return withDocument(userId, id, async (tx, doc, access) => {
    if (access !== "OWNER") fail(403, "OWNER_ONLY", "Only the owner can manage sharing.");
    if (targetId === doc.ownerId) fail(400, "OWNER_ACCESS", "The owner already has full access.");
    const target = await tx.user.findFirst({ where: { id: targetId, email: { in: DEMO_EMAILS } } });
    if (!target) fail(404, "USER_NOT_FOUND", "Choose an existing demo user.");
    const where = { documentId_userId: { documentId: id, userId: targetId } };
    if (action === "create") return tx.documentShare.create({ data: { documentId: id, userId: targetId, role: role! }, include: { user: { select: userSelect } } });
    if (!(await tx.documentShare.findUnique({ where }))) fail(404, "SHARE_NOT_FOUND", "This person no longer has access.");
    if (action === "delete") return tx.documentShare.delete({ where });
    return tx.documentShare.update({ where, data: { role: role! }, include: { user: { select: userSelect } } });
  });
}
