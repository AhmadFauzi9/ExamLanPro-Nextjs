import { NextRequest } from "next/server";
import { z } from "zod";
import { RowDataPacket } from "mysql2";
import { requireRole } from "@/lib/auth";
import { rows, db } from "@/lib/db";
import { apiError, audit, checkOrigin, parseJson } from "@/lib/security";
import { ok } from "@/lib/http";
const schema = z.record(z.string(), z.unknown());
export async function GET() {
  try {
    await requireRole("ADMIN", "TEACHER");
    const rs = await rows<
      (RowDataPacket & { setting_key: string; setting_value: unknown })[]
    >("SELECT setting_key,setting_value FROM app_settings");
    return ok(
      Object.fromEntries(rs.map((x) => [x.setting_key, x.setting_value])),
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(req: NextRequest) {
  try {
    const s = await requireRole("ADMIN");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const x = await parseJson(req, schema);
    for (const [k, v] of Object.entries(x))
      await db.execute(
        "INSERT INTO app_settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
        [k, JSON.stringify(v)],
      );
    await audit(`user:${s.sub}`, "UPDATE_SETTINGS", "settings");
    return ok({});
  } catch (e) {
    return apiError(e);
  }
}
