"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <main className="card max-w-lg p-8 text-center">
          <h1 className="text-2xl font-black">Terjadi kesalahan aplikasi</h1>
          <p className="mt-2 text-slate-500">
            Muat ulang halaman. Jika masalah berulang, hubungi administrator
            ExamLanPro.
          </p>
          <button className="btn-primary mt-5" onClick={reset}>
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
