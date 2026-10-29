import { getSchema, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { z } from "zod";
import { MAX_CONTENT_BYTES } from "@/lib/constants";
export const editorExtensions = [StarterKit.configure({ heading: { levels: [1, 2] }, link: false })];
const schema = getSchema(editorExtensions);
const nodeTypes = new Set(["doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "blockquote", "codeBlock", "hardBreak", "horizontalRule"]);
const markTypes = new Set(["bold", "italic", "underline", "strike", "code"]);
export function validContent(value: unknown): value is JSONContent {
  try {
    if (!value || typeof value !== "object" || (value as JSONContent).type !== "doc") return false;
    if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_CONTENT_BYTES) return false;
    const queue: { node: JSONContent; depth: number }[] = [{ node: value as JSONContent, depth: 0 }];
    let count = 0;
    while (queue.length) {
      const { node, depth } = queue.pop()!;
      if (++count > 100_000 || depth > 24 || !node || typeof node !== "object" || !nodeTypes.has(node.type ?? "")) return false;
      if (Object.keys(node).some(key => !["type", "attrs", "content", "marks", "text"].includes(key))) return false;
      if (node.text !== undefined && (typeof node.text !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(node.text))) return false;
      if (node.attrs) {
        const allowed = node.type === "heading" ? ["level"] : node.type === "orderedList" ? ["start", "type"] : node.type === "codeBlock" ? ["language"] : [];
        if (Object.keys(node.attrs).some(key => !allowed.includes(key))) return false;
        if (node.type === "heading" && ![1, 2].includes(node.attrs.level)) return false;
        if (node.type === "orderedList" && node.attrs.start !== undefined && (!Number.isSafeInteger(node.attrs.start) || node.attrs.start < 1)) return false;
        if (node.attrs.language != null && (typeof node.attrs.language !== "string" || !/^[a-zA-Z0-9_+-]{1,40}$/.test(node.attrs.language))) return false;
      }
      if (node.marks && (!Array.isArray(node.marks) || node.marks.some(mark => !markTypes.has(mark.type) || Object.keys(mark).some(key => key !== "type")))) return false;
      if (node.content !== undefined) {
        if (!Array.isArray(node.content)) return false;
        for (const child of node.content) queue.push({ node: child, depth: depth + 1 });
      }
    }
    schema.nodeFromJSON(value).check();
    return true;
  } catch { return false; }
}
export const contentSchema = z.custom<JSONContent>(validContent, "Invalid or oversized editor content (maximum 3 MB; headings H1/H2 and basic formatting only).");
export const titleSchema = z.string().trim().min(1, "Give your document a title.").max(180, "Titles can contain up to 180 characters.");
export function plainText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(plainText).join(["doc", "bulletList", "orderedList"].includes(node.type ?? "") ? " " : "");
}
