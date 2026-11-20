import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
const username = process.env.ADMIN_USERNAME || "admin";
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) throw new Error("ADMIN_PASSWORD minimal 12 karakter.");
const [existing] = await db.execute("SELECT id FROM users WHERE username=? LIMIT 1", [username]);
if (Array.isArray(existing) && existing.length) { console.log("Admin sudah ada; password tidak diubah."); process.exit(0); }
await db.execute("INSERT INTO users(username,password_hash,name,role,must_change_password) VALUES(?,?,?,?,TRUE)", [username, await bcrypt.hash(password, 12), "Administrator", "ADMIN"]);
console.log(`Admin ${username} berhasil dibuat.`); process.exit(0);
