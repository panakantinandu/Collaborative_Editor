import { errorResponse, fail } from "@/lib/errors";
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN;
  if (!expected) throw new Error("APP_ORIGIN is required.");
  if (origin !== new URL(expected).origin) fail(403, "INVALID_ORIGIN", "This request must come from Draftly. Refresh the page and try again.");
}
export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) checkOrigin(request);
      const response = await handler(request);
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) { const response = errorResponse(error); response.headers.set("Cache-Control", "no-store"); return response; }
  };
}
export async function readBody(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) fail(413, "REQUEST_TOO_LARGE", "This request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel(); fail(413, "REQUEST_TOO_LARGE", "This request is too large."); }
    chunks.push(value);
  }
  const body = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}
export async function jsonBody(request: Request, maxBytes = 3 * 1024 * 1024 + 4096): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) fail(415, "INVALID_CONTENT_TYPE", "Send application/json.");
  const bytes = await readBody(request, maxBytes);
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return fail(400, "INVALID_JSON", "The request contains invalid JSON."); }
}
