"use client";
import { useEffect, useState } from "react";
import { Check, Link as LinkIcon, Loader2, LockKeyhole, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import type { Document, Share, User } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
export function ShareDialog({ document, open, onOpenChange }: { document: Document; open: boolean; onOpenChange: (value: boolean) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [shares, setShares] = useState<Share[]>(document.shares);
  const [target, setTarget] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const owner = document.role === "OWNER";
  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([api<{ users: User[] }>("/api/users"), api<{ shares: Share[] }>(`/api/documents/${document.id}/shares`)]).then(([people, data]) => {
      if (active) { setUsers(people.users); setShares(data.shares); setError(""); setLoading(false); }
    }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [open, document.id]);
  async function mutate(method: string, userId: string, permission?: string) {
    setBusy(true); setError("");
    try {
      await api(`/api/documents/${document.id}/shares${method === "POST" ? "" : `/${userId}`}`, { method, ...(method !== "DELETE" ? { body: JSON.stringify(method === "POST" ? { userId, role: permission } : { role: permission }) } : {}) });
      const result = await api<{ shares: Share[] }>(`/api/documents/${document.id}/shares`);
      setShares(result.shares); setTarget(""); toast.success(method === "DELETE" ? "Access removed" : method === "POST" ? "Invitation added" : "Permission updated");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  const available = users.filter(user => user.id !== document.ownerId && !shares.some(share => share.userId === user.id));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><div className="dialog-icon"><UserPlus size={23} /></div><DialogTitle className="dialog-title">A fresh pair of eyes.</DialogTitle><DialogDescription className="dialog-description">Share “{document.title}” with your people.</DialogDescription>
    {owner ? <form className="invite-form" onSubmit={event => { event.preventDefault(); void mutate("POST", target, role); }}><label htmlFor="invite-user">Invite a demo user</label><div className="invite-controls"><select id="invite-user" value={target} onChange={event => setTarget(event.target.value)} disabled={busy || loading} required><option value="">{available.length ? "Choose a person…" : "Everyone has access"}</option>{available.map(user => <option value={user.id} key={user.id}>{user.name} — {user.email}</option>)}</select><select aria-label="Invitation permission" value={role} onChange={event => setRole(event.target.value)} disabled={busy}><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option></select></div><Button type="submit" disabled={!target || busy || loading}>{busy ? <Loader2 size={15} className="spin" /> : <PlusIcon />} Invite</Button></form> : <div className="info-note">Only {document.owner.name}, the document owner, can change access.</div>}
    {error && <p className="inline-error" role="alert">{error}</p>}<h3 className="access-heading">People with access</h3><div className="person-row"><Avatar user={document.owner} /><div className="person-info"><strong>{document.owner.name}</strong><span>{document.owner.email}</span></div><span className="owner-label">Owner</span></div>
    {loading ? <p className="muted" role="status">Loading access…</p> : shares.map(share => <div key={share.id} className="person-row"><Avatar user={share.user} /><div className="person-info"><strong>{share.user.name}</strong><span>{share.user.email}</span></div>{owner ? <><select aria-label={`${share.user.name} permission`} value={share.role} disabled={busy} onChange={event => void mutate("PATCH", share.userId, event.target.value)}><option value="EDITOR">Editor</option><option value="VIEWER">Viewer</option></select><Button variant="ghost" size="icon" aria-label={`Remove ${share.user.name}'s access`} disabled={busy} onClick={() => void mutate("DELETE", share.userId)}><X size={16} /></Button></> : <span className="owner-label">{share.role === "EDITOR" ? "Editor" : "Viewer"}</span>}</div>)}
    <div className="share-footer"><div><LockKeyhole size={16} /><span>Only invited people can open this document.</span></div><Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/documents/${document.id}`); setCopied(true); toast.success("Document link copied"); } catch { toast.error("Could not copy. Copy the address from your browser instead."); } }}>{copied ? <Check size={14} /> : <LinkIcon size={14} />}{copied ? "Copied" : "Copy link"}</Button></div>
  </DialogContent></Dialog>;
}
function PlusIcon() { return <UserPlus size={15} />; }
