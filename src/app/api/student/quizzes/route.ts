import { NextRequest } from "next/server";
import { RowDataPacket } from "mysql2";
import { rows } from "@/lib/db";
import { apiError } from "@/lib/security";
import { ok } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    const quizRows = await rows<RowDataPacket[]>(
      `SELECT q.id, q.title, q.subject, q.class_name, q.duration_minutes, q.start_at, q.end_at, q.kkm,
              COUNT(DISTINCT qs.id) as question_count
       FROM quizzes q
       LEFT JOIN questions qs ON qs.quiz_id = q.id
       WHERE q.status = 'PUBLISHED' AND q.deleted_at IS NULL
       GROUP BY q.id
       ORDER BY q.created_at DESC`
    );

    const settingRows = await rows<RowDataPacket[]>(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key = 'require_student_password' LIMIT 1"
    );
    let requirePassword = true;
    if (settingRows.length > 0) {
      const v = settingRows[0].setting_value;
      requirePassword = typeof v === "boolean" ? v : v === "true" || v === true;
    }

    return ok({
      quizzes: quizRows.map((q) => ({
        id: q.id,
        title: q.title,
        subject: q.subject,
        className: q.class_name,
        class_name: q.class_name,
        duration_minutes: Number(q.duration_minutes || 60),
        question_count: Number(q.question_count || 0),
        start_at: q.start_at,
        end_at: q.end_at,
        kkm: Number(q.kkm || 75),
      })),
      settings: {
        require_student_password: requirePassword,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
