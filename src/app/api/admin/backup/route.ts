import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows, db } from "@/lib/db";
import { apiError, audit } from "@/lib/security";
import { ok } from "@/lib/http";

const backupDir = path.join(process.cwd(), "storage/backups");

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "TEACHER");
    const action = req.nextUrl.searchParams.get("action");
    const fileName = req.nextUrl.searchParams.get("file");

    await fs.mkdir(backupDir, { recursive: true });

    // Download specific backup
    if (action === "download" && fileName) {
      const safeName = path.basename(fileName);
      const filePath = path.join(backupDir, safeName);
      const content = await fs.readFile(filePath, "utf8");
      return new Response(content, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${safeName}"`,
        },
      });
    }

    // List all backups
    if (action === "list") {
      const files = await fs.readdir(backupDir);
      const backups = [];
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        const filePath = path.join(backupDir, f);
        const stat = await fs.stat(filePath);
        backups.push({
          file: f,
          size: stat.size,
          created_at: stat.mtime.toISOString(),
        });
      }
      backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return ok({ backups });
    }

    // Default export full backup JSON
    const tables = [
      "users",
      "students",
      "quizzes",
      "questions",
      "attempts",
      "attempt_answers",
      "violations",
      "extension_requests",
      "audit_logs",
      "app_settings",
    ];
    const data: Record<string, RowDataPacket[]> = {};
    for (const table of tables) {
      data[table] = await rows<RowDataPacket[]>(`SELECT * FROM ${table}`);
    }

    const payload = JSON.stringify(
      { version: 2, createdAt: new Date().toISOString(), data },
      null,
      2
    );

    const generatedName = `examlanpro-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    await fs.writeFile(path.join(backupDir, generatedName), payload, "utf8");

    return new Response(payload, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${generatedName}"`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    await fs.mkdir(backupDir, { recursive: true });

    const action = req.nextUrl.searchParams.get("action");

    // Handle Restore
    if (action === "restore") {
      const contentType = req.headers.get("content-type") || "";
      let backupPayload: any = null;

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("backup_file") as File;
        if (!file) {
          return Response.json({ error: "Berkas cadangan tidak ditemukan." }, { status: 400 });
        }
        const text = await file.text();
        backupPayload = JSON.parse(text);
      } else {
        const body = await req.json();
        const fileName = body.file;
        if (!fileName) {
          return Response.json({ error: "Nama berkas harus ditentukan." }, { status: 400 });
        }
        const filePath = path.join(backupDir, path.basename(fileName));
        const text = await fs.readFile(filePath, "utf8");
        backupPayload = JSON.parse(text);
      }

      if (!backupPayload || !backupPayload.data) {
        return Response.json({ error: "Struktur berkas cadangan tidak valid." }, { status: 422 });
      }

      // Restore allowed tables
      const allowed = ["students", "quizzes", "questions", "app_settings"];
      for (const table of allowed) {
        const records = backupPayload.data[table];
        if (Array.isArray(records) && records.length > 0) {
          for (const item of records) {
            const keys = Object.keys(item);
            const vals = Object.values(item);
            const placeholders = keys.map(() => "?").join(",");
            const updates = keys.map((k) => `\`${k}\`=VALUES(\`${k}\`)`).join(",");
            const sql = `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(",")}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
            try {
              await db.execute(sql, vals as any);
            } catch {}
          }
        }
      }

      await audit(`user:${s.sub}`, "RESTORE_BACKUP", "backup", "system");
      return ok({ message: "Database berhasil dipulihkan." });
    }

    const tables = [
      "users",
      "students",
      "quizzes",
      "questions",
      "attempts",
      "attempt_answers",
      "violations",
      "extension_requests",
      "audit_logs",
      "app_settings",
    ];
    const data: Record<string, RowDataPacket[]> = {};
    for (const table of tables) {
      data[table] = await rows<RowDataPacket[]>(`SELECT * FROM ${table}`);
    }

    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const fileName = `examlan-backup-${stamp}.json`;
    const payload = JSON.stringify({ version: 2, createdAt: now.toISOString(), data }, null, 2);

    await fs.writeFile(path.join(backupDir, fileName), payload, "utf8");
    await audit(`user:${s.sub}`, "CREATE_BACKUP", "backup", fileName);

    return ok({ file: fileName, createdAt: now.toISOString() });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    const body = await req.json();
    const files = Array.isArray(body.files) ? body.files : [body.file];

    for (const f of files) {
      if (!f) continue;
      const safe = path.basename(f);
      const filePath = path.join(backupDir, safe);
      try {
        await fs.unlink(filePath);
      } catch {}
    }

    await audit(`user:${s.sub}`, "DELETE_BACKUP", "backup", JSON.stringify(files));
    return ok({ deleted: files.length });
  } catch (e) {
    return apiError(e);
  }
}
