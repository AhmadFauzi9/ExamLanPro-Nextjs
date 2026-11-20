"use client";

import { appAlert } from "@/components/common/AppDialog";

export const QUIZ_CARD_THEMES = [
  { bg: "bg-brand-600", border: "border-brand-700", hoverBorder: "hover:border-brand-800", btnText: "text-brand-700" },
  { bg: "bg-rose-600", border: "border-rose-700", hoverBorder: "hover:border-rose-800", btnText: "text-rose-700" },
  { bg: "bg-emerald-600", border: "border-emerald-700", hoverBorder: "hover:border-emerald-800", btnText: "text-emerald-700" },
  { bg: "bg-amber-500", border: "border-amber-600", hoverBorder: "hover:border-amber-700", btnText: "text-amber-800" },
  { bg: "bg-purple-600", border: "border-purple-700", hoverBorder: "hover:border-purple-800", btnText: "text-purple-700" },
  { bg: "bg-teal-600", border: "border-teal-700", hoverBorder: "hover:border-teal-800", btnText: "text-teal-700" },
  { bg: "bg-indigo-600", border: "border-indigo-700", hoverBorder: "hover:border-indigo-800", btnText: "text-indigo-700" },
  { bg: "bg-orange-500", border: "border-orange-600", hoverBorder: "hover:border-orange-700", btnText: "text-orange-700" },
];

