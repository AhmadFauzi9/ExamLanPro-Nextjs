import mysql, { PoolConnection, RowDataPacket } from "mysql2/promise";

declare global {
  var __examlanPool: mysql.Pool | undefined;
}

function config() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL belum diatur.");
  const url = new URL(raw);
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 10,
    charset: "utf8mb4",
    timezone: "+07:00",
  };
}

export const db = global.__examlanPool ?? mysql.createPool(config());
if (process.env.NODE_ENV !== "production") global.__examlanPool = db;

export async function rows<T extends RowDataPacket[]>(
  sql: string,
  params: any[] = [],
) {
  const [result] = await db.execute<T>(sql, params);
  return result;
}

export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
