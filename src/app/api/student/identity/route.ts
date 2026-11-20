import { NextRequest } from "next/server";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { rows } from "@/lib/db";
import { apiError, rateLimit } from "@/lib/security";
import { ok } from "@/lib/http";
type Student = RowDataPacket & {
  nis: string;
  name: string;
  class_name: string;
  section_name: string | null;
  photo_url: string | null;
};
export async function GET(req: NextRequest) {
  try {
    const limited = rateLimit(req, 30);
    if (limited) return limited;
    const nis = z
      .string()
      .regex(/^[A-Za-z0-9.-]{3,40}$/)
      .parse(req.nextUrl.searchParams.get("nis"));
    const student = (
      await rows<Student[]>(
        "SELECT nis,name,class_name,section_name,photo_url FROM students WHERE nis=? AND active=TRUE AND deleted_at IS NULL",
        [nis],
      )
    )[0];
    if (!student)
      return Response.json({ error: "NIS tidak terdaftar." }, { status: 404 });
    return ok(student);
  } catch (e) {
    return apiError(e);
  }
}
