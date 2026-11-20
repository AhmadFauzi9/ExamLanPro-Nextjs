import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { rows } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { apiError, checkOrigin, parseJson, rateLimit } from "@/lib/security";
import { ok } from "@/lib/http";

type StudentRow = RowDataPacket & {
  id: number;
  nis: string;
  name: string;
  class_name: string;
  section_name: string | null;
  password_hash: string | null;
};

type QuizRow = RowDataPacket & {
  id: number;
  title: string;
  subject: string;
  class_name: string;
  start_at: Date;
  end_at: Date;
  duration_minutes: number;
  exam_token: string;
};

const schema = z.object({
  nis: z.string().min(1).max(40),
  password: z.string().max(200).optional(),
  quizId: z.union([z.number(), z.string()]).optional(),
  token: z.string().trim().toUpperCase().optional(),
  name: z.string().optional(),
  class: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 30);
    if (limited) return limited;
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });

    const input = await parseJson(req, schema);
    const nis = input.nis.trim();

    // Cek pengaturan require_student_password
    const settingRows = await rows<RowDataPacket[]>(
      "SELECT setting_value FROM app_settings WHERE setting_key = 'require_student_password' LIMIT 1"
    );
    let requirePassword = true;
    if (settingRows.length > 0) {
      const v = settingRows[0].setting_value;
      requirePassword = typeof v === "boolean" ? v : v === "true" || v === true;
    }

    let student = (
      await rows<StudentRow[]>(
        "SELECT id, nis, name, class_name, section_name, password_hash FROM students WHERE nis=? AND active=TRUE AND deleted_at IS NULL LIMIT 1",
        [nis]
      )
    )[0];

    if (!student) {
      if (!requirePassword && input.name && input.class) {
        // Izinkan login ad-hoc jika tidak wajib password
        const [ins] = await (await import("@/lib/db")).db.execute(
          "INSERT INTO students (nis, name, class_name, active) VALUES (?, ?, ?, TRUE)",
          [nis, input.name.trim(), input.class.trim()]
        ) as any;
        student = {
          id: ins.insertId,
          nis,
          name: input.name.trim(),
          class_name: input.class.trim(),
          section_name: null,
          password_hash: null,
        } as StudentRow;
      } else {
        return Response.json(
          { error: `NIS '${nis}' tidak ditemukan dalam database siswa. Pastikan NIS benar atau hubungi guru.` },
          { status: 404 }
        );
      }
    }

    if (requirePassword) {
      if (!input.password) {
        return Response.json({ error: "Password login siswa wajib diisi." }, { status: 400 });
      }
      if (
        student.password_hash &&
        !(await bcrypt.compare(input.password, student.password_hash))
      ) {
        return Response.json(
          { error: "Password login salah! Silakan tanyakan password login Anda kepada guru pengawas." },
          { status: 401 }
        );
      }
    }

    // Ambil quiz jika quizId atau token diberikan
    let quiz: QuizRow | undefined;
    if (input.quizId) {
      quiz = (
        await rows<QuizRow[]>(
          "SELECT id, title, subject, class_name, start_at, end_at, duration_minutes, exam_token FROM quizzes WHERE id=? AND status='PUBLISHED' AND deleted_at IS NULL LIMIT 1",
          [input.quizId]
        )
      )[0];
    } else if (input.token) {
      quiz = (
        await rows<QuizRow[]>(
          "SELECT id, title, subject, class_name, start_at, end_at, duration_minutes, exam_token FROM quizzes WHERE exam_token=? AND status='PUBLISHED' AND deleted_at IS NULL LIMIT 1",
          [input.token]
        )
      )[0];
    }

    // Periksa attempt aktif jika ada
    let activeAttempt: (RowDataPacket & { id: string; status: string }) | undefined;
    if (quiz) {
      activeAttempt = (
        await rows<(RowDataPacket & { id: string; status: string })[]>(
          "SELECT id, status FROM attempts WHERE quiz_id=? AND student_id=? ORDER BY created_at DESC LIMIT 1",
          [quiz.id, student.id]
        )
      )[0];
      if (activeAttempt?.status === "SUBMITTED") {
        return Response.json(
          { error: "Ujian sudah dikumpulkan. Hubungi guru pengawas untuk izin ujian ulang." },
          { status: 409 }
        );
      }
    }

    await createSession({
      sub: String(student.id),
      role: "STUDENT",
      nis: student.nis,
      attemptId: activeAttempt?.id,
    });

    const questionCount = quiz
      ? (await rows<RowDataPacket[]>("SELECT COUNT(*) as c FROM questions WHERE quiz_id=?", [quiz.id]))[0]?.c || 0
      : 0;

    return ok({
      student: {
        id: student.id,
        nis: student.nis,
        name: student.name,
        className: student.class_name,
        class_name: student.class_name,
        sectionName: student.section_name,
      },
      quiz: quiz
        ? {
            id: quiz.id,
            title: quiz.title,
            subject: quiz.subject,
            className: quiz.class_name,
            class_name: quiz.class_name,
            duration_minutes: Number(quiz.duration_minutes || 60),
            question_count: Number(questionCount),
            start_at: quiz.start_at,
            end_at: quiz.end_at,
          }
        : null,
      activeAttemptId: activeAttempt?.id || null,
    });
  } catch (e) {
    return apiError(e);
  }
}
