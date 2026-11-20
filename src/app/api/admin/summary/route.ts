import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows } from "@/lib/db";
import { apiError } from "@/lib/security";
import { ok } from "@/lib/http";
export async function GET() {
  try {
    await requireRole("ADMIN", "TEACHER");
    const c = async (sql: string) =>
      (await rows<(RowDataPacket & { n: number })[]>(sql))[0].n;
    return ok({
      students: await c(
        "SELECT COUNT(*) n FROM students WHERE deleted_at IS NULL",
      ),
      quizzes: await c(
        "SELECT COUNT(*) n FROM quizzes WHERE deleted_at IS NULL",
      ),
      active: await c(
        "SELECT COUNT(*) n FROM attempts WHERE status='IN_PROGRESS'",
      ),
      results: await c(
        "SELECT COUNT(*) n FROM attempts WHERE status='SUBMITTED'",
      ),
      pendingExtensions: await c(
        "SELECT COUNT(*) n FROM extension_requests WHERE status='PENDING'",
      ),
    });
  } catch (e) {
    return apiError(e);
  }
}
