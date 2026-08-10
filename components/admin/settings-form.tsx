// components/admin/settings-form.tsx — event name/place/deadline form.

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Select as SelectUI,
  SelectContent as SelectContentUI,
  SelectItem as SelectItemUI,
  SelectTrigger as SelectTriggerUI,
  SelectValue as SelectValueUI,
} from "@/components/ui/select";

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
            <Label htmlFor="eventName">Event Name</Label>
            <Input
              id="eventName"
              value={name}
              onChange={(e) => sync("name", e.target.value)}
              placeholder="e.g. Summer Gala 2024"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventPlace">Location</Label>
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
            <Label>Deadline</Label>
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
                  onSelect={handleDateSelect}
                  captionLayout="dropdown"
                />
                <div className="flex items-center gap-2 border-t border-white/8 p-3">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <SelectUI value={selectedTime} onValueChange={(v) => v && handleTimeChange(v)}>
                    <SelectTriggerUI className="ml-auto h-8 w-[120px]">
                      <span>
                        {(() => {
                          const [hh, mm] = selectedTime.split(":");
                          const h24 = Number(hh);
                          const h12 = (h24 % 12) || 12;
                          return `${String(h12).padStart(2,"0")}:${mm} ${h24 < 12 ? "AM" : "PM"}`;
                        })()}
                      </span>
                    </SelectTriggerUI>
                    <SelectContentUI>
                      {Array.from({ length: 48 }, (_, i) => {
                        const h = Math.floor(i / 2);
                        const m = i % 2 === 0 ? "00" : "30";
                        const val = `${String(h).padStart(2, "0")}:${m}`;
                        const h12 = (h % 12) || 12;
                        const label = `${String(h12).padStart(2, "0")}:${m} ${h < 12 ? "AM" : "PM"}`;
                        return <SelectItemUI key={val} value={val}>{label}</SelectItemUI>;
                      })}
                    </SelectContentUI>
                  </SelectUI>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
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

        <div className="relative rounded-xl bg-black/30 p-4">
          {(settings.name || settings.place || settings.deadline) && (
            <button
              onClick={() => setClearOpen(true)}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg text-destructive transition-colors hover:bg-destructive/10"
              title="Clear all settings"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <h4 className="mb-2 text-sm font-semibold text-white">Active Settings</h4>
          <p className="text-sm text-muted-foreground">
            <strong>Event:</strong>{" "}
            <span className="text-white">{settings.name || "—"}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Venue:</strong>{" "}
            <span className="text-white">{settings.place || "—"}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Time:</strong>{" "}
            <span className="text-white">
              {settings.deadline
                ? new Date(settings.deadline).toLocaleString()
                : "—"}
            </span>
            {settings.timezone && settings.timezone !== "auto" && (
              <span className="text-white">
                {" "}({getTzLabel(settings.timezone) ?? `UTC${settings.timezone}`})
              </span>
            )}
          </p>
          {settings.deadline && <DeadlineCountdown deadline={settings.deadline} />}
        </div>

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
