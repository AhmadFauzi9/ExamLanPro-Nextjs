import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL belum diatur.");

const url = new URL(raw);
const database = url.pathname.slice(1);
if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error("Nama database tidak valid.");

const connection = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  multipleStatements: true,
});

try {
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.changeUser({ database });
  const schema = await fs.readFile(path.join(process.cwd(), "db/schema.sql"), "utf8");
  await connection.query(schema);
  const [currentAttemptIndex] = await connection.query(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema=? AND table_name='attempts' AND index_name='idx_quiz_student_attempt' LIMIT 1",
    [database],
  );
  if (!currentAttemptIndex.length) {
    await connection.query("ALTER TABLE attempts ADD INDEX idx_quiz_student_attempt(quiz_id, student_id, status)");
  }
  const [legacyAttemptIndex] = await connection.query(
    "SELECT 1 FROM information_schema.statistics WHERE table_schema=? AND table_name='attempts' AND index_name='uq_quiz_student_attempt' LIMIT 1",
    [database],
  );
  if (legacyAttemptIndex.length) {
    await connection.query("ALTER TABLE attempts DROP INDEX uq_quiz_student_attempt");
  }
  console.log(`Database ${database} siap.`);
} finally {
  await connection.end();
}
