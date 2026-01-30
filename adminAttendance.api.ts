// src/api/adminAttendance.api.ts
import { api } from "../lib/api";

export type AttendanceReportRow = Record<string, any>;

export type AdminAttendanceReportResponse = {
  rows?: AttendanceReportRow[];
  data?: AttendanceReportRow[];
} & Record<string, any>;

export async function fetchAdminAttendanceReport(params: {
  period: "month" | "day";
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}): Promise<AdminAttendanceReportResponse> {
  const qs = new URLSearchParams();
  qs.set("period", params.period);
  qs.set("start_date", params.start_date);
  qs.set("end_date", params.end_date);
  return await api(`/api/admin/attendance/report?${qs.toString()}`);
}
