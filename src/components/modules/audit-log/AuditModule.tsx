"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Quiz, Question, Student, TimeExtensionReq, AuditLog, BackupFile, apiJson, escapeHtml } from "@/types/teacher";
import { TablePagination } from "@/components/common/TablePagination";
import { appAlert, appConfirm } from "@/components/common/AppDialog";

export function AuditModule() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [perPage, setPerPage] = useState(20);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const loadLogs = async () => {
    try {
      const data = await apiJson(await fetch("/api/admin/audit", { cache: "no-store" }));
      setLogs(data || []);
    } catch {}
  };

  useEffect(() => {
    void loadLogs();
  }, []);

  const filtered = useMemo(() => {
    let list = logs.filter((l) => {
      const text = `${l.actor} ${l.action} ${l.entity || ""} ${JSON.stringify(l.detail || "")}`.toLowerCase();
      return !search || text.includes(search.toLowerCase());
    });
    if (sortOrder === "asc") {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return list;
  }, [logs, search, sortOrder]);

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="space-y-4 min-w-0">
      {/* Header Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-lg font-bold shrink-0">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">
              Rekam Jejak Sistem (Audit Log)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Catatan aktivitas administratif, keamanan, autentikasi, dan perubahan data sistem.
            </p>
          </div>
        </div>
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
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none"
            title="Jumlah Baris Tampil"
          >
            {[10, 20, 30, 40, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none"
            title="Urutkan"
          >
            <option value="desc">Terbaru</option>
            <option value="asc">Terlama</option>
          </select>

          <div className="relative min-w-[180px] sm:min-w-[220px] max-w-xs flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aksi, keterangan target, pengguna, atau IP..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none text-xs text-slate-800 transition"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={loadLogs}
          className="btn-icon border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer"
          title="Muat Ulang Log Audit"
        >
          <i className="fa-solid fa-rotate text-xs"></i>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse compact-table">
            <thead className="bg-slate-100 uppercase font-bold text-slate-600 tracking-wider">
              <tr>
                <th className="w-12 text-center">No</th>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Aksi</th>
                <th>Target / Keterangan</th>
                <th>IP / Host</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((l, i) => (
                <tr key={l.id} className="hover:bg-slate-50 transition text-xs">
                  <td className="p-2.5 text-center font-bold text-slate-400">{(currentPage - 1) * perPage + i + 1}</td>
                  <td className="p-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString("id-ID")}
                  </td>
                  <td className="p-2.5 font-bold text-slate-700 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px]">
                      {l.actor || "guru"}
                    </span>
                  </td>
                  <td className="p-2.5 font-bold text-slate-800">{l.action || "-"}</td>
                  <td className="p-2.5 text-slate-600 max-w-sm truncate" title={l.entity ? `${l.entity} (${l.entity_id || "-"})` : (typeof l.detail === "string" ? l.detail : "-")}>
                    {l.entity ? `${l.entity} (${l.entity_id || "-"})` : (typeof l.detail === "string" ? l.detail : "-")}
                  </td>
                  <td className="p-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {l.ip || (typeof l.detail === "object" && l.detail?.ip) || "127.0.0.1"}
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Belum ada log audit.
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
          itemLabel="log"
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}

// ==========================================
// 7. PENGATURAN SYSTEM MODULE
// ==========================================
