import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows, db } from "@/lib/db";
import { apiError, audit, checkOrigin, parseJson } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.object({
  title: z.string().min(3).max(200),
  subject: z.string().min(2).max(120),
  className: z.string().min(1).max(80),
  description: z.string().max(5000).optional().nullable(),
  maxQuestions: z.number().int().min(0).max(1000).optional(),
  max_questions: z.number().int().min(0).max(1000).optional(),
  durationMinutes: z.number().int().min(1).max(600),
  startAt: z.string().optional().nullable(),
  endAt: z.string().optional().nullable(),
  token: z
    .string()
    .optional()
    .nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});
export async function GET() {
  try {
    await requireRole("ADMIN", "TEACHER");
    return ok(
      await rows<RowDataPacket[]>(
        "SELECT q.*,COUNT(qq.id) question_count FROM quizzes q LEFT JOIN questions qq ON qq.quiz_id=q.id WHERE q.deleted_at IS NULL GROUP BY q.id ORDER BY q.created_at DESC",
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const x = await parseJson(req, schema);
    const startDate = x.startAt && x.startAt.trim() && !isNaN(new Date(x.startAt).getTime()) ? new Date(x.startAt) : null;
    const endDate = x.endAt && x.endAt.trim() && !isNaN(new Date(x.endAt).getTime()) ? new Date(x.endAt) : null;
    if (startDate && endDate && endDate <= startDate)
      return Response.json(
        { error: "Waktu selesai harus setelah mulai." },
        { status: 422 },
      );
    const token =
      (x.token && x.token.trim()) ? x.token.trim().toUpperCase() :
      crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    const maxQ = Number(x.maxQuestions ?? x.max_questions ?? 0);
    const [r] = await db.execute(
      "INSERT INTO quizzes(title,subject,class_name,description,max_questions,duration_minutes,start_at,end_at,exam_token,status,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      [
        x.title,
        x.subject,
        x.className,
        x.description || null,
        maxQ,
        x.durationMinutes,
        startDate,
        endDate,
        token,
        x.status,
        s.sub,
      ],
    );
    const newId = (r as { insertId: number }).insertId;
    await audit(
      `user:${s.sub}`,
      "CREATE_QUIZ",
      "quiz",
      String(newId),
    );
    return ok({ id: newId, token }, 201);
  } catch (e) {
    return apiError(e);
  }
}
