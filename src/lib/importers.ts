import readXlsxFile from "read-excel-file/node";

export type SheetRow = Record<string, string>;
const normalize = (value: unknown) => String(value ?? "").trim();
const headerKey = (value: unknown) =>
  normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

function parseCsv(text: string) {
  const result: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((x) => x.trim())) result.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((x) => x.trim())) result.push(row);
  return result;
}

export async function tabularRows(file: File): Promise<SheetRow[]> {
  const ext = file.name.toLowerCase().split(".").pop();
  let matrix: unknown[][];
  if (ext === "xlsx")
    matrix = (await readXlsxFile(
      Buffer.from(await file.arrayBuffer()),
    )) as unknown as unknown[][];
  else if (ext === "csv")
    matrix = parseCsv(
      Buffer.from(await file.arrayBuffer())
        .toString("utf8")
        .replace(/^\uFEFF/, ""),
    );
  else throw new Error("Format berkas harus .xlsx atau .csv.");
  if (matrix.length < 2) throw new Error("Berkas tidak memiliki baris data.");
  const headers = matrix[0].map(headerKey);
  return matrix
    .slice(1)
    .filter((row) => row.some((value) => normalize(value) !== ""))
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, normalize(row[index])]),
      ),
    );
}

export function first(row: SheetRow, ...keys: string[]) {
  for (const key of keys)
    if (row[key] !== undefined && row[key] !== "") return row[key];
  return "";
}

export function parseAnswer(type: string, raw: string) {
  if (type === "mc" || type === "scaled") {
    const upper = raw.trim().toUpperCase();
    if (/^[A-E]$/.test(upper)) return upper.charCodeAt(0) - 65;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "complex")
    return raw
      .split(/[;,|]/)
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean)
      .map((x) => (/^[A-Z]$/.test(x) ? x.charCodeAt(0) - 65 : Number(x)))
      .filter(Number.isFinite);
  if (type === "matching") {
    const object: Record<string, number> = {};
    raw.split(/[;,]/).forEach((pair) => {
      const [a, b] = pair.split("=").map((x) => x.trim());
      if (a !== undefined && b !== undefined)
        object[String(Number(a))] = Number(b);
    });
    return object;
  }
  return raw;
}
