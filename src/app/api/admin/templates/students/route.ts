import { requireRole } from "@/lib/auth";
import { apiError } from "@/lib/security";

export async function GET() {
  try {
    await requireRole("ADMIN", "TEACHER");
    const csv =
      "No Induk,Nama,Kelas,Tahun Ajaran\r\n" +
      "1001,Ahmad Fauzi,7A,2026/2027\r\n" +
      "1002,Budi Santoso,7A,2026/2027\r\n" +
      "1003,Citra Dewi,7B,2026/2027\r\n" +
      "1004,Dwi Prasetyo,8A,2026/2027\r\n" +
      "1005,Eka Rahmawati,9C,2026/2027\r\n";
    return new Response("\ufeff" + csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": 'attachment; filename="Template_Data_Siswa.csv"',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
