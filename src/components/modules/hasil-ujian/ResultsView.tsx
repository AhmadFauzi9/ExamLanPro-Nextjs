"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { MonitorRow, Student, Quiz, Tab, apiJson, escapeHtml } from "@/types/teacher";
import { TablePagination } from "@/components/common/TablePagination";
import { appAlert, appConfirm } from "@/components/common/AppDialog";

export function ResultsView({
  rows,
  students,
  quizzes,
  reload,
  setTab,
}: {
  rows: MonitorRow[];
  students: Student[];
  quizzes: Quiz[];
  reload: () => Promise<void>;
  setTab?: (tab: Tab) => void;
}) {
  const [perPage, setPerPage] = useState(10);
  const [sortOrder, setSortOrder] = useState("date_desc");
  const [quizFilter, setQuizFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [kkmFilter, setKkmFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [detailModal, setDetailModal] = useState<any | null>(null);
  const [retakeModal, setRetakeModal] = useState<MonitorRow | null>(null);
  const [retakeReason, setRetakeReason] = useState("");
  const [retakeAttempts, setRetakeAttempts] = useState(1);
  const [retakeUntil, setRetakeUntil] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [actionMenu, setActionMenu] = useState<{
    id: string;
    top: number;
    left: number;
    row: MonitorRow;
  } | null>(null);

  // Close floating action menu on click outside, scroll, resize, or Escape
  useEffect(() => {
    if (!actionMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("#action-dropdown-menu") && !target?.closest(".action-menu-btn")) {
        setActionMenu(null);
      }
    };
    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("#action-dropdown-menu")) return;
      setActionMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActionMenu(null);
    };
    document.addEventListener("click", onDocClick);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("keydown", onKey);
    };
  }, [actionMenu]);

  // Lock body scroll when modals open
  useEffect(() => {
    if (detailModal || retakeModal) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [detailModal, retakeModal]);

  // Close modals on Escape key
  useEffect(() => {
    if (!detailModal && !retakeModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetailModal(null);
        setRetakeModal(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailModal, retakeModal]);

  function toggleResultActionMenu(event: React.MouseEvent<HTMLButtonElement>, r: MonitorRow) {
    event.stopPropagation();
    event.preventDefault();
    if (actionMenu && String(actionMenu.id) === String(r.id)) {
      setActionMenu(null);
      return;
    }
    const btn = event.currentTarget;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 175;
    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    const isLive = ["IN_PROGRESS", "WORKING", "OFFLINE", "STANDBY"].includes(r.status);
    const menuHeight = isLive ? 44 : 120;
    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - 10) {
      top = rect.top - menuHeight - 4;
    }
    if (top < 10) top = 10;
    setActionMenu({ id: String(r.id), top, left, row: r });
  }

  // Track attempts per student-quiz pair
  const studentQuizCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const key = `${r.student_id || r.nis}_${r.quiz_id}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [rows]);

  // Statistics
  const scores = rows.map((r) => Number(r.score || 0));
  const avgScore = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
  const maxScore = scores.length ? Math.max(...scores) : 0;
  const minScore = scores.length ? Math.min(...scores) : 0;
  const passedStudents = scores.filter((s) => s >= 75).length;
  const passRate = scores.length ? Math.round((passedStudents / scores.length) * 100) : 0;

  const classes = useMemo(() => Array.from(new Set(students.map((s) => s.class_name))).filter(Boolean).sort(), [students]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      const matchQuiz = quizFilter === "all" || String(r.quiz_id) === quizFilter;
      const matchClass = classFilter === "all" || r.class_name === classFilter;
      const score = Number(r.score || 0);
      const matchKkm = kkmFilter === "all" || (kkmFilter === "pass" ? score >= 75 : score < 75);
      const matchSearch =
        !search ||
        r.nis.toLowerCase().includes(search.toLowerCase()) ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase());
      return matchQuiz && matchClass && matchKkm && matchSearch;
    });

    if (sortOrder === "date_desc") list.sort((a, b) => new Date(b.submitted_at || b.started_at).getTime() - new Date(a.submitted_at || a.started_at).getTime());
    if (sortOrder === "date_asc") list.sort((a, b) => new Date(a.submitted_at || a.started_at).getTime() - new Date(b.submitted_at || b.started_at).getTime());
    if (sortOrder === "score_desc") list.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    if (sortOrder === "score_asc") list.sort((a, b) => Number(a.score || 0) - Number(b.score || 0));
    if (sortOrder === "nis_asc") list.sort((a, b) => a.nis.localeCompare(b.nis));
    if (sortOrder === "nis_desc") list.sort((a, b) => b.nis.localeCompare(a.nis));
    if (sortOrder === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortOrder === "name_desc") list.sort((a, b) => b.name.localeCompare(a.name));

    return list;
  }, [rows, quizFilter, classFilter, kkmFilter, search, sortOrder]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Review status of selected quiz
  const currentQuizObj = quizzes.find((q) => String(q.id) === quizFilter);
  const isReviewActive = Boolean(currentQuizObj?.review_enabled);

  async function handleToggleReview() {
    if (quizFilter === "all" || !currentQuizObj) {
      await appAlert("Pilih Soal Ujian terlebih dahulu pada filter.", "Perhatian");
      return;
    }
    const next = !isReviewActive;
    try {
      await apiJson(
        await fetch(`/api/admin/quizzes/${currentQuizObj.id}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        })
      );
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal mengubah status pembahasan.", "Error");
    }
  }

  async function showAnswerDetail(attemptId: string) {
    try {
      const data = await apiJson(await fetch(`/api/admin/results/${attemptId}`));
      setDetailModal(data);
    } catch (err: any) {
      await appAlert(err.message || "Gagal memuat rincian hasil.", "Error");
    }
  }

  async function handleAllowRetake(e: React.FormEvent) {
    e.preventDefault();
    if (!retakeModal) return;
    setBusy(true);
    try {
      await apiJson(
        await fetch(`/api/admin/results/${retakeModal.id}/retake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: retakeReason, attempts: retakeAttempts }),
        })
      );
      setRetakeModal(null);
      await reload();
      await appAlert("Izin ujian ulang berhasil diberikan kepada siswa.", "Sukses");
    } catch (err: any) {
      await appAlert(err.message || "Gagal memberikan izin ujian ulang.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteResult(row: MonitorRow) {
    if (
      !(await appConfirm(
        `Hapus hasil ujian siswa "${row.name}" (${row.title})?\n\nTindakan ini tidak dapat dibatalkan.`,
        "Hapus Hasil Ujian",
        "Batal",
        "Hapus"
      ))
    )
      return;
    try {
      await apiJson(await fetch(`/api/admin/results/${row.id}`, { method: "DELETE" }));
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menghapus hasil.", "Error");
    }
  }

  async function handleDeleteSelected() {
    if (!selectedIds.size) return;
    if (
      !(await appConfirm(
        `Hapus ${selectedIds.size} hasil terpilih?`,
        "Hapus Terpilih",
        "Batal",
        "Hapus"
      ))
    )
      return;
    for (const id of selectedIds) {
      try {
        await apiJson(await fetch(`/api/admin/results/${id}`, { method: "DELETE" }));
      } catch {}
    }
    setSelectedIds(new Set());
    await reload();
  }

  async function handleResetAll() {
    if (!rows.length) return;
    if (
      !(await appConfirm(
        `Yakin ingin mereset seluruh ${rows.length} hasil ujian?\n\nSeluruh riwayat nilai siswa akan dihapus permanen.`,
        "Reset Semua Hasil",
        "Batal",
        "Reset Semua"
      ))
    )
      return;
    for (const r of rows) {
      try {
        await apiJson(await fetch(`/api/admin/results/${r.id}`, { method: "DELETE" }));
      } catch {}
    }
    setSelectedIds(new Set());
    await reload();
  }

  function exportToCsv() {
    const headers = ["No", "NIS", "Nama Siswa", "Kelas", "Paket Kuis", "Benar", "Salah", "Nilai Akhir", "Status KKM", "Waktu Selesai"];
    const lines = filtered.map((r, i) => [
      i + 1,
      r.nis,
      r.name,
      r.class_name,
      r.title,
      r.correct_count ?? 0,
      r.wrong_count ?? 0,
      r.score ?? 0,
      Number(r.score || 0) >= 75 ? "Tuntas" : "Remedial",
      r.submitted_at ? new Date(r.submitted_at).toLocaleString("id-ID") : "-",
    ]);
    const csvContent = "\ufeff" + [headers.join(","), ...lines.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-nilai-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printGradeReport() {
    if (!filtered.length) {
      void appAlert("Tidak ada data hasil ujian yang dapat dicetak!", "Informasi");
      return;
    }
    const printWin = window.open("", "_blank", "width=950,height=750");
    if (!printWin) {
      window.print();
      return;
    }
    const currentQuizTitle = quizzes.find((q) => String(q.id) === quizFilter)?.title || "Semua Paket Ujian";
    const currentClass = classFilter !== "all" ? classFilter : "Semua Kelas";
    const printDate = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    printWin.document.write(`<!DOCTYPE html><html><head><title>Rekap Hasil Ujian - ${currentQuizTitle}</title><style>body{font-family:'Segoe UI',Tahoma,sans-serif;font-size:11px;margin:20px;color:#1e293b}.header{text-align:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:15px}.header h2{margin:0;font-size:16px;text-transform:uppercase;letter-spacing:0.5px}.header p{margin:3px 0 0;color:#64748b;font-size:11px}.meta-table{width:100%;margin-bottom:12px;font-size:11px}.meta-table td{padding:2px 4px}table.data{width:100%;border-collapse:collapse;margin-top:10px;font-size:10.5px}table.data th,table.data td{border:1px solid #cbd5e1;padding:5px 8px}table.data th{background-color:#f1f5f9;text-align:left;font-weight:700;color:#334155}.text-center{text-align:center}.badge{font-weight:bold;padding:2px 6px;border-radius:4px;font-size:9.5px}.pass{background-color:#ecfdf5;color:#047857}.fail{background-color:#fff1f2;color:#be123c}.summary{margin-top:15px;display:flex;gap:15px}.summary-box{flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:8px;text-align:center;background:#f8fafc}.summary-val{font-size:16px;font-weight:800;color:#0f172a;margin-top:2px}.signatures{margin-top:40px;display:flex;justify-content:space-between;page-break-inside:avoid}.sig-box{text-align:center;width:220px}.sig-space{height:60px}@media print{@page{size:A4 landscape;margin:10mm}}</style></head><body><div class="header"><h2>DAFTAR REKAPITULASI HASIL EVALUASI / UJIAN SISWA</h2><p>Sistem Ujian LAN Berbasis Komputer (ExamLAN Pro CBT)</p></div><table class="meta-table"><tr><td width="15%"><strong>Paket Ujian</strong></td><td width="35%">: ${currentQuizTitle}</td><td width="15%"><strong>Tanggal Cetak</strong></td><td width="35%">: ${printDate}</td></tr><tr><td><strong>Target Kelas</strong></td><td>: ${currentClass}</td><td><strong>Total Peserta</strong></td><td>: ${filtered.length} Siswa Terdaftar</td></tr></table><table class="data"><thead><tr><th class="text-center" width="4%">No</th><th class="text-center" width="10%">NIS</th><th width="24%">Nama Siswa</th><th class="text-center" width="10%">Kelas</th><th width="24%">Paket Ujian</th><th class="text-center" width="6%">Benar</th><th class="text-center" width="6%">Salah</th><th class="text-center" width="8%">Nilai</th><th class="text-center" width="8%">Status</th></tr></thead><tbody>${filtered.map((r, i) => { const s = Number(r.score || 0); return `<tr><td class="text-center">${i + 1}</td><td class="text-center" style="font-family: monospace;">${r.nis}</td><td><strong>${r.name}</strong></td><td class="text-center">${r.class_name}</td><td>${r.title}</td><td class="text-center" style="color: #047857; font-weight: bold;">${r.correct_count ?? 0}</td><td class="text-center" style="color: #be123c; font-weight: bold;">${r.wrong_count ?? 0}</td><td class="text-center" style="font-weight: 800;">${s}</td><td class="text-center"><span class="badge ${s >= 75 ? "pass" : "fail"}">${s >= 75 ? "Tuntas" : "Remedial"}</span></td></tr>`; }).join("")}</tbody></table><div class="summary"><div class="summary-box"><div>Total Submit</div><div class="summary-val">${filtered.length}</div></div><div class="summary-box"><div>Rata-rata Nilai</div><div class="summary-val">${avgScore}</div></div><div class="summary-box"><div>Tertinggi / Terendah</div><div class="summary-val">${maxScore} / ${minScore}</div></div><div class="summary-box"><div>Ketuntasan KKM (&ge;75)</div><div class="summary-val" style="color: #047857;">${passRate}% (${passedStudents} Tuntas)</div></div></div><div class="signatures"><div class="sig-box"><p>Mengetahui,<br>Kepala Laboratorium CBT</p><div class="sig-space"></div><p><strong>( .................................................. )</strong><br>NIP. -</p></div><div class="sig-box"><p>Pengawas Ujian / Guru Mapel</p><div class="sig-space"></div><p><strong>( .................................................. )</strong><br>NIP. -</p></div></div><script>window.onload=function(){window.print();}</script></body></html>`);
    printWin.document.close();
  }

  function printSingleStudentReport() {
    if (!detailModal || !detailModal.attempt) return;
    const a = detailModal.attempt;
    const printWin = window.open("", "_blank", "width=850,height=750");
    if (!printWin) {
      window.print();
      return;
    }
    const score = Number(a.score || 0);
    const pass = score >= 75;

    printWin.document.write(`<!DOCTYPE html><html><head><title>Lembar Jawaban Siswa - ${a.name} (${a.nis})</title><style>body{font-family:'Segoe UI',Tahoma,sans-serif;font-size:11px;margin:20px;color:#1e293b}.header{text-align:center;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:15px}.header h2{margin:0;font-size:16px;text-transform:uppercase}.header p{margin:3px 0 0;color:#64748b;font-size:11px}.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:15px;background:#f8fafc;padding:10px;border-radius:6px;border:1px solid #e2e8f0}.q-box{border:1px solid #e2e8f0;border-radius:6px;padding:10px;margin-bottom:10px;background:#fff;page-break-inside:avoid}.q-head{display:flex;justify-content:space-between;font-weight:bold;margin-bottom:6px;font-size:11.5px}.badge{padding:2px 6px;border-radius:4px;font-size:9.5px;font-weight:bold}.pass{background:#ecfdf5;color:#047857}.fail{background:#fff1f2;color:#be123c}.ans-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:10.5px}.exp-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;padding:6px;margin-top:6px;color:#1e3a8a}@media print{@page{size:A4 portrait;margin:10mm}}</style></head><body><div class="header"><h2>LEMBAR EVALUASI & HASIL JAWABAN SISWA</h2><p>Sistem Ujian LAN Berbasis Komputer (ExamLAN Pro CBT)</p></div><div class="meta-grid"><div><strong>Nama Siswa:</strong> ${a.name}<br><strong>NIS:</strong> ${a.nis}<br><strong>Kelas:</strong> ${a.class_name}</div><div><strong>Paket Ujian:</strong> ${a.title}<br><strong>Tanggal Submit:</strong> ${a.submitted_at ? new Date(a.submitted_at).toLocaleString("id-ID") : "-"}<br><strong>Nilai Akhir:</strong> <span style="font-size: 14px; font-weight: 800;">${score}</span> (<span class="badge ${pass ? "pass" : "fail"}">${pass ? "Tuntas" : "Remedial"}</span>)</div></div><div>${(detailModal.answers || []).map((ans: any, i: number) => { const isCor = ans.is_correct === true || ans.is_correct === 1; return `<div class="q-box"><div class="q-head"><span>Soal Nomor ${ans.position || i + 1}</span><span class="badge ${isCor ? "pass" : "fail"}">${isCor ? "Benar" : "Salah"}</span></div><p style="margin: 0; line-height: 1.4;">${ans.content}</p><div class="ans-grid"><div><strong style="color: #64748b;">Jawaban Siswa:</strong><br>${typeof ans.answer === "object" ? JSON.stringify(ans.answer) : String(ans.answer ?? "-")}</div><div><strong style="color: #047857;">Kunci Jawaban:</strong><br>${typeof ans.answer_key === "object" ? JSON.stringify(ans.answer_key) : String(ans.answer_key ?? "-")}</div></div>${ans.explanation ? `<div class="exp-box"><strong>Pembahasan:</strong> ${ans.explanation}</div>` : ""}</div>`; }).join("")}</div><script>window.onload=function(){window.print();}</script></body></html>`);
    printWin.document.close();
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(paginated.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* 4 Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-users text-brand-600"></i> Status Peserta Ujian
          </p>
          <div className="mt-1 min-h-[32px] flex items-center">
            <span className="text-2xl font-black text-slate-800">{rows.length}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Siswa telah submit</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-chart-simple text-brand-600"></i> Rata-rata Nilai
          </p>
          <p className="text-2xl font-black text-slate-800 mt-1">{avgScore}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Skala nilai 0 - 100</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-award text-amber-500"></i> Tertinggi / Terendah
          </p>
          <p className="text-2xl font-black text-slate-800 mt-1">
            {maxScore} / {minScore}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Skor max & min kelas</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-circle-check text-emerald-600"></i> Ketuntasan KKM (≥75)
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{passRate}%</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {passedStudents} tuntas • {rows.length - passedStudents} remedial
          </p>
        </div>
      </div>

      {/* Page Header & Pembahasan Toolbar Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center text-lg font-bold shrink-0">
            <i className="fa-solid fa-chart-line"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
                Hasil Ujian Siswa (Rekap & Evaluasi Pasca Ujian)
              </h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                <i className="fa-solid fa-book-bookmark text-[9px]"></i> Buku Rekap Nilai
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Arsip nilai resmi tersimpan di server. Analisis skor, lembar rincian butir soal, dan cetak laporan resmi kurikulum.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggleReview}
          disabled={quizFilter === "all"}
          className={`btn-compact flex items-center gap-1.5 font-bold transition shadow-2xs cursor-pointer ${
            quizFilter === "all"
              ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
              : isReviewActive
              ? "bg-purple-100 text-purple-700 border border-purple-300"
              : "bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100"
          }`}
          title={quizFilter === "all" ? "Pilih Soal Ujian terlebih dahulu" : "Tampilkan / Sembunyikan Pembahasan"}
        >
          <i className={`fa-solid ${isReviewActive ? "fa-eye" : "fa-eye-slash"} text-xs`}></i>
          <span>{isReviewActive ? "Pembahasan Aktif" : "Tampilkan Pembahasan"}</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-1.5 py-1.5 w-[60px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none"
            title="Jumlah data per halaman"
          >
            {[10, 20, 30, 40, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-1.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none font-medium"
            title="Pengurutan data"
          >
            <option value="date_desc">Terbaru</option>
            <option value="date_asc">Terlama</option>
            <option value="score_desc">Nilai ↑</option>
            <option value="score_asc">Nilai ↓</option>
            <option value="nis_asc">NIS (0-9)</option>
            <option value="nis_desc">NIS (9-0)</option>
            <option value="name_asc">Nama (A-Z)</option>
            <option value="name_desc">Nama (Z-A)</option>
          </select>

          <select
            value={quizFilter}
            onChange={(e) => {
              setQuizFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1.5 w-[110px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none truncate font-medium"
            title="Filter Soal Ujian"
          >
            <option value="all">Soal Ujian</option>
            {quizzes.map((q) => (
              <option key={q.id} value={String(q.id)}>
                {q.title}
              </option>
            ))}
          </select>

          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1.5 w-[80px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none truncate font-medium"
            title="Filter Kelas"
          >
            <option value="all">Kelas</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={kkmFilter}
            onChange={(e) => {
              setKkmFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1.5 w-[75px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none font-medium truncate"
            title="Filter Ketuntasan Nilai KKM"
          >
            <option value="all">Nilai</option>
            <option value="pass">Tuntas (≥ 75)</option>
            <option value="remedial">Remedial (&lt; 75)</option>
          </select>

          <div className="relative min-w-[160px] sm:min-w-[200px] max-w-xs flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama siswa atau NIS..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none text-xs text-slate-800 transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={exportToCsv}
            className="btn-icon bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer flex items-center justify-center"
            title="Ekspor Buku Nilai ke Excel (CSV)"
          >
            <i className="fa-solid fa-file-excel text-xs"></i>
          </button>
          <button
            type="button"
            onClick={printGradeReport}
            className="btn-icon bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition cursor-pointer flex items-center justify-center"
            title="Cetak Rekap Nilai Resmi / Simpan PDF"
          >
            <i className="fa-solid fa-print text-xs"></i>
          </button>
          <button
            type="button"
            disabled={!selectedIds.size}
            onClick={handleDeleteSelected}
            className={`btn-icon border transition cursor-pointer ${
              selectedIds.size
                ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            }`}
            title="Hapus Hasil Ujian Terpilih"
          >
            <i className="fa-solid fa-trash-can text-xs"></i>
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            className="btn-icon bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
            title="Reset Semua Hasil Ujian"
          >
            <i className="fa-solid fa-broom text-xs"></i>
          </button>
          <button
            type="button"
            onClick={() => reload()}
            className="btn-icon border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            title="Muat Ulang Data Hasil Ujian"
          >
            <i className="fa-solid fa-arrows-rotate text-xs"></i>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse compact-table">
            <thead className="bg-slate-100 uppercase font-bold text-slate-600 tracking-wider">
              <tr>
                <th className="w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && paginated.every((r) => selectedIds.has(r.id))}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </th>
                <th className="w-12 text-center whitespace-nowrap">No</th>
                <th className="w-24 whitespace-nowrap">NIS</th>
                <th className="min-w-[180px] whitespace-nowrap">Nama Siswa</th>
                <th className="text-center whitespace-nowrap">Tipe Ujian</th>
                <th className="whitespace-nowrap">Kelas</th>
                <th className="min-w-[150px] max-w-[220px]">Paket Kuis</th>
                <th className="w-16 text-center whitespace-nowrap">Benar</th>
                <th className="w-16 text-center whitespace-nowrap">Salah</th>
                <th className="w-24 text-center whitespace-nowrap">Nilai Akhir</th>
                <th className="w-28 text-center whitespace-nowrap">Status KKM</th>
                <th className="min-w-[150px] whitespace-nowrap">Waktu Selesai</th>
                <th className="text-center w-20 whitespace-nowrap">Aksi Guru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((r, i) => {
                const score = Number(r.score || 0);
                const isSelected = selectedIds.has(r.id);
                const studentKey = `${r.student_id || r.nis}_${r.quiz_id}`;
                const totalAttempts = studentQuizCounts[studentKey] || 1;
                const attemptNum = (r as any).attempt_number || (totalAttempts > 1 ? totalAttempts : 1);
                const isPassed = score >= 75;

                return (
                  <tr key={r.id} className={`hover:bg-slate-50/80 transition ${isSelected ? "bg-brand-50/40" : ""}`}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(r.id);
                          else next.delete(r.id);
                          setSelectedIds(next);
                        }}
                        className="result-row-check w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-center font-bold text-slate-400 whitespace-nowrap">{(currentPage - 1) * perPage + i + 1}</td>
                    <td className="p-3 font-mono font-bold text-brand-700 whitespace-nowrap">{r.nis || "-"}</td>
                    <td className="p-3 whitespace-nowrap min-w-[180px]">
                      <span className="font-bold text-slate-800">{r.name || "-"}</span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {attemptNum > 1 ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                          title={`Ujian Ulang / Remedial (Percobaan ke-${attemptNum})`}
                        >
                          <i className="fa-solid fa-rotate-left text-[9px]"></i> Remedial ({attemptNum})
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0"
                          title="Ujian Pertama (Percobaan 1)"
                        >
                          <i className="fa-solid fa-clock-rotate-left text-[9px]"></i> Pertama
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">{r.class_name || "-"}</td>
                    <td className="p-3 font-medium text-slate-700 max-w-[180px] truncate" title={r.title || "-"}>
                      {r.title || "-"}
                    </td>
                    <td className="p-3 text-center font-bold text-emerald-600 whitespace-nowrap">{r.correct_count ?? 0}</td>
                    <td className="p-3 text-center font-bold text-rose-600 whitespace-nowrap">{r.wrong_count ?? 0}</td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black ${
                          isPassed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {score}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {isPassed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <i className="fa-solid fa-circle-check text-[9px]"></i> TUNTAS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <i className="fa-solid fa-triangle-exclamation text-[9px]"></i> REMEDIAL
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleString("id-ID") : "-"}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => toggleResultActionMenu(e, r)}
                        className="action-menu-btn w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition inline-flex items-center justify-center shadow-2xs cursor-pointer"
                        title="Menu Aksi"
                      >
                        <i className="fa-solid fa-ellipsis-vertical text-xs pointer-events-none"></i>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-slate-400">
                    Belum ada data hasil ujian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          perPage={perPage}
          itemLabel="hasil"
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Floating Action Dropdown Menu */}
      {actionMenu && typeof document !== "undefined" && createPortal(
        <div
          id="action-dropdown-menu"
          style={{ top: actionMenu.top, left: actionMenu.left }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[999999] bg-white rounded-xl border border-slate-200 shadow-xl py-1 text-xs min-w-[175px] transition-none text-left"
        >
          {actionMenu.row.status === "IN_PROGRESS" ||
          actionMenu.row.status === "WORKING" ||
          actionMenu.row.status === "OFFLINE" ||
          actionMenu.row.status === "STANDBY" ? (
            <button
              type="button"
              onClick={() => {
                setActionMenu(null);
                if (setTab) {
                  setTab("monitor");
                  if (typeof window !== "undefined") window.location.hash = "monitoring";
                }
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-slate-700 hover:bg-brand-50 hover:text-brand-600 font-medium transition cursor-pointer"
            >
              <i className="fa-solid fa-tower-broadcast text-brand-600 w-4 text-center"></i>
              <span>Pantau Live</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  const row = actionMenu.row;
                  setActionMenu(null);
                  void showAnswerDetail(row.id);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-slate-700 hover:bg-sky-50 hover:text-sky-700 font-medium transition cursor-pointer"
              >
                <i className="fa-solid fa-clipboard-check text-sky-600 w-4 text-center"></i>
                <span>Rincian Jawaban</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const row = actionMenu.row;
                  setActionMenu(null);
                  setRetakeModal(row);
                  setRetakeReason("");
                  setRetakeAttempts(1);
                  setRetakeUntil("");
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-slate-700 hover:bg-amber-50 hover:text-amber-700 font-medium transition cursor-pointer"
              >
                <i className="fa-solid fa-rotate-left text-amber-600 w-4 text-center"></i>
                <span>Izinkan Ujian Ulang</span>
              </button>
              <div className="my-1 border-t border-slate-100"></div>
              <button
                type="button"
                onClick={() => {
                  const row = actionMenu.row;
                  setActionMenu(null);
                  void handleDeleteResult(row);
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 font-medium transition cursor-pointer"
              >
                <i className="fa-solid fa-trash-can text-rose-600 w-4 text-center"></i>
                <span>Hapus Hasil Ujian</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Modal: Lembar Evaluasi & Rincian Jawaban Siswa per Butir Soal */}
      {detailModal && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[99] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDetailModal(null);
          }}
        >
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold text-base">
                  <i className="fa-solid fa-clipboard-check"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight">
                    Lembar Evaluasi & Rincian Jawaban Siswa
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Rincian butir soal, pilihan jawaban siswa, kunci jawaban, dan pembahasan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Identitas Siswa */}
            <div className="p-4 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Nama Siswa</p>
                <p className="font-bold text-slate-800 truncate mt-0.5">{detailModal.attempt?.name}</p>
                <p className="text-[11px] text-brand-700 font-mono font-bold">{detailModal.attempt?.nis}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Kelas & Ujian</p>
                <p className="font-bold text-slate-800 truncate mt-0.5">{detailModal.attempt?.class_name}</p>
                <p className="text-[11px] text-slate-600 truncate">{detailModal.attempt?.title}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Benar / Salah</p>
                <p className="font-bold text-slate-800 mt-0.5">
                  {detailModal.attempt?.correct_count || 0} / {detailModal.attempt?.wrong_count || 0}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {detailModal.attempt?.submitted_at ? new Date(detailModal.attempt.submitted_at).toLocaleString("id-ID") : "-"}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Nilai Akhir</p>
                <div className="text-2xl font-black text-brand-700 mt-0.5">{detailModal.attempt?.score || 0}</div>
                <span
                  className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                    Number(detailModal.attempt?.score || 0) >= 75
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  {Number(detailModal.attempt?.score || 0) >= 75 ? "Tuntas" : "Remedial"}
                </span>
              </div>
            </div>

            {/* Questions List */}
            <div className="p-4 overflow-y-auto custom-scrollbar space-y-3.5 flex-1 bg-slate-50/50">
              {detailModal.answers?.map((ans: any, idx: number) => {
                const isCorrect = ans.is_correct === true || ans.is_correct === 1;
                return (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Soal Nomor {ans.position || idx + 1}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                          isCorrect
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {isCorrect ? "✓ Benar" : "✕ Salah"}
                      </span>
                    </div>
                    <p className="text-slate-800 font-semibold">{ans.content}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Jawaban Siswa:</span>
                        <p className="text-slate-700 font-medium">
                          {typeof ans.answer === "object" ? JSON.stringify(ans.answer) : String(ans.answer ?? "-")}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 uppercase font-semibold">Kunci Jawaban:</span>
                        <p className="text-emerald-700 font-bold">
                          {typeof ans.answer_key === "object" ? JSON.stringify(ans.answer_key) : String(ans.answer_key ?? "-")}
                        </p>
                      </div>
                    </div>
                    {ans.explanation && (
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-600 text-[11px] mt-1">
                        <strong className="text-brand-700">Pembahasan:</strong> {ans.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0 text-xs">
              <span className="text-slate-400 text-[11px]">ExamLAN Pro • Buku Rekap & Analisis Nilai</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={printSingleStudentReport}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                >
                  <i className="fa-solid fa-print text-xs"></i>
                  <span>Cetak Lembar Siswa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModal(null)}
                  className="px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Izinkan Ujian Ulang (Retake) */}
      {retakeModal && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[95] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRetakeModal(null);
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <i className="fa-solid fa-rotate-left text-sm"></i>
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Izinkan Ujian Ulang</h3>
              </div>
              <button
                type="button"
                onClick={() => setRetakeModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-base"></i>
              </button>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-medium">
              Siswa: <b>{retakeModal.name}</b> ({retakeModal.nis}) • {retakeModal.title}
            </p>

            <form onSubmit={handleAllowRetake} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Pemberian Izin:</label>
                <input
                  type="text"
                  required
                  value={retakeReason}
                  onChange={(e) => setRetakeReason(e.target.value)}
                  placeholder="Contoh: Kendala perangkat / browser tertutup"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Maksimal Percobaan:</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={retakeAttempts}
                    onChange={(e) => setRetakeAttempts(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batas Waktu (Opsional):</label>
                  <input
                    type="datetime-local"
                    value={retakeUntil}
                    onChange={(e) => setRetakeUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setRetakeModal(null)}
                  className="btn-compact border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-compact bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {busy ? "Menyimpan..." : "Simpan Izin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. MONITORING UJIAN (LIVE) COMPONENT (Identical to monitoring/index.html)
// ==========================================
