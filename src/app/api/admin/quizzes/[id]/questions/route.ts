import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, audit, checkOrigin, parseJson } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.object({
  id: z.number().int().positive().optional(),
  position: z.number().int().positive(),
  type: z.enum([
    "mc",
    "complex",
    "cause_effect",
    "case_analysis",
    "matching",
    "essay",
    "scaled",
  ]),
  content: z.string().min(1),
  passage: z.string().optional(),
  imageUrl: z.string().max(500).optional(),
  options: z.unknown().optional(),
  answerKey: z.unknown().optional(),
  explanation: z.string().optional(),
  points: z.number().positive().max(100),
});
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const { id: quizId } = await params;
    const x = await parseJson(req, schema);
    if (x.id) {
      await db.execute(
        "UPDATE questions SET position=?,type=?,content=?,passage=?,image_url=?,options=?,answer_key=?,explanation=?,points=? WHERE id=? AND quiz_id=?",
        [
          x.position,
          x.type,
          x.content,
          x.passage || null,
          x.imageUrl || null,
          JSON.stringify(x.options ?? null),
          JSON.stringify(x.answerKey ?? null),
          x.explanation || null,
          x.points,
          x.id,
          quizId,
        ],
      );
    } else {
      await db.execute(
        "INSERT INTO questions(quiz_id,position,type,content,passage,image_url,options,answer_key,explanation,points) VALUES(?,?,?,?,?,?,?,?,?,?)",
        [
          quizId,
          x.position,
          x.type,
          x.content,
          x.passage || null,
          x.imageUrl || null,
          JSON.stringify(x.options ?? null),
          JSON.stringify(x.answerKey ?? null),
          x.explanation || null,
          x.points,
        ],
      );
    }
    await audit(
      `user:${session.sub}`,
      x.id ? "UPDATE_QUESTION" : "CREATE_QUESTION",
      "quiz",
      quizId,
    );
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
