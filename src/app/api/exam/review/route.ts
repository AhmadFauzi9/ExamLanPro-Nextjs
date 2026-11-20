import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows } from "@/lib/db";
import { apiError } from "@/lib/security";
import { ok } from "@/lib/http";
export async function GET() {
  try {
    const s = await requireRole("STUDENT");
    const attempt = (
      await rows<RowDataPacket[]>(
        "SELECT a.id,a.quiz_id,q.review_enabled FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.student_id=? AND a.status='SUBMITTED' ORDER BY a.submitted_at DESC LIMIT 1",
        [s.sub],
      )
    )[0];
    if (!attempt)
      return Response.json(
        { error: "Hasil ujian tidak ditemukan." },
        { status: 404 },
      );
    if (!attempt.review_enabled)
      return Response.json(
        { error: "Pembahasan belum dibuka oleh guru." },
        { status: 403 },
      );
    const answers = await rows<RowDataPacket[]>(
      "SELECT q.position,q.type,q.content,q.options,q.answer_key,q.explanation,aa.answer,aa.is_correct,aa.awarded_points FROM questions q LEFT JOIN attempt_answers aa ON aa.question_id=q.id AND aa.attempt_id=? WHERE q.quiz_id=? ORDER BY q.position",
      [attempt.id, attempt.quiz_id],
    );
    return ok(answers);
  } catch (e) {
    return apiError(e);
  }
}
