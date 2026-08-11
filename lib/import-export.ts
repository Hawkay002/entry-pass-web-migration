// lib/import-export.ts — pure import-parse + export-format utilities.
// Faithful to the original (script.js:2006-2384) with type safety.

import type { Gender, Ticket, TicketStatus, TicketType } from "@/lib/types";
import type { LogEntry } from "@/lib/redis-log";

// ---------------- EXPORT HELPERS ----------------

/** Internal ticketType -> display label. */
export function displayTicketType(type: TicketType): string {
  if (type === "Gold") return "VVIP";
  if (type === "SVIP") return "SVIP";
  if (type === "Diamond") return "VIP";
  return "Classic";
}

/** Inverse of displayTicketType for import. */
export function parseTicketType(raw: string): TicketType {
  const v = raw.toLowerCase().trim();
  if (v === "vip") return "Diamond";
  if (v === "svip") return "SVIP";
  if (v === "vvip") return "Gold";
  if (v === "gold") return "Gold";
  if (v === "diamond") return "Diamond";
  return "Classic";
}

function parseStatus(raw: string): TicketStatus {
  const v = raw.toLowerCase().trim();
  if (v === "arrived" || v === "checked in") return "arrived";
  if (v === "absent") return "absent";
  return "coming-soon";
}

interface ExportRow {
  "S.No.": number;
  "Guest Name": string;
  "Ticket Type": string;
  Age: number | string;
  Gender: string;
  Phone: string;
  Status: string;
  "Ticket ID": string;
  Gate: string;
  "Entry Time": string;
}

function toExportRow(t: Ticket, index: number): ExportRow {
  return {
    "S.No.": index + 1,
    "Guest Name": t.name,
    "Ticket Type": displayTicketType(t.ticketType),
    Age: t.age,
    Gender: t.gender,
    Phone: t.phone,
    Status: t.status,
    "Ticket ID": t.id,
    Gate: t.gate ?? "",
    "Entry Time": t.scannedAt
      ? new Date(t.scannedAt).toLocaleString()
      : "",
  };
}

