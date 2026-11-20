"use client";

import React from "react";

interface TeacherNavbarProps {
  pendingExtensions: number;
  onOpenExtensions: () => void;
  onOpenInfoLan: () => void;
}

export function TeacherNavbar({
  pendingExtensions,
  onOpenExtensions,
  onOpenInfoLan,
}: TeacherNavbarProps) {
  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 flex justify-between items-center gap-3">
        <div className="flex items-center space-x-2 shrink-0">
          <div className="bg-brand-600 p-2 px-2.5 rounded-lg text-white flex items-center justify-center shadow-xs">
            <i className="fa-solid fa-network-wired text-xl"></i>
          </div>
          <div>
            <h1 className="font-bold text-base sm:text-lg leading-tight flex items-center gap-2">
              ExamLAN Pro{" "}
              <span className="bg-amber-500/20 text-amber-300 text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30">
                v2.0
              </span>
            </h1>
            <p className="text-xs text-slate-400">Server Evaluasi Lab Komputer</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Extension Request Bell */}
          <button
            type="button"
            onClick={onOpenExtensions}
            className="relative p-2 px-3 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition focus:outline-none cursor-pointer flex items-center justify-center"
            title="Permintaan Waktu Siswa"
          >
            <i className="fa-solid fa-bell text-base"></i>
            {pendingExtensions > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-slate-900 animate-pulse"></span>
            )}
          </button>

          {/* Info LAN Button */}
          <button
            type="button"
            onClick={onOpenInfoLan}
            className="relative p-2 px-3 hover:text-white hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            title="Informasi IP Server & Akses LAN Siswa"
          >
            <i className="fa-solid fa-circle-question text-base"></i>
            <span className="hidden lg:inline text-[11px] text-slate-300">Info LAN</span>
          </button>
        </div>
      </div>
    </header>
  );
}
