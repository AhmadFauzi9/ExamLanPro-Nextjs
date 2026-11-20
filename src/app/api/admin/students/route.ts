import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { rows, db } from "@/lib/db";
import { apiError, audit, checkOrigin, parseJson } from "@/lib/security";
import { ok } from "@/lib/http";
import { RowDataPacket } from "mysql2";
const schema = z.object({
  nis: z.string().min(3).max(40),
  name: z.string().min(2).max(150),
  className: z.string().min(1).max(80),
  sectionName: z.string().max(80).optional(),
  homeroomTeacher: z.string().max(150).optional(),
  password: z.string().min(6).max(200).optional(),
});
export async function GET() {
  try {
    await requireRole("ADMIN", "TEACHER");
    return ok(
      await rows<RowDataPacket[]>(
        "SELECT id,nis,name,class_name,section_name,homeroom_teacher,plain_password as password,active FROM students WHERE deleted_at IS NULL ORDER BY class_name,nis",
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
    await db.execute(
      "INSERT INTO students(nis,name,class_name,section_name,homeroom_teacher,password_hash,plain_password) VALUES(?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),class_name=VALUES(class_name),section_name=VALUES(section_name),homeroom_teacher=VALUES(homeroom_teacher),password_hash=COALESCE(VALUES(password_hash),password_hash),plain_password=COALESCE(VALUES(plain_password),plain_password),deleted_at=NULL",
      [
        x.nis,
        x.name,
        x.className,
        x.sectionName || null,
        x.homeroomTeacher || null,
        x.password ? await bcrypt.hash(x.password, 12) : null,
        x.password || null,
      ],
    );
    await audit(`user:${s.sub}`, "UPSERT_STUDENT", "student", x.nis);
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
