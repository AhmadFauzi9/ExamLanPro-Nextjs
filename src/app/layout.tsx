import type { Metadata } from "next";
import "./globals.css";
import { AppDialogContainer } from "@/components/common/AppDialog";

export const metadata: Metadata = {
  title: "ExamLAN Pro - Sistem Evaluasi Lab Komputer",
  description: "Platform ujian CBT sekolah berbasis LAN",
  icons: {
    icon: "/icon/checklist-svgrepo-com.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <head>
        {/* Local Offline Script Assets */}
        <script src="/js/xlsx.full.min.js" defer />
        {/* Local Offline Inter Font */}
        <link rel="stylesheet" href="/fonts/inter/inter.css" />
        {/* Local Offline FontAwesome Assets */}
        <link rel="stylesheet" href="/fontawesome/css/all.min.css" />
        {/* CDN Fallbacks */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />
      </head>
      <body className="bg-slate-50 text-slate-800 font-sans min-h-screen flex flex-col m-0 p-0 overflow-x-clip">
        {children}
        <AppDialogContainer />
      </body>
    </html>
  );
}
