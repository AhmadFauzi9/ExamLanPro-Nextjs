export type Tab =
  | "quizzes"
  | "students"
  | "results"
  | "monitor"
  | "extensions"
  | "audit"
  | "settings";

export interface MonitorRow {
  id: string;
  quiz_id: number;
  nis: string;
  name: string;
  student_id?: number | string;
  class_name: string;
  title: string;
  status: string;
  started_at: string;
  expires_at: string;
  ends_at?: string;
  submitted_at?: string;
  last_seen_at?: string;
  ip?: string;
  attempt_number?: number;
  remaining_time?: string;
  extra_minutes?: number;
  score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  violation_count: number;
  violations?: number;
  answered_count: number;
  total_questions?: number;
  time_remaining_seconds?: number;
  last_active?: string | null;
  updated_at?: string | null;
  is_in_progress?: boolean;
  attempt_id?: string;
  completed_at?: string | null;
  exam_type?: string;
  quiz_title?: string;
  score_percentage?: number | null;
}

export type Quiz = {
  id: number;
  title: string;
  subject: string;
  class_name: string;
  exam_token: string;
  status: string;
  question_count: number;
  max_questions?: number;
  duration_minutes?: number;
  start_at?: string;
  end_at?: string;
  description?: string;
  review_enabled?: number;
  kkm?: number;
  quiz_type?: string;
};

export type Question = {
  id: number;
  position: number;
  quiz_id?: number;
  type: string;
  content: string;
  question_text?: string;
  passage?: string;
  options: any;
  answer_key: any;
  correct_answer?: any;
  points: number;
  explanation?: string;
  image_url?: string;
};

export type Student = {
  id: number;
  nis: string;
  name: string;
  class_name: string;
  section_name?: string;
  homeroom_teacher?: string;
  academic_year?: string;
  photo_url?: string;
  password?: string;
  active: number;
};

export type TimeExtensionReq = {
  id: number;
  attempt_id: string;
  nis: string;
  student_name: string;
  name?: string;
  class_name: string;
  quiz_title: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_minutes: number;
  approved_minutes?: number;
  reason?: string;
  created_at: string;
};

export type ExtensionRequest = TimeExtensionReq;

export type AuditLog = {
  id: number;
  created_at: string;
  actor: string;
  action: string;
  entity?: string;
  entity_id?: string;
  ip?: string;
  detail?: any;
};

export type BackupFile = {
  file: string;
  size: number;
  created_at: string;
};

export async function apiJson(resOrPromise: Response | Promise<Response>): Promise<any> {
  const res = "then" in resOrPromise ? await resOrPromise : resOrPromise;
  const json = await res.json();
  if (!res.ok) {
    const msg = json.error || json.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json.data !== undefined ? json.data : json;
}

export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
