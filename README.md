# ExamLanPro Next

Versi full-stack Next.js, Tailwind CSS, dan MySQL dari ExamLanPro. Proyek ini sengaja terpisah dari aplikasi PHP lama agar migrasi dapat diuji tanpa mengganggu sistem aktif.

## Menjalankan

1. Salin `.env.example` menjadi `.env.local`, lalu isi koneksi MySQL dan `AUTH_SECRET` acak minimal 32 karakter.
2. Jalankan `npm install`.
3. Jalankan `npm run db:init` untuk membuat database/tabel secara idempoten.
4. Jalankan `npm run db:seed` untuk membuat admin pertama. Seeder tidak menimpa akun/password yang sudah ada.
5. Jalankan `npm run dev`, lalu buka `http://localhost:3000` dan `/guru`.

## Modul yang tersedia

- Identitas siswa berbasis NIS, nama/kelas otomatis, token ujian enam karakter.
- Jadwal, kelas, token, status ujian, dan batas waktu ditegakkan server-side.
- Sesi/resume, pengacakan soal, autosave, timer, fullscreen, pencatatan perpindahan tab/fokus.
- Pilihan ganda, pilihan ganda kompleks, sebab-akibat, analisis kasus, menjodohkan, esai, dan skala.
- Penilaian server-side; esai ditandai untuk pemeriksaan manual.
- Portal guru: ringkasan, siswa, paket/bank soal, monitoring, hasil, notifikasi, audit, pengaturan.
- Skema perpanjangan waktu, review guru, audit log, soft-delete, dan pengaturan aplikasi.

## Catatan migrasi

Data lama tersimpan sebagai JSON. Migrasi produksi sebaiknya dilakukan dengan skrip impor khusus setelah pemetaan dan backup; jangan menunjuk versi baru langsung ke data produksi sebelum rekonsiliasi jumlah siswa, paket, soal, dan hasil.
