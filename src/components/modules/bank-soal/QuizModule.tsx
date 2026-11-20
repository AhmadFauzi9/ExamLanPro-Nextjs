"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Quiz, Question, Student, TimeExtensionReq, AuditLog, BackupFile, apiJson, escapeHtml } from "@/types/teacher";
import { TablePagination } from "@/components/common/TablePagination";
import { appAlert, appConfirm } from "@/components/common/AppDialog";
import { QUIZ_CARD_THEMES, getQuestionTypeBadge, downloadExcelTemplate, downloadWordTextTemplate } from "./templates";

export function QuizModule({
  rows,
  reload,
}: {
  rows: Quiz[];
  reload: () => Promise<void>;
}) {
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [quizDetail, setQuizDetail] = useState<{ quiz: Quiz; questions: Question[] } | null>(null);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close open modals on Escape key
  useEffect(() => {
    if (!modalOpen && !quizDetail && !questionModalOpen && !importModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (questionModalOpen) {
          setQuestionModalOpen(false);
        } else if (quizDetail) {
          setQuizDetail(null);
        } else if (modalOpen) {
          setModalOpen(false);
        } else if (importModalOpen) {
          setImportModalOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, quizDetail, questionModalOpen, importModalOpen]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const isAnyOpen = Boolean(modalOpen || quizDetail || questionModalOpen || importModalOpen);
    if (isAnyOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [modalOpen, quizDetail, questionModalOpen, importModalOpen]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const subjects = useMemo(() => Array.from(new Set(rows.map((r) => r.subject))).filter(Boolean).sort(), [rows]);
  const classes = useMemo(() => Array.from(new Set(rows.map((r) => r.class_name))).filter(Boolean).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const matchSubject = filterSubject === "all" || r.subject === filterSubject;
      const matchClass = filterClass === "all" || r.class_name === filterClass;
      const matchStatus = filterStatus === "all" || (filterStatus === "ACTIVE" ? r.status === "PUBLISHED" : r.status !== "PUBLISHED");
      const matchSearch =
        !search ||
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.subject.toLowerCase().includes(search.toLowerCase()) ||
        r.exam_token.toLowerCase().includes(search.toLowerCase());
      return matchSubject && matchClass && matchStatus && matchSearch;
    });
  }, [rows, filterSubject, filterClass, filterStatus, search]);

  // Quiz Form State
  const blankForm = {
    title: "",
    quizType: "mixed",
    subject: "",
    className: "",
    maxQuestions: 0,
    durationMinutes: 60,
    kkm: 75,
    token: "",
    pinAutoRefresh: true,
    status: "PUBLISHED",
    reviewEnabled: false,
    startAt: "",
    endAt: "",
    description: "",
    importFile: null as File | null,
  };
  const [quizForm, setQuizForm] = useState(blankForm);

  function toLocalDatetimeString(dateInput?: string | Date | null): string {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function generateQuizToken() {
    const randomToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    setQuizForm((prev) => ({ ...prev, token: randomToken }));
  }

  function openCreateQuiz() {
    setEditingQuiz(null);
    const randomToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    setQuizForm({
      ...blankForm,
      token: randomToken,
      startAt: "",
      endAt: "",
    });
    setModalOpen(true);
    setError("");
  }

  function openEditQuiz(q: Quiz) {
    setEditingQuiz(q);
    const startStr = toLocalDatetimeString(q.start_at);
    const endStr = toLocalDatetimeString(q.end_at);
    setQuizForm({
      title: q.title,
      quizType: (q as any).quiz_type || "mixed",
      subject: q.subject,
      className: q.class_name,
      maxQuestions: (q as any).max_questions ? Number((q as any).max_questions) : 0,
      durationMinutes: Number(q.duration_minutes || 60),
      kkm: Number(q.kkm || 75),
      token: q.exam_token,
      pinAutoRefresh: true,
      status: q.status,
      reviewEnabled: Boolean(q.review_enabled),
      startAt: startStr,
      endAt: endStr,
      description: q.description || "",
      importFile: null,
    });
    setModalOpen(true);
    setError("");
  }

  async function handleSaveQuiz(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const startAtVal = quizForm.startAt && quizForm.startAt.trim() && !isNaN(new Date(quizForm.startAt).getTime())
        ? new Date(quizForm.startAt).toISOString()
        : null;
      const endAtVal = quizForm.endAt && quizForm.endAt.trim() && !isNaN(new Date(quizForm.endAt).getTime())
        ? new Date(quizForm.endAt).toISOString()
        : null;

      if (startAtVal && endAtVal && new Date(endAtVal) <= new Date(startAtVal)) {
        setError("Waktu selesai harus setelah waktu mulai.");
        setBusy(false);
        return;
      }

      const payload = {
        title: quizForm.title,
        quiz_type: quizForm.quizType,
        subject: quizForm.subject,
        className: quizForm.className,
        max_questions: Number(quizForm.maxQuestions) || 0,
        maxQuestions: Number(quizForm.maxQuestions) || 0,
        durationMinutes: Number(quizForm.durationMinutes),
        kkm: Number(quizForm.kkm),
        token: quizForm.token.toUpperCase().trim(),
        status: quizForm.status,
        reviewEnabled: quizForm.reviewEnabled,
        startAt: startAtVal,
        endAt: endAtVal,
        description: quizForm.description,
      };

      let savedQuizId: number | null = null;
      if (editingQuiz) {
        await apiJson(
          await fetch(`/api/admin/quizzes/${editingQuiz.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
        savedQuizId = editingQuiz.id;
        showToast("Paket kuis berhasil diperbarui.");
      } else {
        const created = await apiJson(
          await fetch("/api/admin/quizzes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        );
        savedQuizId = created?.id;
        showToast("Paket kuis baru berhasil dibuat.");
      }

      // If user provided a file to import directly from quiz modal
      if (savedQuizId && quizForm.importFile) {
        const form = new FormData();
        form.set("file", quizForm.importFile);
        form.set("quizId", String(savedQuizId));
        try {
          const res = await apiJson(await fetch("/api/admin/import/questions", { method: "POST", body: form }));
          showToast(`Paket dibuat & berhasil mengimpor ${res.imported || 0} butir soal.`);
        } catch (err: any) {
          void appAlert("Paket tersimpan, namun import soal gagal: " + (err.message || ""), "Peringatan");
        }
      }

      setModalOpen(false);
      await reload();
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan paket kuis.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteQuiz(q: Quiz) {
    if (
      !(await appConfirm(
        `Hapus paket kuis "${q.title}"? Seluruh butir soal di dalamnya akan terhapus.`,
        "Hapus Paket Kuis",
        "Batal",
        "Hapus"
      ))
    )
      return;
    try {
      await apiJson(await fetch(`/api/admin/quizzes/${q.id}`, { method: "DELETE" }));
      showToast("Paket kuis berhasil dihapus.");
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menghapus kuis.", "Error");
    }
  }

  async function toggleReview(q: Quiz) {
    const nextState = !q.review_enabled;
    try {
      await apiJson(
        await fetch(`/api/admin/quizzes/${q.id}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: nextState }),
        })
      );
      showToast(nextState ? "Pembahasan diaktifkan untuk siswa." : "Pembahasan disembunyikan dari siswa.");
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal mengubah status pembahasan.", "Error");
    }
  }

  // Question Management
  async function openQuestionManager(q: Quiz) {
    setBusy(true);
    try {
      const data = await apiJson(await fetch(`/api/admin/quizzes/${q.id}`));
      setQuizDetail(data);
    } catch (err: any) {
      await appAlert(err.message || "Gagal memuat butir soal.", "Error");
    } finally {
      setBusy(false);
    }
  }

  // Interactive Question Form State
  const blankQuestion = {
    position: 1,
    type: "mc",
    content: "",
    passage: "",
    imageUrl: "",
    optionsMC: ["", "", "", ""],
    correctMC: 0,
    optionsComplex: ["", "", "", ""],
    correctComplex: [0],
    matchingPairs: [
      { premise: "Pernyataan 1", target: "Pasangan 1" },
      { premise: "Pernyataan 2", target: "Pasangan 2" },
      { premise: "Pernyataan 3", target: "Pasangan 3" },
    ],
    ceStatement: "",
    ceReason: "",
    ceKey: "both_correct_connected",
    shortAnswerKey: "",
    essayRubric: "",
    scaledOptions: [
      { text: "Sangat Tidak Setuju / Buruk", score: 1 },
      { text: "Tidak Setuju / Cukup", score: 2 },
      { text: "Ragu-ragu / Netral", score: 3 },
      { text: "Setuju / Baik", score: 4 },
      { text: "Sangat Setuju / Sangat Baik", score: 5 },
    ],
    explanation: "",
    points: 1,
  };
  const [questionForm, setQuestionForm] = useState(blankQuestion);

  function openAddQuestion() {
    setEditingQuestion(null);
    setQuestionForm({
      ...blankQuestion,
      position: (quizDetail?.questions?.length || 0) + 1,
    });
    setQuestionModalOpen(true);
  }

  function openEditQuestion(q: Question) {
    setEditingQuestion(q);
    const qType = q.type || "mc";

    let optMC = ["", "", "", ""];
    let corMC = 0;
    let optComplex = ["", "", "", ""];
    let corComplex = [0];
    let pairs = [
      { premise: "Pernyataan 1", target: "Pasangan 1" },
      { premise: "Pernyataan 2", target: "Pasangan 2" },
      { premise: "Pernyataan 3", target: "Pasangan 3" },
    ];
    let ceStmt = "";
    let ceRsn = "";
    let ceK = "both_correct_connected";
    let saKey = "";
    let esRub = "";
    let scOpts = blankQuestion.scaledOptions;

    if (qType === "mc" || qType === "case_analysis") {
      if (Array.isArray(q.options)) {
        optMC = [...q.options];
        while (optMC.length < 4) optMC.push("");
      }
      corMC = Number(q.answer_key ?? 0);
    } else if (qType === "complex") {
      if (Array.isArray(q.options)) {
        optComplex = [...q.options];
        while (optComplex.length < 4) optComplex.push("");
      }
      corComplex = Array.isArray(q.answer_key) ? q.answer_key.map(Number) : [0];
    } else if (qType === "matching") {
      if (Array.isArray(q.options)) {
        pairs = q.options.map((item: any) => {
          if (typeof item === "object" && item.premise) return item;
          if (typeof item === "string") {
            const parts = item.split("=");
            return { premise: parts[0] || "", target: parts[1] || "" };
          }
          return { premise: "", target: "" };
        });
      }
    } else if (qType === "cause_effect") {
      ceStmt = q.content || "";
      ceRsn = q.passage || "";
      ceK = String(q.answer_key || "both_correct_connected");
    } else if (qType === "short_answer") {
      saKey = String(q.answer_key || "");
    } else if (qType === "essay") {
      esRub = String(q.answer_key || "");
    } else if (qType === "scaled") {
      if (Array.isArray(q.options) && q.options.length) {
        scOpts = q.options;
      }
    }

    setQuestionForm({
      position: q.position ?? 1,
      type: qType,
      content: q.content || "",
      passage: q.passage || "",
      imageUrl: q.image_url || "",
      optionsMC: optMC,
      correctMC: corMC,
      optionsComplex: optComplex,
      correctComplex: corComplex,
      matchingPairs: pairs,
      ceStatement: ceStmt,
      ceReason: ceRsn,
      ceKey: ceK,
      shortAnswerKey: saKey,
      essayRubric: esRub,
      scaledOptions: scOpts,
      explanation: q.explanation || "",
      points: Number(q.points || 1),
    });
    setQuestionModalOpen(true);
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!quizDetail) return;
    setBusy(true);
    try {
      let finalOptions: any = null;
      let finalAnswerKey: any = null;
      let finalContent = questionForm.content;
      let finalPassage = questionForm.passage || undefined;

      const t = questionForm.type;
      if (t === "mc") {
        finalOptions = questionForm.optionsMC.filter(Boolean);
        finalAnswerKey = Number(questionForm.correctMC);
      } else if (t === "complex") {
        finalOptions = questionForm.optionsComplex.filter(Boolean);
        finalAnswerKey = questionForm.correctComplex;
      } else if (t === "matching") {
        finalOptions = questionForm.matchingPairs;
        finalAnswerKey = questionForm.matchingPairs.map((p, idx) => ({ from: idx, to: idx }));
      } else if (t === "cause_effect") {
        finalContent = questionForm.ceStatement || questionForm.content;
        finalPassage = questionForm.ceReason;
        finalAnswerKey = questionForm.ceKey;
      } else if (t === "case_analysis") {
        finalOptions = questionForm.optionsMC.filter(Boolean);
        finalAnswerKey = Number(questionForm.correctMC);
        finalPassage = questionForm.passage;
      } else if (t === "short_answer") {
        finalAnswerKey = questionForm.shortAnswerKey;
      } else if (t === "essay") {
        finalAnswerKey = questionForm.essayRubric;
      } else if (t === "scaled") {
        finalOptions = questionForm.scaledOptions;
        finalAnswerKey = 0;
      }

      await apiJson(
        await fetch(`/api/admin/quizzes/${quizDetail.quiz.id}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingQuestion?.id,
            position: questionForm.position,
            type: questionForm.type,
            content: finalContent,
            passage: finalPassage,
            imageUrl: questionForm.imageUrl || undefined,
            options: finalOptions,
            answerKey: finalAnswerKey,
            explanation: questionForm.explanation,
            points: Number(questionForm.points),
          }),
        })
      );

      setQuestionModalOpen(false);
      showToast("Butir soal berhasil disimpan.");
      await openQuestionManager(quizDetail.quiz);
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menyimpan soal.", "Error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteQuestion(q: Question) {
    if (
      !(await appConfirm(
        `Hapus butir soal nomor ${q.position}?`,
        "Hapus Soal",
        "Batal",
        "Hapus"
      ))
    )
      return;
    try {
      await apiJson(await fetch(`/api/admin/questions/${q.id}`, { method: "DELETE" }));
      showToast("Soal berhasil dihapus.");
      if (quizDetail) await openQuestionManager(quizDetail.quiz);
      await reload();
    } catch (err: any) {
      await appAlert(err.message || "Gagal menghapus soal.", "Error");
    }
  }

  // Matching row handlers
  function addMatchingRow() {
    setQuestionForm((prev) => ({
      ...prev,
      matchingPairs: [...prev.matchingPairs, { premise: "", target: "" }],
    }));
  }

  function removeMatchingRow(idx: number) {
    setQuestionForm((prev) => ({
      ...prev,
      matchingPairs: prev.matchingPairs.filter((_, i) => i !== idx),
    }));
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Page Header Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center text-lg font-bold shrink-0">
            <i className="fa-solid fa-folder-plus"></i>
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm sm:text-base leading-tight">Bank Soal & Paket Kuis</h2>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{rows.length} paket kuis terdaftar</p>
          </div>
        </div>
      </div>

      {/* Search & Filters Toolbar Card */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none max-w-[160px]"
            title="Filter Mata Pelajaran"
          >
            <option value="all">Mapel</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none max-w-[150px]"
            title="Filter Kelas"
          >
            <option value="all">Kelas</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                Kelas {c}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 outline-none"
            title="Filter Status"
          >
            <option value="all">Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="DRAFT">Draf</option>
          </select>

          <div className="relative min-w-[180px] sm:min-w-[220px] max-w-xs flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400"></i>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari judul kuis, mapel, kelas, atau token..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none text-xs text-slate-800 transition"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={openCreateQuiz}
            className="btn-icon bg-brand-600 hover:bg-brand-700 text-white shadow-2xs transition cursor-pointer flex items-center justify-center"
            title="Tambah Paket Kuis"
          >
            <i className="fa-solid fa-plus text-xs"></i>
          </button>
          <button
            type="button"
            onClick={() => reload()}
            className="btn-icon border border-slate-300 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center justify-center"
            title="Muat Ulang Paket Kuis"
          >
            <i className="fa-solid fa-rotate text-xs"></i>
          </button>
        </div>
      </div>

      {/* Quiz Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((q, idx) => {
          const themeIdx = rows.findIndex((item) => item.id === q.id);
          const theme = QUIZ_CARD_THEMES[(themeIdx >= 0 ? themeIdx : idx) % QUIZ_CARD_THEMES.length];
          const qCount = q.question_count || 0;
          const isDraft = q.status === "DRAFT";
          const statusBadge = isDraft ? (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200">
              DRAF
            </span>
          ) : (
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
              AKTIF
            </span>
          );

          const maxQ = (q as any).max_questions && Number((q as any).max_questions) > 0 ? Number((q as any).max_questions) : 0;
          const isSubset = maxQ > 0 && maxQ < qCount;
          const activeCount = isSubset ? maxQ : qCount;
          const typeName = "Campuran 5 Bentuk";

          const remaining = Math.max(0, 600 - (Math.floor(nowSec) % 600));
          const mins = Math.floor(remaining / 60);
          const secs = remaining % 60;
          const timerStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

          return (
            <div
              key={q.id}
              className={`${theme.bg} ${theme.border} ${theme.hoverBorder} rounded-2xl border shadow-2xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between space-y-3.5 group`}
            >
              {/* Top: Badges & Judul */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`text-[11px] font-bold ${theme.btnText} bg-white px-2.5 py-0.5 rounded-lg border border-white/80 shadow-2xs truncate max-w-[150px]`}
                      title={q.subject || "Umum"}
                    >
                      {q.subject || "Umum"}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700 bg-white/95 px-2 py-0.5 rounded-lg border border-white/80 shadow-2xs">
                      {q.class_name ? `Kelas ${q.class_name}` : "Semua Kelas"}
                    </span>
                  </div>
                  {statusBadge}
                </div>

                <div>
                  <h3
                    className="font-bold text-white text-sm sm:text-[15px] leading-snug line-clamp-2 transition"
                    title={q.title}
                  >
                    {q.title}
                  </h3>
                  <p className="text-[11px] text-white/80 mt-1 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-white/90 font-medium">
                      <i className="fa-solid fa-shapes text-white/70 text-[10px]"></i> {typeName}
                    </span>
                  </p>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-white rounded-xl p-3 border border-white/40 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-8 h-8 rounded-lg ${
                        isSubset ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"
                      } flex items-center justify-center text-xs font-bold shrink-0`}
                    >
                      <i className={`fa-solid ${isSubset ? "fa-shuffle" : "fa-list-check"}`}></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-800 text-xs">
                          {activeCount} <span className="text-slate-400 font-normal">/</span> {qCount} Soal
                        </span>
                        {isSubset ? (
                          <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.2 rounded-md">
                            Acak
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.2 rounded-md">
                            Semua
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight truncate">
                        {isSubset ? `${activeCount} soal acak dari ${qCount} soal` : `${qCount} soal dikerjakan`}
                      </p>
                    </div>
                  </div>

                  <div className="flex text-right border-l pl-2.5 border-slate-200/70 items-center justify-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                      <i className="fa-solid fa-clock text-[10px]"></i>
                    </div>
                    <div className="flex-1">
                      <span className="font-extrabold text-slate-800 text-xs">{q.duration_minutes || 60} menit</span>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-tight truncate">Durasi</p>
                    </div>
                  </div>
                </div>

                {/* Token Siswa */}
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-1 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                    <i className="fa-solid fa-shield-halved text-[10px] text-slate-400"></i> Token Siswa:
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-lg text-xs font-mono font-bold"
                    title="Token Akses Siswa (Otomatis berganti tiap 10 menit)"
                  >
                    <i className="fa-solid fa-key text-[10px] text-blue-600"></i>{" "}
                    <span className="tracking-widest font-black">{q.exam_token}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(q.exam_token);
                        showToast(`Token ${q.exam_token} disalin.`);
                      }}
                      className="p-0.5 text-blue-600 hover:text-blue-900 transition focus:outline-none cursor-pointer"
                      title="Salin Token"
                    >
                      <i className="fa-regular fa-copy"></i>
                    </button>
                    <span
                      className="ml-1 pl-1.5 border-l border-blue-200 text-[10px] font-semibold text-blue-600 flex items-center gap-1 font-sans"
                      title="Sisa waktu sebelum token otomatis berubah"
                    >
                      <i className="fa-regular fa-clock text-[9px]"></i>
                      <span>{timerStr}</span>
                    </span>
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-1 flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={() => openQuestionManager(q)}
                  className={`flex-1 btn-compact py-2 bg-white hover:bg-slate-50 ${theme.btnText} border border-white/80 rounded-xl flex items-center justify-center gap-1.5 font-bold transition text-xs shadow-2xs cursor-pointer`}
                >
                  <i className="fa-solid fa-list-check text-xs"></i> <span>Kelola Soal ({qCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => openEditQuiz(q)}
                  className="p-2 w-[36px] h-[36px] bg-white text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition cursor-pointer flex items-center justify-center"
                  title="Edit Paket Kuis"
                >
                  <i className="fa-solid fa-pen text-xs"></i>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteQuiz(q)}
                  className="p-2 w-[36px] h-[36px] bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition cursor-pointer flex items-center justify-center"
                  title="Hapus Paket Kuis"
                >
                  <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
            <i className="fa-solid fa-folder-open text-3xl mb-2 text-slate-300"></i>
            <p className="text-xs">Tidak ada paket kuis yang cocok dengan filter pencarian.</p>
          </div>
        )}
      </div>

      {/* ================= MODAL 1: BUAT / EDIT PAKET KUIS ================= */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-lg sm:max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center text-lg font-bold">
                  <i className="fa-solid fa-folder-plus"></i>
                </div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                  {editingQuiz ? "Edit Paket Kuis" : "Buat Paket Kuis Baru"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
                title="Tutup Modal"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveQuiz} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-7 space-y-3.5 text-xs">
                {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Judul Paket Ujian / Kuis <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quizForm.title}
                    onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                    placeholder="Contoh: Asesmen Sumatif Akhir Semester Informatika"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Jenis Soal <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={quizForm.quizType}
                      onChange={(e) => setQuizForm({ ...quizForm, quizType: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs bg-white"
                    >
                      <option value="">Pilih Jenis Soal</option>
                      <option value="mc">1. Pilihan Ganda (mc)</option>
                      <option value="complex">2. Pilihan Ganda Kompleks (complex)</option>
                      <option value="cause_effect">3. Sebab Akibat (cause_effect)</option>
                      <option value="case_analysis">4. Analisis Kasus (case_analysis)</option>
                      <option value="matching">5. Menjodohkan (matching)</option>
                      <option value="essay">6. Uraian / Esai (essay)</option>
                      <option value="mixed">Campuran (Kombinasi Soal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Status Publikasi</label>
                    <select
                      value={quizForm.status}
                      onChange={(e) => setQuizForm({ ...quizForm, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs bg-white"
                    >
                      <option value="PUBLISHED">Aktif (Tampil ke Siswa)</option>
                      <option value="DRAFT">Draf (Disembunyikan)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1" title="Berapa banyak soal yang dikerjakan siswa dari total soal di bank">
                      Soal Dikerjakan
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quizForm.maxQuestions || ""}
                      onChange={(e) => setQuizForm({ ...quizForm, maxQuestions: Number(e.target.value) || 0 })}
                      placeholder="0 = Semua Soal"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                      title="Jumlah soal yang akan dikerjakan siswa (misal 25 dari 50 soal). Kosongkan atau isi 0 untuk mengerjakan seluruh soal."
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Durasi (Menit) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={360}
                      required
                      value={quizForm.durationMinutes}
                      onChange={(e) => setQuizForm({ ...quizForm, durationMinutes: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Mata Pelajaran</label>
                    <input
                      type="text"
                      value={quizForm.subject}
                      onChange={(e) => setQuizForm({ ...quizForm, subject: e.target.value })}
                      placeholder="Contoh: Informatika"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kelas</label>
                    <input
                      type="text"
                      value={quizForm.className}
                      onChange={(e) => setQuizForm({ ...quizForm, className: e.target.value })}
                      placeholder="Contoh: 7, 8, 9"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Waktu Mulai</label>
                    <input
                      type="datetime-local"
                      value={quizForm.startAt}
                      onChange={(e) => setQuizForm({ ...quizForm, startAt: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Waktu Selesai</label>
                    <input
                      type="datetime-local"
                      value={quizForm.endAt}
                      onChange={(e) => setQuizForm({ ...quizForm, endAt: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 outline-none text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Deskripsi / Petunjuk Pengerjaan</label>
                  <textarea
                    rows={3}
                    value={quizForm.description}
                    onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                    placeholder="Tuliskan petunjuk pengerjaan ujian, ketentuan, atau catatan tambahan bagi siswa (opsional)..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs custom-scrollbar resize-y"
                  />
                </div>

                {/* Grid 2 Kotak Amber: Token Akses & Import Soal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Token Akses */}
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-amber-950 text-xs flex items-center gap-1.5">
                        <i className="fa-solid fa-key text-amber-600"></i>Token Akses Siswa
                      </label>
                      <button
                        type="button"
                        onClick={generateQuizToken}
                        className="btn-compact py-1 px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 rounded-lg shadow-2xs transition cursor-pointer"
                      >
                        <i className="fa-solid fa-arrows-rotate text-[10px]"></i>
                        <span>Acak Token</span>
                      </button>
                    </div>
                    <div>
                      <p className="text-[10px] pl-1 text-amber-900 font-medium mb-1">
                        Kosongkan jika tidak ingin menggunakan token.
                      </p>
                      <input
                        type="text"
                        maxLength={6}
                        value={quizForm.token}
                        onChange={(e) => setQuizForm({ ...quizForm, token: e.target.value.toUpperCase().slice(0, 6) })}
                        placeholder="KOSONG = Tanpa Token"
                        className="w-full px-3 py-1.5 rounded-lg border border-amber-300 font-mono font-bold tracking-widest text-slate-800 uppercase focus:ring-2 focus:ring-amber-500 outline-none text-xs bg-white"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] text-amber-800">
                      <label className="flex items-center gap-1.5 pl-1 cursor-pointer font-semibold select-none text-amber-900 shrink-0">
                        <input
                          type="checkbox"
                          checked={quizForm.pinAutoRefresh}
                          onChange={(e) => setQuizForm({ ...quizForm, pinAutoRefresh: e.target.checked })}
                          className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                        <span>Otomatis ganti tiap 10 menit</span>
                      </label>
                    </div>
                  </div>

                  {/* 2. Bagian Import Soal Massal */}
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block font-bold text-amber-950 text-xs flex items-center gap-1.5">
                        <i className="fa-solid fa-file-import text-amber-600"></i> Import Soal (Word / Excel)
                      </label>
                      <button
                        type="button"
                        onClick={() => setImportModalOpen(true)}
                        className="btn-compact py-1 px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 rounded-lg shadow-2xs transition cursor-pointer"
                        title="Buka dialog unduh template resmi Word & Excel"
                      >
                        <i className="fa-solid fa-download text-xs"></i>
                        <span>Template</span>
                      </button>
                    </div>
                    <div>
                      <p className="text-[10px] pl-1 text-amber-900 font-medium mb-1">
                        Soal Format (.docx, .doc, .xlsx)
                      </p>
                      <input
                        type="file"
                        accept=".docx, .doc, .xlsx, .xls, .csv, .txt"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setQuizForm({ ...quizForm, importFile: f });
                        }}
                        className="w-full text-xs text-slate-500 file:mr-2.5 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 border border-amber-200 rounded-xl p-1 bg-white cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer (Fixed at Bottom) */}
              <div className="px-5 py-3.5 sm:px-5 sm:py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-compact border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-compact bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {busy ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: KELOLA SOAL (QM DIALOG) ================= */}
      {quizDetail && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQuizDetail(null);
          }}
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm leading-tight">{quizDetail.quiz.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{(quizDetail.questions || []).length} soal terdaftar</p>
              </div>
              <button
                type="button"
                onClick={() => setQuizDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2 custom-scrollbar">
              {(quizDetail.questions || []).map((q, idx) => {
                const badge = getQuestionTypeBadge(q.type);
                return (
                  <div key={q.id || idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
                          No. {q.position || idx + 1}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {q.image_url && (
                          <span className="bg-sky-50 text-sky-700 text-[10px] px-1.5 py-0.5 rounded border border-sky-200 flex items-center gap-1">
                            <i className="fa-solid fa-image"></i> Ada Gambar
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditQuestion(q)}
                          className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Edit Soal"
                        >
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Hapus Soal"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-700 line-clamp-2 leading-relaxed">
                      {q.content || (q as any).question || "-"}
                    </p>
                  </div>
                );
              })}
              {(!quizDetail.questions || quizDetail.questions.length === 0) && (
                <div className="p-8 text-center text-slate-400">
                  <i className="fa-solid fa-file-circle-question text-3xl mb-2 text-slate-300"></i>
                  <p className="text-xs">Belum ada butir soal pada paket ini.</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-between items-center border-t">
              <button
                type="button"
                onClick={openAddQuestion}
                className="btn-compact bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <i className="fa-solid fa-plus text-xs"></i> <span>Tambah Soal</span>
              </button>
              <button
                type="button"
                onClick={() => setQuizDetail(null)}
                className="btn-compact border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: TAMBAH / EDIT BUTIR SOAL ================= */}
      {questionModalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[70] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQuestionModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
                  <i className="fa-solid fa-pen-to-square"></i>
                </div>
                <h3 className="font-bold text-slate-800 text-sm">
                  {editingQuestion ? "Edit Soal" : "Tambah Soal Baru"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuestionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bentuk / Tipe Soal <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={questionForm.type}
                    onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs bg-white font-bold text-slate-800"
                  >
                    <option value="mc">1. Pilihan Ganda (mc)</option>
                    <option value="complex">2. Pilihan Ganda Kompleks (complex)</option>
                    <option value="cause_effect">3. Sebab Akibat (cause_effect)</option>
                    <option value="case_analysis">4. Analisis Kasus (case_analysis)</option>
                    <option value="matching">5. Menjodohkan (matching)</option>
                    <option value="essay">6. Uraian / Esai (essay)</option>
                    <option value="short_answer">7. Isian Singkat (short_answer)</option>
                    <option value="scaled">8. Skala Likert (scaled)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lampiran Gambar (Opsional)</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const form = new FormData();
                      form.set("file", file);
                      try {
                        const res = await apiJson(await fetch("/api/admin/upload/question-image", { method: "POST", body: form }));
                        if (res.url) {
                          setQuestionForm((prev) => ({ ...prev, imageUrl: res.url }));
                          showToast("Gambar berhasil diunggah.");
                        }
                      } catch (err: any) {
                        void appAlert(err.message || "Gagal mengunggah gambar.", "Error");
                      }
                    }}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 border border-slate-200 rounded-xl p-1 cursor-pointer"
                  />
                </div>
              </div>

              {/* Preview Gambar */}
              {questionForm.imageUrl && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-700">
                      <i className="fa-solid fa-image text-brand-600 mr-1"></i> Preview Gambar:
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, imageUrl: "" })}
                      className="text-rose-600 hover:text-rose-800 font-bold text-[11px] cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can mr-1"></i> Hapus Gambar
                    </button>
                  </div>
                  <div className="flex justify-center bg-white p-2 rounded-lg border border-slate-100">
                    <img src={questionForm.imageUrl} alt="Preview Soal" className="max-h-40 object-contain rounded" />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pertanyaan / Instruksi Soal <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={questionForm.content}
                  onChange={(e) => setQuestionForm({ ...questionForm, content: e.target.value })}
                  placeholder={
                    questionForm.type === "cause_effect"
                      ? "Pengantar / petunjuk soal (opsional untuk Sebab-Akibat)..."
                      : questionForm.type === "case_analysis"
                      ? "Tuliskan pertanyaan spesifik terkait kasus di bawah..."
                      : questionForm.type === "essay"
                      ? "Tuliskan pertanyaan uraian / instruksi esai untuk siswa..."
                      : "Tuliskan teks pertanyaan..."
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                />
              </div>

              {/* Container Dinamis Berdasarkan Tipe Soal */}
              <div className="space-y-2 p-3 bg-slate-50/80 rounded-xl border border-slate-200">
                {/* 1. Multiple Choice (mc) */}
                {questionForm.type === "mc" && (
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700 mb-1">Pilihan Jawaban (Opsi A - D)</label>
                    {questionForm.optionsMC.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 text-xs w-4">{String.fromCharCode(65 + i)}.</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...questionForm.optionsMC];
                            next[i] = e.target.value;
                            setQuestionForm({ ...questionForm, optionsMC: next });
                          }}
                          required
                          placeholder={`Opsi ${String.fromCharCode(65 + i)}`}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none bg-white"
                        />
                        <input
                          type="radio"
                          name="correct_mc"
                          checked={questionForm.correctMC === i}
                          onChange={() => setQuestionForm({ ...questionForm, correctMC: i })}
                          required
                          title="Tandai Kunci Jawaban Benar"
                          className="text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. Complex Choice (complex) */}
                {questionForm.type === "complex" && (
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Pilihan Jawaban (Centang Satu atau Lebih Kunci Jawaban)
                    </label>
                    {questionForm.optionsComplex.map((opt, i) => {
                      const isChecked = questionForm.correctComplex.includes(i);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="font-bold text-slate-500 text-xs w-4">{String.fromCharCode(65 + i)}.</span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const next = [...questionForm.optionsComplex];
                              next[i] = e.target.value;
                              setQuestionForm({ ...questionForm, optionsComplex: next });
                            }}
                            required
                            placeholder={`Opsi ${String.fromCharCode(65 + i)}`}
                            className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none bg-white"
                          />
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...questionForm.correctComplex, i]
                                : questionForm.correctComplex.filter((idx) => idx !== i);
                              setQuestionForm({ ...questionForm, correctComplex: next });
                            }}
                            title="Tandai Kunci Jawaban"
                            className="text-brand-600 focus:ring-brand-500 rounded cursor-pointer"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3. Matching (matching) */}
                {questionForm.type === "matching" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block font-semibold text-slate-700 text-xs">
                        Pasangan Menjodohkan (Premis vs Target)
                      </label>
                      <button
                        type="button"
                        onClick={addMatchingRow}
                        className="btn-compact bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 font-bold cursor-pointer"
                      >
                        <i className="fa-solid fa-plus mr-1"></i> Tambah Pasangan
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">Urutan pilihan kanan akan diacak otomatis saat siswa mengerjakan.</p>
                    <div className="space-y-2">
                      {questionForm.matchingPairs.map((pair, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-500 text-xs w-5 text-center">{idx + 1}.</span>
                          <input
                            type="text"
                            value={pair.premise}
                            onChange={(e) => {
                              const next = [...questionForm.matchingPairs];
                              next[idx].premise = e.target.value;
                              setQuestionForm({ ...questionForm, matchingPairs: next });
                            }}
                            placeholder="Premis Kiri"
                            required
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none"
                          />
                          <span className="text-slate-400 font-bold">
                            <i className="fa-solid fa-arrows-left-right text-xs"></i>
                          </span>
                          <input
                            type="text"
                            value={pair.target}
                            onChange={(e) => {
                              const next = [...questionForm.matchingPairs];
                              next[idx].target = e.target.value;
                              setQuestionForm({ ...questionForm, matchingPairs: next });
                            }}
                            placeholder="Target Kanan (Benar)"
                            required
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeMatchingRow(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                            title="Hapus Baris"
                          >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Cause Effect (cause_effect) */}
                {questionForm.type === "cause_effect" && (
                  <div className="space-y-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Teks Pernyataan (Utama)</label>
                      <input
                        type="text"
                        value={questionForm.ceStatement}
                        onChange={(e) => setQuestionForm({ ...questionForm, ceStatement: e.target.value })}
                        placeholder="Pernyataan utama..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Teks Alasan (Sebab/Akibat)</label>
                      <input
                        type="text"
                        value={questionForm.ceReason}
                        onChange={(e) => setQuestionForm({ ...questionForm, ceReason: e.target.value })}
                        placeholder="Alasan..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Kunci Hubungan</label>
                      <select
                        value={questionForm.ceKey}
                        onChange={(e) => setQuestionForm({ ...questionForm, ceKey: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                      >
                        <option value="both_correct_connected">Keduanya benar & berhubungan</option>
                        <option value="both_correct_not_connected">Keduanya benar, tidak berhubungan</option>
                        <option value="statement_true_reason_false">Pernyataan BENAR, Alasan SALAH</option>
                        <option value="statement_false_reason_true">Pernyataan SALAH, Alasan BENAR</option>
                        <option value="both_false">Keduanya SALAH</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 5. Case Analysis (case_analysis) */}
                {questionForm.type === "case_analysis" && (
                  <div className="space-y-2">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Teks Cerita / Kasus</label>
                      <textarea
                        rows={3}
                        value={questionForm.passage}
                        onChange={(e) => setQuestionForm({ ...questionForm, passage: e.target.value })}
                        placeholder="Teks studi kasus..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none bg-white"
                      />
                    </div>
                    <label className="block font-semibold text-slate-700 mb-1">Opsi Jawaban Kasus</label>
                    {questionForm.optionsMC.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-bold text-slate-500 text-xs w-4">{String.fromCharCode(65 + i)}.</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const next = [...questionForm.optionsMC];
                            next[i] = e.target.value;
                            setQuestionForm({ ...questionForm, optionsMC: next });
                          }}
                          required
                          placeholder={`Opsi ${String.fromCharCode(65 + i)}`}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs outline-none bg-white"
                        />
                        <input
                          type="radio"
                          name="correct_case"
                          checked={questionForm.correctMC === i}
                          onChange={() => setQuestionForm({ ...questionForm, correctMC: i })}
                          required
                          className="text-brand-600 cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* 6. Short Answer (short_answer) */}
                {questionForm.type === "short_answer" && (
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-700">Kunci Jawaban Isian Singkat</label>
                    <input
                      type="text"
                      value={questionForm.shortAnswerKey}
                      onChange={(e) => setQuestionForm({ ...questionForm, shortAnswerKey: e.target.value })}
                      placeholder="Contoh: Jakarta|DKI Jakarta"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    />
                    <p className="text-[10px] text-slate-500">
                      Gunakan tanda pipa <code>|</code> untuk beberapa variasi jawaban (tidak sensitif huruf besar/kecil).
                    </p>
                  </div>
                )}

                {/* 7. Essay (essay) */}
                {questionForm.type === "essay" && (
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-700">
                      Pedoman Jawaban / Rubrik Penilaian Guru (Opsional)
                    </label>
                    <textarea
                      rows={3}
                      value={questionForm.essayRubric}
                      onChange={(e) => setQuestionForm({ ...questionForm, essayRubric: e.target.value })}
                      placeholder="Tuliskan poin-poin jawaban yang diharapkan atau pedoman penskoran..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    />
                    <p className="text-[10px] text-slate-500">Siswa akan menjawab soal ini dalam bentuk paragraf teks uraian bebas.</p>
                  </div>
                )}

                {/* 8. Scaled Likert (scaled) */}
                {questionForm.type === "scaled" && (
                  <div className="space-y-2">
                    <label className="block font-semibold text-slate-700 mb-1">Skala Likert (Poin Nilai)</label>
                    {questionForm.scaledOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => {
                            const next = [...questionForm.scaledOptions];
                            next[i].text = e.target.value;
                            setQuestionForm({ ...questionForm, scaledOptions: next });
                          }}
                          required
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                        />
                        <input
                          type="number"
                          min={1}
                          value={opt.score}
                          onChange={(e) => {
                            const next = [...questionForm.scaledOptions];
                            next[i].score = Number(e.target.value) || 1;
                            setQuestionForm({ ...questionForm, scaledOptions: next });
                          }}
                          required
                          className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-center bg-white"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pembahasan / Penjelasan (Opsional)</label>
                <textarea
                  rows={2}
                  value={questionForm.explanation}
                  onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                  placeholder="Penjelasan atau kunci pembahasan saat hasil dibuka..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 outline-none text-xs"
                />
              </div>

              </div>

              {/* Modal Footer (Fixed at Bottom) */}
              <div className="px-5 py-3.5 sm:px-5 sm:py-3 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuestionModalOpen(false)}
                  className="btn-compact border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-compact bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {busy ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: DOWNLOAD TEMPLATE & PANDUAN FORMAT ================= */}
      {importModalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[95] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg font-bold">
                  <i className="fa-solid fa-file-arrow-down"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">Download Template Soal & Panduan Format</h3>
                  <p className="text-[11px] text-slate-500">Mendukung Microsoft Word (.docx, .doc) dan Microsoft Excel (.xlsx)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Download Templates */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <i className="fa-solid fa-download text-amber-600"></i> Pilih Berkas Template Resmi untuk Diunduh:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={downloadWordTextTemplate}
                  className="btn-compact py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center justify-center gap-2 font-bold transition shadow-2xs cursor-pointer text-xs"
                >
                  <i className="fa-solid fa-file-word text-base text-blue-600"></i>
                  <span>Template Word (.doc)</span>
                </button>
                <button
                  type="button"
                  onClick={downloadExcelTemplate}
                  className="btn-compact py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center gap-2 font-bold transition shadow-2xs cursor-pointer text-xs"
                >
                  <i className="fa-solid fa-file-excel text-base text-emerald-600"></i>
                  <span>Template Excel (.xlsx)</span>
                </button>
              </div>
              <div className="text-[11px] text-slate-600 space-y-1.5 pt-2 border-t border-slate-200/80">
                <p className="font-bold text-slate-700 flex items-center gap-1">
                  <i className="fa-solid fa-circle-info text-brand-600"></i> Ketentuan Format Penulisan:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px] pl-1">
                  <li>
                    Mendukung seluruh bentuk soal: Pilihan Ganda (mc), Pilihan Ganda Kompleks (complex), Sebab Akibat (cause_effect), Analisis Kasus (case_analysis), Menjodohkan (matching), dan Uraian / Esai (essay).
                  </li>
                  <li>
                    Gambar dapat langsung disisipkan (paste) di dalam dokumen Word/Excel dan otomatis disimpan ke server.
                  </li>
                  <li>Pada dokumen Word, pisahkan setiap butir soal menggunakan tiga tanda strip (<code>---</code>).</li>
                </ul>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="btn-compact bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 cursor-pointer"
              >
                Tutup
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
