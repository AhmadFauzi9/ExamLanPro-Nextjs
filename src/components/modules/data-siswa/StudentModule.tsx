"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Quiz, Question, Student, TimeExtensionReq, AuditLog, BackupFile, apiJson, escapeHtml } from "@/types/teacher";
import { TablePagination } from "@/components/common/TablePagination";
import { appAlert, appConfirm } from "@/components/common/AppDialog";
import { downloadStudentTemplate } from "../bank-soal/templates";

export function StudentModule({
  rows,
  reload,
}: {
  rows: Student[];
  reload: () => Promise<void>;
}) {
  const [perPage, setPerPage] = useState(10);
  const [sortOrder, setSortOrder] = useState("default");
  const [filterClass, setFilterClass] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [requirePassword, setRequirePassword] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Load require_student_password setting
  useEffect(() => {
    void (async () => {
      try {
        const s = await apiJson(await fetch("/api/admin/settings", { cache: "no-store" }));
        if (s) {
          setRequirePassword(s.require_student_password !== false);
        }
      } catch {}
    })();
  }, []);

  // Close modals on Escape key and lock body scroll
  useEffect(() => {
    if (!modalOpen && !importModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalOpen(false);
        setImportModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = orig;
    };
  }, [modalOpen, importModalOpen]);

  async function toggleRequirePassword(checked: boolean) {
    setRequirePassword(checked);
    try {
      await apiJson(
        await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ require_student_password: checked }),
        })
      );
      showToast(checked ? "Login ujian wajib menggunakan password." : "Login ujian tanpa password diaktifkan.");
    } catch {
      await appAlert("Gagal mengubah pengaturan password.", "Error");
    }
  }

  const classes = useMemo(() => Array.from(new Set(rows.map((r) => r.class_name))).filter(Boolean).sort(), [rows]);
  const years = useMemo(() => Array.from(new Set(rows.map((r) => r.section_name))).filter(Boolean).sort(), [rows]);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => {
      const matchClass = filterClass === "all" || r.class_name === filterClass;
      const matchYear = filterYear === "all" || r.section_name === filterYear;
      const matchSearch =
        !search ||
        r.nis.toLowerCase().includes(search.toLowerCase()) ||
        r.name.toLowerCase().includes(search.toLowerCase());
      return matchClass && matchYear && matchSearch;
    });

    if (sortOrder === "nis_asc") list.sort((a, b) => a.nis.localeCompare(b.nis, undefined, { numeric: true }));
    if (sortOrder === "nis_desc") list.sort((a, b) => b.nis.localeCompare(a.nis, undefined, { numeric: true }));
    if (sortOrder === "name_asc") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sortOrder === "name_desc") list.sort((a, b) => b.name.localeCompare(a.name));
    if (sortOrder === "class_asc") list.sort((a, b) => a.class_name.localeCompare(b.class_name));

    return list;
  }, [rows, filterClass, filterYear, search, sortOrder]);

  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Form State
  const blankStudent = {
    nis: "",
    name: "",
    className: "",
    sectionName: "",
    homeroomTeacher: "",
    password: "",
    active: true,
  };
  const [form, setForm] = useState(blankStudent);

  function openCreate() {
    setEditingStudent(null);
    setForm(blankStudent);
    setModalOpen(true);
    setError("");
  }

  function openEdit(st: Student) {
    setEditingStudent(st);
    setForm({
      nis: st.nis,
      name: st.name,
      className: st.class_name,
      sectionName: st.section_name || "",
      homeroomTeacher: st.homeroom_teacher || "",
      password: "",
      active: Boolean(st.active),
    });
    setModalOpen(true);
    setError("");
  }

  async function handleSaveStudent(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        nis: form.nis.trim(),
        name: form.name.trim(),
        className: form.className.trim(),
        sectionName: form.sectionName.trim() || undefined,
        homeroomTeacher: form.homeroomTeacher.trim() || undefined,
        password: form.password || undefined,
        active: form.active,
      };

      if (editingStudent) {
        await apiJson(
          await fetch(`/api/admin/students/${editingStudent.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
        showToast("Data siswa berhasil diperbarui.");
      } else {
        await apiJson(
          await fetch("/api/admin/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
        showToast("Siswa baru berhasil ditambahkan.");
      }

      setModalOpen(false);
      await reload();
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan data siswa.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteStudent(st: Student) {
    if (
      !(await appConfirm(
        `Hapus data siswa "${st.name}" (${st.nis})?`,
        "Hapus Data Siswa",
        "Batal",
        "Hapus"
      ))
    )
      return;
    try {
      await apiJson(await fetch(`/api/admin/students/${st.id}`, { method: "DELETE" }));
      showToast("Data siswa berhasil dihapus.");
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menghapus siswa.", "Error");
    }
  }

  async function handleDeleteSelected() {
    if (!selectedIds.size) return;
    if (
      !(await appConfirm(
        `Hapus ${selectedIds.size} siswa yang dipilih?`,
        "Hapus Siswa Terpilih",
        "Batal",
        "Hapus"
      ))
    )
      return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/admin/students/${id}`, { method: "DELETE" }).then(apiJson)
        )
      );
      setSelectedIds(new Set());
      showToast("Siswa terpilih berhasil dihapus.");
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menghapus beberapa siswa.", "Error");
    }
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  async function processStudentImport() {
    if (!importFile) {
      await appAlert("Silakan pilih berkas Excel (.xlsx / .xls) terlebih dahulu.", "Perhatian");
      return;
    }
    const form = new FormData();
    form.set("file", importFile);
    setBusy(true);
    try {
      const res = await apiJson(await fetch("/api/admin/import/students", { method: "POST", body: form }));
      showToast(`Import selesai: ${res.imported || 0} siswa baru masuk.`);
      setImportModalOpen(false);
      setImportFile(null);
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal mengimpor siswa.", "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Header Card */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center text-lg font-bold shrink-0">
            <i className="fa-solid fa-users"></i>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">Data Siswa</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-semibold text-slate-500">{rows.length} siswa terdaftar</span>
              {selectedIds.size > 0 && (
                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  {selectedIds.size} dipilih
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Security Setting: Toggle Password */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <i className="fa-solid fa-user-shield"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-xs">Login Ujian Menggunakan Password</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  requirePassword
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-300"
                }`}
              >
                {requirePassword ? "Wajib Password" : "Bebas Password"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Aktifkan jika siswa harus memasukkan password saat login ujian, atau matikan agar siswa bisa login hanya dengan NIS.
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 select-none">
          <input
            type="checkbox"
            checked={requirePassword}
            onChange={(e) => toggleRequirePassword(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
          <span className="ml-2 text-xs font-semibold text-slate-700 select-none">
            {requirePassword ? "Wajib Password" : "Bebas"}
          </span>
        </label>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <select
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none"
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
            className="px-1.5 py-1.5 w-[85px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none"
            title="Pengurutan data"
          >
            <option value="default">Sort</option>
            <option value="nis_asc">NIS (0 - 9)</option>
            <option value="nis_desc">NIS (9 - 0)</option>
            <option value="name_asc">Nama (A - Z)</option>
            <option value="name_desc">Nama (Z - A)</option>
            <option value="class_asc">Kelas</option>
          </select>

          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-1.5 py-1.5 w-[90px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none"
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
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-1.5 py-1.5 w-[90px] rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none"
            title="Filter Tahun"
          >
            <option value="all">Tahun</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
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
            onClick={openCreate}
            className="btn-icon bg-brand-600 hover:bg-brand-700 text-white shadow-2xs transition cursor-pointer flex items-center justify-center"
            title="Tambah Siswa Baru"
          >
            <i className="fa-solid fa-user-plus text-xs"></i>
          </button>
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="btn-icon bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer flex items-center justify-center"
            title="Import Siswa (Excel / Word)"
          >
            <i className="fa-solid fa-file-excel text-xs"></i>
          </button>
          <button
            type="button"
            disabled={!selectedIds.size}
            onClick={handleDeleteSelected}
            className={`btn-icon border transition cursor-pointer flex items-center justify-center ${
              selectedIds.size
                ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
            }`}
            title="Hapus Siswa Terpilih"
          >
            <i className="fa-solid fa-trash-can text-xs"></i>
          </button>
          <button
            type="button"
            onClick={() => reload()}
            className="btn-icon border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center"
            title="Muat Ulang Data Siswa"
          >
            <i className="fa-solid fa-rotate text-xs"></i>
          </button>
        </div>
      </div>

      {/* Table with Pagination */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs border-collapse compact-table">
            <thead className="bg-slate-100 uppercase font-bold text-slate-600 tracking-wider">
              <tr>
                <th className="w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </th>
                <th className="w-12 text-center">No</th>
                <th className="w-12 text-center">Foto</th>
                <th>No. Induk</th>
                <th>Nama Siswa</th>
                <th>Kelas</th>
                <th>Tahun Ajaran</th>
                <th>Password</th>
                <th className="text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((st, i) => {
                const noUrut = (currentPage - 1) * perPage + i + 1;
                const isSelected = selectedIds.has(st.id);
                const isPwdVisible = visiblePasswords[st.id] || false;
                const pwd = st.password || "123456";

                return (
                  <tr key={st.id} className={`hover:bg-slate-50/70 transition ${isSelected ? "bg-brand-50/40" : ""}`}>
                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(st.id);
                          else next.delete(st.id);
                          setSelectedIds(next);
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                    </td>
                    <td className="p-2.5 text-center font-mono font-bold text-slate-400 text-[11px]">{noUrut}</td>
                    <td className="p-2.5 text-center">
                      {(st as any).photo ? (
                        <img
                          src={(st as any).photo}
                          alt={st.name}
                          className="w-7 h-7 rounded-full object-cover mx-auto border border-slate-200"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xs font-bold">
                          {(st.name || "S").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 font-mono font-bold text-slate-700">
                      {st.nis ? (
                        st.nis
                      ) : (
                        <span className="text-rose-500 italic text-[11px] font-normal">NIS Kosong</span>
                      )}
                    </td>
                    <td className="p-2.5 font-semibold text-slate-800">{st.name}</td>
                    <td className="p-2.5 text-slate-600">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md font-medium text-[11px]">
                        {st.class_name || "-"}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-500">{st.section_name || "-"}</td>
                    <td className="p-2.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg border border-slate-200 font-mono text-[11px]">
                        <span className={`w-14 font-bold tracking-wider ${isPwdVisible ? "text-brand-700" : "text-slate-400"}`}>
                          {isPwdVisible ? pwd : "••••••"}
                        </span>
                        <button
                          type="button"
                          onClick={() => setVisiblePasswords({ ...visiblePasswords, [st.id]: !isPwdVisible })}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          title={isPwdVisible ? "Sembunyikan Password" : "Tampilkan Password"}
                        >
                          <i className={`fa-solid ${isPwdVisible ? "fa-eye-slash text-brand-600" : "fa-eye"} text-xs`}></i>
                        </button>
                      </div>
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(st)}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Edit Data Siswa"
                        >
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(st)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Hapus Siswa"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Tidak ada data siswa yang cocok dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          perPage={perPage}
          itemLabel="siswa"
          onPageChange={setCurrentPage}
        />
      </div>

      {/* ================= MODAL: TAMBAH / EDIT SISWA ================= */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[95] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                  <i className="fa-solid fa-user-plus text-xs"></i>
                </div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {editingStudent ? "Ubah Data Siswa" : "Tambah Siswa Baru"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3.5 text-xs">
                {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">{error}</div>}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Induk Siswa (NIS) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={form.nis}
                    onChange={(e) => setForm({ ...form, nis: e.target.value })}
                    placeholder="Contoh: 10245"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Lengkap Siswa <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Contoh: Ahmad Fauzi"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Kelas <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.className}
                      onChange={(e) => setForm({ ...form, className: e.target.value })}
                      placeholder="Contoh: 7A"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
                    <input
                      type="text"
                      value={form.sectionName}
                      onChange={(e) => setForm({ ...form, sectionName: e.target.value })}
                      placeholder="Contoh: 2026/2027"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {editingStudent ? "Password Baru (Kosongkan jika tidak diubah)" : "Password Siswa (Opsional)"}
                  </label>
                  <input
                    type="text"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Kode akses ujian..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none text-xs font-mono"
                  />
                </div>

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">
                    <i className="fa-solid fa-shield-halved text-brand-600 mr-1"></i> Keamanan Password Login:
                  </p>
                  <p>
                    Password acak (6 digit angka & huruf) akan dibuat otomatis oleh sistem dan dapat dilihat langsung pada tabel data siswa.
                  </p>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <i className="fa-solid fa-check"></i> <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: IMPORT DATA SISWA EXCEL ================= */}
      {importModalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[95] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <i className="fa-solid fa-file-excel text-xs"></i>
                </div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Import Data Siswa Massal
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3.5 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <p className="font-bold text-emerald-900">Format File Excel yang Didukung:</p>
                <p className="text-emerald-800 text-[11px] leading-relaxed">
                  Sistem otomatis mendeteksi <strong>Template Standar</strong> (kolom <code>No Induk</code>, <code>Nama</code>, <code>Kelas</code>, <code>Tahun Ajaran</code>) maupun berkas <strong>Buku Presensi / Absensi Kelas</strong> resmi sekolah.
                </p>
                <button
                  type="button"
                  onClick={downloadStudentTemplate}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <i className="fa-solid fa-download"></i> Unduh Template Excel Standar
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih File Excel (.xlsx, .xls) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 border border-slate-200 rounded-xl p-1 bg-white cursor-pointer"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-xl font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={processStudentImport}
                disabled={busy || !importFile}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <i className={`fa-solid ${busy ? "fa-spinner fa-spin" : "fa-upload"}`}></i>
                <span>{busy ? "Mengimpor..." : "Mulai Import"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[100] p-3.5 rounded-xl shadow-xl bg-slate-900 text-white flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <i className="fa-solid fa-circle-check text-emerald-400"></i>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
