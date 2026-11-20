import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows, db } from "@/lib/db";
import { apiError, audit, checkOrigin, parseJson } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.object({
  currentPassword: z.string().min(8).max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
  new_password: z.string().min(8).max(200).optional(),
});
export async function PATCH(req: NextRequest) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const x = await parseJson(req, schema);
    const newPwd = (x.newPassword || x.new_password || "").trim();
    if (!newPwd || newPwd.length < 8) {
      return Response.json(
        { error: "Password baru minimal 8 karakter." },
        { status: 400 },
      );
    }
    const user = (
      await rows<(RowDataPacket & { password_hash: string })[]>(
        "SELECT id, password_hash FROM users WHERE id=?",
        [s.sub],
      )
    )[0];
    if (!user) {
      return Response.json(
        { error: "Pengguna tidak ditemukan." },
        { status: 404 },
      );
    }
    if (x.currentPassword) {
      if (!(await bcrypt.compare(x.currentPassword, user.password_hash))) {
        return Response.json(
          { error: "Password saat ini salah." },
          { status: 401 },
        );
      }
    }
    await db.execute(
      "UPDATE users SET password_hash=?,must_change_password=FALSE WHERE id=?",
      [await bcrypt.hash(newPwd, 12), s.sub],
    );
    await audit(`user:${s.sub}`, "CHANGE_PASSWORD", "user", s.sub);
    return ok({ message: "Password guru berhasil diganti." });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(req: NextRequest) {
  return PATCH(req);
}
