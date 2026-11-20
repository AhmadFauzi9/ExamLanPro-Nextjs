"use client";

import React from "react";
import { Tab } from "@/types/teacher";

export const MENU_ITEMS: { key: Tab; slug: string; label: string; icon: string }[] = [
  { key: "quizzes", slug: "bank-soal", label: "Bank Soal", icon: "fa-folder-plus" },
  { key: "students", slug: "data-siswa", label: "Data Siswa", icon: "fa-users" },
  { key: "results", slug: "hasil-ujian", label: "Hasil Ujian", icon: "fa-chart-line" },
  { key: "monitor", slug: "monitoring", label: "Monitoring Ujian", icon: "fa-tower-broadcast" },
  { key: "extensions", slug: "notifikasi", label: "Permintaan Waktu", icon: "fa-clock-rotate-left" },
  { key: "audit", slug: "audit-log", label: "Audit Log", icon: "fa-shield-halved" },
  { key: "settings", slug: "pengaturan", label: "Pengaturan", icon: "fa-gear" },
];

interface TeacherSidebarProps {
  tab: Tab;
  pendingExtensions: number;
  onSelectTab: (t: Tab) => void;
  onLogout: () => void;
}

export function TeacherSidebar({
  tab,
  pendingExtensions,
  onSelectTab,
  onLogout,
}: TeacherSidebarProps) {
  return (
    <aside className="sticky top-20 z-20">
      <nav className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs flex flex-row md:flex-col gap-1 w-full overflow-x-auto md:overflow-visible custom-scrollbar">
        {MENU_ITEMS.map((m) => {
          const isActive = tab === m.key;
          const activeClass = isActive
            ? "bg-brand-50 text-brand-700 font-bold border border-brand-200 shadow-2xs"
            : "text-slate-600 hover:bg-slate-50 font-medium hover:text-slate-900 border border-transparent";
          const iconColor = isActive ? "text-brand-600" : "text-slate-400";
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelectTab(m.key)}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition shrink-0 md:shrink md:w-full text-left cursor-pointer ${activeClass}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <i className={`fa-solid ${m.icon} w-4 text-center text-sm ${iconColor}`}></i>
                <span className="whitespace-nowrap">{m.label}</span>
              </div>
              {m.key === "extensions" && pendingExtensions > 0 && (
                <span className="ml-auto bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse shadow-sm">
                  {pendingExtensions}
                </span>
              )}
            </button>
          );
        })}

        <hr className="hidden md:block my-1.5 border-slate-100" />
        <button
          type="button"
          onClick={onLogout}
          className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 font-medium transition w-full text-left cursor-pointer"
        >
          <i className="fa-solid fa-right-from-bracket w-4 text-center text-sm text-rose-500"></i>
          <span>Logout</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex md:hidden items-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 font-medium transition shrink-0 text-left cursor-pointer"
          title="Logout dari Dashboard Guru"
        >
          <i className="fa-solid fa-right-from-bracket text-sm text-rose-500"></i>
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}
