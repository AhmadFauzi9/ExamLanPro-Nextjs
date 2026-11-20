import mammoth from "mammoth";
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { first, parseAnswer, SheetRow, tabularRows } from "@/lib/importers";
import { apiError, audit, checkOrigin } from "@/lib/security";
import { ok } from "@/lib/http";

function wordRows(text: string): SheetRow[] {
  return text
    .split(/\n\s*---\s*\n|\n\s*\n/)
    .map((block) => {
      const lines = block
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        row: SheetRow = {};
      const options: string[] = [];
      const matchingPairs: string[] = [];

      for (const line of lines) {
        const optMatch = line.match(/^([A-E])[.)]\s*(.+)$/i);
        if (optMatch) {
          options[optMatch[1].toUpperCase().charCodeAt(0) - 65] = optMatch[2].trim();
        } else if (/^TIPE\s*[:=]\s*(.+)$/i.test(line)) {
          row.type = line.replace(/^TIPE\s*[:=]\s*/i, "").trim();
        } else if (/^PERTANYAAN\s*[:=]\s*(.+)$/i.test(line)) {
          row.soal = line.replace(/^PERTANYAAN\s*[:=]\s*/i, "").trim();
        } else if (/^SOAL\s*[:=]\s*(.+)$/i.test(line)) {
          row.soal = line.replace(/^SOAL\s*[:=]\s*/i, "").trim();
        } else if (/^(KASUS|TEKS_KASUS)\s*[:=]\s*(.+)$/i.test(line)) {
          row.teks_kasus = line.replace(/^(KASUS|TEKS_KASUS)\s*[:=]\s*/i, "").trim();
        } else if (/^PERNYATAAN\s*[:=]\s*(.+)$/i.test(line)) {
          row.pernyataan = line.replace(/^PERNYATAAN\s*[:=]\s*/i, "").trim();
        } else if (/^ALASAN\s*[:=]\s*(.+)$/i.test(line)) {
          row.alasan = line.replace(/^ALASAN\s*[:=]\s*/i, "").trim();
        } else if (/^(PASANGAN|JODOHKAN)\s*[:=]\s*(.+)$/i.test(line)) {
          const rawP = line.replace(/^(PASANGAN|JODOHKAN)\s*[:=]\s*/i, "").trim();
          matchingPairs.push(rawP);
        } else if ((line.includes("=") || line.includes(" - ")) && !/^(TIPE|PERTANYAAN|SOAL|KASUS|PERNYATAAN|ALASAN|KUNCI|PEMBAHASAN)/i.test(line)) {
          matchingPairs.push(line.replace(" - ", "="));
        } else if (/^KUNCI(\s*JAWABAN)?\s*[:=]\s*(.+)$/i.test(line)) {
          row.kunci_jawaban = line.replace(/^KUNCI(\s*JAWABAN)?\s*[:=]\s*/i, "").trim();
        } else if (/^PEMBAHASAN\s*[:=]\s*(.+)$/i.test(line)) {
          row.pembahasan = line.replace(/^PEMBAHASAN\s*[:=]\s*/i, "").trim();
        } else if (!row.soal && !line.startsWith("---")) {
          row.soal = line;
        }
      }

      options.forEach((value, i) => {
        row[`opsi_${String.fromCharCode(97 + i)}`] = value;
      });

      if (matchingPairs.length > 0) {
        row.pasangan_menjodohkan = matchingPairs.join("|");
      }

      return row;
    })
    .filter((row) => row.soal || row.pernyataan || row.teks_kasus);
}

