import { NextRequest, NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { db } from "./db";

const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(req: NextRequest, limit = 20, windowMs = 60_000) {
  const key = `${req.headers.get("x-forwarded-for")?.split(",")[0] || "local"}:${req.nextUrl.pathname}`;
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return null;
  }
  current.count += 1;
  if (current.count > limit)
    return NextResponse.json(
      { error: "Terlalu banyak permintaan." },
      { status: 429 },
    );
  return null;
}
export function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return origin === req.nextUrl.origin || origin === process.env.APP_URL;
}
export async function parseJson<T>(req: NextRequest, schema: ZodSchema<T>) {
  return schema.parse(await req.json());
}
export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    const first = error.issues[0]?.message || "Data tidak valid.";
    return NextResponse.json({ error: first }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : "Kesalahan server.";
  if (message === "UNAUTHORIZED")
    return NextResponse.json({ error: "Akses ditolak." }, { status: 401 });
  console.error(error);
  return NextResponse.json({ error: message || "Kesalahan server." }, { status: 500 });
}
export async function audit(
  actor: string,
  action: string,
  entity?: string,
  entityId?: string,
  detail?: unknown,
) {
  await db.execute(
    "INSERT INTO audit_logs(actor, action, entity, entity_id, detail) VALUES(?,?,?,?,?)",
    [
      actor,
      action,
      entity || null,
      entityId || null,
      detail ? JSON.stringify(detail) : null,
    ],
  );
}
