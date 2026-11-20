import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const raw = process.env.DATABASE_URL;
if (!raw) throw new Error("DATABASE_URL belum diatur.");

const jsonPath = "C:/xampp/htdocs/ExamLANPro/backend/storage/db_kuis.json";
const jsonContent = await fs.readFile(jsonPath, "utf8");
const dbData = JSON.parse(jsonContent);

const url = new URL(raw);
const conn = await mysql.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  charset: "utf8mb4",
});

try {
  console.log("Migrating data from db_kuis.json to MySQL...");

  // 1. Get or create admin user
  const [adminRows] = await conn.query("SELECT id FROM users WHERE username = 'admin' LIMIT 1");
  let adminId;
  if (adminRows.length === 0) {
    const hash = await bcrypt.hash("admin123", 10);
    const [res] = await conn.query(
      "INSERT INTO users (username, password_hash, name, role, must_change_password) VALUES ('admin', ?, 'Administrator Guru', 'ADMIN', FALSE)",
      [hash]
    );
    adminId = res.insertId;
  } else {
    adminId = adminRows[0].id;
  }

  // 2. Settings
  const reqPwd = dbData.settings?.require_student_password !== false;
  await conn.query(
    "INSERT INTO app_settings (setting_key, setting_value) VALUES ('require_student_password', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
    [JSON.stringify(reqPwd), JSON.stringify(reqPwd)]
  );

  // 3. Students
  console.log(`Migrating ${dbData.students?.length || 0} students...`);
  const studentIdMap = new Map(); // nis -> mysql id
  for (const st of dbData.students || []) {
    const nis = String(st.nis || "").trim();
    if (!nis) continue;
    const name = String(st.name || "").trim();
    const className = String(st.class || "").trim();
    const sectionName = String(st.section_name || st.tahun_ajaran || "").trim();
    const rawPwd = String(st.password || "").trim();
    const pwdHash = rawPwd ? await bcrypt.hash(rawPwd, 8) : null;

    const [existing] = await conn.query("SELECT id FROM students WHERE nis = ? LIMIT 1", [nis]);
    let sId;
    if (existing.length > 0) {
      sId = existing[0].id;
      await conn.query(
        "UPDATE students SET name = ?, class_name = ?, section_name = ?, password_hash = COALESCE(?, password_hash) WHERE id = ?",
        [name, className, sectionName, pwdHash, sId]
      );
    } else {
      const [ins] = await conn.query(
        "INSERT INTO students (nis, name, class_name, section_name, password_hash, active) VALUES (?, ?, ?, ?, ?, TRUE)",
        [nis, name, className, sectionName, pwdHash]
      );
      sId = ins.insertId;
    }
    studentIdMap.set(nis, sId);
  }

  // 4. Quizzes & Questions
  console.log(`Migrating ${dbData.questions?.length || 0} quizzes...`);
  const quizIdMap = new Map(); // json quiz id -> mysql quiz id
  for (const q of dbData.questions || []) {
    const title = String(q.title || "Paket Ujian").trim();
    const subject = String(q.subject || "Umum").trim();
    const className = String(q.class || "8").trim();
    const duration = Number(q.duration || q.duration_minutes || 60);
    const token = String(q.pin || "").toUpperCase().slice(0, 6) || crypto.randomBytes(3).toString("hex").toUpperCase();
    const kkm = Number(q.kkm || 75);
    const reviewEnabled = Boolean(q.review_enabled);
    const startAt = new Date(Date.now() - 24 * 3600 * 1000);
    const endAt = new Date(Date.now() + 30 * 24 * 3600 * 1000);

    const [existingQuiz] = await conn.query("SELECT id FROM quizzes WHERE title = ? AND class_name = ? LIMIT 1", [title, className]);
    let qId;
    if (existingQuiz.length > 0) {
      qId = existingQuiz[0].id;
      await conn.query(
        "UPDATE quizzes SET exam_token = ?, duration_minutes = ?, kkm = ?, review_enabled = ?, status = 'PUBLISHED' WHERE id = ?",
        [token, duration, kkm, reviewEnabled ? 1 : 0, qId]
      );
    } else {
      const [ins] = await conn.query(
        "INSERT INTO quizzes (title, subject, class_name, duration_minutes, start_at, end_at, exam_token, status, review_enabled, kkm, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?, ?)",
        [title, subject, className, duration, startAt, endAt, token, reviewEnabled ? 1 : 0, kkm, adminId]
      );
      qId = ins.insertId;
    }
    quizIdMap.set(q.id, qId);

    // Questions
    await conn.query("DELETE FROM questions WHERE quiz_id = ?", [qId]);
    const questionsList = q.questions || [];
    for (let pos = 0; pos < questionsList.length; pos++) {
      const item = questionsList[pos];
      const type = item.type || "mc";
      const content = String(item.question || item.content || item.statement || "").trim();
      const passage = item.passage || (item.reason ? `Alasan: ${item.reason}` : null);
      let img = item.image || item.image_url || null;
      if (img && !img.startsWith("/")) {
        img = "/" + img;
      }
      const options = item.options ? JSON.stringify(item.options) : null;
      let answerKey = null;
      if (item.answer !== undefined) {
        answerKey = JSON.stringify(item.answer);
      } else if (item.answers !== undefined) {
        answerKey = JSON.stringify(item.answers);
      } else if (item.pairs !== undefined) {
        answerKey = JSON.stringify(item.pairs);
      }
      const explanation = item.explanation || null;
      const points = Number(item.points || 1);

      await conn.query(
        "INSERT INTO questions (quiz_id, position, type, content, passage, image_url, options, answer_key, explanation, points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [qId, pos + 1, type, content, passage, img, options, answerKey, explanation, points]
      );
    }
  }

  // 5. Results / Attempts
  console.log(`Migrating ${dbData.results?.length || 0} results...`);
  for (const r of dbData.results || []) {
    const nis = String(r.nis || "").trim();
    const sId = studentIdMap.get(nis);
    if (!sId) continue;
    const qId = quizIdMap.get(r.code) || Array.from(quizIdMap.values())[0];
    if (!qId) continue;

    const attemptId = r.id?.startsWith("res_") ? crypto.randomUUID() : (r.id || crypto.randomUUID());
    const score = Number(r.score || 0);
    const correct = Number(r.correct || 0);
    const wrong = Number(r.wrong || 0);
    const questionOrder = JSON.stringify(r.question_order || []);
    
    // Check if attempt exists
    const [existAttempt] = await conn.query("SELECT id FROM attempts WHERE quiz_id = ? AND student_id = ? LIMIT 1", [qId, sId]);
    if (existAttempt.length === 0) {
      await conn.query(
        "INSERT INTO attempts (id, quiz_id, student_id, resume_token_hash, status, question_order, started_at, expires_at, submitted_at, score, correct_count, wrong_count) VALUES (?, ?, ?, 'migrated', 'SUBMITTED', ?, NOW(), NOW(), NOW(), ?, ?, ?)",
        [attemptId, qId, sId, questionOrder, score, correct, wrong]
      );

      // Breakdown answers if available
      if (Array.isArray(r.breakdowns)) {
        // Get questions for this quiz
        const [qRows] = await conn.query("SELECT id, position FROM questions WHERE quiz_id = ? ORDER BY position", [qId]);
        for (let bIdx = 0; bIdx < r.breakdowns.length; bIdx++) {
          const bd = r.breakdowns[bIdx];
          const matchedQ = qRows[bIdx];
          if (matchedQ) {
            await conn.query(
              "INSERT IGNORE INTO attempt_answers (attempt_id, question_id, answer, is_correct, awarded_points) VALUES (?, ?, ?, ?, ?)",
              [attemptId, matchedQ.id, JSON.stringify(bd.studentAnswer), bd.isCorrect ? 1 : 0, bd.isCorrect ? 1 : 0]
            );
          }
        }
      }
    }
  }

  console.log("Migration completed successfully!");
} finally {
  await conn.end();
}