function normalizeType(value: string) {
  const v = value.toLowerCase().trim();
  if (["pg", "pilihan_ganda"].includes(v)) return "mc";
  if (["pgk", "kompleks", "ganda_kompleks"].includes(v)) return "complex";
  if (["jodohkan", "menjodohkan"].includes(v)) return "matching";
  if (["sebab_akibat", "sebabakibat"].includes(v)) return "cause_effect";
  if (["studi_kasus", "analisis_kasus", "kasus"].includes(v)) return "case_analysis";
  if (["esai", "uraian"].includes(v)) return "essay";
  return [
    "mc",
    "complex",
    "cause_effect",
    "case_analysis",
    "matching",
    "essay",
    "scaled",
  ].includes(v)
    ? v
    : "mc";
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireRole("ADMIN", "TEACHER");
    if (!checkOrigin(req))
      return Response.json({ error: "Origin ditolak." }, { status: 403 });
    const form = await req.formData(),
      quizId = Number(form.get("quizId")),
      file = form.get("file");
    if (!quizId || !(file instanceof File))
      return Response.json(
        { error: "Paket dan berkas wajib dipilih." },
        { status: 422 },
      );
    if (file.size > 10 * 1024 * 1024)
      return Response.json(
        { error: "Ukuran berkas maksimal 10 MB." },
        { status: 413 },
      );
    const ext = file.name.toLowerCase().split(".").pop();
    let data: SheetRow[];
    if (ext === "docx" || ext === "doc") {
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(await file.arrayBuffer()),
      });
      data = wordRows(result.value);
    } else data = await tabularRows(file);
    let imported = 0,
      skipped = 0;
    await transaction(async (c) => {
      const [positionRows] = await c.execute(
        "SELECT COALESCE(MAX(position),0) max_position FROM questions WHERE quiz_id=?",
        [quizId],
      );
      let position = Number(
        (positionRows as { max_position: number }[])[0].max_position,
      );
      for (const row of data) {
        const type = normalizeType(first(row, "tipe", "type") || "mc");
        let content = first(row, "soal", "pertanyaan", "question", "content");
        let passage = first(row, "teks_kasus", "kasus", "bacaan", "passage");

        if (type === "cause_effect") {
          content = first(row, "pernyataan", "statement", "soal", "pertanyaan");
          passage = first(row, "alasan", "reason");
        }

        if (!content && !passage) {
          skipped++;
          continue;
        }

        const options = ["a", "b", "c", "d", "e"]
          .map((letter) =>
            first(
              row,
              `opsi_${letter}`,
              `option_${letter}`,
              letter.toUpperCase(),
            ),
          )
          .filter(Boolean);

        let optionValue: unknown = options;

        if (type === "matching") {
          const rawPairs = first(row, "pasangan_menjodohkan", "pasangan", "pairs");
          const pairs = rawPairs
            .split("|")
            .map((x) => x.split("=").map((v) => v.trim()))
            .filter((x) => x.length === 2);
          optionValue = {
            premises: pairs.map((x) => x[0]),
            targets: pairs.map((x) => x[1]),
          };
        } else if (type === "cause_effect") {
          optionValue = {
            statement: content,
            reason: passage,
          };
        }

        const rawAnswer = first(
          row,
          "kunci_jawaban",
          "kunci",
          "answer",
          "jawaban",
        );
        if (rawAnswer === "" && type !== "essay" && type !== "scaled") {
          skipped++;
          continue;
        }

        position++;
        await c.execute(
          "INSERT INTO questions(quiz_id,position,type,content,passage,options,answer_key,explanation,points) VALUES(?,?,?,?,?,?,?,?,?)",
          [
            quizId,
            position,
            type,
            content || "Soal Analisis Kasus",
            passage || null,
            JSON.stringify(optionValue),
            JSON.stringify(parseAnswer(type, rawAnswer)),
            first(row, "pembahasan", "explanation") || null,
            Number(first(row, "poin", "points") || 1),
          ],
        );
        imported++;
      }
    });
    await audit(`user:${s.sub}`, "IMPORT_QUESTIONS", "quiz", String(quizId), {
      file: file.name,
      imported,
      skipped,
    });
    return ok({ imported, skipped });
  } catch (e) {
    return apiError(e);
  }
}
