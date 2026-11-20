"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appAlert, appConfirm } from "@/components/common/AppDialog";

type QuizSummary = {
  id: number;
  title: string;
  subject: string;
  className: string;
  duration_minutes: number;
  question_count: number;
  start_at: string;
  end_at: string;
  kkm: number;
};

type Question = {
  id: number;
  type: string;
  content: string;
  passage?: string | null;
  image_url?: string | null;
  options?: any;
  points: number;
};

type Exam = {
  attemptId: string;
  title: string;
  subject: string;
  expiresAt: string;
  extraMinutes: number;
  questions: Question[];
  answers: Record<string, any>;
};

type ReviewItem = {
  position: number;
  type: string;
  content: string;
  options: any;
  studentAnswer: any;
  correctAnswer: any;
  isCorrect: boolean | null;
  awardedPoints: number;
  points: number;
  explanation?: string | null;
};

// Storage Keys matching ExamLANPro
const PENDING_EXAM_INFO_KEY = "examlan_pending_exam_info";
const ACTIVE_ATTEMPT_KEY = "examlan_active_attempt";
const STUDENT_SESSION_KEY = "examlan_student_session";

async function apiJson(res: Response) {
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Terjadi kesalahan pada permintaan.");
  return json.data;
}

export default function StudentPortal() {
  // Screens: 'login' | 'exam_info' | 'resume_screen' | 'quiz' | 'result'
  const [screen, setScreen] = useState<"login" | "exam_info" | "resume_screen" | "quiz" | "result">("login");

  // Initial Data
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [requirePassword, setRequirePassword] = useState(true);
  const [selectedQuizId, setSelectedQuizId] = useState<number | "">("");

  // Student Input
  const [nis, setNis] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [examToken, setExamToken] = useState("");
  const [resumeToken, setResumeToken] = useState("");

  // Exam Active State
  const [exam, setExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [saveStatus, setSaveStatus] = useState<string>("✓ Tersimpan");
  const [violationsCount, setViolationsCount] = useState(0);

  // Overlays
  const [showTimeoutOverlay, setShowTimeoutOverlay] = useState(false);
  const [showViolationOverlay, setShowViolationOverlay] = useState(false);
  const [showFullscreenRestoreOverlay, setShowFullscreenRestoreOverlay] = useState(false);
  const [showReloadConfirmModal, setShowReloadConfirmModal] = useState(false);
  const [extensionStatus, setExtensionStatus] = useState<string>("");

  // Result & Review
  const [result, setResult] = useState<{
    score: number;
    correct: number;
    wrong: number;
    percentage: number;
  } | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[] | null>(null);
  const [reviewEnabled, setReviewEnabled] = useState(false);

  // App Modal / Alert
  const [busy, setBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Lock body scroll and Escape key for reload confirmation modal
  useEffect(() => {
    if (!showReloadConfirmModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowReloadConfirmModal(false);
    };
    window.addEventListener("keydown", onKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = orig;
    };
  }, [showReloadConfirmModal]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNavigatingRef = useRef(false);

  function triggerToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  // 1. Initial Load: Quizzes & Settings
  const loadInitialData = useCallback(async () => {
    try {
      const data = await apiJson(await fetch("/api/student/quizzes", { cache: "no-store" }));
      if (data?.quizzes) {
        setQuizzes(data.quizzes);
        if (data.quizzes.length > 0) {
          setSelectedQuizId((prev) => prev || data.quizzes[0].id);
        }
      }
      if (data?.settings) {
        setRequirePassword(data.settings.require_student_password !== false);
      }
    } catch (e: any) {
      console.warn("Gagal memuat kuis:", e.message);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
    void (async () => {
      // Step A: Check if active attempt is in progress (resuming exam)
      try {
        const cur = await apiJson(await fetch("/api/exam/current", { cache: "no-store" }));
        if (cur?.attemptId && cur?.questions?.length) {
          try {
            const savedStr =
              typeof window !== "undefined"
                ? sessionStorage.getItem(PENDING_EXAM_INFO_KEY) ||
                  localStorage.getItem(PENDING_EXAM_INFO_KEY) ||
                  sessionStorage.getItem(STUDENT_SESSION_KEY)
                : null;
            if (savedStr) {
              const saved = JSON.parse(savedStr);
              if (saved?.nis) setNis(saved.nis);
              if (saved?.name) setStudentName(saved.name);
              if (saved?.classId) setStudentClass(saved.classId);
            }
          } catch {}
          setupExamData(cur);
          return;
        }
      } catch {
        // Belum ada sesi ujian aktif
      }

      // Step B: Check if student completed an exam and is on result screen
      try {
        const resultSessionStr =
          typeof window !== "undefined" ? sessionStorage.getItem(STUDENT_SESSION_KEY) : null;
        if (resultSessionStr) {
          const sess = JSON.parse(resultSessionStr);
          if (sess?.result && sess?.activeStudent) {
            setResult(sess.result);
            if (sess.reviews) {
              setReviews(sess.reviews);
              setReviewEnabled(true);
            }
            if (sess.activeStudent.nis) setNis(sess.activeStudent.nis);
            if (sess.activeStudent.name) setStudentName(sess.activeStudent.name);
            if (sess.activeStudent.classId) setStudentClass(sess.activeStudent.classId);
            if (sess.quizId) setSelectedQuizId(sess.quizId);
            setScreen("result");
            return;
          }
        }
      } catch {}

      // Step C: Check if student has pending exam info (logged in, at exam_info screen - matching ExamLANPro)
      try {
        const pendingStr =
          typeof window !== "undefined"
            ? sessionStorage.getItem(PENDING_EXAM_INFO_KEY) ||
              localStorage.getItem(PENDING_EXAM_INFO_KEY)
            : null;
        if (pendingStr) {
          const pending = JSON.parse(pendingStr);
          if (pending && pending.nis) {
            setNis(pending.nis || "");
            setStudentName(pending.name || "");
            setStudentClass(pending.classId || "");
            if (pending.quizId) {
              setSelectedQuizId(Number(pending.quizId));
            }
            setScreen("exam_info");
            return;
          }
        }
      } catch (e) {
        console.warn("Gagal memulihkan info ujian:", e);
      }
    })();
  }, [loadInitialData]);

  // 2. Auto-lookup student details when NIS is entered (length >= 3)
  async function handleNisLookup(typedNis: string) {
    setNis(typedNis);
    const cleaned = typedNis.replace(/[^0-9]/g, "").slice(0, 6);
    if (cleaned.length >= 3) {
      try {
        const student = await apiJson(await fetch(`/api/student/identity?nis=${encodeURIComponent(cleaned)}`));
        if (student) {
          setStudentName(student.name || "");
          setStudentClass(student.class_name || "");
        }
      } catch {
        // If not found yet, don't overwrite manual inputs
      }
    }
  }

  // 3. Login Action
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!nis) {
      void appAlert("Nomor Induk Siswa (NIS) wajib diisi.", "Validasi Gagal");
      return;
    }
    if (requirePassword && !password) {
      void appAlert("Kode Akses / Sandi Siswa wajib diisi.", "Validasi Gagal");
      return;
    }

    setBusy(true);
    try {
      const res = await apiJson(
        await fetch("/api/student/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nis,
            password: password || undefined,
            quizId: selectedQuizId || undefined,
            name: studentName,
            class: studentClass,
          }),
        })
      );

      const finalName = res.student?.name || studentName;
      const finalClass = res.student?.className || res.student?.class_name || studentClass;
      if (res.student) {
        setStudentName(finalName);
        setStudentClass(finalClass);
      }

      if (res.activeAttemptId) {
        // Has active attempt, prompt for resume or directly load
        const cur = await apiJson(await fetch("/api/exam/current"));
        if (cur) {
          setupExamData(cur);
          return;
        }
      }

      // Persist pending exam info so refreshing at exam_info preserves session (matching ExamLANPro)
      try {
        const info = {
          quizId: selectedQuizId,
          nis,
          name: finalName,
          classId: finalClass,
        };
        sessionStorage.setItem(PENDING_EXAM_INFO_KEY, JSON.stringify(info));
        localStorage.setItem(PENDING_EXAM_INFO_KEY, JSON.stringify(info));
      } catch {}

      setScreen("exam_info");
    } catch (err: any) {
      void appAlert(err.message || "Gagal masuk.", "Login Gagal");
    } finally {
      setBusy(false);
    }
  }

  // Clear Session & Return to Login
  function handleBackToLogin() {
    try {
      sessionStorage.removeItem(PENDING_EXAM_INFO_KEY);
      localStorage.removeItem(PENDING_EXAM_INFO_KEY);
      sessionStorage.removeItem(STUDENT_SESSION_KEY);
      localStorage.removeItem(STUDENT_SESSION_KEY);
      sessionStorage.removeItem(ACTIVE_ATTEMPT_KEY);
      localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
    } catch {}
    setScreen("login");
    setPassword("");
    setExamToken("");
    setStudentName("");
    setStudentClass("");
  }

  // 4. Start Exam with Token
  async function handleStartExam() {
    if (!examToken || examToken.length !== 6) {
      void appAlert("Masukkan 6 karakter Token Ujian dari guru pengawas.", "Token Belum Lengkap");
      return;
    }

    setBusy(true);
    try {
      const startRes = await apiJson(
        await fetch("/api/exam/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId: selectedQuizId,
            token: examToken.toUpperCase().trim(),
          }),
        })
      );

      localStorage.setItem("examlan_resume_token", startRes.resumeToken || "");
      try {
        sessionStorage.removeItem(PENDING_EXAM_INFO_KEY);
        localStorage.removeItem(PENDING_EXAM_INFO_KEY);
      } catch {}
      const current = await apiJson(await fetch("/api/exam/current"));
      setupExamData(current);

      // Attempt fullscreen
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      } catch {}
    } catch (err: any) {
      void appAlert(err.message || "Token tidak valid.", "Gagal Memulai Ujian");
    } finally {
      setBusy(false);
    }
  }

  function setupExamData(examData: Exam) {
    setExam(examData);
    setAnswers(examData.answers || {});
    setCurrentIndex(0);
    try {
      sessionStorage.removeItem(PENDING_EXAM_INFO_KEY);
      localStorage.removeItem(PENDING_EXAM_INFO_KEY);
    } catch {}
    setScreen("quiz");
  }

  // 5. Timer & Auto-Save
  useEffect(() => {
    if (!exam || screen !== "quiz") return;
    const expires = new Date(exam.expiresAt).getTime() + (exam.extraMinutes || 0) * 60000;
    const tick = () => {
      const diff = Math.max(0, Math.floor((expires - Date.now()) / 1000));
      setRemainingSeconds(diff);
      if (diff === 0) {
        setShowTimeoutOverlay(true);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [exam, screen]);

  // Answer handler
  function saveAnswer(questionId: number, val: any) {
    const updated = { ...answers, [questionId]: val };
    setAnswers(updated);
    setSaveStatus("⟳ Menyimpan…");

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await apiJson(
          await fetch("/api/exam/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              answers: [{ questionId, answer: val }],
            }),
          })
        );
        setSaveStatus("✓ Tersimpan");
      } catch {
        setSaveStatus("⚠ Tersimpan Lokal");
      }
    }, 400);
  }

  // 6. Anti-Cheat / Violation Listeners & Proctor Secret (Ctrl + C + B)
  const reportViolation = useCallback(async (type: string, detail?: string) => {
    if (isNavigatingRef.current) return;
    try {
      await fetch("/api/exam/violation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, detail }),
      });
      setViolationsCount((c) => c + 1);
      setShowViolationOverlay(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (screen !== "quiz") return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        reportViolation("TAB_HIDDEN", "Siswa berpindah tab atau meminimize browser.");
      }
    };

    const onBlur = () => {
      reportViolation("WINDOW_BLUR", "Fokus browser berpindah ke aplikasi lain.");
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setShowViolationOverlay(true);
      }
    };

    let lastCtrlCTime = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      // 1. Proctor Emergency Key: Ctrl + C + B (exact ExamLANPro 3000ms detection)
      if (e.ctrlKey) {
        if (e.key === "c" || e.key === "C") {
          lastCtrlCTime = Date.now();
          e.preventDefault();
          return;
        }
        if (e.key === "b" || e.key === "B") {
          if (Date.now() - lastCtrlCTime < 3000) {
            e.preventDefault();
            e.stopPropagation();
            lastCtrlCTime = 0;
            setShowViolationOverlay(false);
            setShowFullscreenRestoreOverlay(false);
            triggerToast("Kunci Mode Kiosk dibuka oleh pengawas (Ctrl + C + B).");
            return;
          }
        }
      }

      // 2. F5 or Ctrl+R live reload confirmation
      if (e.key === "F5" || (e.ctrlKey && (e.key === "r" || e.key === "R"))) {
        e.preventDefault();
        e.stopPropagation();
        setShowReloadConfirmModal(true);
        return;
      }

      // 3. Block common cheating shortcuts
      if (
        e.key === "F11" ||
        e.key === "F12" ||
        (e.ctrlKey && ["w", "W", "t", "T", "n", "N", "u", "U"].includes(e.key))
      ) {
        e.preventDefault();
        triggerToast("Pintasan tombol dibatasi selama ujian.");
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [screen, reportViolation]);

  // 7. Time Extension
  async function requestExtension() {
    setBusy(true);
    try {
      await apiJson(
        await fetch("/api/exam/extension", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            minutes: 15,
            reason: "Waktu ujian habis; siswa meminta tambahan waktu kepada pengawas.",
          }),
        })
      );
      setExtensionStatus("Permintaan perpanjangan waktu telah dikirimkan ke guru pengawas. Menunggu konfirmasi...");
    } catch (e: any) {
      setExtensionStatus("Gagal mengirim permintaan: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  // 8. Submit Quiz
  async function handleSubmitQuiz(force = false) {
    if (!force) {
      const totalQ = exam?.questions?.length || 0;
      const answeredQ = Object.keys(answers).length;
      if (answeredQ < totalQ) {
        const emptyIndices: number[] = [];
        (exam?.questions || []).forEach((_, idx) => {
          if (answers[idx] === undefined || answers[idx] === null || answers[idx] === "") {
            emptyIndices.push(idx + 1);
          }
        });

        const ok = await appConfirm(
          `Masih ada ${totalQ - answeredQ} soal yang belum dijawab.\n\nNomor soal kosong: ${emptyIndices.join(", ")}\n\nSemua jawaban wajib diisi sebelum ujian dapat dikumpulkan.`,
          "Jawaban Masih Kosong",
          "Kembali ke Soal",
          "Lihat Soal Kosong"
        );
        if (ok && emptyIndices.length > 0) {
          setCurrentIndex(emptyIndices[0] - 1);
        }
        return;
      } else {
        const ok = await appConfirm(
          "Semua soal sudah dijawab. Yakin ingin mengirimkan seluruh jawaban dan menyelesaikan ujian?",
          "Selesaikan Ujian",
          "Batal",
          "Kirim Jawaban"
        );
        if (!ok) return;
      }
    }

    setBusy(true);
    isNavigatingRef.current = true;
    try {
      const res = await apiJson(await fetch("/api/exam/submit", { method: "POST" }));
      const resultObj = {
        score: res.score || 0,
        correct: res.correct || 0,
        wrong: res.wrong || 0,
        percentage: Math.round(((res.correct || 0) / (exam?.questions?.length || 1)) * 100),
      };
      setResult(resultObj);

      // Check review
      let revData: ReviewItem[] | null = null;
      try {
        const rev = await apiJson(await fetch("/api/exam/review"));
        if (Array.isArray(rev) && rev.length > 0) {
          setReviews(rev);
          setReviewEnabled(true);
          revData = rev;
        } else {
          setReviewEnabled(false);
        }
      } catch {
        setReviewEnabled(false);
      }

      // Persist student result session (matching ExamLANPro)
      try {
        sessionStorage.removeItem(PENDING_EXAM_INFO_KEY);
        localStorage.removeItem(PENDING_EXAM_INFO_KEY);
        sessionStorage.removeItem(ACTIVE_ATTEMPT_KEY);
        localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
        sessionStorage.setItem(
          STUDENT_SESSION_KEY,
          JSON.stringify({
            result: resultObj,
            reviews: revData,
            quizId: selectedQuizId,
            activeStudent: { nis, name: studentName, classId: studentClass },
          })
        );
      } catch {}

      setScreen("result");
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      } catch {}
    } catch (err: any) {
      void appAlert(err.message || "Gagal mengumpulkan jawaban.", "Gagal Mengumpulkan");
    } finally {
      setBusy(false);
      isNavigatingRef.current = false;
    }
  }

  // Helper formatting
  const currentQuiz = quizzes.find((q) => q.id === selectedQuizId) || quizzes[0];
  const qList = exam?.questions || [];
  const currentQ = qList[currentIndex];
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 font-sans">
      {/* ================= MODULAR NAVBAR ================= */}
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
              <p className="text-xs text-slate-400">Sistem Evaluasi Lab Komputer Terintegrasi</p>
            </div>
          </div>

          {/* Student Profile Chip */}
          {studentName && screen !== "login" && (
            <div className="flex items-center gap-2.5 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-brand-600/30 border border-brand-500/40 text-brand-300 flex items-center justify-center font-bold text-xs shrink-0">
                <i className="fa-solid fa-user-graduate"></i>
              </div>
              <div className="text-left leading-tight min-w-0">
                <div className="font-bold text-xs sm:text-sm text-white truncate max-w-[130px] sm:max-w-[220px]">
                  {studentName}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 flex items-center justify-end gap-1.5 mt-0.5 font-mono">
                  <span className="text-brand-300 font-semibold">{nis}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-300 truncate max-w-[80px] sm:max-w-none">{studentClass || "-"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ================= MAIN CONTENT VIEW ================= */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col">
        {/* ================= 1. LOGIN SCREEN ================= */}
        {screen === "login" && (
          <div className="max-w-md mx-auto w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-100 mt-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-3 text-brand-600 text-2xl">
                <i className="fa-solid fa-id-card"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Login Peserta Ujian</h2>
              <p className="text-slate-500 text-sm mt-1">Masukkan identitas Anda untuk melanjutkan ke ujian</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 ml-1">
                  Pilih Paket Kuis / Ujian
                </label>
                <select
                  value={selectedQuizId}
                  onChange={(e) => setSelectedQuizId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm bg-white"
                  required
                >
                  {quizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} ({q.subject} - Kelas {q.className})
                    </option>
                  ))}
                  {quizzes.length === 0 && <option value="">Tidak ada paket kuis aktif</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 ml-1">
                  NIS (Nomor Induk Santri - Maks 6 Angka)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={nis}
                  onChange={(e) => handleNisLookup(e.target.value)}
                  placeholder="Contoh: 123456"
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 ml-1">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 ml-1">
                  Kelas & Bagian
                </label>
                <input
                  type="text"
                  required
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  placeholder="Contoh: 8A"
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm"
                />
              </div>

              {requirePassword && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1 ml-1">
                    Kode Akses / Sandi Siswa
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kode akses dari guru"
                      maxLength={12}
                      autoComplete="one-time-code"
                      className="w-full px-3 py-2 pr-11 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm font-mono tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 px-3.5 flex items-center text-slate-400 hover:text-slate-600"
                      title="Tampilkan/Sembunyikan Sandi"
                    >
                      <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"} text-sm`}></i>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    <i className="fa-solid fa-key text-slate-400 mr-1"></i> Kode akses diperoleh dari guru pengawas di Data Siswa.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full mt-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{busy ? "Memverifikasi..." : "Login"}</span>
                <i className="fa-solid fa-right-to-bracket text-sm"></i>
              </button>
            </form>
          </div>
        )}

        {/* ================= 2. EXAM INFO SCREEN ================= */}
        {screen === "exam_info" && (
          <div className="max-w-2xl mx-auto w-full bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-100 mt-4 sm:mt-6 animate-in fade-in duration-150">
            <div className="text-center mb-6 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-brand-600 text-2xl shadow-inner">
                <i className="fa-solid fa-clipboard-check"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Informasi Data Ujian</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Periksa kelengkapan data peserta dan masukkan Token Ujian dari guru pengawas
              </p>
            </div>

            {/* Details Box */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-200/80 mb-6 space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Nama Peserta</span>
                  <span className="font-bold text-slate-800 text-sm sm:text-base mt-0.5">{studentName}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Nomor Induk Siswa (NIS)</span>
                  <span className="font-mono font-bold text-slate-800 text-sm sm:text-base mt-0.5">{nis}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200/60">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Kelas & Bagian</span>
                  <span className="font-semibold text-slate-800 mt-0.5">{studentClass}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Tanggal Ujian</span>
                  <span className="font-semibold text-slate-800 mt-0.5">
                    {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60">
                <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Mata Pelajaran / Judul Ujian</span>
                <div className="font-bold text-brand-700 text-sm sm:text-base mt-0.5">
                  {currentQuiz?.title || "Ujian Terjadwal"}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200/60">
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Jumlah Soal & Durasi</span>
                  <span className="font-semibold text-slate-800 mt-0.5">
                    {currentQuiz?.question_count || 0} Soal • {currentQuiz?.duration_minutes || 60} Menit
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">KKM Kelulusan</span>
                  <span className="font-semibold text-emerald-700 mt-0.5">≥ {currentQuiz?.kkm || 75} Poin</span>
                </div>
              </div>
            </div>

            {/* Token Input Box */}
            <div className="bg-amber-50/80 border-2 border-amber-200/90 rounded-2xl p-5 mb-6 text-center">
              <div className="flex items-center justify-center gap-2 text-amber-800 font-bold text-sm uppercase tracking-wider mb-1.5">
                <i className="fa-solid fa-key text-amber-600"></i>
                <span>Token Ujian</span>
              </div>
              <p className="text-xs text-amber-700 mb-3 max-w-md mx-auto">
                Token didapat dari guru pengawas di menu <b>Bank Soal</b>. Siswa tidak dapat memulai ujian tanpa memasukkan token yang valid.
              </p>
              <div className="max-w-xs mx-auto">
                <input
                  type="text"
                  maxLength={6}
                  value={examToken}
                  placeholder="------"
                  autoComplete="off"
                  onChange={(e) => setExamToken(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleStartExam();
                    }
                  }}
                  className="w-full text-center font-mono text-2xl font-black tracking-[0.35em] uppercase py-3 px-4 rounded-xl border-2 border-amber-300 focus:border-brand-600 focus:ring-4 focus:ring-brand-500/20 outline-none bg-white text-slate-900 shadow-inner transition-all"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="sm:w-1/3 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-arrow-left"></i>
                <span>Kembali / Ganti Identitas</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleStartExam}
                className="sm:w-2/3 py-3 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{busy ? "Memproses..." : "Mulai Mengerjakan Ujian"}</span>
                <i className="fa-solid fa-circle-play text-base"></i>
              </button>
            </div>
          </div>
        )}

        {/* ================= 3. QUIZ SCREEN ================= */}
        {screen === "quiz" && exam && (
          <div className="w-full flex-1 flex flex-col justify-between gap-4">
            {/* Header Info Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700 font-bold text-lg">
                  <i className="fa-solid fa-file-pen"></i>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{exam.title}</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    NIS: {nis} | Siswa: {studentName} | Kelas: {studentClass}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowReloadConfirmModal(true)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-300 transition cursor-pointer"
                  title="Muat ulang data ujian jika koneksi terputus"
                >
                  <i className="fa-solid fa-rotate text-[11px]"></i>
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-semibold flex items-center gap-2 font-mono">
                  <i className="fa-solid fa-clock"></i>
                  <span>{formatTimer(remainingSeconds)}</span>
                </div>
                <div className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                  Soal <span>{currentIndex + 1}</span> dari <span>{qList.length}</span>
                </div>
                <span className="text-xs font-medium text-slate-500">{saveStatus}</span>
              </div>
            </div>

            {/* Question + Sidebar Palette */}
            <div className="relative flex-1 grid grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)] gap-5 items-start">
              {/* Sidebar Navigation */}
              <aside className="bg-white p-4 rounded-2xl shadow-md border border-slate-200 lg:sticky lg:top-16">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <i className="fa-solid fa-list-ol text-brand-600 mr-1"></i> Navigasi Soal
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500">
                    {Object.keys(answers).length}/{qList.length}
                  </span>
                </div>

                <div className="grid grid-cols-5 lg:grid-cols-4 gap-1.5 max-h-72 overflow-y-auto custom-scrollbar p-1">
                  {qList.map((q, idx) => {
                    const isCurrent = idx === currentIndex;
                    const isAnswered = answers[q.id] !== undefined && answers[q.id] !== "" && answers[q.id] !== null;
                    let btnColor = "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200";
                    if (isCurrent) {
                      btnColor = "bg-brand-600 text-white font-bold ring-2 ring-brand-300";
                    } else if (isAnswered) {
                      btnColor = "bg-emerald-500 text-white font-bold";
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-9 rounded-lg text-xs transition border flex items-center justify-center cursor-pointer ${btnColor}`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-[10px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded bg-brand-600"></span> Sedang dibuka
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500"></span> Sudah dijawab
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded bg-slate-200"></span> Belum dijawab
                  </div>
                </div>
              </aside>

              {/* Question Card */}
              {currentQ && (() => {
                let parsedOpts: any = currentQ.options;
                if (typeof parsedOpts === "string") {
                  try {
                    parsedOpts = JSON.parse(parsedOpts);
                  } catch {
                    parsedOpts = [];
                  }
                }

                return (
                  <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-slate-200 space-y-6">
                    {/* Top Bar: Question Number & Badge */}
                    <div className="flex items-center justify-between border-b pb-3 text-xs">
                      <span className="font-bold text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1 rounded-full">
                        Nomor {currentIndex + 1}
                      </span>
                      <span className="text-slate-400 font-medium">Bobot: {currentQ.points || 1} Poin</span>
                    </div>

                    {/* Case Analysis Stimulus */}
                    {currentQ.type === "case_analysis" && currentQ.passage && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed font-serif italic border-l-4 border-l-brand-600">
                        <strong className="block not-italic font-sans text-slate-900 mb-1">
                          <i className="fa-solid fa-book-open text-brand-600 mr-1"></i> Teks Studi Kasus:
                        </strong>
                        {currentQ.passage}
                      </div>
                    )}

                    {/* Cause & Effect Statement & Reason */}
                    {currentQ.type === "cause_effect" && (
                      <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs sm:text-sm">
                        <p className="font-bold text-slate-800">
                          <i className="fa-solid fa-circle-info text-brand-600 mr-1"></i> Pernyataan Utama:
                        </p>
                        <p className="text-slate-700 pl-4 border-l-2 border-slate-300">
                          &quot;{currentQ.content || parsedOpts?.statement || ""}&quot;
                        </p>
                        <p className="font-bold text-slate-800 pt-2">
                          <i className="fa-solid fa-link text-brand-600 mr-1"></i> Alasan:
                        </p>
                        <p className="text-slate-700 pl-4 border-l-2 border-slate-300">
                          &quot;{currentQ.passage || parsedOpts?.reason || ""}&quot;
                        </p>
                      </div>
                    )}

                    {/* Generic Stimulus / Passage if any (except case_analysis & cause_effect) */}
                    {currentQ.type !== "case_analysis" && currentQ.type !== "cause_effect" && currentQ.passage && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
                        <strong className="block text-slate-900 mb-1">Teks Bacaan / Stimulus:</strong>
                        {currentQ.passage}
                      </div>
                    )}

                    {/* Question Image if any */}
                    {currentQ.image_url && (
                      <div className="my-3">
                        <img
                          src={currentQ.image_url}
                          alt={`Gambar Soal ${currentIndex + 1}`}
                          className="max-h-72 rounded-xl border border-slate-200 object-contain mx-auto"
                        />
                      </div>
                    )}

                    {/* Question Content (Hidden for cause_effect since shown above) */}
                    {currentQ.type !== "cause_effect" && (
                      <div className="text-sm sm:text-base font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {currentQ.content}
                      </div>
                    )}

                    {/* Question Options */}
                    <div className="pt-2 space-y-2.5">
                      {/* 1. Multiple Choice (mc) & Case Analysis (case_analysis) */}
                      {(currentQ.type === "mc" || currentQ.type === "case_analysis" || !currentQ.type) && (
                        <div className="space-y-2">
                          {Array.isArray(parsedOpts) && parsedOpts.length > 0 ? (
                            parsedOpts.map((opt: string, optIdx: number) => {
                              const isSelected = answers[currentQ.id] === optIdx;
                              const letter = String.fromCharCode(65 + optIdx);
                              return (
                                <label
                                  key={optIdx}
                                  onClick={() => saveAnswer(currentQ.id, optIdx)}
                                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition cursor-pointer text-xs sm:text-sm option-label ${
                                    isSelected
                                      ? "bg-brand-50 border-brand-500 text-brand-900 font-semibold shadow-xs"
                                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  <span
                                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                      isSelected
                                        ? "bg-brand-600 text-white shadow-xs"
                                        : "bg-slate-100 text-slate-600 border border-slate-300"
                                    }`}
                                  >
                                    {letter}
                                  </span>
                                  <span className="flex-1 leading-snug">{opt}</span>
                                </label>
                              );
                            })
                          ) : (
                            <p className="text-xs text-slate-400">Tidak ada pilihan opsi.</p>
                          )}
                        </div>
                      )}

                      {/* 2. Complex Multiple Choice (complex) */}
                      {currentQ.type === "complex" && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 font-medium italic">
                            (Pilih satu atau lebih jawaban yang menurut Anda benar)
                          </p>
                          {Array.isArray(parsedOpts) &&
                            parsedOpts.map((opt: string, optIdx: number) => {
                              const selectedArr = Array.isArray(answers[currentQ.id]) ? answers[currentQ.id] : [];
                              const isSelected = selectedArr.includes(optIdx);
                              const letter = String.fromCharCode(65 + optIdx);

                              const toggleOption = () => {
                                const next = isSelected
                                  ? selectedArr.filter((x: number) => x !== optIdx)
                                  : [...selectedArr, optIdx].sort((a, b) => a - b);
                                saveAnswer(currentQ.id, next);
                              };

                              return (
                                <label
                                  key={optIdx}
                                  onClick={toggleOption}
                                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition cursor-pointer text-xs sm:text-sm option-label ${
                                    isSelected
                                      ? "bg-purple-50 border-purple-500 text-purple-900 font-semibold shadow-xs"
                                      : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                  }`}
                                >
                                  <span
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                      isSelected
                                        ? "bg-purple-600 text-white shadow-xs"
                                        : "bg-slate-100 text-slate-600 border border-slate-300"
                                    }`}
                                  >
                                    {letter}
                                  </span>
                                  <span className="flex-1 leading-snug">{opt}</span>
                                </label>
                              );
                            })}
                        </div>
                      )}

                      {/* 3. Cause & Effect (cause_effect) */}
                      {currentQ.type === "cause_effect" && (
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 font-medium italic">
                            (Pilihlah salah satu hubungan sebab-akibat di bawah ini)
                          </p>
                          {[
                            { val: "both_correct_connected", label: "Pernyataan benar, alasan benar, dan keduanya menunjukkan hubungan sebab akibat (A)" },
                            { val: "both_correct_not_connected", label: "Pernyataan benar, alasan benar, tetapi keduanya TIDAK menunjukkan hubungan sebab akibat (B)" },
                            { val: "statement_true_reason_false", label: "Pernyataan BENAR dan alasan SALAH (C)" },
                            { val: "statement_false_reason_true", label: "Pernyataan SALAH dan alasan BENAR (D)" },
                            { val: "both_false", label: "Pernyataan dan alasan, keduanya SALAH (E)" },
                          ].map((item, idx) => {
                            const isSelected = answers[currentQ.id] === item.val;
                            const letter = String.fromCharCode(65 + idx);
                            return (
                              <label
                                key={item.val}
                                onClick={() => saveAnswer(currentQ.id, item.val)}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition cursor-pointer text-xs sm:text-sm option-label ${
                                  isSelected
                                    ? "bg-amber-50 border-amber-500 text-amber-900 font-semibold"
                                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <span
                                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isSelected ? "bg-amber-600 text-white" : "bg-slate-100 text-slate-600 border"
                                  }`}
                                >
                                  {letter}
                                </span>
                                <span className="flex-1 leading-snug">{item.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* 4. Matching (matching) */}
                      {currentQ.type === "matching" && (() => {
                        const premises: string[] = Array.isArray(parsedOpts?.premises) ? parsedOpts.premises : [];
                        const targets: string[] = Array.isArray(parsedOpts?.targets) ? parsedOpts.targets : [];
                        const currentMatches = typeof answers[currentQ.id] === "object" && answers[currentQ.id] !== null ? answers[currentQ.id] : {};

                        return (
                          <div className="space-y-3 pt-1">
                            <p className="text-xs text-slate-600 font-medium">
                              Jodohkan setiap pernyataan di kolom kiri dengan pasangan yang tepat di kolom kanan:
                            </p>
                            <div className="space-y-2.5">
                              {premises.map((premise, pIdx) => {
                                const selectedTarget = currentMatches[pIdx] !== undefined ? currentMatches[pIdx] : "";
                                return (
                                  <div
                                    key={pIdx}
                                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-2.5 flex-1">
                                      <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-800 text-xs font-bold flex items-center justify-center shrink-0">
                                        {pIdx + 1}
                                      </span>
                                      <span className="text-xs sm:text-sm font-medium text-slate-800">{premise}</span>
                                    </div>
                                    <div className="sm:w-64 shrink-0">
                                      <select
                                        value={selectedTarget}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const updated = { ...currentMatches };
                                          if (val === "") {
                                            delete updated[pIdx];
                                          } else {
                                            updated[pIdx] = parseInt(val, 10);
                                          }
                                          saveAnswer(currentQ.id, updated);
                                        }}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-brand-500 outline-none"
                                      >
                                        <option value="">-- Pilih Pasangan --</option>
                                        {targets.map((target, tIdx) => (
                                          <option key={tIdx} value={tIdx}>
                                            {String.fromCharCode(65 + tIdx)}. {target}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 5. Short Answer (short_answer) */}
                      {currentQ.type === "short_answer" && (
                        <div className="space-y-2 pt-1">
                          <label className="block text-xs font-semibold text-slate-700">Tuliskan Jawaban Singkat:</label>
                          <input
                            type="text"
                            value={answers[currentQ.id] || ""}
                            onChange={(e) => saveAnswer(currentQ.id, e.target.value)}
                            placeholder="Ketikkan jawaban Anda di sini..."
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 font-medium outline-none bg-white"
                          />
                        </div>
                      )}

                      {/* 6. Essay / Uraian (essay) */}
                      {currentQ.type === "essay" && (
                        <div className="space-y-2">
                          <textarea
                            rows={6}
                            value={answers[currentQ.id] || ""}
                            onChange={(e) => saveAnswer(currentQ.id, e.target.value)}
                            placeholder="Ketikkan jawaban uraian Anda di sini secara lengkap..."
                            className="w-full p-4 rounded-xl border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none text-xs sm:text-sm leading-relaxed custom-scrollbar bg-slate-50/50"
                          />
                          <div className="flex justify-end text-[11px] text-slate-400">
                            {(answers[currentQ.id] || "").length} karakter
                          </div>
                        </div>
                      )}

                      {/* 7. Scale (scaled / scale) */}
                      {(currentQ.type === "scaled" || currentQ.type === "scale") && (
                        <div className="flex items-center justify-center gap-4 py-4 bg-slate-50 rounded-xl border border-slate-200">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <label
                              key={val}
                              onClick={() => saveAnswer(currentQ.id, val)}
                              className={`flex flex-col items-center gap-1 cursor-pointer p-2 rounded-xl transition ${
                                answers[currentQ.id] === val ? "text-brand-600 font-bold" : "text-slate-600"
                              }`}
                            >
                              <span
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm border ${
                                  answers[currentQ.id] === val
                                    ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                                    : "bg-white border-slate-300"
                                }`}
                              >
                                {val}
                              </span>
                              <span className="text-[10px]">Nilai {val}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Bottom Controls */}
            <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((c) => Math.max(0, c - 1))}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
                <span>Sebelumnya</span>
              </button>

              <div className="flex items-center gap-2">
                {currentIndex < qList.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((c) => Math.min(qList.length - 1, c + 1))}
                    className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <span>Selanjutnya</span>
                    <i className="fa-solid fa-chevron-right text-xs"></i>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleSubmitQuiz(false)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>Kirim Jawaban</span>
                </button>
              </div>
            </div>

            {/* Timeout Overlay */}
            {showTimeoutOverlay && (
              <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl mb-4 border border-amber-500/30">
                  <i className="fa-solid fa-hourglass-end"></i>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Waktu Ujian Habis</h3>
                <p className="text-slate-300 text-sm max-w-md mb-6 leading-relaxed">
                  Waktu pengerjaan telah selesai. Seluruh jawaban Anda telah disimpan otomatis oleh server. Silakan kirimkan ujian atau ajukan perpanjangan waktu ke pengawas/guru.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={requestExtension}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <i className="fa-solid fa-clock-rotate-left"></i>
                    <span>Minta Perpanjangan Waktu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmitQuiz(true)}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <i className="fa-solid fa-square-check"></i>
                    <span>Lihat Hasil Ujian</span>
                  </button>
                </div>
                {extensionStatus && (
                  <p className="text-xs text-amber-300 font-medium mt-4 bg-amber-500/10 px-4 py-2 rounded-lg border border-amber-500/20">
                    {extensionStatus}
                  </p>
                )}
              </div>
            )}

            {/* Violation Overlay (Mode Kiosk Resmi Terkunci) */}
            {showViolationOverlay && (
              <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[110] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-150">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center text-3xl mb-4 border border-rose-500/40 animate-pulse">
                  <i className="fa-solid fa-lock"></i>
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-rose-400 bg-rose-500/20 px-3.5 py-1 rounded-full border border-rose-500/30 mb-3 flex items-center gap-1.5">
                  <i className="fa-solid fa-shield-halved"></i> Mode Kiosk Resmi CBT
                </span>
                <h3 className="text-2xl font-black text-white mb-2">Mode Kiosk Resmi Terkunci</h3>
                <p className="text-slate-300 text-sm max-w-lg mb-6 leading-relaxed">
                  Layar pengerjaan soal dikunci dalam Mode Kiosk Resmi karena terdeteksi keluar dari layar ujian atau fokus berpindah ke aplikasi lain.
                </p>

                <div className="bg-rose-950/70 border border-rose-500/40 rounded-xl px-5 py-2.5 mb-6 text-xs text-rose-200 font-semibold flex items-center gap-3">
                  <i className="fa-solid fa-bell text-rose-400 text-base animate-bounce"></i>
                  <span>
                    Total Pelanggaran:{" "}
                    <strong className="text-white text-base font-black underline">{violationsCount}</strong> kali
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowViolationOverlay(false);
                    try {
                      document.documentElement.requestFullscreen?.().catch(() => {});
                    } catch {}
                  }}
                  className="px-7 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-rose-600/50 transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-lock-open text-base"></i>
                  <span>Buka Kunci Layar</span>
                </button>
              </div>
            )}

            {/* Reload Confirmation Modal */}
            {showReloadConfirmModal && (
              <div
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[130] flex items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowReloadConfirmModal(false);
                }}
              >
                <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center animate-in fade-in duration-150">
                  <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-3 text-amber-600 text-2xl">
                    <i className="fa-solid fa-arrows-rotate"></i>
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Muat Ulang Halaman Ujian?</h3>
                  <p className="text-slate-600 text-xs mt-2 leading-relaxed">
                    Data soal, jawaban, dan status koneksi server akan disinkronkan kembali tanpa keluar dari mode layar penuh.
                  </p>
                  <div className="flex items-center justify-center gap-2.5 mt-5">
                    <button
                      type="button"
                      onClick={() => setShowReloadConfirmModal(false)}
                      className="flex-1 py-2.5 px-4 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowReloadConfirmModal(false);
                        window.location.reload();
                      }}
                      className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-rotate text-xs"></i>
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 4. RESULT SCREEN ================= */}
        {screen === "result" && result && (
          <div className="max-w-4xl mx-auto w-full space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <i className="fa-solid fa-check text-4xl"></i>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">Ujian Selesai!</h2>
              <p className="text-slate-500 text-sm">Jawaban Anda telah berhasil tersimpan di server lokal via API.</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto pt-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5">
                    <i className="fa-solid fa-chart-line text-brand-600"></i> Skor Akhir
                  </p>
                  <p className="text-3xl font-extrabold text-brand-600 mt-1">{result.score}</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <p className="text-xs text-emerald-600 font-medium flex items-center justify-center gap-1.5">
                    <i className="fa-solid fa-circle-check text-emerald-600"></i> Benar
                  </p>
                  <p className="text-3xl font-extrabold text-emerald-600 mt-1">{result.correct}</p>
                </div>
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                  <p className="text-xs text-rose-600 font-medium flex items-center justify-center gap-1.5">
                    <i className="fa-solid fa-circle-xmark text-rose-600"></i> Salah
                  </p>
                  <p className="text-3xl font-extrabold text-rose-600 mt-1">{result.wrong}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-xs text-slate-500 font-medium flex items-center justify-center gap-1.5">
                    <i className="fa-solid fa-bullseye text-slate-500"></i> Akurasi
                  </p>
                  <p className="text-3xl font-extrabold text-slate-700 mt-1">{result.percentage}%</p>
                </div>
              </div>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-medium hover:bg-slate-700 transition cursor-pointer flex items-center gap-2"
                >
                  <i className="fa-solid fa-house text-sm"></i>
                  <span>Kembali ke Halaman Utama</span>
                </button>
              </div>
            </div>

            {/* Pembahasan & Evaluasi Detail */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-md border border-slate-200 space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-bold text-slate-800">Pembahasan & Evaluasi Detail</h3>
                <p className="text-xs text-slate-500">Tinjau kembali jawaban Anda beserta penjelasannya.</p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm font-bold text-slate-700">Jawaban & Pembahasan</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {reviewEnabled
                      ? "Pembahasan diaktifkan oleh guru pengawas."
                      : "Jawaban benar dan pembahasan disembunyikan oleh guru pengawas."}
                  </p>
                </div>
              </div>

              {reviewEnabled && reviews && reviews.length > 0 && (
                <div className="space-y-4">
                  {reviews.map((r, i) => (
                    <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">Soal {r.position || i + 1}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                            r.isCorrect
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : "bg-rose-100 text-rose-800 border border-rose-300"
                          }`}
                        >
                          {r.isCorrect ? "✓ Benar" : "✕ Salah"}
                        </span>
                      </div>
                      <p className="text-slate-800 font-medium">{r.content}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Jawaban Anda:</span>
                          <p className="text-slate-700 font-medium">
                            {typeof r.studentAnswer === "object" ? JSON.stringify(r.studentAnswer) : String(r.studentAnswer ?? "-")}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-600 uppercase font-semibold">Kunci Jawaban:</span>
                          <p className="text-emerald-700 font-bold">
                            {typeof r.correctAnswer === "object" ? JSON.stringify(r.correctAnswer) : String(r.correctAnswer ?? "-")}
                          </p>
                        </div>
                      </div>
                      {r.explanation && (
                        <div className="bg-brand-50 p-2.5 rounded-lg border border-brand-200 text-brand-900 mt-2">
                          <strong className="block text-[10px] uppercase font-bold text-brand-700">Pembahasan:</strong>
                          {r.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[210] p-3.5 rounded-xl shadow-xl bg-slate-900 text-white flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <i className="fa-solid fa-circle-info text-brand-400"></i>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
