import { afterEach, describe, expect, it, vi } from "vitest";
import { Autosave } from "@/lib/autosave";
const draft = { title: "First", contentJson: { type: "doc", content: [{ type: "paragraph" }] } };
afterEach(() => vi.useRealTimers());
describe("autosave reliability", () => {
  it("debounces changes for 700 ms", async () => {
    vi.useFakeTimers(); const save = vi.fn().mockResolvedValue({ revision: 2 });
    const saver = new Autosave(draft, 1, save);
    saver.change({ ...draft, title: "Next" }); await vi.advanceTimersByTimeAsync(600);
    saver.change({ ...draft, title: "Final" }); await vi.advanceTimersByTimeAsync(699);
    expect(save).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledWith({ ...draft, title: "Final" }, 1); expect(saver.dirty).toBe(false); saver.dispose();
  });
  it("never marks new unsaved changes as saved when an old response arrives", async () => {
    let finish!: (value: { revision: number }) => void;
    const save = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ revision: 3 });
    const saver = new Autosave(draft, 1, save); const states: string[] = [];
    saver.subscribe(state => states.push(state.status)); saver.change({ ...draft, title: "Older" }); const flight = saver.flush();
    saver.change({ ...draft, title: "Newest" }); finish({ revision: 2 }); await flight;
    expect(save).toHaveBeenNthCalledWith(2, { ...draft, title: "Newest" }, 2);
    expect(states.filter(status => status === "saved")).toHaveLength(1); expect(saver.dirty).toBe(false); saver.dispose();
  });
  it("preserves drafts and stops automatic writes after a conflict", async () => {
    const save = vi.fn().mockRejectedValue(Object.assign(new Error("Conflict"), { code: "REVISION_CONFLICT" }));
    const saver = new Autosave(draft, 1, save); saver.change({ ...draft, title: "Keep me" });
    expect(await saver.flush()).toBe(false); saver.change({ ...draft, title: "Still here" });
    expect(await saver.flush()).toBe(false); expect(save).toHaveBeenCalledTimes(1); expect(saver.dirty).toBe(true); expect(saver.state.code).toBe("REVISION_CONFLICT"); expect(saver.draft.title).toBe("Still here"); saver.dispose();
  });
  it("can retry a failed network save", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ revision: 2 });
    const saver = new Autosave(draft, 1, save); saver.change(draft); await saver.flush(); expect(saver.state.status).toBe("error");
    expect(await saver.retry()).toBe(true); expect(saver.state.status).toBe("saved"); saver.dispose();
  });
});
