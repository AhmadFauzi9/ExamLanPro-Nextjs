import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { RowDataPacket } from "mysql2";
import { apiError, audit, checkOrigin } from "@/lib/security";
import { ok } from "@/lib/http";
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("ADMIN", "TEACHER");
    const { id } = await params;
    const attempt = (
      await rows<RowDataPacket[]>(
        "SELECT a.*,s.nis,s.name,s.class_name,q.title,q.kkm FROM attempts a JOIN students s ON s.id=a.student_id JOIN quizzes q ON q.id=a.quiz_id WHERE a.id=?",
        [id],
      )
    )[0];
    if (!attempt)
      return Response.json(
        { error: "Hasil tidak ditemukan." },
        { status: 404 },
      );
    const answers = await rows<RowDataPacket[]>(
      "SELECT q.position,q.type,q.content,q.options,q.answer_key,q.explanation,aa.answer,aa.is_correct,aa.awarded_points FROM questions q LEFT JOIN attempt_answers aa ON aa.question_id=q.id AND aa.attempt_id=? WHERE q.quiz_id=? ORDER BY q.position",
      [id, attempt.quiz_id],
    );
    return ok({ attempt, answers });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const { id } = await params;
    await db.execute("DELETE FROM attempts WHERE id=?", [id]);
    await audit(`user:${s.sub}`, "DELETE_RESULT", "attempt", id);
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
