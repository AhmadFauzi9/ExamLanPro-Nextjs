import { NextRequest } from "next/server";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows, db } from "@/lib/db";
import { apiError, checkOrigin, parseJson, rateLimit } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.object({
  minutes: z.number().int().min(1).max(60).default(15),
  reason: z.string().max(500).optional(),
});
export async function GET() {
  try {
    const s = await requireRole("STUDENT");
    if (!s.attemptId) throw new Error("UNAUTHORIZED");
    const row =
      (
        await rows<RowDataPacket[]>(
          "SELECT id,status,requested_minutes,approved_minutes,reason,created_at,decided_at FROM extension_requests WHERE attempt_id=? ORDER BY created_at DESC LIMIT 1",
          [s.attemptId],
        )
      )[0] || null;
    return ok(row);
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 5, 60000);
    if (limited) return limited;
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const s = await requireRole("STUDENT");
    if (!s.attemptId) throw new Error("UNAUTHORIZED");
    const x = await parseJson(req, schema);
    const pending = (
      await rows<RowDataPacket[]>(
        "SELECT id FROM extension_requests WHERE attempt_id=? AND status='PENDING' LIMIT 1",
        [s.attemptId],
      )
    )[0];
    if (pending)
      return Response.json(
        { error: "Permintaan sebelumnya masih menunggu keputusan guru." },
        { status: 409 },
      );
    await db.execute(
      "INSERT INTO extension_requests(attempt_id,requested_minutes,reason) VALUES(?,?,?)",
      [s.attemptId, x.minutes, x.reason || null],
    );
    return ok({ status: "PENDING" }, 201);
  } catch (e) {
    return apiError(e);
  }
}
