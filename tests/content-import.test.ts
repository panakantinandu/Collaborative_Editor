import { describe, expect, it } from "vitest";
import { validContent, plainText } from "@/lib/content";
import { importDocument } from "@/lib/import";
import { MAX_FILE_BYTES } from "@/lib/constants";
const bytes = (text: string) => new TextEncoder().encode(text);
describe("structured rich text", () => {
  it("preserves heading, bold, italic, underline and list structure", () => {
    const doc = { type: "doc", content: [{ type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Hello", marks: [{ type: "bold" }, { type: "italic" }, { type: "underline" }] }] }, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "World" }] }] }] }] };
    expect(validContent(JSON.parse(JSON.stringify(doc)))).toBe(true);
    expect(plainText(doc)).toBe("Hello World");
  });
  it.each([
    { type: "doc", content: [{ type: "script", text: "alert(1)" }] },
    { type: "doc", content: [{ type: "text", text: "Not a block" }] },
    { type: "doc", content: [{ type: "heading", attrs: { level: 9 } }] },
    { type: "doc", content: [{ type: "paragraph", attrs: { onclick: "alert(1)" } }] },
    { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] }] }
  ])("rejects unsafe or invalid structures: %j", content => expect(validContent(content)).toBe(false));
  it("rejects excessive nesting and oversized JSON", () => {
    let node: object = { type: "paragraph" };
    for (let i = 0; i < 30; i++) node = { type: "blockquote", content: [node] };
    expect(validContent({ type: "doc", content: [node] })).toBe(false);
    expect(validContent({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(3 * 1024 * 1024) }] }] })).toBe(false);
  });
});
describe("file import", () => {
  it("converts Markdown into editable headings, marks, and lists", () => {
    const result = importDocument("Meeting.md", bytes("# Plan\n\n**Bold** and *italic*.\n\n- First\n- Second\n\n1. Ordered\n\n> A quote\n\n```js\nconst a = 1;\n```"));
    expect(result.title).toBe("Meeting");
    expect(validContent(result.contentJson)).toBe(true);
    expect(result.contentJson.content?.map(node => node.type)).toEqual(["heading", "paragraph", "bulletList", "orderedList", "blockquote", "codeBlock"]);
    expect(result.contentJson.content?.[1].content?.[0].marks).toEqual([{ type: "bold" }]);
  });
  it("converts UTF-8 TXT to paragraphs, preserving blank lines and literal HTML", () => {
    const result = importDocument("notes.TXT", bytes("Hello café\r\n\r\n<script>safe text</script>"));
    expect(result.contentJson.content).toHaveLength(3);
    expect(result.contentJson.content?.[2].content?.[0].text).toContain("<script>");
  });
  it("strips raw Markdown HTML and converts links to labels", () => {
    const result = importDocument("safe.md", bytes("[hello](javascript:alert(1))\n\n<script>alert(1)</script>"));
    expect(plainText(result.contentJson)).toBe("hello");
    expect(JSON.stringify(result.contentJson)).not.toContain("javascript:");
  });
  it.each(["report.docx", "photo.png", "file.md.exe"])("rejects unsupported extension %s", name => expect(() => importDocument(name, bytes("content"))).toThrow(".txt or .md"));
  it("rejects files larger than 2 MB", () => expect(() => importDocument("big.txt", new Uint8Array(MAX_FILE_BYTES + 1))).toThrow("2 MB"));
  it("rejects malformed UTF-8", () => expect(() => importDocument("bad.txt", new Uint8Array([0xff, 0xfe]))).toThrow("UTF-8"));
  it.each(["", " \n\t", "abc\0def"])("rejects empty or binary input", value => expect(() => importDocument("bad.txt", bytes(value))).toThrow("empty or contains binary"));
});
