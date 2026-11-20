export type Question = {
  id: number;
  type: string;
  answer_key: unknown;
  points: number;
};

const normalize = (v: unknown) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

function normalizeCauseEffect(val: unknown): string {
  const clean = normalize(val).replace(/[^a-z0-9]/g, "");
  if (["a", "1", "bothcorrectconnected"].includes(clean)) return "both_correct_connected";
  if (["b", "2", "bothcorrectnotconnected"].includes(clean)) return "both_correct_not_connected";
  if (["c", "3", "statementtruereasonfalse", "statementcorrectreasonwrong"].includes(clean)) return "statement_true_reason_false";
  if (["d", "4", "statementfalsereasontrue", "statementwrongreasoncorrect"].includes(clean)) return "statement_false_reason_true";
  if (["e", "5", "bothfalse", "bothwrong"].includes(clean)) return "both_false";
  return clean;
}

export function scoreQuestion(q: Question, given: unknown) {
  const key = q.answer_key;
  if (q.type === "essay") return { correct: null, score: 0, manual: true };

  if (q.type === "complex") {
    const a = Array.isArray(given) ? given.map(normalize).sort() : [];
    const b = Array.isArray(key) ? key.map(normalize).sort() : [];
    const ok = a.length > 0 && JSON.stringify(a) === JSON.stringify(b);
    return { correct: ok, score: ok ? q.points : 0, manual: false };
  }

  if (q.type === "matching") {
    const expObj: Record<string, number> = Array.isArray(key)
      ? Object.fromEntries(key.map((t, idx) => [String(idx), Number(t)]))
      : typeof key === "object" && key !== null
      ? (key as Record<string, number>)
      : {};
    const givenObj: Record<string, number> = Array.isArray(given)
      ? Object.fromEntries(given.map((t, idx) => [String(idx), Number(t)]))
      : typeof given === "object" && given !== null
      ? (given as Record<string, number>)
      : {};

    const expEntries = Object.entries(expObj);
    const total = expEntries.length;
    if (total === 0) return { correct: false, score: 0, manual: false };

    let matches = 0;
    for (const [pIdx, tIdx] of expEntries) {
      if (givenObj[pIdx] !== undefined && Number(givenObj[pIdx]) === Number(tIdx)) {
        matches++;
      }
    }
    const ok = matches === total;
    return { correct: ok, score: ok ? q.points : 0, manual: false };
  }

  if (q.type === "cause_effect") {
    const givenNorm = normalizeCauseEffect(given);
    const keyNorm = normalizeCauseEffect(key);
    const ok = givenNorm !== "" && givenNorm === keyNorm;
    return { correct: ok, score: ok ? q.points : 0, manual: false };
  }

  if (q.type === "scaled") return { correct: null, score: 0, manual: false };

  // mc, case_analysis, short_answer
  const ok = normalize(given) === normalize(key);
  return { correct: ok, score: ok ? q.points : 0, manual: false };
}