// Helper: Get question type badge matching ExamLANPro getQuestionTypeBadge
export function getQuestionTypeBadge(type: string) {
  switch (type) {
    case "mc":
      return { label: "Pilihan Ganda", bg: "bg-brand-50 text-brand-700 border-brand-200" };
    case "complex":
      return { label: "Ganda Kompleks", bg: "bg-purple-50 text-purple-700 border-purple-200" };
    case "cause_effect":
      return { label: "Sebab Akibat", bg: "bg-amber-50 text-amber-700 border-amber-200" };
    case "case_analysis":
      return { label: "Analisis Kasus", bg: "bg-blue-50 text-blue-700 border-blue-200" };
    case "matching":
      return { label: "Menjodohkan", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "essay":
      return { label: "Uraian / Esai", bg: "bg-rose-50 text-rose-700 border-rose-200" };
    case "short_answer":
      return { label: "Isian Singkat", bg: "bg-cyan-50 text-cyan-700 border-cyan-200" };
    case "scaled":
      return { label: "Skala Likert", bg: "bg-teal-50 text-teal-700 border-teal-200" };
    default:
      return { label: "Pilihan Ganda", bg: "bg-slate-100 text-slate-700 border-slate-200" };
  }
}

// Client-side Excel & Word template downloads matching ExamLANPro
export function downloadExcelTemplate() {
  if (typeof window === "undefined") return;
  const XLSX = (window as any).XLSX;
  if (!XLSX) {
    void appAlert("Library Excel sedang disiapkan, silakan ulangi sesaat lagi.", "Perhatian");
    return;
  }
  const templateData = [
    ["tipe", "pertanyaan", "teks_kasus", "pernyataan", "alasan", "opsi_a", "opsi_b", "opsi_c", "opsi_d", "opsi_e", "kunci_jawaban", "pasangan_menjodohkan", "pembahasan"],
    ["mc", "Komponen komputer manakah yang berfungsi sebagai penyimpan data komputasi sementara saat sistem menyala?", "", "", "", "RAM (Random Access Memory)", "Harddisk / SSD", "Power Supply Unit", "Kartu Grafis (GPU)", "", "A", "", "RAM menyimpan instruksi dan data komputasi yang sedang aktif dijalankan sistem."],
    ["complex", "Manakah yang tergolong perangkat masukan (input device)? (Pilih beberapa)", "", "", "", "Keyboard", "Monitor Layar", "Mouse Optik", "Speaker", "Scanner Dokumen", "A,C,E", "", "Keyboard, Mouse, dan Scanner merupakan perangkat masukan data pengguna."],
    ["cause_effect", "Tentukan kebenaran pernyataan, alasan, dan keterkaitan sebab-akibat berikut:", "", "Peningkatan emisi gas rumah kaca dapat mempercepat pemanasan global.", "Gas rumah kaca seperti karbon dioksida memerangkap radiasi panas matahari di atmosfer bumi.", "", "", "", "", "", "A", "", "Pernyataan BENAR, Alasan BENAR, dan keduanya menunjukkan hubungan sebab akibat."],
    ["case_analysis", "Berdasarkan studi kasus di atas, apa tindakan mitigasi awal yang paling tepat untuk menormalkan sistem?", "Sebuah laboratorium komputer sekolah mengalami gangguan jaringan lokal (LAN) saat pelaksanaan ujian berlangsung akibat adanya indikasi broadcast storm dari port salah satu switch.", "", "", "Merestart server ujian secara tiba-tiba tanpa backup", "Mengisolasi segmen kabel atau port switch yang bermasalah untuk memutus loop", "Mengganti seluruh kabel jaringan di laboratorium sekaligus", "Mematikan sambungan listrik utama laboratorium", "", "B", "", "Mengisolasi port/segmen bermasalah langsung memutus broadcast storm tanpa mematikan server utama."],
    ["matching", "Jodohkan perangkat keras komputer berikut dengan fungsinya yang sesuai:", "", "", "", "", "", "", "", "", "0=0, 1=1, 2=2, 3=3", "Monitor=Menampilkan visual antarmuka|Keyboard=Memasukkan data teks dan perintah|SSD=Menyimpan berkas secara permanen|CPU=Memproses instruksi komputasi", "Pasangkan perangkat keras sesuai fungsi utamanya."],
    ["essay", "Jelaskan perbedaan mendasar antara memori utama (RAM) dan penyimpanan sekunder (SSD/Harddisk) pada sistem komputer!", "", "", "", "", "", "", "", "", "RAM bersifat volatile (data hilang saat listrik padam) untuk pemrosesan sementara yang cepat, sedangkan SSD/Harddisk bersifat non-volatile untuk menyimpan berkas secara permanen.", "", "Rubrik: Poin 1 sifat volatile vs non-volatile, Poin 2 fungsi dan kecepatan operasional komputer."]
  ];
  const ws = XLSX.utils.aoa_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template_Soal_ExamLAN");
  XLSX.writeFile(wb, "Template_Import_Soal_Lengkap.xlsx");
}

export function downloadWordTextTemplate() {
  if (typeof window === "undefined") return;
  const content = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Template Import Soal Resmi (Lengkap)</title>
  <style>
    body { font-family: 'Calibri', 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #1e293b; padding: 20px; }
    h1 { font-size: 15pt; color: #1e40af; border-bottom: 2px solid #2563eb; padding-bottom: 5px; margin-bottom: 10px; }
    .notice { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 18px; border-left: 4px solid #2563eb; font-size: 10.5pt; }
    p { margin: 4px 0; }
    .separator { color: #64748b; font-weight: bold; margin-top: 16px; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; }
    b { color: #0f172a; }
    .badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 10pt; }
  </style>
</head>
<body>
  <h1>TEMPLATE IMPORT SOAL - FORMAT LENGKAP (WORD / DOC)</h1>
  <div class="notice">
    <p><b>PETUNJUK PENGISIAN FORMAT SOAL:</b></p>
    <p>1. Template ini mendukung <b>Format Soal Lengkap</b>: Pilihan Ganda (mc), Pilihan Ganda Kompleks (complex), Sebab Akibat (cause_effect), Analisis Kasus (case_analysis), Menjodohkan (matching), dan Uraian / Esai (essay).</p>
    <p>2. <b>DUKUNGAN GAMBAR:</b> Anda dapat menyisipkan/paste gambar secara langsung di bawah pertanyaan atau teks soal! Gambar akan otomatis tersimpan ke server.</p>
    <p>3. <b>PENTING:</b> Pisahkan setiap butir soal dengan tanda tiga strip (<b>---</b>).</p>
    <p>4. Simpan file ini dalam format <b>.docx</b> atau <b>.doc</b>, lalu unggah saat membuat paket kuis.</p>
  </div>

  <p class="separator">---</p>
  <p><span class="badge">1. PILIHAN GANDA (mc)</span></p>
  <p><b>TIPE:</b> mc</p>
  <p><b>PERTANYAAN:</b> Komponen perangkat keras manakah yang berfungsi sebagai penyimpan memori komputasi sementara saat komputer menyala?</p>
  <p><b>A:</b> RAM (Random Access Memory)</p>
  <p><b>B:</b> Harddisk / SSD</p>
  <p><b>C:</b> Unit Pemrosesan Pusat (CPU)</p>
  <p><b>D:</b> Optical Disc Drive (DVD)</p>
  <p><b>KUNCI:</b> A</p>
  <p><b>PEMBAHASAN:</b> RAM menyimpan instruksi dan data komputasi yang sedang aktif dijalankan sistem.</p>

  <p class="separator">---</p>
  <p><span class="badge">2. PILIHAN GANDA KOMPLEKS (complex)</span></p>
  <p><b>TIPE:</b> complex</p>
  <p><b>PERTANYAAN:</b> Manakah peranti berikut yang tergolong sebagai perangkat masukan (input device)? (Pilih lebih dari satu)</p>
  <p><b>A:</b> Papan Tombol (Keyboard)</p>
  <p><b>B:</b> Layar Monitor</p>
  <p><b>C:</b> Mouse / Trackpad</p>
  <p><b>D:</b> Mesin Pencetak (Printer)</p>
  <p><b>E:</b> Pemindai (Scanner)</p>
  <p><b>KUNCI:</b> A, C, E</p>
  <p><b>PEMBAHASAN:</b> Keyboard, Mouse, dan Scanner berfungsi memasukkan instruksi dan data pengguna.</p>

  <p class="separator">---</p>
  <p><span class="badge">3. SEBAB AKIBAT (cause_effect)</span></p>
  <p><b>TIPE:</b> cause_effect</p>
  <p><b>PERNYATAAN:</b> Peningkatan emisi gas rumah kaca di atmosfer dapat mempercepat pemanasan global bumi.</p>
  <p><b>ALASAN:</b> Gas rumah kaca seperti karbon dioksida memerangkap radiasi gelombang panas matahari di permukaan bumi.</p>
  <p><b>KUNCI:</b> A</p>
  <p><b>PEMBAHASAN:</b> Pernyataan BENAR, Alasan BENAR, dan keduanya menunjukkan hubungan sebab akibat.</p>

  <p class="separator">---</p>
  <p><span class="badge">4. ANALISIS KASUS (case_analysis)</span></p>
  <p><b>TIPE:</b> case_analysis</p>
  <p><b>KASUS:</b> Sebuah laboratorium komputer sekolah mengalami gangguan jaringan lokal (LAN) saat pelaksanaan ujian berlangsung akibat adanya indikasi broadcast storm dari port salah satu switch.</p>
  <p><b>PERTANYAAN:</b> Berdasarkan studi kasus di atas, apa tindakan mitigasi awal yang paling tepat untuk menormalkan sistem?</p>
  <p><b>A:</b> Merestart server ujian secara tiba-tiba tanpa backup</p>
  <p><b>B:</b> Mengisolasi segmen kabel atau port switch yang bermasalah untuk memutus loop</p>
  <p><b>C:</b> Mengganti seluruh kabel jaringan di laboratorium sekaligus</p>
  <p><b>D:</b> Mematikan sambungan listrik utama laboratorium</p>
  <p><b>KUNCI:</b> B</p>
  <p><b>PEMBAHASAN:</b> Mengisolasi port/segmen bermasalah langsung memutus broadcast storm tanpa mematikan server utama.</p>

  <p class="separator">---</p>
  <p><span class="badge">5. MENJODOHKAN (matching)</span></p>
  <p><b>TIPE:</b> matching</p>
  <p><b>PERTANYAAN:</b> Jodohkan perangkat keras komputer berikut dengan fungsinya yang sesuai:</p>
  <p><b>PASANGAN:</b></p>
  <p>Monitor = Menampilkan visual antarmuka</p>
  <p>Keyboard = Memasukkan data teks dan perintah</p>
  <p>SSD = Menyimpan berkas secara permanen</p>
  <p>CPU = Memproses instruksi komputasi</p>
  <p><b>PEMBAHASAN:</b> Pasangkan perangkat keras sesuai fungsi utamanya.</p>

  <p class="separator">---</p>
  <p><span class="badge">6. URAIAN / ESAI (essay)</span></p>
  <p><b>TIPE:</b> essay</p>
  <p><b>PERTANYAAN:</b> Jelaskan perbedaan mendasar antara memori utama (RAM) dan penyimpanan sekunder (SSD/Harddisk) pada sistem komputer!</p>
  <p><b>KUNCI:</b> RAM bersifat volatile (data hilang saat listrik padam) untuk pemrosesan sementara yang cepat, sedangkan SSD/Harddisk bersifat non-volatile untuk menyimpan berkas secara permanen.</p>
  <p><b>PEMBAHASAN:</b> Rubrik: Poin 1 sifat volatile vs non-volatile, Poin 2 fungsi dan kecepatan operasional komputer.</p>
</body>
</html>`;
  const blob = new Blob(["\ufeff" + content], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Template_Import_Soal_Lengkap.doc";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadStudentTemplate() {
  if (typeof window === "undefined") return;
  const XLSX = (window as any).XLSX;
  if (!XLSX) {
    void appAlert("Library Excel sedang disiapkan, silakan ulangi sesaat lagi.", "Perhatian");
    return;
  }
  const sampleData = [
    ["No Induk", "Nama", "Kelas", "Tahun Ajaran"],
    ["1001", "Ahmad Fauzi", "7A", "2026/2027"],
    ["1002", "Budi Santoso", "7A", "2026/2027"],
    ["1003", "Citra Dewi", "7B", "2026/2027"]
  ];
  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template_Siswa");
  XLSX.writeFile(wb, "Template_Data_Siswa.xlsx");
}
