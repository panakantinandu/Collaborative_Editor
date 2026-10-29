"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownUp, ArrowRight, BookOpen, Check, ChevronDown, FileText, Files, FolderOpen, LayoutGrid, List, Loader2, Plus, Search, Sparkles, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";
import { api, relativeDate } from "@/lib/client";
import type { Document, User } from "@/lib/types";
import { MAX_FILE_BYTES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/avatar";
const views = [{ id: "all", title: "All documents", icon: Files }, { id: "mine", title: "My documents", icon: FileText }, { id: "shared", title: "Shared with me", icon: Users }];
export function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [scope, setScope] = useState("all");
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("updated");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const [people, session] = await Promise.all([api<{ users: User[] }>("/api/users"), api<{ user: User | null }>("/api/session")]);
        if (!people.users.length) throw new Error("No demo users found. Run npm run db:seed to set up your workspace.");
        const active = session.user ?? (await api<{ user: User }>("/api/session", { method: "POST", body: JSON.stringify({ userId: people.users[0].id }) })).user;
        if (!cancelled) { setUsers(people.users); setUser(active); setError(""); }
      } catch (e) { if (!cancelled) { setError((e as Error).message); setLoading(false); } }
    }
    void boot(); return () => { cancelled = true; };
  }, [retry]);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await api<{ documents: Document[] }>(`/api/documents?scope=${scope}&search=${encodeURIComponent(search)}`, { signal: controller.signal });
        setDocs(result.documents); setError("");
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [user, scope, search, retry]);
  async function switchUser(id: string) {
    setBusy(true); setDocs([]); setLoading(true);
    try { const result = await api<{ user: User }>("/api/session", { method: "POST", body: JSON.stringify({ userId: id }) }); setUser(result.user); toast.success(`You’re now ${result.user.name}`); }
    catch (e) { toast.error((e as Error).message); setLoading(false); }
    finally { setBusy(false); }
  }
  async function create() {
    setBusy(true);
    try { const result = await api<{ document: Document }>("/api/documents", { method: "POST", body: JSON.stringify({ title: "Untitled document" }) }); router.push(`/documents/${result.document.id}`); }
    catch (e) { toast.error((e as Error).message); setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) { toast.error("Choose a .txt or .md file."); return; }
    if (file.size > MAX_FILE_BYTES) { toast.error("Files must be 2 MB or smaller."); return; }
    setBusy(true);
    const form = new FormData(); form.append("file", file);
    try { const result = await api<{ document: Document }>("/api/documents/import", { method: "POST", body: form }); toast.success("Document imported. Make it yours."); router.push(`/documents/${result.document.id}`); }
    catch (e) { toast.error((e as Error).message); setBusy(false); }
  }
  const sorted = [...docs].sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt));
  return <div className="workspace">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><BookOpen size={22} strokeWidth={1.8} /></span>draftly<span className="brand-dot">.</span></Link>
      <div className="workspace-label"><span className="workspace-icon">D</span><div>Your workspace<small>A little room to think</small></div></div>
      <Button className="new-document" onClick={create} disabled={!user || busy}><Plus size={17} />New document<span className="key-hint">↵</span></Button>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Document views">{views.map(view => <button key={view.id} className={`nav-item ${scope === view.id ? "active" : ""}`} onClick={() => setScope(view.id)} aria-current={scope === view.id ? "page" : undefined}><view.icon size={18} />{view.title}{scope === view.id && !loading && <span className="nav-count">{docs.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="little-note"><span className="note-spark">✳</span><h3>Better ideas, together.</h3><p>A first draft is just the beginning. Invite someone to make it better.</p><button onClick={() => setHelp(true)}>How sharing works <ArrowRight size={14} /></button></div>
      <button className="help-button" onClick={() => setHelp(true)}><BookOpen size={17} /> A quick guide <ArrowRight size={15} /></button>
      <div className="demo-account">{user && <Avatar user={user} />}<div className="account-select"><label htmlFor="demo-user">Demo workspace</label><select id="demo-user" value={user?.id ?? ""} disabled={busy || !users.length} onChange={event => void switchUser(event.target.value)}>{!users.length && <option>Loading…</option>}{users.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div><ChevronDown size={15} aria-hidden="true" /></div>
      <p className="demo-label">Demo authentication · not for production</p></div>
    </aside>
    <div className="workspace-main"><header className="workspace-topbar"><div><span className="breadcrumb-muted">Workspace</span><span className="breadcrumb-slash">/</span>{views.find(view => view.id === scope)?.title}</div><span className="private-label"><span className="green-dot" />Your ideas, in good company</span></header>
    <main className="dashboard"><section className="welcome-row"><div><div className="eyebrow">A LITTLE SPACE FOR BIG IDEAS</div><h1>Make room for your next idea<span>.</span></h1><p>From the first thought to the final draft. It all starts here.</p></div><div className="welcome-illustration" aria-hidden="true"><span className="illustration-star">✳</span><div className="illustration-paper"><span /><span /><span /><i /></div><div className="illustration-pencil" /></div></section>
      <section className="quick-actions" aria-label="Start writing"><button className="quick-card" disabled={!user || busy} onClick={create}><span className="quick-icon green"><Plus size={23} /></span><span><strong>Start from a blank page</strong><small>A fresh space for whatever’s next</small></span><ArrowRight size={18} /></button><button className="quick-card" disabled={!user || busy} onClick={() => input.current?.click()}><span className="quick-icon peach"><Upload size={21} /></span><span><strong>Bring your words along</strong><small>Import a .txt or .md file · up to 2 MB</small></span><ArrowRight size={18} /></button></section>
      <input ref={input} type="file" accept=".txt,.md" className="sr-only" aria-label="Import a text or Markdown file" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }} />
      <section className="documents-section"><div className="section-heading"><div><h2>{views.find(view => view.id === scope)?.title}<span className="document-count">{docs.length}</span></h2><p>{scope === "shared" ? "Good things happen when you put your heads together." : "Your thoughts, plans, and works in progress."}</p></div><Button variant="outline" size="sm" disabled={!user || busy} onClick={() => input.current?.click()}>{busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />} Import</Button></div>
        <div className="document-filters"><div className="search-field"><Search size={17} /><input aria-label="Search documents by title" placeholder="Search your documents…" value={search} onChange={event => setSearch(event.target.value)} maxLength={180} />{search && <button aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}</div><div className="view-options"><label className="sort-control"><ArrowDownUp size={14} /><select aria-label="Sort documents" value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Last edited</option><option value="title">Title A–Z</option></select></label><span className="filter-divider" /><div className="layout-toggle"><button aria-label="Grid view" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><LayoutGrid size={16} /></button><button aria-label="List view" aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={17} /></button></div></div></div>
        {error ? <div className="empty-state" role="alert"><FolderOpen size={30} /><h3>Let’s reconnect your workspace</h3><p>{error}</p><Button variant="outline" onClick={() => setRetry(value => value + 1)}>Try again</Button></div> : loading ? <div className="document-grid" aria-label="Loading documents" aria-busy="true">{[1, 2, 3, 4, 5, 6].map(item => <div className="document-skeleton" key={item} />)}</div> : !sorted.length ? <div className="empty-state"><FolderOpen size={32} /><h3>{search ? "No matching documents" : scope === "shared" ? "A space for shared ideas" : "Every good idea starts somewhere"}</h3><p>{search ? "Try a different title or clear your search." : scope === "shared" ? "Documents shared with you will appear here. Switch demo users to try an invitation." : "Create your first document and make this space yours."}</p>{search ? <Button variant="outline" onClick={() => setSearch("")}>Clear search</Button> : scope !== "shared" && <Button onClick={create}><Plus size={16} /> Create a document</Button>}</div> : <div className={layout === "grid" ? "document-grid" : "document-list"}>{sorted.map((doc, index) => <Link href={`/documents/${doc.id}`} key={doc.id} className="document-card"><div className={`document-preview preview-${index % 4}`}><div className="mini-paper"><span className="mini-title">{doc.title}</span><p>{doc.preview || "A blank page, full of possibilities."}</p><span className="mini-line" /><span className="mini-line short" /></div><span className={`permission-badge ${doc.role === "OWNER" ? "owner-badge" : ""}`}>{doc.role === "OWNER" ? "Your document" : doc.role === "EDITOR" ? "Can edit" : "View only"}</span></div><div className="document-details"><div className="document-title-row"><FileText size={17} /><h3>{doc.title}</h3></div><div className="document-meta"><span>Edited {relativeDate(doc.updatedAt)}</span><div className="card-people"><Avatar small user={doc.owner} />{doc.shares.slice(0, 2).map(share => <Avatar small key={share.id} user={share.user} />)}</div></div><span className="sr-only">Owned by {doc.owner.name}</span></div></Link>)}</div>}
      </section><footer className="dashboard-footer"><span><Check size={14} /> A home for your work in progress</span><span>Made for a little more clarity.</span></footer>
    </main></div>
    <Dialog open={help} onOpenChange={setHelp}><DialogContent><div className="dialog-icon"><Sparkles size={23} /></div><DialogTitle className="dialog-title">Good ideas grow together.</DialogTitle><DialogDescription className="dialog-description">A quick guide to your Draftly demo workspace.</DialogDescription><div className="guide-steps"><p><strong>1. Make it yours.</strong> Create a document or import UTF-8 TXT and Markdown files. Changes save automatically.</p><p><strong>2. Invite a fresh perspective.</strong> Open a document you own and choose Share. Editors can write; viewers can read.</p><p><strong>3. Try another point of view.</strong> Switch between Alice, Bob, and Charlie in the sidebar to check permissions.</p></div><div className="info-note">This is intentionally non-production demo authentication. Anyone can switch to any demo account. Collaboration uses saved revisions, with conflict detection; it is not live co-editing.</div><Button className="full-width" onClick={() => setHelp(false)}>Let’s get writing <ArrowRight size={16} /></Button></DialogContent></Dialog>
  </div>;
}
