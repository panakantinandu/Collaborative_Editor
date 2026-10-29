import type { JSONContent } from "@tiptap/core";
export type User = { id: string; name: string; email: string; avatarColor: string };
export type Role = "OWNER" | "EDITOR" | "VIEWER";
export type Share = { id: string; userId: string; role: "EDITOR" | "VIEWER"; user: User };
export type Document = { id: string; title: string; preview?: string; contentJson: JSONContent; ownerId: string; owner: User; role: Role; revision: number; createdAt: string; updatedAt: string; shares: Share[] };
