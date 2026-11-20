import { NextRequest } from "next/server";
import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows, db } from "@/lib/db";
import { apiError, audit } from "@/lib/security";
import { ok } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "TEACHER");
    const { searchParams } = new URL(req.url);
    const violationAttemptId = searchParams.get("violations");

    if (violationAttemptId) {
      const vList = await rows<RowDataPacket[]>(
        `SELECT id, type, detail, DATE_FORMAT(occurred_at, '%H:%i:%s') as time, occurred_at
         FROM violations
         WHERE attempt_id = ?
         ORDER BY occurred_at DESC`,
        [violationAttemptId]
      );
      return ok({
        violations: vList,
        violations_count: vList.length,
      });
    }

    const data = await rows<RowDataPacket[]>(
      `SELECT a.id, a.quiz_id, s.nis, s.name, s.class_name, q.title, a.status,
              a.started_at, a.expires_at, a.submitted_at, a.last_seen_at, a.extra_minutes,
              a.score, a.correct_count, a.wrong_count, a.manual_review_required,
              COUNT(DISTINCT v.id) as violation_count,
              COUNT(DISTINCT aa.question_id) as answered_count,
              COUNT(DISTINCT qs.id) as total_questions
       FROM attempts a
       JOIN students s ON s.id = a.student_id
       JOIN quizzes q ON q.id = a.quiz_id
       LEFT JOIN questions qs ON qs.quiz_id = q.id
       LEFT JOIN violations v ON v.attempt_id = a.id
       LEFT JOIN attempt_answers aa ON aa.attempt_id = a.id
       GROUP BY a.id
       ORDER BY a.created_at DESC
       LIMIT 500`
    );
    return ok(data);
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    const body = await req.json();
    const { action, attemptId, attemptIds, minutes } = body;

    if (action === "CLEAR_ALL_SESSIONS") {
      await db.execute(
        `DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM attempts WHERE status != 'SUBMITTED')`
      );
      await db.execute(
        `DELETE FROM violations WHERE attempt_id IN (SELECT id FROM attempts WHERE status != 'SUBMITTED')`
      );
      await db.execute(`DELETE FROM attempts WHERE status != 'SUBMITTED'`);
      await audit(`user:${s.sub}`, "CLEAR_ALL_MONITORING_SESSIONS", "attempt");
      return ok({ message: "Semua sesi monitoring aktif berhasil dibersihkan." });
    }

    if (action === "DELETE_SESSIONS" && Array.isArray(attemptIds) && attemptIds.length > 0) {
      for (const id of attemptIds) {
        await db.execute("DELETE FROM attempt_answers WHERE attempt_id = ?", [id]);
        await db.execute("DELETE FROM violations WHERE attempt_id = ?", [id]);
        await db.execute("DELETE FROM attempts WHERE id = ?", [id]);
      }
      await audit(`user:${s.sub}`, "DELETE_BULK_MONITORING_SESSIONS", "attempt", `${attemptIds.length} items`);
      return ok({ message: `${attemptIds.length} sesi monitoring berhasil dihapus.` });
    }

    if (!attemptId) {
      return Response.json({ error: "Attempt ID wajib disertakan." }, { status: 400 });
    }

    if (action === "UNLOCK_SESSION" || action === "RESET_SESSION") {
      // Buka kunci sesi agar siswa bisa lanjut atau pindah PC
      await db.execute(
        "UPDATE attempts SET ip_address = NULL, user_agent = NULL, last_seen_at = NOW() WHERE id = ?",
        [attemptId]
      );
      await audit(`user:${s.sub}`, "RESET_STUDENT_SESSION", "attempt", attemptId);
      return ok({ message: "Sesi ujian siswa berhasil dibuka kuncinya." });
    }

    if (action === "RESET_VIOLATIONS") {
      await db.execute("DELETE FROM violations WHERE attempt_id = ?", [attemptId]);
      await audit(`user:${s.sub}`, "RESET_STUDENT_VIOLATIONS", "attempt", attemptId);
      return ok({ message: "Hitungan dan log pelanggaran siswa berhasil direset ke 0." });
    }

    if (action === "DELETE_SESSION") {
      await db.execute("DELETE FROM attempt_answers WHERE attempt_id = ?", [attemptId]);
      await db.execute("DELETE FROM violations WHERE attempt_id = ?", [attemptId]);
      await db.execute("DELETE FROM attempts WHERE id = ?", [attemptId]);
      await audit(`user:${s.sub}`, "DELETE_MONITORING_SESSION", "attempt", attemptId);
      return ok({ message: "Sesi monitoring siswa berhasil dihapus." });
    }

    if (action === "ADD_TIME") {
      const extra = Math.max(1, Number(minutes || 10));
      await db.execute(
        "UPDATE attempts SET extra_minutes = extra_minutes + ? WHERE id = ? AND status = 'IN_PROGRESS'",
        [extra, attemptId]
      );
      await audit(`user:${s.sub}`, "ADD_STUDENT_TIME", "attempt", `${attemptId} (+${extra}m)`);
      return ok({ message: `Berhasil menambahkan waktu ${extra} menit.` });
    }

    if (action === "FORCE_SUBMIT") {
      await db.execute(
        "UPDATE attempts SET status = 'SUBMITTED', submitted_at = NOW() WHERE id = ? AND status = 'IN_PROGRESS'",
        [attemptId]
      );
      await audit(`user:${s.sub}`, "FORCE_SUBMIT", "attempt", attemptId);
      return ok({ message: "Ujian berhasil dipaksa selesai." });
    }

    return Response.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (e) {
    return apiError(e);
  }
}
