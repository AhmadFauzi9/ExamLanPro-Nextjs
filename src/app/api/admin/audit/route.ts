import { NextRequest } from "next/server";
import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows } from "@/lib/db";
import { apiError } from "@/lib/security";
import { ok } from "@/lib/http";
export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "TEACHER");
    const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 100);
    return ok(
      await rows<RowDataPacket[]>(
        "SELECT * FROM audit_logs WHERE actor LIKE ? OR action LIKE ? OR entity LIKE ? ORDER BY created_at DESC LIMIT 1000",
        [`%${q}%`, `%${q}%`, `%${q}%`],
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
