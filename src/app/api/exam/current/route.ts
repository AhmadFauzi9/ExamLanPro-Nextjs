import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows, db } from "@/lib/db";
import { apiError } from "@/lib/security";
import { ok } from "@/lib/http";
type A = RowDataPacket & {
  id: string;
  quiz_id: number;
  expires_at: Date;
  extra_minutes: number;
  title: string;
  subject: string;
  question_order: string;
};
export async function GET() {
  try {
    const s = await requireRole("STUDENT");
    if (!s.attemptId)
      return Response.json({ error: "Sesi ujian tidak ada." }, { status: 404 });
    const a = (
      await rows<A[]>(
        "SELECT a.id,a.quiz_id,a.expires_at,a.extra_minutes,a.question_order,q.title,q.subject FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.id=? AND a.student_id=? AND a.status='IN_PROGRESS'",
        [s.attemptId, s.sub],
      )
    )[0];
    if (!a)
      return Response.json({ error: "Ujian tidak aktif." }, { status: 404 });
    const order =
      typeof a.question_order === "string"
        ? JSON.parse(a.question_order)
        : a.question_order;
    const qs = await rows<(RowDataPacket & Record<string, unknown>)[]>(
      `SELECT id,type,content,passage,image_url,options,points FROM questions WHERE quiz_id=?`,
      [a.quiz_id],
    );
    const map = new Map(qs.map((q) => [Number(q.id), q]));
    const questions = (order as number[])
      .map((id) => map.get(id))
      .filter(Boolean);
    const answers = await rows<
      (RowDataPacket & { question_id: number; answer: unknown })[]
    >("SELECT question_id,answer FROM attempt_answers WHERE attempt_id=?", [
      a.id,
    ]);
    await db.execute("UPDATE attempts SET last_seen_at=NOW() WHERE id=?", [
      a.id,
    ]);
    return ok({
      attemptId: a.id,
      title: a.title,
      subject: a.subject,
      expiresAt: a.expires_at,
      extraMinutes: a.extra_minutes,
      questions,
      answers: Object.fromEntries(
        answers.map((x) => [x.question_id, x.answer]),
      ),
    });
  } catch (e) {
    return apiError(e);
  }
}
