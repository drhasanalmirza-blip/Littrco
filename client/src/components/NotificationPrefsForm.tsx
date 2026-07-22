import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Plus, Phone, Thermometer, Wind } from "lucide-react";

export interface NotificationChannels {
  email: boolean;
  sms: boolean;
  call: boolean;
  push: boolean;
}

export interface NotificationEvents {
  full: boolean;
  fillLevels: number[];
  fire: boolean;
  tempHigh: boolean;
  vocHigh: boolean;
  offline: boolean;
  drops: boolean;
  /** Personal gate: only notify high-temp when the reading is ≥ this °C. null = any. */
  tempThresholdC: number | null;
  /** Personal gate: only notify high-VOC when the reading is ≥ this %. null = any. */
  vocThresholdPct: number | null;
}

export type PhoneSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface PhoneEntry {
  number: string;
  sms: boolean;
  call: boolean;
  minSeverity: PhoneSeverity;
}

export interface NotificationPrefs {
  shopId?: number | null;
  channelsJson: NotificationChannels;
  eventsJson: NotificationEvents;
  phone: string | null;
  phonesJson: PhoneEntry[];
  updatedAt?: string;
}

export interface NotificationPrefsFormProps {
  /** URL to GET the effective (defaults-merged) prefs. */
  getUrl: string;
  /** URL to PUT { channelsJson, eventsJson, phonesJson }. */
  putUrl: string;
  /** Whether the underlying query should run (usual auth/id gate). */
  enabled: boolean;
  /** Card title; defaults to "Notification Preferences". */
  title?: string;
}

const CHANNELS: { key: keyof NotificationChannels; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "call", label: "Phone call" },
  { key: "push", label: "Push" },
];

const EVENTS: { key: "full" | "fire" | "tempHigh" | "vocHigh" | "offline" | "drops"; label: string }[] = [
  { key: "full", label: "Bin full (100%)" },
  { key: "fire", label: "Fire / smoke" },
  { key: "tempHigh", label: "High temperature" },
  { key: "vocHigh", label: "High VOC" },
  { key: "offline", label: "Device offline" },
  { key: "drops", label: "New drops" },
];

const SEVERITY_OPTIONS: { value: PhoneSeverity; label: string }[] = [
  { value: "INFO", label: "All alerts" },
  { value: "WARNING", label: "Warnings + critical" },
  { value: "CRITICAL", label: "Critical only" },
];

const DEFAULT_CHANNELS: NotificationChannels = { email: true, sms: false, call: false, push: false };
const DEFAULT_EVENTS: NotificationEvents = {
  full: true,
  fillLevels: [],
  fire: true,
  tempHigh: false,
  vocHigh: false,
  offline: false,
  drops: false,
  tempThresholdC: null,
  vocThresholdPct: null,
};

const cToF = (c: number) => Math.round((c * 9) / 5 + 32);
const fToC = (f: number) => Math.round(((f - 32) * 5) / 9);

