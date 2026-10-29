// @vitest-environment jsdom
import "./setup";
import React from "react";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { editorExtensions } from "@/lib/content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
function Harness({ onEditor, editable = true }: { onEditor: (editor: Editor) => void; editable?: boolean }) {
  const editor = useEditor({ extensions: editorExtensions, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A first draft" }] }] }, immediatelyRender: false, editable, onCreate: ({ editor }) => onEditor(editor) });
  return <EditorContent editor={editor} />;
}
describe("editor and accessible controls", () => {
  it("applies formatting to actual Tiptap JSON and renders it", async () => {
    let editor!: Editor; render(<Harness onEditor={value => { editor = value; }} />);
    await waitFor(() => expect(editor).toBeDefined());
    act(() => { editor.commands.selectAll(); editor.commands.toggleBold(); editor.commands.toggleItalic(); editor.commands.toggleUnderline(); editor.commands.toggleHeading({ level: 2 }); });
    expect(editor.getJSON().content?.[0].type).toBe("heading"); expect(editor.getJSON().content?.[0].content?.[0].marks?.map(mark => mark.type)).toEqual(expect.arrayContaining(["bold", "italic", "underline"]));
    expect(screen.getByText("A first draft").closest("h2")).toBeInTheDocument();
    const json = editor.getJSON(); act(() => { editor.commands.setContent(json); }); expect(editor.getJSON()).toEqual(json);
  });
  it("renders a non-editable surface for viewers", async () => {
    let editor!: Editor; const { container } = render(<Harness editable={false} onEditor={value => { editor = value; }} />);
    await waitFor(() => expect(editor).toBeDefined()); expect(editor.isEditable).toBe(false); expect(container.querySelector('[contenteditable="false"]')).toBeInTheDocument();
  });
  it("opens a labeled dialog and closes with its accessible close button", async () => {
    render(<Dialog><DialogTrigger asChild><Button>Share</Button></DialogTrigger><DialogContent><DialogTitle>Share this draft</DialogTitle><DialogDescription>Invite a collaborator.</DialogDescription></DialogContent></Dialog>);
    fireEvent.click(screen.getByRole("button", { name: "Share" })); expect(screen.getByRole("dialog", { name: "Share this draft" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" })); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
