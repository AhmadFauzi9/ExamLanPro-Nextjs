import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiError, checkOrigin } from "@/lib/security";
import { ok } from "@/lib/http";
const allowed = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
export async function POST(req: NextRequest) {
  try {
    await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const file = (await req.formData()).get("file");
    if (!(file instanceof File))
      return Response.json({ error: "Gambar wajib dipilih." }, { status: 422 });
    const ext = allowed.get(file.type);
    if (!ext)
      return Response.json(
        { error: "Format gambar harus JPG, PNG, atau WebP." },
        { status: 422 },
      );
    if (file.size > 3 * 1024 * 1024)
      return Response.json(
        { error: "Ukuran gambar maksimal 3 MB." },
        { status: 413 },
      );
    const dir = path.join(process.cwd(), "public", "uploads", "questions");
    await fs.mkdir(dir, { recursive: true });
    const name = `question-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(
      path.join(dir, name),
      Buffer.from(await file.arrayBuffer()),
      { flag: "wx" },
    );
    return ok({ url: `/uploads/questions/${name}` }, 201);
  } catch (e) {
    return apiError(e);
  }
}