export default function NotificationPrefsForm({
  getUrl,
  putUrl,
  enabled,
  title = "Notification Preferences",
}: NotificationPrefsFormProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data } = useQuery<NotificationPrefs>({
    queryKey: [getUrl],
    queryFn: () => apiJson<NotificationPrefs>(getUrl),
    enabled,
  });

  const [channels, setChannels] = useState<NotificationChannels>(DEFAULT_CHANNELS);
  const [events, setEvents] = useState<NotificationEvents>(DEFAULT_EVENTS);
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [newLevel, setNewLevel] = useState<string>("");
  const [newPhone, setNewPhone] = useState<string>("");
  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");

  // Sync local editable state from server whenever fresh prefs load.
  useEffect(() => {
    if (!data) return;
    setChannels({ ...DEFAULT_CHANNELS, ...(data.channelsJson || {}) });
    setEvents({
      ...DEFAULT_EVENTS,
      ...(data.eventsJson || {}),
      fillLevels: Array.isArray(data.eventsJson?.fillLevels) ? data.eventsJson.fillLevels : [],
    });
    if (Array.isArray(data.phonesJson) && data.phonesJson.length > 0) {
      setPhones(data.phonesJson);
    } else if (data.phone) {
      // Legacy single number carries over as the first entry
      setPhones([{ number: data.phone, sms: data.channelsJson?.sms ?? false, call: data.channelsJson?.call ?? false, minSeverity: "WARNING" }]);
    } else {
      setPhones([]);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiSend(putUrl, "PUT", {
        channelsJson: channels,
        eventsJson: events,
        phonesJson: phones,
      }),
    onSuccess: () => {
      toast({ title: "Notification preferences saved" });
      qc.invalidateQueries({ queryKey: [getUrl] });
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const addLevel = () => {
    const n = Math.round(Number(newLevel));
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      toast({ title: "Enter a level between 1 and 100", variant: "destructive" });
      return;
    }
    if (events.fillLevels.includes(n)) {
      setNewLevel("");
      return;
    }
    if (events.fillLevels.length >= 10) {
      toast({ title: "At most 10 fill levels", variant: "destructive" });
      return;
    }
    setEvents((prev) => ({
      ...prev,
      fillLevels: [...prev.fillLevels, n].sort((a, b) => a - b),
    }));
    setNewLevel("");
  };

  const removeLevel = (n: number) =>
    setEvents((prev) => ({ ...prev, fillLevels: prev.fillLevels.filter((x) => x !== n) }));

  const addPhone = () => {
    const number = newPhone.trim();
    if (number.length < 3) {
      toast({ title: "Enter a valid phone number", variant: "destructive" });
      return;
    }
    if (phones.length >= 5) {
      toast({ title: "At most 5 numbers", variant: "destructive" });
      return;
    }
    setPhones((prev) => [...prev, { number, sms: true, call: false, minSeverity: "WARNING" }]);
    setNewPhone("");
  };

  const patchPhone = (i: number, patch: Partial<PhoneEntry>) =>
    setPhones((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const removePhone = (i: number) => setPhones((prev) => prev.filter((_, idx) => idx !== i));

  const tempDisplay =
    events.tempThresholdC == null ? "" : tempUnit === "C" ? String(Math.round(events.tempThresholdC)) : String(cToF(events.tempThresholdC));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Channels */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Channels</Label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CHANNELS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={channels[key]}
                  onCheckedChange={(v) => setChannels((prev) => ({ ...prev, [key]: v }))}
                  data-testid={`switch-channel-${key}`}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Email is delivered today. SMS, phone call, and push are stored and will activate when
            those providers go live. SMS/call go to the numbers below.
          </p>
        </div>

        {/* Events */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Alert events</Label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {EVENTS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={events[key]}
                  onCheckedChange={(v) => setEvents((prev) => ({ ...prev, [key]: v }))}
                  data-testid={`switch-event-${key}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Personal reading thresholds */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">My reading thresholds</Label>
          <p className="text-xs text-muted-foreground">
            Your personal minimums for high-temperature and high-VOC notifications — separate from
            the bin's own fire settings and from other accounts' thresholds.
          </p>

          {/* VOC */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Wind className="h-4 w-4 text-muted-foreground" />
                VOC level minimum
                {events.vocThresholdPct != null && (
                  <Badge variant="secondary">{Math.round(events.vocThresholdPct)}%</Badge>
                )}
              </span>
              <Switch
                checked={events.vocThresholdPct != null}
                onCheckedChange={(v) =>
                  setEvents((prev) => ({ ...prev, vocThresholdPct: v ? 75 : null }))
                }
                data-testid="switch-voc-threshold"
              />
            </div>
            {events.vocThresholdPct != null && (
              <>
                <Slider
                  value={[Math.round(events.vocThresholdPct)]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setEvents((prev) => ({ ...prev, vocThresholdPct: v }))}
                  data-testid="slider-voc-threshold"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: <button type="button" className="underline" onClick={() => setEvents((p) => ({ ...p, vocThresholdPct: 75 }))}>75%</button> — avoids frequent false alarms from nearby vaping or smoke.
                </p>
              </>
            )}
          </div>

          {/* Temperature */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <Thermometer className="h-4 w-4 text-muted-foreground" />
                Temperature minimum
                {events.tempThresholdC != null && (
                  <Badge variant="secondary">
                    {tempUnit === "C" ? `${Math.round(events.tempThresholdC)}°C` : `${cToF(events.tempThresholdC)}°F`}
                  </Badge>
                )}
              </span>
              <Switch
                checked={events.tempThresholdC != null}
                onCheckedChange={(v) =>
                  setEvents((prev) => ({ ...prev, tempThresholdC: v ? 40 : null }))
                }
                data-testid="switch-temp-threshold"
              />
            </div>
            {events.tempThresholdC != null && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="w-28"
                  value={tempDisplay}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setEvents((prev) => ({
                      ...prev,
                      tempThresholdC: tempUnit === "C" ? n : fToC(n),
                    }));
                  }}
                  data-testid="input-temp-threshold"
                />
                <div className="flex overflow-hidden rounded-md border">
                  {(["C", "F"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setTempUnit(u)}
                      className={`px-3 py-1.5 text-sm ${tempUnit === u ? "bg-green-500 text-white" : "bg-background hover:bg-muted"}`}
                      data-testid={`button-temp-unit-${u}`}
                    >
                      °{u}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fill-level thresholds */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Fill-level alerts (%)</Label>
          <div className="flex flex-wrap items-center gap-2">
            {events.fillLevels.length === 0 && (
              <span className="text-sm text-muted-foreground">No fill-level alerts set.</span>
            )}
            {events.fillLevels.map((n) => (
              <Badge key={n} variant="secondary" className="gap-1 pr-1">
                {n}%
                <button
                  type="button"
                  onClick={() => removeLevel(n)}
                  className="ml-1 rounded-sm hover:opacity-70"
                  aria-label={`Remove ${n}%`}
                  data-testid={`chip-remove-fill-${n}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={100}
              value={newLevel}
              onChange={(e) => setNewLevel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLevel();
                }
              }}
              placeholder="e.g. 80"
              className="w-28"
              data-testid="input-fill-level"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addLevel}
              disabled={events.fillLevels.length >= 10}
              data-testid="button-add-fill-level"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Up to 10 thresholds, each 1–100%.</p>
        </div>

        {/* Phone numbers */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Phone numbers (SMS / calls)</Label>
          <p className="text-xs text-muted-foreground">
            Add up to 5 numbers, each with its own channels and alert level. If the same number is
            on multiple accounts, it's contacted once with the combined channels — never duplicated.
          </p>
          <div className="space-y-2">
            {phones.map((p, i) => (
              <div
                key={`${p.number}-${i}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                data-testid={`row-phone-${i}`}
              >
                <span className="flex min-w-36 items-center gap-2 font-mono text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {p.number}
                </span>
                <label className="flex items-center gap-1.5 text-sm">
                  <Switch checked={p.sms} onCheckedChange={(v) => patchPhone(i, { sms: v })} data-testid={`switch-phone-sms-${i}`} />
                  SMS
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <Switch checked={p.call} onCheckedChange={(v) => patchPhone(i, { call: v })} data-testid={`switch-phone-call-${i}`} />
                  Call
                </label>
                <Select value={p.minSeverity} onValueChange={(v) => patchPhone(i, { minSeverity: v as PhoneSeverity })}>
                  <SelectTrigger className="w-44" data-testid={`select-phone-severity-${i}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => removePhone(i)}
                  aria-label={`Remove ${p.number}`}
                  data-testid={`button-remove-phone-${i}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPhone();
                }
              }}
              placeholder="+1 (555) 123-4567"
              className="max-w-xs"
              data-testid="input-new-phone"
            />
            <Button type="button" variant="outline" onClick={addPhone} disabled={phones.length >= 5} data-testid="button-add-phone">
              <Plus className="mr-1 h-4 w-4" />
              Add number
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending || !enabled}
            data-testid="button-save-notification-prefs"
          >
            {save.isPending ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
