import { unified } from "unified";
import remarkParse from "remark-parse";
import type { JSONContent } from "@tiptap/core";
import { MAX_FILE_BYTES } from "@/lib/constants";
import { contentSchema } from "@/lib/content";
import { fail } from "@/lib/errors";
type MdNode = { type: string; value?: string; depth?: number; ordered?: boolean; start?: number; lang?: string; alt?: string; children?: MdNode[] };
function convert(node: MdNode, marks: { type: string }[] = [], depth = 0): JSONContent[] {
  if (depth > 24) fail(400, "INVALID_FILE", "This Markdown file is too deeply nested.");
  const children = (nextMarks = marks) => (node.children ?? []).flatMap(child => convert(child, nextMarks, depth + 1));
  switch (node.type) {
    case "text": return node.value ? [{ type: "text", text: node.value, ...(marks.length ? { marks } : {}) }] : [];
    case "strong": return children([...marks, { type: "bold" }]);
    case "emphasis": return children([...marks, { type: "italic" }]);
    case "inlineCode": return node.value ? [{ type: "text", text: node.value, marks: [...marks, { type: "code" }] }] : [];
    case "paragraph": return [{ type: "paragraph", content: children() }];
    case "heading": return [{ type: "heading", attrs: { level: Math.min(node.depth ?? 1, 2) }, content: children() }];
    case "list": return [{ type: node.ordered ? "orderedList" : "bulletList", ...(node.ordered ? { attrs: { start: node.start || 1 } } : {}), content: children() }];
    case "listItem": return [{ type: "listItem", content: children() }];
    case "blockquote": return [{ type: "blockquote", content: children() }];
    case "code": return [{ type: "codeBlock", content: node.value ? [{ type: "text", text: node.value }] : [] }];
    case "break": return [{ type: "hardBreak" }];
    case "thematicBreak": return [{ type: "horizontalRule" }];
    case "image": return node.alt ? [{ type: "text", text: node.alt }] : [];
    // Raw HTML is omitted. Links become plain labels; no arbitrary HTML or URLs are rendered.
    case "html": return [];
    default: return children();
  }
}
export function importDocument(name: string, bytes: Uint8Array) {
  if (!/\.(txt|md)$/i.test(name)) fail(400, "INVALID_FILE_TYPE", "Choose a .txt or .md file.");
  if (bytes.byteLength > MAX_FILE_BYTES) fail(413, "FILE_TOO_LARGE", "Files must be 2 MB or smaller.");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return fail(400, "INVALID_ENCODING", "Save your file as UTF-8 text and try again."); }
  if (!text.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) fail(400, "INVALID_FILE", "The file is empty or contains binary data.");
  text = text.replace(/\r\n?/g, "\n");
  const content = /\.md$/i.test(name) ? convert(unified().use(remarkParse).parse(text) as MdNode) : text.split("\n").map(line => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] }));
  if (!content.length) fail(400, "INVALID_FILE", "The file has no supported text content.");
  return { title: name.replace(/\.(txt|md)$/i, "").trim().slice(0, 180) || "Imported document", contentJson: contentSchema.parse({ type: "doc", content }) };
}
