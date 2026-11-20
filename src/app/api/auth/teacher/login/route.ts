import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { rows, db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import {
  apiError,
  audit,
  checkOrigin,
  parseJson,
  rateLimit,
} from "@/lib/security";
import { ok } from "@/lib/http";

type UserRow = RowDataPacket & {
  id: number;
  password_hash: string;
  role: "ADMIN" | "TEACHER";
  name: string;
  must_change_password: number;
};
const schema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(8).max(200),
});
export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, 8, 60_000);
    if (limited) return limited;
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const input = await parseJson(req, schema);
    const user = (
      await rows<UserRow[]>(
        "SELECT id,password_hash,role,name,must_change_password FROM users WHERE username=? LIMIT 1",
        [input.username],
      )
    )[0];
    if (!user || !(await bcrypt.compare(input.password, user.password_hash)))
      return Response.json(
        { error: "Username atau password salah." },
        { status: 401 },
      );
    await createSession({ sub: String(user.id), role: user.role });
    await db.execute("UPDATE users SET last_login_at=NOW() WHERE id=?", [
      user.id,
    ]);
    await audit(input.username, "LOGIN", "user", String(user.id));
    return ok({
      name: user.name,
      role: user.role,
      mustChangePassword: Boolean(user.must_change_password),
    });
  } catch (e) {
    return apiError(e);
  }
}
