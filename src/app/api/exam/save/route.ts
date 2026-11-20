import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, checkOrigin, parseJson, rateLimit } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        answer: z.unknown(),
      }),
    )
    .max(100),
});
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 120);
    if (limited) return limited;
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const s = await requireRole("STUDENT");
    if (!s.attemptId) throw new Error("UNAUTHORIZED");
    const data = await parseJson(req, schema);
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const a of data.answers)
        await conn.execute(
          "INSERT INTO attempt_answers(attempt_id,question_id,answer) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM questions q JOIN attempts x ON x.quiz_id=q.quiz_id WHERE q.id=? AND x.id=? AND x.status='IN_PROGRESS' AND NOW()<=DATE_ADD(x.expires_at,INTERVAL x.extra_minutes MINUTE)) ON DUPLICATE KEY UPDATE answer=VALUES(answer)",
          [
            s.attemptId,
            a.questionId,
            JSON.stringify(a.answer),
            a.questionId,
            s.attemptId,
          ],
        );
      await conn.execute("UPDATE attempts SET last_seen_at=NOW() WHERE id=?", [
        s.attemptId,
      ]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    return ok({ savedAt: new Date().toISOString() });
  } catch (e) {
    return apiError(e);
  }
}
