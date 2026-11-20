import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL belum diatur.");
const url = new URL(raw); const database = url.pathname.slice(1);
const conn = await mysql.createConnection({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), multipleStatements: true });
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database.replaceAll("`", "``")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.changeUser({ database });
await conn.query(await fs.readFile(path.join(process.cwd(), "db/schema.sql"), "utf8"));
await conn.end(); console.log(`Database ${database} siap.`);
