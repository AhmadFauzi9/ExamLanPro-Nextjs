import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, audit, checkOrigin, parseJson } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.object({ enabled: z.boolean() });
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const { id } = await params,
      input = await parseJson(req, schema);
    await db.execute("UPDATE quizzes SET review_enabled=? WHERE id=?", [
      input.enabled,
      id,
    ]);
    await audit(
      `user:${s.sub}`,
      input.enabled ? "ENABLE_REVIEW" : "DISABLE_REVIEW",
      "quiz",
      id,
    );
    return ok({ enabled: input.enabled });
  } catch (e) {
    return apiError(e);
  }
}
