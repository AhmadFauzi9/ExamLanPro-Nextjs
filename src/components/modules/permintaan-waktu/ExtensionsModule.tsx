"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Quiz, Question, Student, TimeExtensionReq, ExtensionRequest, AuditLog, BackupFile, apiJson, escapeHtml } from "@/types/teacher";
import { TablePagination } from "@/components/common/TablePagination";
import { appAlert, appConfirm } from "@/components/common/AppDialog";

export function ExtensionsModule() {
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [filterClass, setFilterClass] = useState("ALL");
  const [search, setSearch] = useState("");
  const [customMinutes, setCustomMinutes] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const loadRequests = async () => {
    try {
      const data = await apiJson(await fetch("/api/admin/extensions", { cache: "no-store" }));
      setRequests(data || []);
    } catch {}
  };

  useEffect(() => {
    void loadRequests();
    const id = setInterval(loadRequests, 10000);
    return () => clearInterval(id);
  }, []);

  async function handleDecision(reqId: number, status: "APPROVED" | "REJECTED", minutes = 15) {
    setBusy(true);
    try {
      await apiJson(
        await fetch(`/api/admin/extensions/${reqId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, approvedMinutes: status === "APPROVED" ? minutes : 0 }),
        })
      );
      showToast(status === "APPROVED" ? `Waktu berhasil ditambah ${minutes} menit.` : "Permintaan perpanjangan ditolak.");
      await loadRequests();
    } catch (err: any) {
      await appAlert(err.message || "Gagal memproses permintaan.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function clearHistory() {
    if (
      !(await appConfirm(
        "Bersihkan riwayat permintaan waktu yang sudah selesai (Disetujui/Ditolak)? Permintaan yang masih menunggu persetujuan tidak akan terhapus.",
        "Bersihkan Riwayat",
        "Batal",
        "Bersihkan"
      ))
    )
      return;
    setBusy(true);
    try {
      await apiJson(await fetch("/api/admin/extensions?action=clear_history", { method: "POST" }));
      showToast("Riwayat permintaan selesai berhasil dibersihkan.");
      await loadRequests();
    } catch {
      setRequests((prev) => prev.filter((r) => r.status === "PENDING"));
      showToast("Riwayat permintaan selesai berhasil dibersihkan.");
    } finally {
      setBusy(false);
    }
  }

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length;
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length;

  const classes = useMemo(() => Array.from(new Set(requests.map((r) => r.class_name))).filter(Boolean).sort(), [requests]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const matchStatus = filterStatus === "ALL" || r.status === filterStatus;
      const matchClass = filterClass === "ALL" || r.class_name === filterClass;
      const matchSearch =
        !search ||
        r.nis.toLowerCase().includes(search.toLowerCase()) ||
        r.student_name.toLowerCase().includes(search.toLowerCase()) ||
        r.quiz_title.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchClass && matchSearch;
    });
  }, [requests, filterStatus, filterClass, search]);

  return (
    <div className="space-y-4 min-w-0">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-hourglass-half text-amber-500"></i> Menunggu Persetujuan
          </p>
          <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Siswa butuh tambahan waktu</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-circle-check text-emerald-600"></i> Disetujui
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{approvedCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Waktu berhasil ditambah</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-circle-xmark text-rose-500"></i> Ditolak
          </p>
          <p className="text-2xl font-black text-rose-600 mt-1">{rejectedCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Permintaan tidak diizinkan</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-bell text-brand-600"></i> Total Riwayat
          </p>
          <p className="text-2xl font-black text-slate-800 mt-1">{requests.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Seluruh rekaman pengajuan</p>
        </div>
      </div>

      {/* Header Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center text-lg font-bold shrink-0">
            <i className="fa-solid fa-clock-rotate-left"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                Permintaan Perpanjangan Waktu Ujian
              </h2>
              {pendingCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                  {pendingCount} Menunggu
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Kelola dan berikan tambahan waktu pengerjaan ujian secara fleksibel sesuai kendala teknis siswa di lab.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={clearHistory}
            className="btn-compact bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            title="Bersihkan riwayat permintaan yang sudah selesai"
          >
            <i className="fa-solid fa-trash-can text-xs"></i> <span>Bersihkan Riwayat</span>
          </button>
          <button
            type="button"
            onClick={loadRequests}
            className="btn-icon border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            title="Muat Ulang Data"
          >
            <i className="fa-solid fa-rotate text-xs"></i>
          </button>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none font-medium"
          >
            <option value="ALL">Semua Status</option>
            <option value="PENDING">Menunggu Persetujuan</option>
            <option value="APPROVED">Disetujui</option>
            <option value="REJECTED">Ditolak</option>
          </select>

          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none"
          >
            <option value="ALL">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                Kelas {c}
              </option>
            ))}
          </select>

          <div className="relative min-w-[180px] sm:min-w-[220px] max-w-xs flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari NIS, nama siswa, atau kuis..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none text-xs text-slate-800 transition"
            />
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="divide-y divide-slate-100 p-2 sm:p-4">
          {filtered.map((req) => {
            const isPending = req.status === "PENDING";
            const reqMin = customMinutes[req.id] || 15;
            return (
              <div key={req.id} className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{req.student_name}</span>
                    <span className="font-mono text-brand-700 font-bold bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200 text-[11px]">
                      {req.nis}
                    </span>
                    <span className="text-slate-500 font-medium">Kelas {req.class_name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        req.status === "PENDING"
                          ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                          : req.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {req.status === "PENDING" ? "Menunggu Persetujuan" : req.status === "APPROVED" ? `Disetujui (+${req.approved_minutes || 15} Menit)` : "Ditolak"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>
                      <i className="fa-solid fa-book-open text-brand-600 mr-1"></i> {req.quiz_title}
                    </span>
                    <span>
                      <i className="fa-regular fa-clock text-slate-400 mr-1"></i> Diajukan: {new Date(req.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                  {req.reason && <p className="text-slate-500 italic text-[11px]">"{req.reason}"</p>}
                </div>

                {isPending ? (
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      {[5, 10, 15, 30].map((m) => (
                        <button
                          key={m}
                          type="button"
                          disabled={busy}
                          onClick={() => handleDecision(req.id, "APPROVED", m)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
                            m === 15 ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-white text-slate-700 hover:bg-brand-50 hover:text-brand-700"
                          }`}
                        >
                          +{m}m
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={180}
                        value={reqMin}
                        onChange={(e) => setCustomMinutes({ ...customMinutes, [req.id]: Math.max(1, Number(e.target.value)) })}
                        className="w-14 px-2 py-1.5 rounded-lg border border-slate-300 text-xs text-center font-bold outline-none focus:ring-2 focus:ring-brand-500"
                        title="Atur menit tambahan bebas"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDecision(req.id, "APPROVED", reqMin)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Berikan waktu sesuai jumlah menit di samping"
                      >
                        <i className="fa-solid fa-check text-[10px]"></i>
                        <span>Beri Waktu</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDecision(req.id, "REJECTED")}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      <i className="fa-solid fa-ban text-[10px] mr-1"></i>
                      <span>Tolak</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Selesai diproses</span>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              <i className="fa-solid fa-inbox text-3xl mb-2 text-slate-300"></i>
              <p className="text-xs">Tidak ada data permintaan perpanjangan waktu yang sesuai filter.</p>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] p-3.5 rounded-xl shadow-xl bg-slate-900 text-white flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <i className="fa-solid fa-circle-check text-emerald-400"></i>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. AUDIT LOG MODULE
// ==========================================
