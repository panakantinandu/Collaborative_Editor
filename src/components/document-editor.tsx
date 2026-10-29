"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import Placeholder from "@tiptap/extension-placeholder";
import { ArrowLeft, Bold, BookOpen, Check, ChevronDown, CloudCheck, Download, Eye, Heading1, Heading2, Italic, List, ListOrdered, Loader2, LockKeyhole, Redo2, Share2, Underline, Undo2, AlertCircle } from "lucide-react";
import { api } from "@/lib/client";
import type { Document } from "@/lib/types";
import { editorExtensions, plainText } from "@/lib/content";
import { Autosave, type SaveState } from "@/lib/autosave";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/avatar";
import { ShareDialog } from "@/components/share-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
export function DocumentEditor({ id }: { id: string }) {
  const [document, setDocument] = useState<Document | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<{ document: Document }>(`/api/documents/${id}`).then(result => { if (active) setDocument(result.document); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id]);
  if (error) return <main className="center-state"><LockKeyhole size={34} /><h1>This document isn’t available.</h1><p role="alert">{error}</p><Link href="/" className="button button-primary">Back to workspace</Link></main>;
  if (!document) return <main className="center-state" aria-live="polite"><Loader2 className="spin" size={26} /><p>Finding your words…</p></main>;
  return <EditorSurface key={document.id} initial={document} />;
}
function EditorSurface({ initial }: { initial: Document }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [state, setState] = useState<SaveState>({ status: "saved" });
  const [share, setShare] = useState(false);
  const [leave, setLeave] = useState(false);
  const [role, setRole] = useState(initial.role);
  const [accessError, setAccessError] = useState("");
  const [words, setWords] = useState(() => countWords(plainText(initial.contentJson)));
  const [saver] = useState(() => new Autosave({ title: initial.title, contentJson: initial.contentJson }, initial.revision, async (draft, revision) => {
    const result = await api<{ document: Document }>(`/api/documents/${initial.id}`, { method: "PATCH", body: JSON.stringify({ ...draft, title: draft.title.trim() || "Untitled document", revision }) });
    return result.document;
  }));
  const editable = role !== "VIEWER" && !accessError;
  const editor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: "Let your ideas find their words…" })],
    content: initial.contentJson, immediatelyRender: false, editable,
    editorProps: { attributes: { class: "writing-content", role: "textbox", "aria-label": "Document content", "aria-multiline": "true", spellcheck: "true" } },
    onUpdate: ({ editor }) => { const contentJson = editor.getJSON(); saver.change({ ...saver.draft, contentJson }); setWords(countWords(plainText(contentJson))); }
  });
  useEffect(() => { editor?.setEditable(Boolean(editable)); }, [editor, editable]);
  useEffect(() => {
    const unsubscribe = saver.subscribe(setState);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (saver.dirty) { event.preventDefault(); event.returnValue = ""; } };
    const popState = (event: PopStateEvent) => { if (saver.dirty && !window.confirm("Your latest changes haven’t been saved. Leave and discard them?")) { event.stopImmediatePropagation(); window.history.go(1); } };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", popState, true);
    return () => { unsubscribe(); saver.dispose(); window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", popState, true); };
  }, [saver]);
  useEffect(() => {
    let active = true;
    const refreshAccess = () => { api<{ document: Document }>(`/api/documents/${initial.id}`).then(result => { if (active) { setRole(result.document.role); setAccessError(""); } }).catch(error => { if (active && [401, 403, 404].includes(error.status)) setAccessError(error.message); }); };
    const interval = setInterval(refreshAccess, 15_000);
    window.addEventListener("focus", refreshAccess);
    return () => { active = false; clearInterval(interval); window.removeEventListener("focus", refreshAccess); };
  }, [initial.id]);
  async function goBack() { if (await saver.flush()) router.push("/"); else setLeave(true); }
  function download() {
    const blob = new Blob([JSON.stringify({ title, contentJson: saver.draft.contentJson }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = `${title.replace(/[^a-z0-9_-]/gi, "_").slice(0, 80) || "draft"}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const conflict = state.code === "REVISION_CONFLICT";
  return <div className="editor-app"><header className="editor-header"><button className="editor-brand" onClick={() => void goBack()} aria-label="Back to documents"><span className="brand-mark"><BookOpen size={20} /></span></button><div className="editor-heading"><div className="editor-breadcrumb"><button onClick={() => void goBack()}>My workspace</button><span>/</span><span>{title || "Untitled document"}</span></div><div className="save-indicator" role="status" aria-live="polite">{!editable ? <><Eye size={13} />Read-only document</> : state.status === "saving" ? <><Loader2 size={13} className="spin" />Saving…</> : state.status === "error" ? <><AlertCircle size={13} />Changes not saved</> : <><CloudCheck size={14} />All changes saved</>}</div></div><div className="editor-header-actions"><span className="editor-owner"><Avatar small user={initial.owner} /><span>{initial.owner.name}’s document</span></span><Button size="sm" variant="outline" onClick={() => void goBack()}><ArrowLeft size={15} /><span className="back-label">Documents</span></Button><Button size="sm" onClick={() => setShare(true)}><Share2 size={15} />Share</Button></div></header>
    <div className="toolbar-wrap">{editor ? <Toolbar editor={editor} disabled={!editable} /> : <div className="toolbar-placeholder" />}<span className="editing-mode">{editable ? <><span className="green-dot" /> Editing <ChevronDown size={12} /></> : <><Eye size={14} /> Viewing</>}</span></div>
    {(role === "VIEWER" || accessError) && <div className="viewer-banner"><LockKeyhole size={15} />{accessError || "You have view-only access. Ask the owner for editing permission."}</div>}
    {state.status === "error" && <div className="save-error" role="alert"><div><AlertCircle size={18} /><span>{state.message}</span></div><div className="error-actions"><Button variant="outline" size="sm" onClick={download}><Download size={14} />Download draft</Button>{conflict ? <Button size="sm" onClick={() => { if (window.confirm("Load the latest saved version? Download your draft first to keep your unsaved changes.")) { saver.dispose(); window.location.reload(); } }}>Load latest</Button> : editable && <Button size="sm" onClick={() => void saver.retry()}>Retry save</Button>}</div></div>}
    <main className="editor-main"><div className="paper-overline"><FileLabel /><span>Good things start with a first draft.</span></div><article className="editor-paper"><div className="paper-header"><div className="document-eyebrow">YOUR WORDS, TAKING SHAPE</div><input aria-label="Document title" className="document-title-input" maxLength={180} value={title} readOnly={!editable} placeholder="Untitled document" onChange={event => { setTitle(event.target.value); saver.change({ ...saver.draft, title: event.target.value }); }} onBlur={() => { if (!title.trim()) setTitle("Untitled document"); }} /><div className="paper-byline"><Avatar small user={initial.owner} /><span>{initial.owner.name}</span><span>·</span><span>{new Date(initial.createdAt).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</span></div></div>{accessError ? <p className="access-withdrawn">Access has changed. Return to your workspace to continue.</p> : <EditorContent editor={editor} />}</article><footer className="editor-footer"><span>{words} {words === 1 ? "word" : "words"} <span>·</span> {Math.max(1, Math.ceil(words / 200))} min read</span><span><Check size={13} /> A little progress is still progress.</span></footer></main>
    <ShareDialog document={{ ...initial, title, role }} open={share} onOpenChange={setShare} />
    <Dialog open={leave} onOpenChange={setLeave}><DialogContent><DialogTitle className="dialog-title">Your words are worth keeping.</DialogTitle><DialogDescription className="dialog-description">Your latest changes haven’t saved. Stay and retry, or download your draft before leaving.</DialogDescription><div className="leave-actions"><Button variant="outline" onClick={download}><Download size={15} />Download draft</Button><Button onClick={() => setLeave(false)}>Keep editing</Button><Button variant="ghost" onClick={() => router.push("/")}>Discard and leave</Button></div></DialogContent></Dialog>
  </div>;
}
function FileLabel() { return <span className="paper-label"><BookOpen size={14} /> DOCUMENT</span>; }
function countWords(value: string) { return value.trim() ? value.trim().split(/\s+/).length : 0; }
function Toolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const active = useEditorState({ editor, selector: ({ editor }) => ({ bold: editor.isActive("bold"), italic: editor.isActive("italic"), underline: editor.isActive("underline"), h1: editor.isActive("heading", { level: 1 }), h2: editor.isActive("heading", { level: 2 }), bullet: editor.isActive("bulletList"), ordered: editor.isActive("orderedList"), undo: editor.can().undo(), redo: editor.can().redo() }) });
  const controls = [
    { label: "Undo", icon: Undo2, command: () => editor.chain().focus().undo().run(), unavailable: !active.undo },
    { label: "Redo", icon: Redo2, command: () => editor.chain().focus().redo().run(), unavailable: !active.redo },
    { label: "Heading 1", icon: Heading1, command: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: active.h1 },
    { label: "Heading 2", icon: Heading2, command: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: active.h2 },
    { label: "Bold", icon: Bold, command: () => editor.chain().focus().toggleBold().run(), active: active.bold },
    { label: "Italic", icon: Italic, command: () => editor.chain().focus().toggleItalic().run(), active: active.italic },
    { label: "Underline", icon: Underline, command: () => editor.chain().focus().toggleUnderline().run(), active: active.underline },
    { label: "Bulleted list", icon: List, command: () => editor.chain().focus().toggleBulletList().run(), active: active.bullet },
    { label: "Numbered list", icon: ListOrdered, command: () => editor.chain().focus().toggleOrderedList().run(), active: active.ordered }
  ];
  return <div className="format-toolbar" role="toolbar" aria-label="Document formatting">{controls.map((control, index) => <span className="toolbar-item" key={control.label}>{[2, 4, 7].includes(index) && <span className="toolbar-divider" />}<button title={control.label} aria-label={control.label} aria-pressed={control.active} disabled={disabled || control.unavailable} onClick={control.command} className={control.active ? "is-active" : ""}><control.icon size={18} strokeWidth={1.8} /></button></span>)}</div>;
}
