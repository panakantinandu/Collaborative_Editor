export class RequestError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...(init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init?.headers }, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new RequestError(result.error?.message ?? "Something went wrong. Try again.", response.status, result.error?.code ?? "UNKNOWN");
  return result as T;
}
export function relativeDate(value: string) {
  const date = new Date(value); const diff = Math.max(0, Date.now() - date.getTime());
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}
