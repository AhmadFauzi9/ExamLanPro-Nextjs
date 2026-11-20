import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { apiError } from "@/lib/security";

export async function GET(req: NextRequest) {
  try {
    await requireRole("ADMIN", "TEACHER");
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || searchParams.get("type");

    if (format === "word" || format === "doc") {
      const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="utf-8">
    <title>Template Import Soal Resmi (5 Jenis Soal)</title>
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
    <h1>TEMPLATE IMPORT SOAL - 5 JENIS SOAL (WORD / DOC)</h1>
    <div class="notice">
        <p><b>PETUNJUK PENGISIAN FORMAT SOAL:</b></p>
        <p>1. Template ini mendukung <b>5 Jenis Soal</b>: Pilihan Ganda (mc), Pilihan Ganda Kompleks (complex), Sebab Akibat (cause_effect), Analisis Kasus (case_analysis), dan Menjodohkan (matching).</p>
        <p>2. <b>DUKUNGAN GAMBAR:</b> Anda dapat menyisipkan/paste gambar secara langsung di bawah pertanyaan atau teks soal! Gambar akan otomatis tersimpan ke server.</p>
        <p>3. <b>PENTING:</b> Pisahkan setiap butir soal dengan tanda tiga strip (<b>---</b>).</p>
        <p>4. Simpan file ini dalam format <b>.docx</b> atau <b>.doc</b>, lalu unggah saat membuat paket kuis.</p>
    </div>

    <p class="separator">---</p>
    <p><span class="badge">1. PILIHAN GANDA (mc)</span></p>
    <p><b>TIPE:</b> mc</p>
    <p><b>PERTANYAAN:</b> Komponen komputer manakah yang berfungsi sebagai penyimpan data sementara saat sistem menyala?</p>
    <p><b>A.</b> RAM (Random Access Memory)</p>
    <p><b>B.</b> Harddisk / SSD</p>
    <p><b>C.</b> Power Supply Unit</p>
    <p><b>D.</b> Kartu Grafis (GPU)</p>
    <p><b>KUNCI:</b> A</p>
    <p><b>PEMBAHASAN:</b> RAM menyimpan instruksi dan data yang sedang aktif diproses CPU.</p>

    <p class="separator">---</p>
    <p><span class="badge">2. PILIHAN GANDA KOMPLEKS (complex)</span></p>
    <p><b>TIPE:</b> complex</p>
    <p><b>PERTANYAAN:</b> Manakah di antara komponen berikut yang tergolong perangkat masukan (input device)?</p>
    <p><b>A.</b> Keyboard</p>
    <p><b>B.</b> Monitor Layar</p>
    <p><b>C.</b> Mouse Optik</p>
    <p><b>D.</b> Speaker</p>
    <p><b>E.</b> Scanner Dokumen</p>
    <p><b>KUNCI:</b> A, C, E</p>
    <p><b>PEMBAHASAN:</b> Keyboard, mouse, dan scanner mengirimkan data input dari luar ke dalam sistem.</p>

    <p class="separator">---</p>
    <p><span class="badge">3. SEBAB AKIBAT (cause_effect)</span></p>
    <p><b>TIPE:</b> cause_effect</p>
    <p><b>PERNYATAAN:</b> Peningkatan emisi gas rumah kaca dapat mempercepat laju pemanasan suhu global bumi.</p>
    <p><b>ALASAN:</b> Gas rumah kaca seperti karbon dioksida dan metana menyerap radiasi inframerah panas matahari di lapisan atmosfer.</p>
    <p><b>KUNCI:</b> A</p>
    <p><b>PEMBAHASAN:</b> Pernyataan BENAR, Alasan BENAR, dan keduanya saling berhubungan sebab akibat.</p>

    <p class="separator">---</p>
    <p><span class="badge">4. ANALISIS KASUS (case_analysis)</span></p>
    <p><b>TIPE:</b> case_analysis</p>
    <p><b>KASUS:</b> Sebuah laboratorium komputer sekolah mengalami gangguan jaringan lokal (LAN) saat pelaksanaan ujian berlangsung akibat adanya indikasi broadcast storm dari port salah satu switch.</p>
    <p><b>PERTANYAAN:</b> Berdasarkan studi kasus di atas, apa tindakan mitigasi awal yang paling tepat untuk menormalkan sistem?</p>
    <p><b>A.</b> Merestart server ujian secara mendadak</p>
    <p><b>B.</b> Mengisolasi segmen kabel atau port switch yang bermasalah untuk memutus loop jaringan</p>
    <p><b>C.</b> Mengganti seluruh kabel jaringan di laboratorium sekaligus</p>
    <p><b>D.</b> Mematikan suplai listrik laboratorium</p>
    <p><b>KUNCI:</b> B</p>
    <p><b>PEMBAHASAN:</b> Mengisolasi port switch memutus loop broadcast storm tanpa mematikan server ujian.</p>

    <p class="separator">---</p>
    <p><span class="badge">5. MENJODOHKAN (matching)</span></p>
    <p><b>TIPE:</b> matching</p>
    <p><b>PERTANYAAN:</b> Jodohkan nama protokol jaringan di sebelah kiri dengan fungsi utamanya di sebelah kanan:</p>
    <p><b>PASANGAN:</b></p>
    <p>HTTP = Protokol transfer dokumen web berbasis teks & multimedia</p>
    <p>FTP = Protokol transfer pengiriman berkas antar komputer</p>
    <p>DNS = Sistem penerjemah nama domain menjadi alamat IP numerik</p>
    <p>DHCP = Layanan konfigurasi otomatisasi alamat IP untuk klien</p>
    <p><b>PEMBAHASAN:</b> Pasangan protokol jaringan sesuai dengan standar OSI layer aplikasi.</p>
</body>
</html>`;
      return new Response(docHtml, {
        headers: {
          "Content-Type": "application/msword;charset=utf-8",
          "Content-Disposition": 'attachment; filename="Template_Import_Soal_ExamLAN_Pro.doc"',
        },
      });
    }

    // Default: CSV / Excel template
    const csv =
      "tipe,pertanyaan,teks_kasus,pernyataan,alasan,opsi_a,opsi_b,opsi_c,opsi_d,opsi_e,kunci_jawaban,pasangan_menjodohkan,pembahasan\r\n" +
      'mc,"Komponen komputer manakah yang berfungsi sebagai penyimpan data sementara saat sistem menyala?",,,,"RAM (Random Access Memory)","Harddisk / SSD","Power Supply Unit","Kartu Grafis (GPU)",,A,,"RAM menyimpan instruksi dan data komputasi yang sedang aktif dijalankan sistem."\r\n' +
      'complex,"Manakah yang tergolong perangkat masukan (input device)? (Pilih beberapa)",,,,"Keyboard","Monitor Layar","Mouse Optik","Speaker","Scanner Dokumen","A,C,E",,"Keyboard, Mouse, dan Scanner merupakan perangkat masukan data pengguna."\r\n' +
      'cause_effect,,"","Peningkatan emisi gas rumah kaca dapat mempercepat pemanasan global.","Gas rumah kaca seperti karbon dioksida memerangkap radiasi panas matahari di atmosfer bumi.",,,,,,"A",,"Pernyataan BENAR, Alasan BENAR, dan keduanya menunjukkan hubungan sebab akibat."\r\n' +
      'case_analysis,"Berdasarkan studi kasus di atas, apa tindakan mitigasi awal yang paling tepat untuk menormalkan sistem?","Sebuah laboratorium komputer sekolah mengalami gangguan jaringan lokal (LAN) saat pelaksanaan ujian berlangsung akibat adanya indikasi broadcast storm dari port salah satu switch.",,,"Merestart server ujian secara tiba-tiba tanpa backup","Mengisolasi segmen kabel atau port switch yang bermasalah untuk memutus loop","Mengganti seluruh kabel jaringan di laboratorium sekaligus","Mematikan sambungan listrik utama laboratorium",,"B",,"Mengisolasi port/segmen bermasalah langsung memutus broadcast storm tanpa mematikan server utama."\r\n' +
      'matching,"Jodohkan nama protokol jaringan berikut dengan fungsi utamanya:",,,,,,,,,,"HTTP=Transfer Dokumen Web|FTP=Transfer Berkas|DNS=Penerjemah Domain ke IP|DHCP=Pemberi IP Otomatis","Pasangan protokol jaringan sesuai fungsinya."\r\n';

    return new Response("\ufeff" + csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": 'attachment; filename="Template_Import_Soal_ExamLAN_Pro.csv"',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
