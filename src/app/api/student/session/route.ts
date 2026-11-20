import { NextRequest } from "next/server";
import { readSession } from "@/lib/auth";
import { rows } from "@/lib/db";
import { ok } from "@/lib/http";
import { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest) {
  try {
    const session = await readSession();
    if (!session || session.role !== "STUDENT") {
      return Response.json({ error: "Sesi tidak ditemukan" }, { status: 401 });
    }
    const student = (
      await rows<RowDataPacket[]>(
        "SELECT id, nis, name, class_name FROM students WHERE id=? AND active=TRUE AND deleted_at IS NULL LIMIT 1",
        [session.sub]
      )
    )[0];
    if (!student) {
      return Response.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }
    return ok({
      student: {
        id: student.id,
        nis: student.nis,
        name: student.name,
        className: student.class_name,
      },
      attemptId: session.attemptId || null,
    });
  } catch {
    return Response.json({ error: "Gagal memverifikasi sesi" }, { status: 500 });
  }
}
