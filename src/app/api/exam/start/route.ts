import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { RowDataPacket } from "mysql2";
import { requireRole, createSession } from "@/lib/auth";
import { rows, transaction } from "@/lib/db";
import { apiError, checkOrigin } from "@/lib/security";
import { ok } from "@/lib/http";

type Q = RowDataPacket & {
  id: number;
  duration_minutes: number;
  max_questions?: number;
  end_at: Date;
  start_at: Date;
  randomize_questions: number;
  exam_token: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const s = await requireRole("STUDENT");
    const body = await req.json();
    const quizId = Number(body.quizId);
    const inputToken = String(body.token || "").trim().toUpperCase();

    const quiz = (
      await rows<Q[]>(
        "SELECT id, duration_minutes, max_questions, start_at, end_at, randomize_questions, exam_token FROM quizzes WHERE id=? AND status='PUBLISHED' AND deleted_at IS NULL",
        [quizId]
      )
    )[0];
    if (!quiz)
      return Response.json({ error: "Paket ujian tidak ditemukan atau belum aktif." }, { status: 404 });

    // Validasi token ujian
    if (quiz.exam_token && inputToken !== quiz.exam_token) {
      return Response.json(
        { error: "Token ujian salah atau tidak valid! Silakan minta token aktif kepada guru pengawas." },
        { status: 403 }
      );
    }

    const existing = (
      await rows<(RowDataPacket & { id: string; status: string })[]>(
        "SELECT id, status FROM attempts WHERE quiz_id=? AND student_id=? ORDER BY created_at DESC LIMIT 1",
        [quizId, s.sub]
      )
    )[0];

    if (existing) {
      if (existing.status === "SUBMITTED") {
        return Response.json(
          { error: "Ujian sudah dikumpulkan. Hubungi guru pengawas untuk izin ujian ulang." },
          { status: 409 }
        );
      }
      await createSession({ ...s, attemptId: existing.id });
      return ok({ attemptId: existing.id, resumed: true });
    }

    const ids = (
      await rows<(RowDataPacket & { id: number })[]>(
        "SELECT id FROM questions WHERE quiz_id=? ORDER BY position",
        [quizId]
      )
    ).map((x) => x.id);

    if (quiz.randomize_questions || (quiz.max_questions && quiz.max_questions > 0 && quiz.max_questions < ids.length)) {
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
    }

    if (quiz.max_questions && quiz.max_questions > 0 && quiz.max_questions < ids.length) {
      ids.splice(quiz.max_questions);
    }

    const id = crypto.randomUUID();
    const resume = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const durationEnd = now + quiz.duration_minutes * 60000;
    const endAtTime = quiz.end_at ? new Date(quiz.end_at).getTime() : NaN;
    const expires = new Date(
      !isNaN(endAtTime) && endAtTime > now
        ? Math.min(durationEnd, endAtTime)
        : durationEnd
    );

    await transaction(async (c) => {
      await c.execute(
        "INSERT INTO attempts(id, quiz_id, student_id, resume_token_hash, question_order, started_at, expires_at, last_seen_at, ip_address, user_agent) VALUES(?,?,?,?,?,NOW(),?,NOW(),?,?)",
        [
          id,
          quizId,
          s.sub,
          crypto.createHash("sha256").update(resume).digest("hex"),
          JSON.stringify(ids),
          expires,
          req.headers.get("x-forwarded-for")?.slice(0, 64) || null,
          req.headers.get("user-agent")?.slice(0, 500) || null,
        ]
      );
    });

    await createSession({ ...s, attemptId: id });
    return ok({ attemptId: id, resumeToken: resume, resumed: false });
  } catch (e) {
    return apiError(e);
  }
}
