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
  token: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  reviewEnabled: z.boolean().default(false),
  kkm: z.number().min(0).max(100).default(75),
});
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("ADMIN", "TEACHER");
    const { id } = await params;
    const quiz = (
      await rows<RowDataPacket[]>(
        "SELECT * FROM quizzes WHERE id=? AND deleted_at IS NULL",
        [id],
      )
    )[0];
    if (!quiz)
      return Response.json(
        { error: "Paket tidak ditemukan." },
        { status: 404 },
      );
    const questions = await rows<RowDataPacket[]>(
      "SELECT * FROM questions WHERE quiz_id=? ORDER BY position",
      [id],
    );
    return ok({ quiz, questions });
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const { id } = await params;
    const x = await parseJson(req, schema);
    const startDate = x.startAt && x.startAt.trim() && !isNaN(new Date(x.startAt).getTime()) ? new Date(x.startAt) : null;
    const endDate = x.endAt && x.endAt.trim() && !isNaN(new Date(x.endAt).getTime()) ? new Date(x.endAt) : null;
    if (startDate && endDate && endDate <= startDate)
      return Response.json(
        { error: "Waktu selesai harus setelah mulai." },
        { status: 422 },
      );
    const maxQ = Number(x.maxQuestions ?? x.max_questions ?? 0);
    const token = (x.token && x.token.trim()) ? x.token.trim().toUpperCase() : crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    await db.execute(
      "UPDATE quizzes SET title=?,subject=?,class_name=?,description=?,max_questions=?,duration_minutes=?,start_at=?,end_at=?,exam_token=?,status=?,review_enabled=?,kkm=? WHERE id=? AND deleted_at IS NULL",
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
        x.reviewEnabled,
        x.kkm,
        id,
      ],
    );
    await audit(`user:${session.sub}`, "UPDATE_QUIZ", "quiz", id);
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const { id } = await params;
    await db.execute(
      "UPDATE quizzes SET deleted_at=NOW(),status='ARCHIVED' WHERE id=?",
      [id],
    );
    await audit(`user:${session.sub}`, "DELETE_QUIZ", "quiz", id);
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
