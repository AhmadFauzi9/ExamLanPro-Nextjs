import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows } from "@/lib/db";
import { apiError } from "@/lib/security";
import { ok } from "@/lib/http";
export async function GET() {
  try {
    await requireRole("ADMIN", "TEACHER");
    return ok(
      await rows<RowDataPacket[]>(
        "SELECT e.*,s.nis,s.name,s.class_name,q.title FROM extension_requests e JOIN attempts a ON a.id=e.attempt_id JOIN students s ON s.id=a.student_id JOIN quizzes q ON q.id=a.quiz_id ORDER BY e.created_at DESC LIMIT 500",
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
