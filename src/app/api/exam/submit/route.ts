import { NextRequest } from "next/server";
import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows, transaction } from "@/lib/db";
import { scoreQuestion, Question } from "@/lib/scoring";
import { apiError, audit, checkOrigin } from "@/lib/security";
import { ok } from "@/lib/http";
export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const s = await requireRole("STUDENT");
    if (!s.attemptId) throw new Error("UNAUTHORIZED");
    const attemptId = s.attemptId;
    const qs = await rows<(RowDataPacket & Question)[]>(
      "SELECT q.id,q.type,q.answer_key,q.points FROM questions q JOIN attempts a ON a.quiz_id=q.quiz_id WHERE a.id=? AND a.student_id=? AND a.status='IN_PROGRESS'",
      [attemptId, s.sub],
    );
    const ans = await rows<
      (RowDataPacket & { question_id: number; answer: unknown })[]
    >("SELECT question_id,answer FROM attempt_answers WHERE attempt_id=?", [
      attemptId,
    ]);
    const amap = new Map(ans.map((a) => [a.question_id, a.answer]));
    let earned = 0,
      total = 0,
      correct = 0,
      wrong = 0,
      manual = false;
    const scored = qs.map((q) => {
      total += Number(q.points);
      const r = scoreQuestion(
        {
          ...q,
          answer_key:
            typeof q.answer_key === "string"
              ? JSON.parse(q.answer_key)
              : q.answer_key,
        },
        amap.get(q.id),
      );
      earned += Number(r.score);
      if (r.correct === true) correct++;
      if (r.correct === false) wrong++;
      manual ||= r.manual;
      return { q, r };
    });
    const score = total ? Math.round((earned / total) * 10000) / 100 : 0;
    await transaction(async (c) => {
      for (const x of scored)
        await c.execute(
          "UPDATE attempt_answers SET is_correct=?,awarded_points=? WHERE attempt_id=? AND question_id=?",
          [x.r.correct, x.r.score, attemptId, x.q.id],
        );
      await c.execute(
        "UPDATE attempts SET status='SUBMITTED',submitted_at=NOW(),score=?,correct_count=?,wrong_count=?,manual_review_required=? WHERE id=? AND status='IN_PROGRESS'",
        [score, correct, wrong, manual, attemptId],
      );
    });
    await audit(`student:${s.nis}`, "SUBMIT_EXAM", "attempt", attemptId, {
      score,
    });
    return ok({ score, correct, wrong, manualReviewRequired: manual });
  } catch (e) {
    return apiError(e);
  }
}
