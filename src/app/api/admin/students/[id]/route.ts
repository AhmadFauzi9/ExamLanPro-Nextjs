import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, audit, checkOrigin, parseJson } from "@/lib/security";
import { ok } from "@/lib/http";

const schema = z.object({
  nis: z.string().min(3).max(40),
  name: z.string().min(2).max(150),
  className: z.string().min(1).max(80),
  sectionName: z.string().max(80).optional(),
  homeroomTeacher: z.string().max(150).optional(),
  password: z.string().min(6).max(200).optional(),
  active: z.boolean().default(true),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const { id } = await params;
    const input = await parseJson(req, schema);
    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 12)
      : null;
    await db.execute(
      "UPDATE students SET nis=?,name=?,class_name=?,section_name=?,homeroom_teacher=?,active=?,password_hash=COALESCE(?,password_hash),plain_password=COALESCE(?,plain_password) WHERE id=? AND deleted_at IS NULL",
      [
        input.nis,
        input.name,
        input.className,
        input.sectionName || null,
        input.homeroomTeacher || null,
        input.active,
        passwordHash,
        input.password || null,
        id,
      ],
    );
    await audit(`user:${session.sub}`, "UPDATE_STUDENT", "student", id);
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
      "UPDATE students SET deleted_at=NOW(),active=FALSE WHERE id=? AND deleted_at IS NULL",
      [id],
    );
    await audit(`user:${session.sub}`, "DELETE_STUDENT", "student", id);
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
