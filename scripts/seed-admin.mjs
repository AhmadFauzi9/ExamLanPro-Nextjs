import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL belum diatur.");
const username = process.env.ADMIN_USERNAME || "admin";
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) throw new Error("ADMIN_PASSWORD minimal 12 karakter.");

const url = new URL(raw);
const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
});

try {
  const [existing] = await connection.execute("SELECT id FROM users WHERE username=? LIMIT 1", [username]);
  if (existing.length) {
    console.log("Admin sudah ada; password tidak diubah.");
  } else {
    await connection.execute(
      "INSERT INTO users(username,password_hash,name,role,must_change_password) VALUES(?,?,?,?,TRUE)",
      [username, await bcrypt.hash(password, 12), "Administrator", "ADMIN"],
    );
    console.log(`Admin ${username} berhasil dibuat.`);
  }
} finally {
  await connection.end();
}
