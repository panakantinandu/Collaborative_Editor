import type { JSONContent } from "@tiptap/core";
export type Draft = { title: string; contentJson: JSONContent };
export type SaveState = { status: "saved" | "saving" | "error"; message?: string; code?: string };
// Single-flight saves plus local sequence numbers prevent both write reordering and
// stale success responses from marking a newer, unsaved draft as saved.
export class Autosave {
  private version = 0;
  private savedVersion = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private flight?: Promise<boolean>;
  private blocked = false;
  private listeners = new Set<(state: SaveState) => void>();
  state: SaveState = { status: "saved" };
  constructor(public draft: Draft, private revision: number, private save: (draft: Draft, revision: number) => Promise<{ revision: number }>, private delay = 700) {}
  get dirty() { return this.version !== this.savedVersion; }
  subscribe(listener: (state: SaveState) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit(state: SaveState) { this.state = state; this.listeners.forEach(fn => fn(state)); }
  change(draft: Draft) {
    this.draft = draft; this.version++;
    clearTimeout(this.timer);
    if (this.blocked) return;
    this.emit({ status: "saving" });
    this.timer = setTimeout(() => { void this.flush(); }, this.delay);
  }
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    if (this.flight) { const ok = await this.flight; return ok && this.dirty ? this.flush() : ok; }
    if (!this.dirty) return true;
    if (this.blocked) return false;
    const version = this.version; const draft = this.draft;
    this.emit({ status: "saving" });
    const operation = this.save(draft, this.revision).then(result => {
      this.revision = result.revision; this.savedVersion = version;
      this.emit({ status: this.dirty ? "saving" : "saved" });
      return true;
    }).catch((error: Error & { code?: string }) => {
      this.blocked = true;
      this.emit({ status: "error", message: error.message, code: error.code });
      return false;
    });
    this.flight = operation;
    const ok = await operation;
    this.flight = undefined;
    if (ok && this.dirty) return this.flush();
    return ok;
  }
  retry() { this.blocked = false; return this.flush(); }
  dispose() { clearTimeout(this.timer); this.listeners.clear(); }
}
