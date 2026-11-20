"use client";

import React, { useEffect, useState } from "react";
import { appConfirm } from "@/components/common/AppDialog";
import { Tab, Student, Quiz, MonitorRow, apiJson } from "@/types/teacher";

import { TeacherNavbar } from "./layout/TeacherNavbar";
import { TeacherSidebar } from "./layout/TeacherSidebar";
import { InfoLanModal } from "./layout/InfoLanModal";

import { QuizModule } from "./modules/bank-soal/QuizModule";
import { StudentModule } from "./modules/data-siswa/StudentModule";
import { ResultsView } from "./modules/hasil-ujian/ResultsView";
import { MonitoringView } from "./modules/monitoring/MonitoringView";
import { ExtensionsModule } from "./modules/permintaan-waktu/ExtensionsModule";
import { AuditModule } from "./modules/audit-log/AuditModule";
import { SettingsModule } from "./modules/pengaturan/SettingsModule";

export default function TeacherPortalV2() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("admin");
  const [tab, setTab] = useState<Tab>("quizzes");

  useEffect(() => {
    function syncHash() {
      if (typeof window === "undefined") return;
      const h = window.location.hash.replace("#", "").toLowerCase();
      const slugMap: Record<string, Tab> = {
        "bank-soal": "quizzes",
        quizzes: "quizzes",
        "data-siswa": "students",
        students: "students",
        "hasil-ujian": "results",
        results: "results",
        monitoring: "monitor",
        monitor: "monitor",
        notifikasi: "extensions",
        "permintaan-waktu": "extensions",
        extensions: "extensions",
        "audit-log": "audit",
        audit: "audit",
        pengaturan: "settings",
        settings: "settings",
      };
      if (h && slugMap[h]) {
        setTab(slugMap[h]);
      }
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const [students, setStudents] = useState<Student[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [monitor, setMonitor] = useState<MonitorRow[]>([]);
  const [pendingExtensions, setPendingExtensions] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showLanGuide, setShowLanGuide] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function loadAll() {
    try {
      const [sumRes, monRes, stRes, qRes, extRes] = await Promise.all([
        fetch("/api/admin/summary", { cache: "no-store" }),
        fetch("/api/admin/monitoring", { cache: "no-store" }),
        fetch("/api/admin/students", { cache: "no-store" }),
        fetch("/api/admin/quizzes", { cache: "no-store" }),
        fetch("/api/admin/extensions", { cache: "no-store" }),
      ]);

      if (sumRes.status === 401) {
        setAuthenticated(false);
        return;
      }

      const [monData, stData, qData, extData] = await Promise.all([
        apiJson(monRes),
        apiJson(stRes),
        apiJson(qRes),
        apiJson(extRes),
      ]);

      setMonitor(monData || []);
      setStudents(stData || []);
      setQuizzes(qData || []);

      const pending = Array.isArray(extData)
        ? extData.filter((x: any) => x.status === "PENDING").length
        : 0;
      setPendingExtensions(pending);

      setAuthenticated(true);
      setError("");
    } catch (e: any) {
      setError(e.message || "Gagal memuat data server.");
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const interval = setInterval(() => void loadAll(), 15000);
    return () => clearInterval(interval);
  }, [authenticated]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiJson(
        await fetch("/api/auth/teacher/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        })
      );
      setAuthenticated(true);
      setPassword("");
      await loadAll();
    } catch (err: any) {
      setError(err.message || "Password salah!");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (
      !(await appConfirm(
        "Apakah Anda yakin ingin logout dari Dashboard Guru?",
        "Konfirmasi Logout",
        "Batal",
        "Ya, Logout"
      ))
    )
      return;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setAuthenticated(false);
    setPassword("");
  }

  function downloadKioskLauncher() {
    const portalUrl = `http://${typeof window !== "undefined" ? window.location.host : "localhost:3000"}/`;
    const batContent =
      `@echo off\r\n` +
      `title ExamLAN Pro - Mode Kiosk Resmi CBT\r\n` +
      `echo ====================================================\r\n` +
      `echo Membuka ExamLAN Pro dalam Mode Kiosk Resmi CBT...\r\n` +
      `echo ====================================================\r\n` +
      `where msedge >nul 2>&1\r\n` +
      `if %ERRORLEVEL% equ 0 (\r\n` +
      `    start "" msedge --kiosk "${portalUrl}" --edge-kiosk-type=fullscreen --no-first-run\r\n` +
      `    exit\r\n` +
      `)\r\n` +
      `where chrome >nul 2>&1\r\n` +
      `if %ERRORLEVEL% equ 0 (\r\n` +
      `    start "" chrome --kiosk "${portalUrl}" --no-first-run\r\n` +
      `    exit\r\n` +
      `)\r\n` +
      `start "${portalUrl}"\r\n` +
      `exit\r\n`;
    const blob = new Blob([batContent], { type: "application/x-bat" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Buka-Ujian-Siswa-Kiosk.bat";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Unauthenticated Server Login Screen
  if (!authenticated) {
    return (
      <main className="min-h-screen bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto text-xl">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h3 className="text-base font-bold text-slate-800">Login Guru / Server</h3>
            <p className="text-xs text-slate-500">Masukkan password pengawas ujian untuk membuka dashboard.</p>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Password Guru
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
            >
              {busy ? "Memeriksa..." : "Masuk Dashboard"}
            </button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      {/* 1. Header Navbar */}
      <TeacherNavbar
        pendingExtensions={pendingExtensions}
        onOpenExtensions={() => setTab("extensions")}
        onOpenInfoLan={() => setShowLanGuide(true)}
      />

      {/* 2. Main Container: Sidebar + Content */}
      <main className="flex-grow w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="grid grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)] gap-5 items-start">
          {/* Sidebar */}
          <TeacherSidebar
            tab={tab}
            pendingExtensions={pendingExtensions}
            onSelectTab={(selectedTab) => {
              setTab(selectedTab);
              const slugMap: Record<Tab, string> = {
                quizzes: "bank-soal",
                students: "data-siswa",
                results: "hasil-ujian",
                monitor: "monitoring",
                extensions: "notifikasi",
                audit: "audit-log",
                settings: "pengaturan",
              };
              if (typeof window !== "undefined") window.location.hash = slugMap[selectedTab];
            }}
            onLogout={handleLogout}
          />

          {/* Module Content Views */}
          <section className="space-y-4 min-w-0">
            {tab === "quizzes" && <QuizModule rows={quizzes} reload={loadAll} />}
            {tab === "students" && <StudentModule rows={students} reload={loadAll} />}
            {tab === "results" && (
              <ResultsView
                rows={monitor}
                students={students}
                quizzes={quizzes}
                reload={loadAll}
                setTab={setTab}
              />
            )}
            {tab === "monitor" && (
              <MonitoringView
                rows={monitor}
                quizzes={quizzes}
                students={students}
                reload={loadAll}
                pendingExtensions={pendingExtensions}
                setTab={setTab}
              />
            )}
            {tab === "extensions" && <ExtensionsModule />}
            {tab === "audit" && <AuditModule />}
            {tab === "settings" && <SettingsModule />}
          </section>
        </div>
      </main>

      {/* Info LAN Modal */}
      <InfoLanModal
        isOpen={showLanGuide}
        onClose={() => setShowLanGuide(false)}
        onDownloadKioskLauncher={downloadKioskLauncher}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] p-3.5 rounded-xl shadow-xl bg-slate-900 text-white flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <i className="fa-solid fa-circle-check text-emerald-400"></i>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
