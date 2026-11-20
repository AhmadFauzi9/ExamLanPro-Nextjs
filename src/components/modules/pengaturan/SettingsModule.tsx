"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Quiz, Question, Student, TimeExtensionReq, AuditLog, BackupFile, apiJson, escapeHtml } from "@/types/teacher";
import { TablePagination } from "@/components/common/TablePagination";
import { appAlert, appConfirm } from "@/components/common/AppDialog";

export function SettingsModule() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [selectedBackups, setSelectedBackups] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const loadBackups = async () => {
    try {
      const res = await apiJson(await fetch("/api/admin/backup?action=list", { cache: "no-store" }));
      setBackups(res.backups || []);
    } catch {}
  };

  useEffect(() => {
    void loadBackups();
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      await appAlert("Password baru minimal 8 karakter.", "Perhatian");
      return;
    }
    if (newPassword !== confirmPassword) {
      await appAlert("Konfirmasi password tidak cocok.", "Perhatian");
      return;
    }

    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/auth/teacher/password", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        })
      );
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password guru berhasil diperbarui.");
    } catch (err: any) {
      await appAlert(err.message || "Gagal mengubah password.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateBackup() {
    setBusy(true);
    try {
      const res = await apiJson(await fetch("/api/admin/backup", { method: "POST" }));
      showToast(`Cadangan berhasil dibuat: ${res.file}`);
      await loadBackups();
    } catch (err: any) {
      await appAlert(err.message || "Gagal membuat cadangan.", "Error");
    } finally {
      setBusy(false);
    }
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

  async function handleDeleteBackup(fileName: string) {
    if (
      !(await appConfirm(
        `Hapus berkas cadangan "${fileName}"?`,
        "Hapus Berkas Cadangan",
        "Batal",
        "Hapus"
      ))
    )
      return;
    try {
      await apiJson(
        await fetch("/api/admin/backup", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: fileName }),
        })
      );
      showToast("Berkas cadangan berhasil dihapus.");
      await loadBackups();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menghapus cadangan.", "Error");
    }
  }

  async function handleDeleteSelectedBackups() {
    if (!selectedBackups.size) return;
    if (
      !(await appConfirm(
        `Hapus ${selectedBackups.size} berkas cadangan terpilih?`,
        "Hapus Cadangan Terpilih",
        "Batal",
        "Hapus"
      ))
    )
      return;
    try {
      await apiJson(
        await fetch("/api/admin/backup", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: Array.from(selectedBackups) }),
        })
      );
      setSelectedBackups(new Set());
      showToast("Berkas cadangan terpilih berhasil dihapus.");
      await loadBackups();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menghapus berkas cadangan terpilih.", "Error");
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleRestoreBackup(fileName: string) {
    if (
      !(await appConfirm(
        `Pulihkan (Restore) database server dari berkas cadangan "${fileName}"? Seluruh data yang ada saat ini akan ditimpa dengan data cadangan ini.`,
        "Konfirmasi Pemulihan Database",
        "Batal",
        "Ya, Pulihkan Database"
      ))
    )
      return;
    setBusy(true);
    try {
      const res = await apiJson(
        await fetch("/api/admin/backup?action=restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: fileName }),
        })
      );
      await appAlert(res.message || "Database berhasil dipulihkan.", "Berhasil");
      await loadBackups();
    } catch (err: any) {
      await appAlert(err.message || "Gagal memulihkan database.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !(await appConfirm(
        `Pulihkan (Restore) database dari berkas "${file.name}"? Pastikan berkas ini adalah cadangan resmi ExamLAN Pro (.json).`,
        "Konfirmasi Restore Berkas",
        "Batal",
        "Ya, Pulihkan Berkas"
      ))
    ) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append("backup_file", file);
      const res = await apiJson(
        await fetch("/api/admin/backup?action=restore", {
          method: "POST",
          body: form,
        })
      );
      await appAlert(res.message || "Database berhasil dipulihkan dari berkas.", "Berhasil");
      await loadBackups();
    } catch (err: any) {
      await appAlert(err.message || "Gagal memulihkan berkas cadangan.", "Error");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
      {/* Page Title Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg font-bold shrink-0">
          <i className="fa-solid fa-gear"></i>
        </div>
        <div>
          <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">Pengaturan Sistem Ujian</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Konfigurasi akun administrator dan cadangan database server.
          </p>
        </div>
      </div>

      {/* 2-Column Grid: Kolom Kiri (Ganti Password & Keamanan Ujian) & Kolom Kanan (Cadangan Database) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* KOLOM KIRI: Ganti Password Guru & Keamanan Ujian (Mode Kiosk Resmi) */}
        <div className="space-y-5">
          {/* CARD 1: GANTI PASSWORD GURU / ADMINISTRATOR */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b pb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-sm font-bold shrink-0">
                <i className="fa-solid fa-key"></i>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Ganti Password Guru</h3>
                <p className="text-[11px] text-slate-500">Perbarui kata sandi untuk mengakses dashboard guru ExamLAN Pro.</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 text-xs w-full">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password Baru (Minimal 8 Karakter)</label>
                <div className="relative">
                  <input
                    type={showPwd1 ? "text" : "password"}
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi baru..."
                    className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd1(!showPwd1)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <i className={`fa-regular ${showPwd1 ? "fa-eye-slash" : "fa-eye"} text-xs`}></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Konfirmasi Password Baru</label>
                <div className="relative">
                  <input
                    type={showPwd2 ? "text" : "password"}
                    minLength={8}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru..."
                    className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd2(!showPwd2)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <i className={`fa-regular ${showPwd2 ? "fa-eye-slash" : "fa-eye"} text-xs`}></i>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-start">
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-compact bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  <i className="fa-solid fa-lock text-xs"></i>
                  <span>Ganti Password</span>
                </button>
              </div>
            </form>
          </div>

          {/* CARD 2: KEAMANAN UJIAN (MODE KIOSK RESMI) - DI BAWAH PENGATURAN PASSWORD */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Keamanan Ujian (Mode Kiosk Resmi)</h3>
                <p className="text-[11px] text-slate-500">
                  Informasi proteksi layar siswa dan pintasan darurat proktor ruang.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Kotak 1: Proteksi Mode Kiosk Klien */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <i className="fa-solid fa-lock text-brand-600"></i>
                  <span>Proteksi Mode Kiosk Klien:</span>
                </div>
                <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside leading-relaxed">
                  <li>Layar terkunci otomatis dalam mode layar penuh (Full Screen) saat siswa memulai ujian.</li>
                  <li>
                    Jika siswa keluar layar penuh (tekan X atau tahan ESC), layar ujian{" "}
                    <b>langsung terkunci seketika</b> dan pelanggaran dicatat ke server pengawas.
                  </li>
                  <li>Pindah tab, membuka jendela lain, atau tombol Windows otomatis mengunci layar ujian.</li>
                </ul>
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-[10px] text-slate-500 mb-2">
                    Agar tombol X atas hilang total dan tombol ESC tahan mati sepenuhnya (standar ANBK), buka komputer siswa melalui Launcher Kiosk:
                  </p>
                  <button
                    type="button"
                    onClick={downloadKioskLauncher}
                    className="w-full py-2 px-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <i className="fa-solid fa-download"></i> Unduh Launcher Kiosk Siswa (.bat)
                  </button>
                </div>
              </div>

              {/* Kotak 2: Pintasan Darurat Pengawas */}
              <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 font-bold">
                    <i className="fa-solid fa-key text-amber-600"></i>
                    <span>Pintasan Darurat Pengawas:</span>
                  </div>
                  <span className="text-[10px] bg-amber-200/70 text-amber-800 font-bold px-2 py-0.5 rounded-full shrink-0">
                    Rahasia
                  </span>
                </div>
                <div className="flex items-center gap-2 py-1 font-mono font-black text-sm text-slate-800">
                  <kbd className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg shadow-2xs text-amber-700">CTRL</kbd>
                  <span className="text-amber-500">+</span>
                  <kbd className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg shadow-2xs text-amber-700">C</kbd>
                  <span className="text-amber-500">+</span>
                  <kbd className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg shadow-2xs text-amber-700">B</kbd>
                </div>
                <p className="text-[11px] text-amber-900/90 leading-relaxed">
                  Tekan kombinasi tombol di atas pada perangkat siswa untuk <b>langsung keluar seketika dari Mode Kiosk</b> atau membuka kunci layar yang terblokir. <i>(Pintasan ini sengaja dirahasiakan dan tidak ditampilkan di layar komputer siswa)</i>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: CADANGAN & PEMULIHAN (BACKUP & RESTORE) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            {/* Header Card: Hanya Judul & Keterangan (Tombol dipindah ke bawah) */}
            <div className="flex items-center gap-2.5 border-b pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold shrink-0">
                <i className="fa-solid fa-database"></i>
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">Cadangan & Pemulihan (Backup & Restore)</h3>
                <p className="text-[11px] text-slate-500">Amankan dan pulihkan data paket soal, data siswa, dan rekap nilai server.</p>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-slate-700">Riwayat Berkas Cadangan:</p>
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    {backups.length} berkas
                  </span>
                </div>
                {selectedBackups.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full animate-pulse">
                      {selectedBackups.size} dipilih
                    </span>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedBackups}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can text-[11px]"></i>
                      <span>Hapus Terpilih</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Table Header */}
              {backups.length > 0 && (
                <div className="bg-slate-100/90 border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-600 flex items-center justify-between gap-2 select-none">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={backups.length > 0 && selectedBackups.size === backups.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBackups(new Set(backups.map((b) => b.file)));
                        else setSelectedBackups(new Set());
                      }}
                      className="w-3.5 h-3.5 rounded text-brand-600 focus:ring-brand-500 cursor-pointer shrink-0"
                      title="Pilih Semua Berkas"
                    />
                    <span className="w-6 text-center text-slate-400 shrink-0">No.</span>
                    <span>Nama Berkas Cadangan</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:inline">Waktu Cadangan</span>
                    <span className="w-24 text-center">Aksi</span>
                  </div>
                </div>
              )}

              {/* Backups List */}
              <div className="space-y-1.5 max-h-[380px] overflow-y-auto custom-scrollbar text-xs">
                {backups.map((b, idx) => (
                  <div
                    key={b.file}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl flex items-center justify-between text-xs gap-2 transition group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedBackups.has(b.file)}
                        onChange={(e) => {
                          const next = new Set(selectedBackups);
                          if (e.target.checked) next.add(b.file);
                          else next.delete(b.file);
                          setSelectedBackups(next);
                        }}
                        className="w-3.5 h-3.5 rounded text-brand-600 cursor-pointer shrink-0"
                      />
                      <span className="w-6 text-center font-bold text-slate-400 text-[11px] shrink-0">{idx + 1}</span>
                      <i className="fa-solid fa-file-shield text-emerald-600 shrink-0"></i>
                      <span className="font-mono font-bold text-slate-700 truncate" title={b.file}>
                        {b.file}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-slate-500 font-mono text-[11px] hidden sm:inline mr-1">
                        {new Date(b.created_at).toLocaleString("id-ID")}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRestoreBackup(b.file)}
                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Pulihkan (Restore) database server dari berkas cadangan ini"
                      >
                        <i className="fa-solid fa-rotate-left text-[10px]"></i>
                        <span>Restore</span>
                      </button>
                      <a
                        href={`/api/admin/backup?action=download&file=${encodeURIComponent(b.file)}`}
                        className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition inline-flex items-center justify-center"
                        title="Unduh berkas cadangan ini (.json)"
                        download={b.file}
                      >
                        <i className="fa-solid fa-download text-xs"></i>
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteBackup(b.file)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Hapus Berkas Cadangan Ini"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  </div>
                ))}
                {backups.length === 0 && (
                  <p className="text-slate-400 text-xs py-4 text-center">Belum ada riwayat berkas cadangan.</p>
                )}
              </div>
            </div>
          </div>

          {/* Card Footer: Tombol Restore Berkas & Buat Backup (Sejajar Horisontal) */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2.5">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <i className="fa-solid fa-shield-halved text-emerald-600"></i>
              <span>Cadangan tersimpan aman di server</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="btn-compact bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                title="Pulihkan database dari berkas cadangan luar (.json)"
              >
                <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                <span>Restore Berkas</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleCreateBackup}
                className="btn-compact bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                title="Buat arsip cadangan database saat ini"
              >
                <i className="fa-solid fa-cloud-arrow-down text-xs"></i>
                <span>Buat Backup</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                className="hidden"
                onChange={handleRestoreFile}
              />
            </div>
          </div>
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
