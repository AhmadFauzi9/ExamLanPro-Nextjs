import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { apiError, audit, checkOrigin, parseJson } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  minutes: z.number().int().min(1).max(180).default(15),
});
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const { id } = await params,
      x = await parseJson(req, schema);
    await transaction(async (c) => {
      const [rs] = await c.execute(
        "SELECT attempt_id FROM extension_requests WHERE id=? AND status='PENDING' FOR UPDATE",
        [id],
      );
      const row = (rs as { attempt_id: string }[])[0];
      if (!row)
        throw new Error("Permintaan tidak ditemukan atau sudah diproses.");
      await c.execute(
        "UPDATE extension_requests SET status=?,approved_minutes=?,decided_by=?,decided_at=NOW() WHERE id=?",
        [x.decision, x.decision === "APPROVED" ? x.minutes : null, s.sub, id],
      );
      if (x.decision === "APPROVED")
        await c.execute(
          "UPDATE attempts SET extra_minutes=extra_minutes+? WHERE id=?",
          [x.minutes, row.attempt_id],
        );
    });
    await audit(`user:${s.sub}`, `EXTENSION_${x.decision}`, "extension", id);
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
