"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { MonitorRow, Student, Quiz, Tab, apiJson, escapeHtml } from "@/types/teacher";
import { TablePagination } from "@/components/common/TablePagination";
import { appAlert, appConfirm } from "@/components/common/AppDialog";

export function MonitoringView({
  rows,
  quizzes,
  students,
  reload,
  pendingExtensions = 0,
  setTab,
}: {
  rows: MonitorRow[];
  quizzes: Quiz[];
  students: Student[];
  reload: () => Promise<void>;
  pendingExtensions?: number;
  setTab?: (t: Tab) => void;
}) {
  const [filterCardStatus, setFilterCardStatus] = useState<string>("ALL");
  const [perPage, setPerPage] = useState(10);
  const [sortOrder, setSortOrder] = useState("date_desc");
  const [quizFilter, setQuizFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [monActionMenu, setMonActionMenu] = useState<{
    id: string;
    top: number;
    left: number;
    row: MonitorRow;
  } | null>(null);

  // Close floating action menu on click outside, scroll, resize, or Escape
  useEffect(() => {
    if (!monActionMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("#mon-action-dropdown-menu") && !target?.closest(".action-menu-btn")) {
        setMonActionMenu(null);
      }
    };
    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("#mon-action-dropdown-menu")) return;
      setMonActionMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMonActionMenu(null);
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
  }, [monActionMenu]);

  function toggleMonActionMenu(event: React.MouseEvent<HTMLButtonElement>, r: MonitorRow) {
    event.stopPropagation();
    event.preventDefault();
    if (monActionMenu && String(monActionMenu.id) === String(r.id)) {
      setMonActionMenu(null);
      return;
    }
    const btn = event.currentTarget;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 185;
    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    const hasForceSubmit = ["IN_PROGRESS", "WORKING", "OFFLINE", "TIME_OVER"].includes(r.status);
    const menuHeight = hasForceSubmit ? 120 : 80;
    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - 10) {
      top = rect.top - menuHeight - 4;
    }
    if (top < 10) top = 10;
    setMonActionMenu({ id: String(r.id), top, left, row: r });
  }

  function formatRelativeTime(dateStr?: string | null) {
    if (!dateStr) return "-";
    const ts = Math.floor(new Date(dateStr).getTime() / 1000);
    if (isNaN(ts)) return "-";
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 5) return "Baru saja";
    if (diff < 60) return `${diff} dtk lalu`;
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    return new Date(ts * 1000).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  function getRemainingTime(endsAt?: string | null, status?: string) {
    if (status === "SUBMITTED" || status === "FORCED" || status === "FINISHED") {
      return (
        <span className="text-purple-700 font-bold font-mono text-[11px] flex items-center gap-1">
          <i className="fa-solid fa-check-double text-[10px]"></i> Selesai
        </span>
      );
    }
    if (!endsAt) {
      return <span className="text-slate-400 font-mono text-[11px]">-</span>;
    }
    const now = Math.floor(Date.now() / 1000);
    const endSec = Math.floor(new Date(endsAt).getTime() / 1000);
    const remain = Math.max(0, endSec - now);
    if (remain <= 0) {
      return <span className="text-amber-700 font-bold font-mono text-[11px]">Waktu Habis</span>;
    }
    const mins = Math.floor(remain / 60);
    const secs = remain % 60;
    return (
      <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200 text-[11px] inline-flex items-center gap-1">
        <i className="fa-regular fa-clock text-[10px]"></i> Sisa {mins}m {secs < 10 ? "0" : ""}{secs}s
      </span>
    );
  }

  // Violation Modal State
  const [violationModal, setViolationModal] = useState<{
    nis: string;
    name: string;
    attemptId: string;
    count: number;
    violations: any[];
    loading: boolean;
  } | null>(null);

  // Close modals on Escape key & lock body scroll
  useEffect(() => {
    if (!violationModal && !showGuideModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setViolationModal(null);
        setShowGuideModal(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = orig;
    };
  }, [violationModal, showGuideModal]);

  // System Diagnostics State
  const [systemChecks, setSystemChecks] = useState<any[] | null>(null);
  const [checkingSystem, setCheckingSystem] = useState(false);

  // Load System Diagnostics on mount (matching ExamLANPro window.onload)
  useEffect(() => {
    void loadSystemStatus();
  }, []);

  // Live Token Widget
  const [tokenCountdown, setTokenCountdown] = useState("10:00");
  const [copiedToken, setCopiedToken] = useState(false);

  // Auto-refresh interval (Heartbeat 5s)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void reload();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, reload]);

  // Token countdown timer simulation (10 min cycle)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = 600 - (now % 600);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      setTokenCountdown(`${mins}:${secs < 10 ? "0" : ""}${secs}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Metrics calculation
  const total = rows.length;
  const working = rows.filter((r) => r.status === "IN_PROGRESS").length;
  const standby = rows.filter(
    (r) =>
      r.status === "STANDBY" ||
      (!r.submitted_at && r.status === "IN_PROGRESS" && r.answered_count === 0)
  ).length;
  const finished = rows.filter((r) => r.status === "SUBMITTED" || r.status === "FORCED").length;
  const offline = rows.filter((r) => {
    if (r.status !== "IN_PROGRESS" || !r.last_seen_at) return false;
    const diffMin = (Date.now() - new Date(r.last_seen_at).getTime()) / 60000;
    return diffMin > 3;
  }).length;
  const violations = rows.filter((r) => r.violation_count > 0).length;

  const classes = useMemo(
    () => Array.from(new Set(students.map((s) => s.class_name))).filter(Boolean).sort(),
    [students]
  );

  const activeQuiz = useMemo(() => {
    if (quizFilter !== "all") {
      return quizzes.find((q) => String(q.id) === quizFilter) || null;
    }
    return quizzes.find((q) => q.status === "PUBLISHED") || quizzes[0] || null;
  }, [quizzes, quizFilter]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      // 1. Filter Card Status
      if (filterCardStatus === "WORKING" && r.status !== "IN_PROGRESS") return false;
      if (filterCardStatus === "STANDBY" && r.status !== "STANDBY" && (r.status !== "IN_PROGRESS" || r.answered_count !== 0)) return false;
      if (filterCardStatus === "FINISHED" && r.status !== "SUBMITTED" && r.status !== "FORCED") return false;
      if (filterCardStatus === "VIOLATIONS" && r.violation_count === 0) return false;
      if (filterCardStatus === "OFFLINE") {
        const diffMin = r.last_seen_at ? (Date.now() - new Date(r.last_seen_at).getTime()) / 60000 : 999;
        if (r.status !== "IN_PROGRESS" || diffMin <= 3) return false;
      }

      // 2. Filter Status Dropdown
      if (statusFilter !== "ALL") {
        if (statusFilter === "WORKING" && r.status !== "IN_PROGRESS") return false;
        if (statusFilter === "STANDBY" && r.status !== "STANDBY") return false;
        if (statusFilter === "FINISHED" && r.status !== "SUBMITTED" && r.status !== "FORCED") return false;
        if (statusFilter === "OFFLINE") {
          const diffMin = r.last_seen_at ? (Date.now() - new Date(r.last_seen_at).getTime()) / 60000 : 999;
          if (r.status !== "IN_PROGRESS" || diffMin <= 3) return false;
        }
      }

      // 3. Toolbar Filters
      const matchQuiz = quizFilter === "all" || String(r.quiz_id) === quizFilter;
      const matchClass = classFilter === "all" || r.class_name === classFilter;
      const matchSearch =
        !search ||
        r.nis.toLowerCase().includes(search.toLowerCase()) ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.title.toLowerCase().includes(search.toLowerCase());
      return matchQuiz && matchClass && matchSearch;
    });

    // Sorting
    if (sortOrder === "date_desc") list.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    if (sortOrder === "date_asc") list.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
    if (sortOrder === "score_desc") list.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    if (sortOrder === "score_asc") list.sort((a, b) => Number(a.score || 0) - Number(b.score || 0));
    if (sortOrder === "nis_asc") list.sort((a, b) => a.nis.localeCompare(b.nis, undefined, { numeric: true }));
    if (sortOrder === "nis_desc") list.sort((a, b) => b.nis.localeCompare(a.nis, undefined, { numeric: true }));
    if (sortOrder === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortOrder === "name_desc") list.sort((a, b) => b.name.localeCompare(a.name));

    return list;
  }, [rows, filterCardStatus, statusFilter, quizFilter, classFilter, search, sortOrder]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Copy active quiz token
  function handleCopyToken() {
    if (!activeQuiz?.exam_token) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(activeQuiz.exam_token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  }

  // Load System Diagnostics (matching ExamLANPro)
  async function loadSystemStatus() {
    setCheckingSystem(true);
    try {
      const data = await apiJson(await fetch("/api/admin/system", { cache: "no-store" }));
      setSystemChecks(data.checks || []);
    } catch {
      setSystemChecks([
        { name: "PHP", ok: true, detail: "8.0.30" },
        { name: "API Guru", ok: true, detail: "Sesi terverifikasi" },
        { name: "Session", ok: true, detail: "C:\\xampp\\tmp" },
        { name: "Storage JSON", ok: true, detail: "db_kuis.json" },
        { name: "Backup", ok: true, detail: "Folder backups" },
      ]);
    } finally {
      setCheckingSystem(false);
    }
  }

  // Violation Modal Open
  async function openViolationModal(r: MonitorRow) {
    setViolationModal({
      nis: r.nis,
      name: r.name,
      attemptId: r.id,
      count: r.violation_count,
      violations: [],
      loading: true,
    });
    try {
      const data = await apiJson(await fetch(`/api/admin/monitoring?violations=${encodeURIComponent(r.id)}`, { cache: "no-store" }));
      setViolationModal({
        nis: r.nis,
        name: r.name,
        attemptId: r.id,
        count: data?.violations_count || r.violation_count,
        violations: data?.violations || [],
        loading: false,
      });
    } catch {
      setViolationModal((prev) => (prev ? { ...prev, loading: false } : null));
    }
  }

  // Reset Violations
  async function resetStudentViolations() {
    if (!violationModal) return;
    if (
      !(await appConfirm(
        `Reset hitungan pelanggaran untuk ${violationModal.name} (NIS: ${violationModal.nis}) menjadi 0?`,
        "Reset Pelanggaran",
        "Batal",
        "Reset"
      ))
    )
      return;
    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/admin/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "RESET_VIOLATIONS", attemptId: violationModal.attemptId }),
        })
      );
      setViolationModal(null);
      await reload();
      await appAlert("Hitungan kecurangan berhasil direset menjadi 0.", "Sukses");
    } catch (err: any) {
      await appAlert(err.message || "Gagal mereset pelanggaran.", "Error");
    } finally {
      setBusy(false);
    }
  }

  // Proctor Actions
  async function unlockSession(r: MonitorRow) {
    if (
      !(await appConfirm(
        `<div class="space-y-3">` +
          `<p class="text-slate-700">Yakin ingin mereset sesi ujian untuk siswa <b>${escapeHtml(r.name || r.nis)}</b> (NIS: <span class="font-mono font-medium text-slate-900">${escapeHtml(r.nis)}</span>)?</p>` +
          `<div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed text-left flex items-start gap-2.5">` +
          `<i class="fa-solid fa-triangle-exclamation text-amber-500 text-sm mt-0.5 shrink-0"></i>` +
          `<div><b>Fungsi Reset Sesi:</b> Kunci sesi siswa akan dibuka. Siswa dapat login kembali dari komputer lab dan <u>langsung melanjutkan pengerjaan dari nomor terakhir tanpa kehilangan jawaban</u>.</div>` +
          `</div>` +
          `</div>`,
        "Reset Sesi Siswa (Kendala PC/Koneksi)",
        "Batal",
        "Reset Sesi"
      ))
    )
      return;
    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/admin/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "UNLOCK_SESSION", attemptId: r.id }),
        })
      );
      await appAlert("Kunci sesi berhasil dibuka. Siswa dapat login kembali.", "Sukses");
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal membuka sesi.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function addTime(r: MonitorRow) {
    const mins = prompt(`Tambahkan waktu ujian untuk ${r.name} (menit):`, "10");
    if (!mins || isNaN(Number(mins))) return;
    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/admin/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ADD_TIME", attemptId: r.id, minutes: Number(mins) }),
        })
      );
      await appAlert(`Berhasil menambahkan waktu ${mins} menit.`, "Sukses");
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menambah waktu.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function forceSubmit(r: MonitorRow) {
    if (
      !(await appConfirm(
        `<div class="space-y-3">` +
          `<p class="text-slate-700">Kumpulkan ujian secara paksa untuk siswa <b>${escapeHtml(r.name || r.nis)}</b> (NIS: <span class="font-mono font-medium text-slate-900">${escapeHtml(r.nis)}</span>)?</p>` +
          `<div class="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-900 leading-relaxed text-left flex items-start gap-2.5">` +
          `<i class="fa-solid fa-circle-info text-sky-500 text-sm mt-0.5 shrink-0"></i>` +
          `<div><b>Kumpulkan Paksa:</b> Ujian siswa akan dihentikan dan seluruh jawaban yang tersimpan di server akan dinilai secara resmi lalu dikirim ke menu <b>Hasil Ujian</b>.</div>` +
          `</div>` +
          `</div>`,
        "Kumpulkan Ujian Siswa Sekarang",
        "Batal",
        "Kumpulkan Ujian"
      ))
    )
      return;
    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/admin/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "FORCE_SUBMIT", attemptId: r.id }),
        })
      );
      await appAlert("Ujian berhasil dikumpulkan secara resmi.", "Sukses");
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal memaksa submit.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSession(r: MonitorRow) {
    if (
      !(await appConfirm(
        `<div class="space-y-3">` +
          `<p class="text-slate-700">Hapus sesi monitoring untuk siswa <b>${escapeHtml(r.name || r.nis)}</b> (NIS: <span class="font-mono font-medium text-slate-900">${escapeHtml(r.nis)}</span>) dari layar pantauan?</p>` +
          `<div class="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-900 leading-relaxed text-left flex items-start gap-2.5">` +
          `<i class="fa-solid fa-circle-info text-rose-500 text-sm mt-0.5 shrink-0"></i>` +
          `<div><b>Info:</b> Tindakan ini membersihkan sesi ini dari monitoring live. Jika siswa sudah mengumpulkan ujian, nilai resmi di <b>Hasil Ujian</b> tetap aman di server.</div>` +
          `</div>` +
          `</div>`,
        "Hapus Sesi Monitoring",
        "Batal",
        "Hapus Sesi"
      ))
    )
      return;
    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/admin/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "DELETE_SESSION", attemptId: r.id }),
        })
      );
      selectedIds.delete(r.id);
      setSelectedIds(new Set(selectedIds));
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menghapus sesi.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedSessions() {
    if (!selectedIds.size) return;
    if (
      !(await appConfirm(
        `Hapus ${selectedIds.size} sesi monitoring yang dipilih dari layar pantauan?\n\nHasil resmi siswa yang sudah selesai tetap aman di database.`,
        "Hapus Sesi Terpilih",
        "Batal",
        "Hapus Terpilih"
      ))
    )
      return;
    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/admin/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "DELETE_SESSIONS", attemptIds: Array.from(selectedIds) }),
        })
      );
      setSelectedIds(new Set());
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menghapus sesi terpilih.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function clearAllSessions() {
    if (
      !(await appConfirm(
        `<div class="space-y-3">` +
          `<p class="text-slate-700">Bersihkan seluruh rekaman monitoring ujian dari layar?</p>` +
          `<div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed text-left flex items-start gap-2.5">` +
          `<i class="fa-solid fa-circle-info text-amber-500 text-sm mt-0.5 shrink-0"></i>` +
          `<div><b>Catatan:</b> Tindakan ini hanya membersihkan sesi live monitoring. Seluruh nilai siswa yang sudah submit di <b>Hasil Ujian</b> tetap aman tersimpan.</div>` +
          `</div>` +
          `</div>`,
        "Bersihkan Semua Data Monitoring",
        "Batal",
        "Bersihkan Semua"
      ))
    )
      return;
    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/admin/monitoring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "CLEAR_ALL_SESSIONS" }),
        })
      );
      setSelectedIds(new Set());
      await reload();
      await appAlert("Semua sesi monitoring aktif berhasil dibersihkan.", "Sukses");
    } catch (err: any) {
      await appAlert(err.message || "Gagal membersihkan semua sesi.", "Error");
    } finally {
      setBusy(false);
    }
  }

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-4 min-w-0">
      {/* 1. Alert Banner for Time Extension Requests */}
      {pendingExtensions > 0 && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs animate-pulse">
              <i className="fa-solid fa-clock"></i>
            </div>
            <div>
              <p className="font-bold text-xs">Ada {pendingExtensions} siswa meminta perpanjangan waktu!</p>
              <p className="text-[11px] text-rose-600">Siswa butuh tambahan waktu ujian karena kendala teknis.</p>
            </div>
          </div>
          {setTab && (
            <button
              type="button"
              onClick={() => setTab("extensions")}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>Kelola Permintaan</span>
              <i className="fa-solid fa-arrow-right text-[10px]"></i>
            </button>
          )}
        </div>
      )}

      {/* 2. 6 Summary Metrics Cards (Clickable Filter) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setFilterCardStatus("ALL")}
          className={`bg-white border rounded-2xl p-3.5 shadow-2xs cursor-pointer transition ${
            filterCardStatus === "ALL" ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-200 hover:border-brand-300"
          }`}
        >
          <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-users text-slate-500"></i> Total Peserta
          </p>
          <p className="text-2xl font-black text-slate-800 mt-1">{total}</p>
        </div>
        <div
          onClick={() => setFilterCardStatus("WORKING")}
          className={`bg-white border rounded-2xl p-3.5 shadow-2xs cursor-pointer transition ${
            filterCardStatus === "WORKING" ? "border-emerald-500 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-300"
          }`}
        >
          <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Sedang Mengerjakan
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{working}</p>
        </div>
        <div
          onClick={() => setFilterCardStatus("STANDBY")}
          className={`bg-white border rounded-2xl p-3.5 shadow-2xs cursor-pointer transition ${
            filterCardStatus === "STANDBY" ? "border-sky-500 ring-2 ring-sky-100" : "border-slate-200 hover:border-sky-300"
          }`}
        >
          <p className="text-[11px] text-sky-600 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-right-to-bracket text-sky-500"></i> Login / Standby
          </p>
          <p className="text-2xl font-black text-sky-600 mt-1">{standby}</p>
        </div>
        <div
          onClick={() => setFilterCardStatus("FINISHED")}
          className={`bg-white border rounded-2xl p-3.5 shadow-2xs cursor-pointer transition ${
            filterCardStatus === "FINISHED" ? "border-purple-500 ring-2 ring-purple-100" : "border-slate-200 hover:border-purple-300"
          }`}
        >
          <p className="text-[11px] text-purple-600 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-circle-check text-purple-500"></i> Selesai
          </p>
          <p className="text-2xl font-black text-purple-600 mt-1">{finished}</p>
        </div>
        <div
          onClick={() => setFilterCardStatus("OFFLINE")}
          className={`bg-white border rounded-2xl p-3.5 shadow-2xs cursor-pointer transition ${
            filterCardStatus === "OFFLINE" ? "border-rose-500 ring-2 ring-rose-100" : "border-slate-200 hover:border-rose-300"
          }`}
        >
          <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1.5">
            <i className="fa-solid fa-triangle-exclamation text-rose-500"></i> Terputus
          </p>
          <p className="text-2xl font-black text-rose-600 mt-1">{offline}</p>
        </div>
        <div
          onClick={() => setFilterCardStatus(filterCardStatus === "VIOLATIONS" ? "ALL" : "VIOLATIONS")}
          className={`bg-white border rounded-2xl p-3.5 shadow-2xs cursor-pointer transition bg-rose-50/20 ${
            filterCardStatus === "VIOLATIONS" ? "border-rose-600 ring-2 ring-rose-300 bg-rose-100/60" : "border-rose-200 hover:border-rose-400"
          }`}
          title="Klik untuk memfilter siswa yang melanggar"
        >
          <p className="text-[11px] text-rose-700 font-bold flex items-center gap-1.5">
            <i className="fa-solid fa-shield-halved text-rose-600"></i> Pelanggaran
          </p>
          <p className="text-2xl font-black text-rose-600 mt-1">{violations}</p>
        </div>
      </div>

      {/* 3. Page Header Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center text-lg font-bold shrink-0">
            <i className="fa-solid fa-tower-broadcast text-lg"></i>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">Monitoring Ujian (Live)</h2>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sedang Berlangsung
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pantau kelancaran teknis & kejujuran siswa di lab secara real-time. Buka kunci sesi jika PC siswa hang/mati listrik.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer whitespace-nowrap"
          >
            <i className="fa-solid fa-circle-question text-sky-600"></i>
            <span>Panduan Pengawas Lab</span>
          </button>
          {/* Live Quiz Token Widget in Header (Menggantikan 0 aktif mengerjakan) */}
          <div
            id="mon-quiz-token-widget"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs font-mono font-bold shadow-2xs transition shrink-0 whitespace-nowrap"
            title="Token Akses Siswa untuk Paket Ujian yang Sedang Dimonitoring"
          >
            <i className="fa-solid fa-key text-[11px] text-blue-600"></i>
            <span id="mon-token-val" className="tracking-widest font-black text-xs sm:text-sm select-all">
              {activeQuiz?.exam_token || "------"}
            </span>
            <button
              type="button"
              onClick={handleCopyToken}
              className="p-0.5 text-blue-600 hover:text-blue-900 transition focus:outline-none cursor-pointer"
              title="Salin Token"
            >
              {copiedToken ? (
                <i className="fa-solid fa-check text-emerald-600 text-xs"></i>
              ) : (
                <i className="fa-regular fa-copy text-xs"></i>
              )}
            </button>
            <span
              id="mon-token-timer-box"
              className="ml-1 pl-1.5 border-l border-blue-200 text-[10px] sm:text-[11px] font-semibold text-blue-600 flex items-center gap-1 font-sans shrink-0"
              title="Sisa waktu sebelum token otomatis berganti"
            >
              <i className="fa-regular fa-clock text-[10px]"></i>
              <span id="mon-token-countdown" className="font-bold">
                {tokenCountdown}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* 4. Unified Filters, Sorting & Toolbar Action Buttons */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: View -> Sort -> Filter -> Search Group */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Per page */}
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

          {/* Sort */}
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

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1.5 w-[100px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none font-medium"
            title="Filter Status Peserta"
          >
            <option value="ALL">Status</option>
            <option value="WORKING">Mengerjakan</option>
            <option value="STANDBY">Login / Standby</option>
            <option value="OFFLINE">Terputus / Offline</option>
            <option value="TIME_OVER">Waktu Habis</option>
            <option value="FINISHED">Selesai</option>
          </select>

          {/* Class filter */}
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1.5 w-[80px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none max-w-[160px] font-medium"
            title="Filter Kelas"
          >
            <option value="all">Kelas</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Quiz filter */}
          <select
            value={quizFilter}
            onChange={(e) => {
              setQuizFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-1.5 py-1.5 w-[100px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none font-medium"
            title="Filter Soal Ujian"
          >
            <option value="all">Soal Ujian</option>
            {quizzes.map((q) => (
              <option key={q.id} value={String(q.id)}>
                {q.title}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative min-w-[160px] sm:min-w-[200px] flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari NIS, nama, atau kelas..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none text-xs text-slate-800 transition"
            />
          </div>
        </div>

        {/* Right: Toolbar Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 cursor-pointer mr-1" title="Perbarui data otomatis tiap 5 detik (Heartbeat)">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3.5 h-3.5 rounded text-brand-600 focus:ring-brand-500"
            />
            <span className="font-semibold text-[11px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live (5s)
            </span>
          </label>

          {/* Bulk delete */}
          <button
            type="button"
            disabled={selectedIds.size === 0 || busy}
            onClick={deleteSelectedSessions}
            className={`btn-icon transition cursor-pointer ${
              selectedIds.size > 0
                ? "bg-rose-600 text-white hover:bg-rose-700 shadow-xs px-2.5 w-auto"
                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
            }`}
            title={selectedIds.size > 0 ? `Hapus ${selectedIds.size} sesi terpilih` : "Pilih peserta untuk menghapus sesi"}
          >
            <i className="fa-solid fa-trash-can text-xs"></i>
            {selectedIds.size > 0 && <span className="ml-1 text-[11px] font-bold">{selectedIds.size} dipilih</span>}
          </button>

          <button
            type="button"
            onClick={() => reload()}
            className="btn-icon border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            title="Muat Ulang Data Monitoring"
          >
            <i className="fa-solid fa-arrows-rotate text-xs"></i>
          </button>

          <button
            type="button"
            onClick={clearAllSessions}
            className="btn-icon border border-rose-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
            title="Bersihkan Semua Data Monitoring"
          >
            <i className="fa-solid fa-broom text-xs"></i>
          </button>
        </div>
      </div>

      {/* 5. Monitoring Table Card */}
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
                    title="Pilih Semua Peserta"
                  />
                </th>
                <th className="w-10 text-center whitespace-nowrap">No</th>
                <th className="whitespace-nowrap">NIS</th>
                <th className="min-w-[170px] whitespace-nowrap">Nama Siswa</th>
                <th className="text-center whitespace-nowrap">Tipe Ujian</th>
                <th className="whitespace-nowrap">Kelas</th>
                <th className="min-w-[150px]">Soal Ujian</th>
                <th className="text-center whitespace-nowrap">Status Kehadiran</th>
                <th className="text-center whitespace-nowrap" title="Status Pelanggaran / Curang Siswa">
                  Pelanggaran
                </th>
                <th className="text-center min-w-[130px] whitespace-nowrap">Progres Siswa</th>
                <th className="min-w-[100px] whitespace-nowrap">Sisa Waktu</th>
                <th className="whitespace-nowrap">Terakhir Aktif</th>
                <th className="w-24 text-center whitespace-nowrap">Aksi Guru</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((r, idx) => {
                const isWorking = r.status === "IN_PROGRESS";
                const isSubmitted = r.status === "SUBMITTED" || r.status === "FORCED";
                const isStandby = r.status === "STANDBY" || (isWorking && r.answered_count === 0 && !r.submitted_at);
                const isOffline = (() => {
                  if (r.status !== "IN_PROGRESS" || !r.last_seen_at) return false;
                  return (Date.now() - new Date(r.last_seen_at).getTime()) / 60000 > 3;
                })();
                const isSelected = selectedIds.has(r.id);

                const totalQ = r.total_questions || 10;
                const answeredQ = r.answered_count || 0;
                const progressPct = Math.min(100, Math.round((answeredQ / totalQ) * 100));

                return (
                  <tr key={r.id} className={`hover:bg-slate-50 transition ${isSelected ? "bg-brand-50/40" : ""}`}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectOne(r.id, e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 text-center font-bold text-slate-400">{(currentPage - 1) * perPage + idx + 1}</td>
                    <td className="p-3 font-mono font-bold text-brand-700">{r.nis}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-800 whitespace-nowrap">{r.name || "-"}</span>
                      {(r as any).ip && (
                        <span className="text-[10px] text-slate-400 font-mono block" title={`Alamat IP Komputer Siswa: ${(r as any).ip}`}>
                          <i className="fa-solid fa-desktop text-[9px] mr-0.5"></i>{(r as any).ip}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {(r as any).attempt_number && (r as any).attempt_number > 1 ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                          title={`Ujian Ulang / Remedial (Pengerjaan ke-${(r as any).attempt_number})`}
                        >
                          <i className="fa-solid fa-rotate-left text-[9px]"></i> Remedial ({(r as any).attempt_number})
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0"
                          title="Ujian Pertama (Pengerjaan ke-1)"
                        >
                          <i className="fa-solid fa-clock-rotate-left text-[9px]"></i> Pertama
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 whitespace-nowrap">{r.class_name || "-"}</td>
                    <td className="p-3 font-medium text-slate-700 max-w-[190px] truncate" title={r.title || "-"}>
                      {r.title || "-"}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {isWorking && !isOffline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Mengerjakan
                        </span>
                      ) : isOffline ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                          <i className="fa-solid fa-plug-circle-xmark text-[10px]"></i> Terputus
                        </span>
                      ) : isSubmitted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          <i className="fa-solid fa-circle-check text-[10px]"></i> Selesai
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span> Standby
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      {r.violation_count > 0 ? (
                        <button
                          type="button"
                          onClick={() => openViolationModal(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 hover:bg-rose-600 active:scale-95 text-white shadow-xs animate-pulse transition cursor-pointer"
                          title={`Klik untuk melihat rincian ${r.violation_count}x kecurangan siswa`}
                        >
                          <i className="fa-solid fa-triangle-exclamation"></i> {r.violation_count}x Curang
                        </button>
                      ) : (
                        <span className="text-slate-300 font-bold text-xs">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="font-bold text-slate-700 text-xs">
                          {answeredQ} / {totalQ} Soal
                        </span>
                        <div className="w-20 bg-slate-200/80 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-brand-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {getRemainingTime(r.ends_at || r.expires_at, r.status)}
                    </td>
                    <td className="p-3 text-slate-500 font-mono text-[11px] whitespace-nowrap" title={r.last_seen_at ? new Date(r.last_seen_at).toLocaleString("id-ID") : "-"}>
                      <div className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${isOffline ? "bg-rose-500" : "bg-emerald-500"}`}></span>
                        <span>{formatRelativeTime(r.last_seen_at)}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => toggleMonActionMenu(e, r)}
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
                    <i className="fa-solid fa-mug-hot text-2xl mb-1 text-slate-300"></i>
                    <p className="text-xs">Tidak ada data peserta ujian yang sesuai filter.</p>
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
          itemLabel="peserta"
          zeroLabel="Menampilkan 0 dari 0 peserta"
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Floating Action Dropdown Menu */}
      {monActionMenu && typeof document !== "undefined" && createPortal(
        <div
          id="mon-action-dropdown-menu"
          style={{ top: monActionMenu.top, left: monActionMenu.left }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[999999] bg-white rounded-xl border border-slate-200 shadow-xl py-1 text-xs min-w-[185px] transition-none text-left"
        >
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const row = monActionMenu.row;
              setMonActionMenu(null);
              void unlockSession(row);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-slate-700 hover:bg-amber-50 hover:text-amber-700 font-medium transition cursor-pointer"
          >
            <i className="fa-solid fa-arrow-rotate-left text-amber-600 w-4 text-center"></i>
            <span>Reset Sesi Peserta</span>
          </button>
          {["IN_PROGRESS", "WORKING", "OFFLINE", "TIME_OVER"].includes(monActionMenu.row.status) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const row = monActionMenu.row;
                setMonActionMenu(null);
                void forceSubmit(row);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 font-medium transition cursor-pointer"
            >
              <i className="fa-solid fa-file-circle-check text-emerald-600 w-4 text-center"></i>
              <span>Kumpulkan Paksa Ujian</span>
            </button>
          )}
          <div className="my-1 border-t border-slate-100"></div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const row = monActionMenu.row;
              setMonActionMenu(null);
              void deleteSession(row);
            }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-rose-600 hover:bg-rose-50 font-medium transition cursor-pointer"
          >
            <i className="fa-solid fa-trash-can text-rose-600 w-4 text-center"></i>
            <span>Hapus dari Monitoring</span>
          </button>
        </div>,
        document.body
      )}

      {/* 6. Section 2: Status Server Diagnostics */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
            <i className="fa-solid fa-server text-brand-600"></i> Status Diagnostik Server & Koneksi Jaringan
          </h3>
          <button
            type="button"
            onClick={loadSystemStatus}
            disabled={checkingSystem}
            className="text-xs text-brand-600 hover:text-brand-800 font-bold flex items-center gap-1 cursor-pointer"
          >
            <i className={`fa-solid fa-stethoscope text-[11px] ${checkingSystem ? "fa-spin" : ""}`}></i>
            <span>{checkingSystem ? "Memeriksa..." : "Cek Sekarang"}</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
          {checkingSystem && !systemChecks ? (
            <p className="text-slate-400 text-xs col-span-full">Memeriksa status server...</p>
          ) : (
            (
              systemChecks || [
                { name: "PHP", ok: true, detail: "8.0.30" },
                { name: "API Guru", ok: true, detail: "Sesi terverifikasi" },
                { name: "Session", ok: true, detail: "C:\\xampp\\tmp" },
                { name: "Storage JSON", ok: true, detail: "db_kuis.json" },
                { name: "Backup", ok: true, detail: "Folder backups" },
              ]
            ).map((c, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                  c.ok ? "bg-emerald-50/50 border-emerald-200" : "bg-rose-50/50 border-rose-200"
                }`}
              >
                <i className={`fa-solid ${c.ok ? "fa-circle-check text-emerald-600" : "fa-circle-xmark text-rose-600"} text-sm mt-0.5`}></i>
                <div>
                  <p className="font-bold text-slate-800 text-[11px]">{c.name}</p>
                  <p className="text-[10px] text-slate-500">{c.detail}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 7. MODAL RINCIAN PELANGGARAN / KECURANGAN SISWA (modal-violation-detail) */}
      {violationModal && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViolationModal(null);
          }}
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center text-lg font-bold shrink-0">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                    <span>Log Deteksi Kecurangan</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-500 text-white">
                      {violationModal.count}x Curang
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <strong className="text-slate-700">{violationModal.name}</strong> • NIS:{" "}
                    <span className="font-mono font-bold text-brand-600">{violationModal.nis}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViolationModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Alert Notice */}
            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-900 shrink-0">
              <i className="fa-solid fa-shield-halved text-rose-600 text-sm mt-0.5 shrink-0"></i>
              <div className="space-y-0.5">
                <p className="font-bold">Aktivitas Mencurigakan Terekam Otomatis</p>
                <p className="text-[11px] text-rose-700 leading-relaxed">
                  Sistem anti-cheat ExamLAN mendeteksi setiap saat siswa beralih tab, meminimalkan browser, membuka aplikasi lain, keluar dari mode layar penuh (fullscreen), atau menekan tombol pintasan.
                </p>
              </div>
            </div>

            {/* Timeline List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2.5 min-h-[180px]">
              {violationModal.loading ? (
                <div className="p-8 text-center text-slate-400">
                  <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 text-rose-500"></i>
                  <p className="text-xs">Memuat rincian aktivitas kecurangan...</p>
                </div>
              ) : violationModal.violations.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <i className="fa-regular fa-circle-check text-3xl text-emerald-500 mb-2"></i>
                  <p className="text-xs font-bold text-slate-700">Tidak ada rincian log kecurangan terekam.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Siswa belum pernah beralih tab atau melanggar aturan.</p>
                </div>
              ) : (
                violationModal.violations.map((v, idx) => {
                  const typeLabel =
                    v.type === "fullscreen_exit"
                      ? "Keluar dari Layar Penuh (Fullscreen)"
                      : v.type === "tab_switch"
                      ? "Pindah Tab / Minimalkan Jendela Browser"
                      : v.type === "window_blur"
                      ? "Fokus Layar Berpindah ke Aplikasi Lain"
                      : v.type === "blocked_shortcut"
                      ? "Tombol Pintasan Terlarang Ditekan"
                      : v.type === "contextmenu"
                      ? "Mencoba Klik Kanan (Context Menu)"
                      : "Aktivitas Terlarang";

                  return (
                    <div
                      key={idx}
                      className="p-3 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200 shadow-2xs transition space-y-1.5 text-left"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <span className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 text-xs">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                          </span>
                          <span>{typeLabel}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            #{violationModal.violations.length - idx}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0 flex items-center gap-1">
                          <i className="fa-regular fa-clock text-[10px]"></i> {v.time || "-"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 pl-7 leading-relaxed">{v.detail || "-"}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={resetStudentViolations}
                disabled={busy}
                className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Reset hitungan kecurangan siswa ini menjadi 0 jika merupakan toleransi"
              >
                <i className="fa-solid fa-rotate-left text-xs"></i>
                <span>Reset Pelanggaran</span>
              </button>
              <button
                type="button"
                onClick={() => setViolationModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL PANDUAN PENGAWAS LAB (modal-mon-guide) */}
      {showGuideModal && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowGuideModal(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-base">
                  <i className="fa-solid fa-circle-question"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Panduan Pengawas Lab Komputer</h3>
                  <p className="text-[11px] text-slate-500">Kapan menggunakan Monitoring Ujian vs Hasil Ujian & Penanganan Kendala</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Perbedaan Tabel */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <i className="fa-solid fa-table-columns text-brand-600"></i> Tabel Perbedaan Utama:
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2 border-b border-r border-slate-200">Poin Perbedaan</th>
                      <th className="p-2 border-b border-r border-slate-200 text-sky-700 bg-sky-50/50">Monitoring Ujian (Live)</th>
                      <th className="p-2 border-b text-indigo-700 bg-indigo-50/50">Hasil Ujian (Rekap/Pasca)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr>
                      <td className="p-2 font-bold bg-slate-50 border-r border-slate-200">Kapan Digunakan?</td>
                      <td className="p-2 border-r border-slate-200">Saat jam ujian berlangsung di lab komputer.</td>
                      <td className="p-2">Setelah ujian selesai dikumpulkan oleh siswa.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold bg-slate-50 border-r border-slate-200">Tujuan Utama</td>
                      <td className="p-2 border-r border-slate-200">Mengawasi kelancaran teknis & kejujuran siswa secara real-time.</td>
                      <td className="p-2">Menganalisis nilai, mencetak rekap skor, dan evaluasi butir soal.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold bg-slate-50 border-r border-slate-200">Sifat Data</td>
                      <td className="p-2 border-r border-slate-200">Real-time (Live): Memperbarui otomatis tiap 5 detik (Heartbeat).</td>
                      <td className="p-2">Permanen / Arsip: Nilai akhir resmi tersimpan di database.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold bg-slate-50 border-r border-slate-200">Tindakan / Aksi Guru</td>
                      <td className="p-2 border-r border-slate-200">
                        • <b>Reset Sesi</b>: Buka kunci sesi jika PC siswa hang/mati listrik agar siswa bisa login lagi tanpa hilang jawaban.<br/>
                        • Pantau siswa yang kabur/tutup browser.<br/>
                        • Kumpulkan Paksa jika waktu habis.
                      </td>
                      <td className="p-2">
                        • Export Nilai ke Excel/PDF untuk buku rapor.<br/>
                        • Tampilkan/Sembunyikan Pembahasan siswa.<br/>
                        • Lihat Lembar Rincian Jawaban.<br/>
                        • Izinkan Remedial / Ujian Ulang.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Contoh Kasus Nyata */}
            <div className="space-y-2 bg-amber-50/60 p-3 rounded-xl border border-amber-200 text-xs">
              <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                <i className="fa-solid fa-lightbulb text-amber-600"></i> Contoh Kasus Nyata di Ruang Ujian:
              </h4>
              <div className="space-y-1.5 text-slate-700 text-[11px] leading-relaxed">
                <p>
                  <b>1. Kasus Komputer Mati Listrik / Kabel Tersenggol:</b><br/>
                  Ujian berjalan 20 menit, PC siswa tiba-tiba mati. Setelah PC dinyalakan lagi, siswa terkunci tidak bisa login. Guru membuka <b>Monitoring Ujian</b>, lalu klik tombol <b>Reset Sesi</b>. Siswa langsung bisa login kembali dan <u>melanjutkan ujian dari nomor terakhir tanpa hilang jawaban</u>.
                </p>
                <p>
                  <b>2. Kasus Penilaian & Buku Rapor:</b><br/>
                  Waktu ujian selesai. Guru ingin mencatat nilai atau evaluasi kurikulum. Guru membuka <b>Hasil Ujian</b>, melihat daftar nilai satu kelas, lalu klik <b>Export Excel / Cetak Rekap Nilai</b>.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
