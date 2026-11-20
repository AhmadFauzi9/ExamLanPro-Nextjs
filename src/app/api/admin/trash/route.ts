import { NextRequest } from "next/server";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows, db } from "@/lib/db";
import { apiError, audit, checkOrigin, parseJson } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.object({
  type: z.enum(["student", "quiz"]),
  id: z.number().int().positive(),
});
export async function GET() {
  try {
    await requireRole("ADMIN");
    const [students, quizzes] = await Promise.all([
      rows<RowDataPacket[]>(
        "SELECT id,nis,name,class_name,deleted_at FROM students WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
      ),
      rows<RowDataPacket[]>(
        "SELECT id,title,subject,class_name,deleted_at FROM quizzes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC",
      ),
    ]);
    return ok({ students, quizzes });
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(req: NextRequest) {
  try {
    const s = await requireRole("ADMIN");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const x = await parseJson(req, schema);
    if (x.type === "student")
      await db.execute(
        "UPDATE students SET deleted_at=NULL,active=TRUE WHERE id=?",
        [x.id],
      );
    else
      await db.execute(
        "UPDATE quizzes SET deleted_at=NULL,status='DRAFT' WHERE id=?",
        [x.id],
      );
    await audit(`user:${s.sub}`, "RESTORE_TRASH", x.type, String(x.id));
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