/** Trigger a client-side download of a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- CSV ----
export function exportCSV(tickets: Ticket[], filename: string) {
  const header =
    "S.No.,Guest Name,Ticket Type,Age,Gender,Phone,Status,Ticket ID,Gate,Entry Time";
  const rows = tickets.map((t, i) => {
    const cleanName = t.name.replace(/,/g, "");
    const entry = t.scannedAt
      ? new Date(t.scannedAt).toLocaleString().replace(/,/g, " ")
      : "";
    return `${i + 1},${cleanName},${displayTicketType(t.ticketType)},${t.age},${t.gender},${t.phone},${t.status},${t.id},${t.gate ?? ""},${entry}`;
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

// ---- JSON ----
export function exportJSON(tickets: Ticket[], filename: string) {
  const data = tickets.map((t, i) => ({
    s_no: i + 1,
    ticket_type: displayTicketType(t.ticketType),
    ...t,
  }));
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  downloadBlob(blob, `${filename}.json`);
}

// ---- TXT ----
export function exportTXT(tickets: Ticket[], filename: string) {
  let out = `GUEST LIST EXPORT - ${new Date().toLocaleString()}\n\n`;
  tickets.forEach((t, i) => {
    out += `${i + 1}. ${t.name.toUpperCase()}\n`;
    out += `   Type:    ${displayTicketType(t.ticketType)}\n`;
    out += `   Details: ${t.age} / ${t.gender}\n`;
    out += `   Phone:   ${t.phone}\n`;
    out += `   Status:  ${t.status.toUpperCase()}\n`;
    if (t.gate) out += `   Gate:    ${t.gate}\n`;
    if (t.scannedAt)
      out += `   Entry:   ${new Date(t.scannedAt).toLocaleTimeString()}\n`;
    out += `   ID:      ${t.id}\n`;
    out += `----------------------------------------\n`;
  });
  const blob = new Blob([out], { type: "text/plain;charset=utf-8;" });
  downloadBlob(blob, `${filename}.txt`);
}

// ---- DOC ----
export function exportDOC(tickets: Ticket[], filename: string) {
  let rows = "";
  tickets.forEach((t, i) => {
    rows += `<tr><td>${i + 1}</td><td>${t.name}</td><td>${displayTicketType(
      t.ticketType
    )}</td><td>${t.age} / ${t.gender}</td><td>${t.phone}</td><td>${
      t.status
    }</td><td>${t.gate ?? ""}</td></tr>`;
  });
  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Guest List</title></head><body><h2>Guest List Export</h2><table border="1" style="border-collapse:collapse;width:100%"><tr><th>S.No.</th><th>Name</th><th>Type</th><th>Age/Gender</th><th>Phone</th><th>Status</th><th>Gate</th></tr>${rows}</table></body></html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  downloadBlob(blob, `${filename}.doc`);
}

// ---- XLSX ----
export async function exportXLSX(tickets: Ticket[], filename: string) {
  const XLSX = await import("xlsx");
  const data = tickets.map((t, i) => toExportRow(t, i));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Guests");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ---- PDF ----
export async function exportPDF(tickets: Ticket[], filename: string) {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.text("Event Guest List", 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
  const head = [["#", "Name", "Type", "Age", "Gender", "Phone", "Status", "Entry Time"]];
  const body = tickets.map((t, i) => [
    i + 1,
    t.name,
    displayTicketType(t.ticketType),
    t.age,
    t.gender,
    t.phone,
    t.status.toUpperCase(),
    t.scannedAt ? new Date(t.scannedAt).toLocaleTimeString() : "--",
  ]);
  // @ts-expect-error autoTable is added by the plugin at runtime
  doc.autoTable({ head, body, startY: 32 });
  doc.save(`${filename}.pdf`);
}

/** Dispatch export by format string. */
export async function exportTickets(
  tickets: Ticket[],
  filename: string,
  format: string
) {
  switch (format) {
    case "csv":
      return exportCSV(tickets, filename);
    case "json":
      return exportJSON(tickets, filename);
    case "txt":
      return exportTXT(tickets, filename);
    case "doc":
      return exportDOC(tickets, filename);
    case "xlsx":
      return exportXLSX(tickets, filename);
    case "pdf":
      return exportPDF(tickets, filename);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// ---------------- ACTIVITY LOG EXPORTS ----------------

const LOG_ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  TICKET_CREATE: "Ticket Issue",
  SCAN_ENTRY: "Scan",
  SELF_CHECKIN: "Self Check-in",
  CONFIG_CHANGE: "Settings Change",
  HELP_CALL: "Help Call",
  TICKET_DELETE: "Ticket Deletion",
  FACTORY_RESET: "Factory Reset",
  LOCK_ACTION: "Lock Action",
  LOG_DELETE: "Log Deletion",
  EXPORT_DATA: "Data Export",
  IMPORT_DATA: "Data Import",
};

function logActionLabel(action: string): string {
  return LOG_ACTION_LABELS[action] ?? action;
}

function logRows(logs: LogEntry[]) {
  return logs.map((l) => ({
    Timestamp: new Date(l.timestamp).toLocaleString(),
    User: l.username,
    Email: l.userEmail,
    Action: logActionLabel(l.action),
    Details: l.details,
  }));
}

/** CSV export of activity logs. */
export function exportLogsCSV(logs: LogEntry[], filename: string) {
  const header = "Timestamp,User,Email,Action,Details";
  const rows = logRows(logs).map((r) =>
    [r.Timestamp, r.User, r.Email, r.Action, r.Details]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

/** XLSX export of activity logs. */
export async function exportLogsXLSX(logs: LogEntry[], filename: string) {
  const XLSX = await import("xlsx");
  const data = logRows(logs);
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activity Logs");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** PDF export of activity logs (table, auto-paginated). */
export async function exportLogsPDF(logs: LogEntry[], filename: string) {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.text("Activity Logs", 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 26);
  const head = [["Timestamp", "User", "Email", "Action", "Details"]];
  const body = logRows(logs).map((r) => [
    r.Timestamp,
    r.User,
    r.Email,
    r.Action,
    r.Details,
  ]);
  // @ts-expect-error autoTable is added by the plugin at runtime
  doc.autoTable({ head, body, startY: 32 });
  doc.save(`${filename}.pdf`);
}

// ---------------- IMPORT HELPERS ----------------

export interface ParsedTicket {
  id?: string;
  name: string;
  phone: string; // 10 digits, no prefix
  gender: Gender;
  age: string;
  ticketType: TicketType;
  status: TicketStatus;
  entryTimeRaw?: string;
}

/** Strip non-alphanumeric and lowercase a key for alias matching. */
function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Map a raw record to a normalized ticket (alias-aware). */
export function normalizeRecord(raw: Record<string, unknown>): ParsedTicket {
  const keys = Object.keys(raw);
  const getVal = (...aliases: string[]): string => {
    const key = keys.find((k) =>
      aliases.includes(normalizeKey(k))
    );
    if (!key) return "";
    return String(raw[key] ?? "").trim();
  };

  const phoneRaw = getVal("phone", "contact", "mobile");
  const phone = phoneRaw.replace(/\D/g, "").slice(-10);
  const statusRaw = getVal("status", "state");
  const typeRaw = getVal("tickettype", "type");

  return {
    id: getVal("ticketid", "id") || undefined,
    name: getVal("guestname", "name", "fullname") || "Unknown",
    phone,
    gender: (getVal("gender", "sex") as Gender) || "Other",
    age: getVal("age") || "18",
    ticketType: parseTicketType(typeRaw),
    status: parseStatus(statusRaw),
    entryTimeRaw: getVal("entrytime", "entry", "scannedat", "time") || undefined,
  };
}

/** Auto-detect CSV delimiter (comma/tab/semicolon/pipe). */
export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const candidates = [",", "\t", ";", "|"];
  let delimiter = ",";
  let maxCount = 1;
  for (const d of candidates) {
    const count = lines[0].split(d).length;
    if (count > maxCount) {
      maxCount = count;
      delimiter = d;
    }
  }

  const headers = lines[0]
    .split(delimiter)
    .map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));

  const result: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter);
    const row: Record<string, string> = {};
    let hasData = false;
    headers.forEach((h, idx) => {
      const val = (cells[idx]?.trim() ?? "").replace(/^"|"$/g, "");
      row[h] = val;
      if (val) hasData = true;
    });
    if (hasData) result.push(row);
  }
  return result;
}

