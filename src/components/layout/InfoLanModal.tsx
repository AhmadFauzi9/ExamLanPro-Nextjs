"use client";

import React from "react";

interface InfoLanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadKioskLauncher: () => void;
}

export function InfoLanModal({
  isOpen,
  onClose,
  onDownloadKioskLauncher,
}: InfoLanModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-3 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b pb-2.5">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <i className="fa-solid fa-network-wired text-brand-600"></i> Informasi Jaringan LAN
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div className="space-y-2 text-xs text-slate-600">
          <p>Agar siswa di lab dapat mengakses ujian melalui jaringan LAN, bagikan alamat berikut kepada siswa:</p>
          <div className="p-2.5 bg-slate-100 rounded-xl font-mono text-xs font-bold text-brand-700 text-center select-all border border-slate-200">
            http://{typeof window !== "undefined" ? window.location.host : "localhost:3000"}/
          </div>
          <p className="text-[11px] text-slate-500">
            Pastikan perangkat server dan komputer siswa terhubung ke Switch/Access Point yang sama.
          </p>
          <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-200 text-sky-900 space-y-1.5 mt-2">
            <p className="font-bold text-[11px] flex items-center gap-1.5">
              <i className="fa-solid fa-shield-halved text-sky-600"></i> Mode Kiosk 100% Terkunci (Tanpa Tombol X & Anti-ESC):
            </p>
            <p className="text-[10px] text-slate-600 leading-relaxed">
              Jalankan ujian di PC lab menggunakan parameter Kiosk resmi agar tombol X atas hilang total dan penekanan/penahanan tombol ESC tidak dapat keluar dari ujian:
            </p>
            <button
              type="button"
              onClick={onDownloadKioskLauncher}
              className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <i className="fa-solid fa-download"></i> Unduh Launcher Kiosk Siswa (.bat)
            </button>
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
