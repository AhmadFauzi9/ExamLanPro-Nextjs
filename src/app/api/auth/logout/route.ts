import { NextRequest } from "next/server";
import { clearSession } from "@/lib/auth";
import { checkOrigin } from "@/lib/security";
import { ok } from "@/lib/http";
export async function POST(req: NextRequest) {
  if (!checkOrigin(req))
    return Response.json({ error: "Origin ditolak." }, { status: 403 });
  await clearSession();
  return ok({});
}
