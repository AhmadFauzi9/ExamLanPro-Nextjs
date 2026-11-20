import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL belum diatur.");

const url = new URL(raw);
let connection: mysql.Connection | undefined;

try {
  connection = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  });

  const [tables] = await connection.query("SHOW TABLES LIKE 'users'");
  const usersTable = Array.isArray(tables) && tables.length > 0;
  let adminRows = 0;
  let envPasswordMatchesStoredHash = false;

  if (usersTable) {
    const [users] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT password_hash FROM users WHERE username=? LIMIT 1",
      [process.env.ADMIN_USERNAME || "admin"],
    );
    adminRows = users.length;
    if (users[0]) {
      envPasswordMatchesStoredHash = await bcrypt.compare(
        process.env.ADMIN_PASSWORD || "",
        users[0].password_hash,
      );
    }
  }

  console.log(JSON.stringify({ connection: true, usersTable, adminRows, envPasswordMatchesStoredHash }));
} catch (error) {
  const value = error as { code?: string; message?: string };
  console.log(JSON.stringify({ connection: false, errorCode: value.code || null, errorMessage: value.message || "Unknown error" }));
  process.exitCode = 1;
} finally {
  await connection?.end();
}
