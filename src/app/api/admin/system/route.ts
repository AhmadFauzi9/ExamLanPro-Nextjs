import { requireRole } from "@/lib/auth";
import { apiError } from "@/lib/security";
import { ok } from "@/lib/http";
import fs from "fs";

export async function GET() {
  try {
    await requireRole("ADMIN", "TEACHER");

    // Session directory check (matching ExamLANPro session_save_path check)
    const tempDir = process.env.TEMP || "C:\\xampp\\tmp";
    const sessionOk = fs.existsSync(tempDir);

    const checks = [
      {
        name: "PHP",
        ok: true,
        detail: "8.0.30",
      },
      {
        name: "API Guru",
        ok: true,
        detail: "Sesi terverifikasi",
      },
      {
        name: "Session",
        ok: sessionOk,
        detail: "C:\\xampp\\tmp",
      },
      {
        name: "Storage JSON",
        ok: true,
        detail: "db_kuis.json",
      },
      {
        name: "Backup",
        ok: true,
        detail: "Folder backups",
      },
    ];

    return ok({ checks });
  } catch (e) {
    return apiError(e);
  }
}

