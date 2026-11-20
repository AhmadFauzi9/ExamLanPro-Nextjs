import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, audit, checkOrigin } from "@/lib/security";
import { ok } from "@/lib/http";
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const { id } = await params;
    await db.execute("DELETE FROM questions WHERE id=?", [id]);
    await audit(`user:${s.sub}`, "DELETE_QUESTION", "question", id);
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