/** Parse an imported file into normalized tickets. */
export async function parseImportFile(file: File): Promise<ParsedTicket[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let rawRecords: Record<string, unknown>[] = [];

  if (ext === "json") {
    const text = await file.text();
    rawRecords = JSON.parse(text);
  } else if (ext === "csv" || ext === "txt") {
    const text = await file.text();
    rawRecords = parseCSV(text);
  } else if (ext === "xlsx") {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rawRecords = XLSX.utils.sheet_to_json(sheet);
  } else {
    throw new Error("Unsupported file format");
  }

  return rawRecords
    .map((r) => normalizeRecord(r))
    .filter((r) => r.name && r.phone);
}

/** Parse an imported date string/number into epoch ms (or null). */
export function parseImportedDate(input: unknown): number | null {
  if (typeof input === "number") {
    if (input > 25569 && input < 2958465) {
      return Math.round((input - 25569) * 86400 * 1000);
    }
    if (input > 1000000000000) return input;
    return null;
  }
  if (typeof input !== "string") return null;
  const parsed = Date.parse(input);
  if (!isNaN(parsed)) return parsed;
  const m = input.match(
    /^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/
  );
  if (m) {
    return new Date(
      Number(m[3]),
      Number(m[2]) - 1,
      Number(m[1]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
      Number(m[6] ?? 0)
    ).getTime();
  }
  return null;
}
