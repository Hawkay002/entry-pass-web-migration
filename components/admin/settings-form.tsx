// components/admin/settings-form.tsx — event name/place/deadline form.

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, CalendarIcon, Sparkles, DoorOpen } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { TimelineEventIcon, Location03Icon, TimeZoneIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings } from "@/hooks/use-settings";
import { saveSettings, clearSettings } from "@/app/actions/admin";
import { TIMEZONES, DEFAULT_TZ, getTzLabel } from "@/lib/timezones";
import { Switch } from "@/components/ui/switch";
import { GatePanel } from "@/components/admin/gate-panel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Calendar-clock icon (custom SVG — hugeicons calendar-clock-stroke-rounded). */
function CalendarClockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 2V6M7.5 2V6" />
      <path d="M20.3985 8C20.2706 6.69989 19.9816 5.82475 19.3284 5.17157C18.1569 4 16.2712 4 12.5 4H10.5C6.72876 4 4.84315 4 3.67157 5.17157C2.5 6.34315 2.5 8.22876 2.5 12V14C2.5 17.7712 2.5 19.6569 3.67157 20.8284C4.47975 21.6366 5.6277 21.8873 7.5 21.965" />
      <path d="M2.5 10H7.5" />
      <path d="M15.5 22C18.8137 22 21.5 19.3137 21.5 16C21.5 12.6863 18.8137 10 15.5 10C12.1863 10 9.5 12.6863 9.5 16C9.5 19.3137 12.1863 22 15.5 22Z" />
      <path d="M15.5 13V16L17.5 17" />
    </svg>
  );
}

