import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export type Session = {
  sub: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  nis?: string;
  attemptId?: string;
};
const COOKIE = "examlan_session";
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET minimal 32 karakter.");
  return new TextEncoder().encode(secret);
}

export async function createSession(session: Session, maxAge = 60 * 60 * 8) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}
export async function readSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    return (await jwtVerify(token, key())).payload as unknown as Session;
  } catch {
    return null;
  }
}
export async function requireRole(...roles: Session["role"][]) {
  const session = await readSession();
  if (!session || !roles.includes(session.role))
    throw new Error("UNAUTHORIZED");
  return session;
}
export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
