"use client";
import { useEffect, useState } from "react";
type Summary = {
  students: number;
  quizzes: number;
  active: number;
  results: number;
  pendingExtensions: number;
};
type Student = {
  id: number;
  nis: string;
  name: string;
  class_name: string;
  section_name?: string;
  active: number;
};
type Quiz = {
  id: number;
  title: string;
  subject: string;
  class_name: string;
  exam_token: string;
  status: string;
  question_count: number;
  start_at: string;
  end_at: string;
};
type Monitor = {
  id: string;
  nis: string;
  name: string;
  class_name: string;
  title: string;
  status: string;
  score: number | null;
  answered_count: number;
  violation_count: number;
  last_seen_at: string;
};
const json = async (r: Response) => {
  const x = await r.json();
  if (!r.ok) throw new Error(x.error || "Gagal");
  return x.data;
};
export default function TeacherPortal() {
  const [auth, setAuth] = useState(false),
    [username, setUsername] = useState("admin"),
    [password, setPassword] = useState(""),
    [tab, setTab] = useState("dashboard"),
    [summary, setSummary] = useState<Summary | null>(null),
    [students, setStudents] = useState<Student[]>([]),
    [quizzes, setQuizzes] = useState<Quiz[]>([]),
    [monitor, setMonitor] = useState<Monitor[]>([]),
    [error, setError] = useState("");
  async function load() {
    try {
      const [s, st, q, m] = await Promise.all([
        fetch("/api/admin/summary"),
        fetch("/api/admin/students"),
        fetch("/api/admin/quizzes"),
        fetch("/api/admin/monitoring"),
      ]);
      if (s.status === 401) {
        setAuth(false);
        return;
      }
      setSummary(await json(s));
      setStudents(await json(st));
      setQuizzes(await json(q));
      setMonitor(await json(m));
      setAuth(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
    const id = setInterval(() => auth && load(), 15000);
    return () => clearInterval(id);
  }, [auth]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    try {
      await json(
        await fetch("/api/auth/teacher/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        }),
      );
      setAuth(true);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!auth)
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-4">
        <form onSubmit={login} className="card w-full max-w-md p-8">
          <div className="text-2xl font-black">Portal Guru</div>
          <p className="mt-1 text-sm text-slate-500">
            Masuk untuk mengelola ExamLanPro.
          </p>
          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <div className="mt-6 space-y-4">
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <button className="btn-primary w-full">Masuk</button>
            <a href="/" className="block text-center text-sm text-indigo-600">
              Kembali ke portal siswa
            </a>
          </div>
        </form>
      </main>
    );
  const nav = [
    ["dashboard", "Dashboard"],
    ["students", "Data Siswa"],
    ["quizzes", "Bank Soal & Paket"],
    ["monitor", "Monitoring"],
    ["results", "Hasil Ujian"],
    ["extensions", "Notifikasi"],
    ["audit", "Audit Log"],
    ["settings", "Pengaturan"],
  ];
  return (
    <main className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-slate-950 px-5 py-4 text-white">
        <div>
          <b className="text-lg">ExamLanPro</b>
          <span className="ml-2 text-xs text-slate-400">Portal Guru</span>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary !py-1.5" onClick={load}>
            Refresh
          </button>
          <button
            className="btn-secondary !py-1.5"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              setAuth(false);
            }}
          >
            Logout
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[220px_1fr]">
        <aside className="card h-fit p-2">
          {nav.map(([k, n]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${tab === k ? "bg-indigo-600 text-white" : "hover:bg-slate-100"}`}
            >
              {n}
              {k === "extensions" && summary?.pendingExtensions
                ? ` (${summary.pendingExtensions})`
                : ""}
            </button>
          ))}
        </aside>
        <section>
          {tab === "dashboard" && (
            <>
              <h1 className="text-2xl font-black">Dashboard</h1>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {summary &&
                  Object.entries(summary).map(([k, v]) => (
                    <div className="card p-5" key={k}>
                      <div className="text-3xl font-black text-indigo-600">
                        {v}
                      </div>
                      <div className="mt-1 text-sm capitalize text-slate-500">
                        {
                          (
                            {
                              students: "Siswa",
                              quizzes: "Paket ujian",
                              active: "Sedang ujian",
                              results: "Hasil",
                              pendingExtensions: "Perpanjangan",
                            } as Record<string, string>
                          )[k]
                        }
                      </div>
                    </div>
                  ))}
              </div>
              <div className="card mt-5 p-5">
                <h2 className="font-black">Keamanan aktif</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cookie HttpOnly, validasi origin, rate limit, password hashing
                  bcrypt, query parameterized, jadwal dan token server-side,
                  transaksi submit, audit log, serta kunci jawaban tidak pernah
                  dikirim ke peserta.
                </p>
              </div>
            </>
          )}
          {tab === "students" && (
            <DataTable
              title="Data Siswa"
              heads={["NIS", "Nama", "Kelas", "Status"]}
              rows={students.map((s) => [
                s.nis,
                s.name,
                `${s.class_name} ${s.section_name || ""}`,
                s.active ? "Aktif" : "Nonaktif",
              ])}
            />
          )}{" "}
          {tab === "quizzes" && (
            <DataTable
              title="Bank Soal & Paket Ujian"
              heads={["Paket", "Mapel", "Kelas", "Token", "Status", "Soal"]}
              rows={quizzes.map((q) => [
                q.title,
                q.subject,
                q.class_name,
                q.exam_token,
                q.status,
                q.question_count,
              ])}
            />
          )}{" "}
          {tab === "monitor" && (
            <DataTable
              title="Monitoring Ujian"
              heads={[
                "NIS",
                "Nama",
                "Kelas",
                "Paket",
                "Status",
                "Terjawab",
                "Pelanggaran",
              ]}
              rows={monitor.map((m) => [
                m.nis,
                m.name,
                m.class_name,
                m.title,
                m.status,
                m.answered_count,
                m.violation_count,
              ])}
            />
          )}{" "}
          {tab === "results" && (
            <DataTable
              title="Hasil Ujian"
              heads={["NIS", "Nama", "Paket", "Status", "Nilai", "Pelanggaran"]}
              rows={monitor
                .filter((m) => m.status !== "IN_PROGRESS")
                .map((m) => [
                  m.nis,
                  m.name,
                  m.title,
                  m.status,
                  m.score ?? "-",
                  m.violation_count,
                ])}
            />
          )}{" "}
          {["extensions", "audit", "settings"].includes(tab) && (
            <div className="card p-8">
              <h1 className="text-xl font-black">
                {nav.find((x) => x[0] === tab)?.[1]}
              </h1>
              <p className="mt-2 text-slate-500">
                Modul backend dan tabel data sudah tersedia. Form operasional
                lanjutan disiapkan pada iterasi migrasi berikutnya.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
function DataTable({
  title,
  heads,
  rows,
}: {
  title: string;
  heads: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b p-5">
        <h1 className="text-xl font-black">{title}</h1>
        <span className="badge bg-indigo-50 text-indigo-700">
          {rows.length} data
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {heads.map((h) => (
                <th className="whitespace-nowrap px-4 py-3" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr className="border-t" key={i}>
                {r.map((v, j) => (
                  <td className="whitespace-nowrap px-4 py-3" key={j}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
