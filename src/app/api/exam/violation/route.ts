import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, checkOrigin, parseJson, rateLimit } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.object({
  type: z.string().min(2).max(80),
  detail: z.string().max(500).optional(),
});
export async function POST(req: NextRequest) {
  try {
    const l = rateLimit(req, 30);
    if (l) return l;
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const s = await requireRole("STUDENT");
    if (!s.attemptId) throw new Error("UNAUTHORIZED");
    const x = await parseJson(req, schema);
    await db.execute(
      "INSERT INTO violations(attempt_id,type,detail) VALUES(?,?,?)",
      [s.attemptId, x.type, x.detail || null],
    );
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
