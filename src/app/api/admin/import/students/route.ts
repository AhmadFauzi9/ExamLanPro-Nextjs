import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { first, tabularRows } from "@/lib/importers";
import { apiError, audit, checkOrigin } from "@/lib/security";
import { ok } from "@/lib/http";

function generateStudentCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return Response.json({ error: "Berkas wajib dipilih." }, { status: 422 });
    if (file.size > 5 * 1024 * 1024)
      return Response.json(
        { error: "Ukuran berkas maksimal 5 MB." },
        { status: 413 },
      );
    const data = await tabularRows(file);
    let imported = 0,
      skipped = 0;
    await transaction(async (c) => {
      for (const row of data) {
        const nis = first(row, "no_induk", "nis", "nomor_induk", "nomor_induk_siswa"),
          name = first(row, "nama", "nama_siswa", "name"),
          className = first(row, "kelas", "class", "class_name"),
          section = first(row, "bagian", "section"),
          homeroom = first(row, "wali_kelas", "walikelas", "tahun_ajaran");
        let password = first(row, "password", "kata_sandi", "kode_akses", "sandi");

        if (!nis || !name || !className) {
          skipped++;
          continue;
        }

        if (!password) {
          password = generateStudentCode();
        }

        const hash = await bcrypt.hash(password, 12);
        await c.execute(
          `INSERT INTO students(nis, name, class_name, section_name, homeroom_teacher, password_hash, plain_password)
           VALUES(?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             class_name = VALUES(class_name),
             section_name = VALUES(section_name),
             homeroom_teacher = VALUES(homeroom_teacher),
             password_hash = COALESCE(VALUES(password_hash), password_hash),
             plain_password = COALESCE(VALUES(plain_password), plain_password),
             active = TRUE,
             deleted_at = NULL`,
          [nis, name, className, section || null, homeroom || null, hash, password],
        );
        imported++;
      }
    });
    await audit(`user:${s.sub}`, "IMPORT_STUDENTS", "student", undefined, {
      file: file.name,
      imported,
      skipped,
    });
    return ok({ imported, skipped });
  } catch (e) {
    return apiError(e);
  }
}