export function SettingsForm({ isAdmin = false }: { isAdmin?: boolean }) {
  const { settings, loading } = useSettings();
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tz, setTz] = useState(DEFAULT_TZ);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [multiGate, setMultiGate] = useState(false);
  const [savedMultiGate, setSavedMultiGate] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("19:00");
  // Raw input strings for the time boxes — allow empty while typing.
  const [hourInput, setHourInput] = useState("");
  const [minuteInput, setMinuteInput] = useState("");

  async function handleClear() {
    setClearOpen(false);
    const res = await clearSettings();
    if (res.ok) {
      toast.success("Settings cleared");
      setName("");
      setPlace("");
      setDeadline("");
      setSelectedDate(undefined);
      setSelectedTime("19:00");
      setMultiGate(false);
      setSavedMultiGate(false);
      setEdited(false);
    } else {
      toast.error("Failed to clear settings");
    }
  }

  // Seed local state once when settings first arrive (not during render).
  useEffect(() => {
    if (!loading && !seeded && (settings.name || settings.place || settings.deadline)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed from server data
      setName(settings.name);
      setPlace(settings.place);
      // Strip any existing timezone offset so datetime-local shows a clean value.
      // "2026-08-04T17:00:00+05:30" → "2026-08-04T17:00"
      const cleanDeadline = settings.deadline
        ? settings.deadline.replace(/[+-]\d{2}:\d{2}(:\d{2})?$/, "").replace(/:\d{2}$/, "")
        : "";
      setDeadline(cleanDeadline);
      // Parse into Date + time for the Calendar + time picker.
      if (cleanDeadline) {
        const parsed = new Date(cleanDeadline);
        if (!isNaN(parsed.getTime())) {
          setSelectedDate(parsed);
          const hh = String(parsed.getHours()).padStart(2, "0");
          const mm = String(parsed.getMinutes()).padStart(2, "0");
          setSelectedTime(`${hh}:${mm}`);
        }
      }
      if (settings.timezone) setTz(settings.timezone);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed
      setMultiGate(Boolean(settings.multiGate));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed
      setSavedMultiGate(Boolean(settings.multiGate));
      setSeeded(true);
    }
  }, [loading, seeded, settings.name, settings.place, settings.deadline, settings.timezone, settings.multiGate]);

  // Sync the raw time input strings whenever selectedTime changes externally
  // (form seed, AM/PM toggle, date selection). Skips if the user is actively
  // typing in the boxes — those update on blur.
  useEffect(() => {
    const [hh, mm] = selectedTime.split(":");
    const h12 = (Number(hh) % 12) || 12;
    setHourInput(String(h12));
    setMinuteInput(mm || "00");
  }, [selectedTime]);

  // Sync savedMultiGate from remote when it changes (multi-device realtime).
  // Only updates if the user isn't mid-edit (no unsaved changes).
  useEffect(() => {
    if (!edited) {
      setMultiGate(Boolean(settings.multiGate));
      setSavedMultiGate(Boolean(settings.multiGate));
    }
  }, [settings.multiGate, edited]);

  function sync(field: "name" | "place" | "deadline", value: string) {
    setEdited(true);
    if (field === "name") setName(value);
    if (field === "place") setPlace(value);
    if (field === "deadline") setDeadline(value);
  }

  // Combine the Calendar date + time dropdown into a datetime-local string.
  function mergeDateTime(date: Date | undefined, time: string): string {
    if (!date) return "";
    const [hh, mm] = time.split(":");
    const d = new Date(date);
    d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${mo}-${da}T${h}:${mi}`;
  }

  function handleDateSelect(date: Date | undefined) {
    setSelectedDate(date);
    setDeadline(mergeDateTime(date, selectedTime));
    setEdited(true);
    setCalOpen(false);
  }

  function handleTimeChange(time: string) {
    setSelectedTime(time);
    setDeadline(mergeDateTime(selectedDate, time));
    setEdited(true);
  }

  async function handleSave() {
    setSaving(true);
    // Append the selected timezone offset to the deadline so the server
    // (running in UTC on Vercel) interprets it correctly.
    let offsetStr: string;
    if (tz === "auto") {
      const tzOffset = -new Date().getTimezoneOffset();
      offsetStr = `${tzOffset >= 0 ? "+" : ""}${String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, "0")}:${String(Math.abs(tzOffset) % 60).padStart(2, "0")}`;
    } else {
      offsetStr = tz;
    }
    const deadlineWithTz = deadline ? deadline + ":00" + offsetStr : deadline;
    const res = await saveSettings({ name, place, deadline: deadlineWithTz, timezone: tz, multiGate });
    setSaving(false);
    if (res.ok) {
      toast.success("Configuration saved");
      setSavedMultiGate(multiGate);
      setEdited(false);
    } else {
      toast.error("Save failed", { description: res.error });
    }
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Event Name + Location — 50/50 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="eventName" className="flex items-center gap-1.5">
              <HugeiconsIcon icon={TimelineEventIcon} size={14} primaryColor="#3b82f6" />
              Event Name
            </Label>
            <Input
              id="eventName"
              value={name}
              onChange={(e) => sync("name", e.target.value)}
              placeholder="e.g. Summer Gala 2024"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventPlace" className="flex items-center gap-1.5">
              <HugeiconsIcon icon={Location03Icon} size={14} primaryColor="#3b82f6" />
              Venue Location
            </Label>
            <Input
              id="eventPlace"
              value={place}
              onChange={(e) => sync("place", e.target.value)}
              placeholder="e.g. Grand Hall"
            />
          </div>
        </div>
        {/* Deadline + Timezone — 50/50 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarClockIcon size={14} />
              Deadline
            </Label>
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="h-8 w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-1.5 hidden h-3.5 w-3.5 sm:block" />
                    {selectedDate
                      ? (() => {
                          const [hh, mm] = selectedTime.split(":");
                          const h24 = Number(hh);
                          const h12 = (h24 % 12) || 12;
                          const ampm = h24 < 12 ? "AM" : "PM";
                          return `${selectedDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}, ${String(h12).padStart(2,"0")}:${mm} ${ampm}`;
                        })()
                      : <span className="text-muted-foreground">Pick date & time</span>}
                  </Button>
                }
              />
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => { setSelectedDate(date); setEdited(true); }}
                  captionLayout="dropdown"
                />
                <div className="flex items-center gap-2 border-t border-white/8 p-3">
                  <CalendarClockIcon size={14} />
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <div className="ml-auto flex items-center gap-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={hourInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setHourInput(raw);
                        if (raw === "") return;
                        const val = Math.min(12, Math.max(1, Number(raw)));
                        const mm = selectedTime.split(":")[1] || "00";
                        const isPM = Number(selectedTime.split(":")[0]) >= 12;
                        const h24 = val === 12 ? (isPM ? 12 : 0) : (isPM ? val + 12 : val);
                        handleTimeChange(`${String(h24).padStart(2, "0")}:${mm}`);
                      }}
                      onBlur={() => {
                        const val = Math.min(12, Math.max(1, Number(hourInput) || 12));
                        const h12 = String(val);
                        setHourInput(h12);
                        const mm = selectedTime.split(":")[1] || "00";
                        const isPM = Number(selectedTime.split(":")[0]) >= 12;
                        const h24 = val === 12 ? (isPM ? 12 : 0) : (isPM ? val + 12 : val);
                        handleTimeChange(`${String(h24).padStart(2, "0")}:${mm}`);
                      }}
                      className="h-8 w-[40px] text-center text-sm"
                      maxLength={2}
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={minuteInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
                        setMinuteInput(raw);
                        if (raw === "") return;
                        const val = String(Math.min(59, Number(raw))).padStart(2, "0");
                        const hh = selectedTime.split(":")[0] || "12";
                        handleTimeChange(`${hh}:${val}`);
                      }}
                      onBlur={() => {
                        const val = String(Math.min(59, Math.max(0, Number(minuteInput) || 0))).padStart(2, "0");
                        setMinuteInput(val);
                        const hh = selectedTime.split(":")[0] || "12";
                        handleTimeChange(`${hh}:${val}`);
                      }}
                      className="h-8 w-[40px] text-center text-sm"
                      maxLength={2}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-[42px] px-0 text-xs font-semibold"
                      onClick={() => {
                        const [hh, mm] = selectedTime.split(":");
                        const h24 = Number(hh);
                        const newH24 = h24 < 12 ? h24 + 12 : h24 - 12;
                        handleTimeChange(`${String(newH24).padStart(2, "0")}:${mm}`);
                      }}
                    >
                      {Number(selectedTime.split(":")[0]) >= 12 ? "PM" : "AM"}
                    </Button>
                  </div>
                </div>
                <div className="-mt-1 flex justify-end px-3 pb-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedDate}
                    onClick={() => {
                      setDeadline(mergeDateTime(selectedDate, selectedTime));
                      setEdited(true);
                      setCalOpen(false);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <HugeiconsIcon icon={TimeZoneIcon} size={14} primaryColor="#3b82f6" />
              Timezone
            </Label>
            <SearchableSelect
              value={tz}
              onChange={(v) => { setTz(v); setEdited(true); }}
              options={[
                { value: "auto", label: "Local (auto-detect)" },
                ...TIMEZONES.map((t) => ({ value: t.offset, label: t.label })),
              ]}
              placeholder="Timezone"
              dropAlign="left"
              mobileDropAlign="below"
              belowAlign="right"
              panelWidth="w-80"
            />
          </div>
        </div>

        {/* Multi-Gate Mode toggle — admin only */}
        {isAdmin && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/20 p-4">
          <div className="space-y-0.5">
            <Label htmlFor="multiGate" className="text-sm font-medium">
              Multi-Gate Mode
            </Label>
            <p className="text-xs text-muted-foreground">
              Assign tickets to gates by category. Wrong-gate scans are blocked.
            </p>
          </div>
          <Switch
            id="multiGate"
            checked={multiGate}
            onCheckedChange={(v) => { setMultiGate(v); setEdited(true); }}
          />
        </div>
        )}

        <Button onClick={handleSave} disabled={saving || (!edited && !loading)}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Configuration
        </Button>

        {/* Active Settings — premium card */}
        <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent p-5">
          {/* subtle glow */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-accent-secondary/5 blur-2xl" />
          {/* Clear button */}
          {(settings.name || settings.place || settings.deadline) && (
            <button
              onClick={() => setClearOpen(true)}
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
              title="Clear all settings"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          {/* Header */}
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-secondary" />
            <h4 className="text-sm font-semibold tracking-tight text-white">Active Settings</h4>
          </div>

          {/* Event name — the hero */}
          {settings.name && (
            <div className="mb-4 flex items-center gap-2">
              <HugeiconsIcon icon={TimelineEventIcon} size={24} primaryColor="#3b82f6" />
              <p className="text-2xl font-bold tracking-tight text-white">
                {settings.name}
              </p>
            </div>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Venue Location */}
            <div className="flex items-center gap-2.5 rounded-xl bg-black/30 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-secondary/10">
                <HugeiconsIcon icon={Location03Icon} size={16} primaryColor="#3b82f6" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Venue Location</p>
                <p className="truncate text-sm font-medium text-white">{settings.place || "—"}</p>
              </div>
            </div>
            {/* Deadline */}
            <div className="flex items-center gap-2.5 rounded-xl bg-black/30 p-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-secondary/10">
                <CalendarClockIcon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">Deadline</p>
                <p className="truncate text-sm font-medium text-white">
                  {settings.deadline
                    ? new Date(settings.deadline).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Timezone badge + multi-gate badge */}
          {(settings.timezone || settings.multiGate) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {settings.timezone && settings.timezone !== "auto" && (
                <Badge variant="outline" className="gap-1 text-[0.65rem] font-normal text-muted-foreground">
                  <HugeiconsIcon icon={TimeZoneIcon} size={10} primaryColor="#3b82f6" />
                  {getTzLabel(settings.timezone) ?? `UTC${settings.timezone}`}
                </Badge>
              )}
              {settings.multiGate && (
                <Badge variant="outline" className="gap-1 border-accent-secondary/30 text-[0.65rem] font-normal text-accent-secondary">
                  <DoorOpen className="h-2.5 w-2.5" />
                  Multi-Gate Active
                </Badge>
              )}
            </div>
          )}

          {/* Countdown */}
          {settings.deadline && <DeadlineCountdown deadline={settings.deadline} />}
        </div>

        <Separator className="my-2" />

        {/* Gate management — admin only, visible when multiGate is saved ON */}
        {isAdmin && savedMultiGate && (
          <div className="space-y-2 pt-2">
            <h4 className="text-sm font-semibold text-white">Gate Configuration</h4>
            <GatePanel />
          </div>
        )}
      </CardContent>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Settings?</DialogTitle>
            <DialogDescription>
              This will permanently remove the event name, venue, and deadline
              from the database.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function DeadlineCountdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState("");
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    function update() {
      const ms = new Date(deadline).getTime() - Date.now();
      if (ms <= 0) {
        setPassed(true);
        setRemaining("");
        return;
      }
      setPassed(false);
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (passed) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
        Deadline Passed
      </div>
    );
  }

  return (
    <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      Starts in {remaining}
    </div>
  );
}
