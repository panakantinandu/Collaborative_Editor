import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function fail(status: number, code: string, message: string): never { throw new ApiError(status, code, message); }
export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid input." } }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: { code: "ALREADY_SHARED", message: "This person already has access. Change their permission instead." } }, { status: 409 });
  console.error("Request failed:", error instanceof Error ? error.name : "Unknown error", error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "");
  return Response.json({ error: { code: "SERVER_ERROR", message: "Draftly could not complete this request. Check database setup and try again." } }, { status: 500 });
}
