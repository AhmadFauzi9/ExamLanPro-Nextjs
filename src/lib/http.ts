import { NextResponse } from "next/server";
export const ok = (data: unknown, status = 200) =>
  NextResponse.json({ ok: true, data }, { status });
