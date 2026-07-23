import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Save, Play, Loader2, AlertTriangle, RefreshCcw } from "lucide-react";
import {
  DEFAULT_DEVICE_SETTINGS,
  mergeDeviceSettings,
  fireActionSchema,
  vocPctFromAnalog,
  vocAnalogFromPct,
  VOC_RECOMMENDED_PCT,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  type DeviceSettingsJson,
  type FireAction,
} from "@shared/deviceSettings";

interface BinSettingsProps {
  device: any; // selected device object (incl. id, serial)
  enabled: boolean;
}

interface SettingsResp {
  settingsJson: DeviceSettingsJson;
  version: number;
}

interface LiveFill {
  fillPercent: number;
  rawDistanceMm: number | null;
  lastHeartbeatAt: string | null;
}

// Bin-local fire actions only (what the bin itself does). Emails/SMS/calls are
// configured per-user in the Notifications tab, not here.
const ACTIONS = fireActionSchema.options; // ["DISPLAY","ALARM"]
const ACTION_LABELS: Record<FireAction, string> = {
  DISPLAY: "Show warning on screen",
  ALARM: "Sound the bin alarm",
};

// Common IANA timezones (US-focused since LITTR operates in upstate NY, plus a
// few majors) — a dropdown instead of a free-text field.
const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Halifax",
  "UTC",
];

const FIRE_MODES = [
  { value: "0", label: "Temperature only" },
  { value: "1", label: "VOC only" },
  { value: "2", label: "Either (temp or VOC)" },
  { value: "3", label: "Both (temp and VOC)" },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

// Build the minimal structured patch of only the leaves that changed. Nested
// plain objects recurse; arrays / scalars replace wholesale (server deep-merges).
function buildPatch(base: any, next: any): any {
  const out: any = {};
  for (const k of Object.keys(next ?? {})) {
    const b = base?.[k];
    const n = next[k];
    if (isPlainObject(n) && isPlainObject(b)) {
      const sub = buildPatch(b, n);
      if (Object.keys(sub).length) out[k] = sub;
    } else if (!deepEqual(b, n)) {
      out[k] = n;
    }
  }
  return out;
}

export default function BinSettings({ device, enabled }: BinSettingsProps) {
  const id: number | undefined = device?.id;
  const { toast } = useToast();
  const qc = useQueryClient();
  const isStaff = useStore((s) => s.role) === "staff";

  const settingsUrl = `/api/partner/devices/${id}/settings`;

  const { data, isLoading, error } = useQuery<SettingsResp>({
    queryKey: [settingsUrl],
    queryFn: () => apiJson<SettingsResp>(settingsUrl),
    enabled: enabled && !!id,
  });

  const [baseline, setBaseline] = useState<DeviceSettingsJson | null>(null);
  const [form, setForm] = useState<DeviceSettingsJson | null>(null);
  // Which device the current baseline/form belong to. On a device switch the
  // settings query key changes and `data` returns to undefined while the new
  // device loads; tracking the loaded id lets us ignore the stale form during
  // that window so we never PUT one bin's edits to another bin.
  const [loadedId, setLoadedId] = useState<number | undefined>(undefined);

  // (Re)initialise the editable form whenever fresh settings arrive (mount,
  // device switch, or post-save refetch). Defensive: settingsJson may be {} or
  // missing nested keys, so merge onto DEFAULT_DEVICE_SETTINGS.
  useEffect(() => {
    if (!data) return;
    const merged = mergeDeviceSettings(
      DEFAULT_DEVICE_SETTINGS as Record<string, unknown>,
      (data.settingsJson ?? {}) as Record<string, unknown>,
    ) as DeviceSettingsJson;
    setBaseline(clone(merged));
    setForm(clone(merged));
    setLoadedId(id);
  }, [data, id]);

  // The form is only trustworthy once the loaded settings match the selected
  // device. Until then (in-flight switch) treat it as not-dirty so Save is inert.
  const synced = baseline != null && form != null && loadedId === id;
  const patch = useMemo(
    () => (synced ? buildPatch(baseline, form) : {}),
    [synced, baseline, form],
  );
  const dirty = Object.keys(patch).length > 0;

  // Section-scoped immutable updater.
  const setSection = <K extends keyof DeviceSettingsJson>(
    section: K,
    values: Record<string, unknown>,
  ) =>
    setForm((f) =>
      f ? ({ ...f, [section]: { ...((f[section] as any) ?? {}), ...values } }) : f,
    );

  const [tempUnit, setTempUnit] = useState<"C" | "F">("C");

  const toggleAction = (
    group: "onBoth" | "onTempOnly" | "onVocOnly",
    action: FireAction,
    checked: boolean,
  ) =>
    setForm((f) => {
      if (!f) return f;
      const fire: any = f.fire ?? {};
      const set = new Set<FireAction>(fire[group] ?? []);
      if (checked) set.add(action);
      else set.delete(action);
      const next = ACTIONS.filter((a) => set.has(a));
      return { ...f, fire: { ...fire, [group]: next } };
    });

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiSend<any>(settingsUrl, "PUT", body),
    onSuccess: (res) => {
      // Reset the dirty baseline immediately; the invalidated query refetch is
      // authoritative and will re-sync form + version.
      setForm((f) => {
        if (f) setBaseline(clone(f));
        return f;
      });
      const v = typeof res?.version === "number" ? res.version : undefined;
      toast({
        title: "Settings saved",
        description:
          (v != null ? `Now v${v}. ` : "") + "Bin will pull on its next poll.",
      });
      qc.invalidateQueries({ queryKey: [settingsUrl] });
    },
    onError: (e: any) =>
      toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  // ---- Live fill calibration ------------------------------------------------
  const [calibSecLeft, setCalibSecLeft] = useState(0);
  const calibrating = calibSecLeft > 0;

  useEffect(() => {
    if (!calibrating) return;
    const t = setInterval(
      () => setCalibSecLeft((s) => (s <= 1 ? 0 : s - 1)),
      1000,
    );
    return () => clearInterval(t);
  }, [calibrating]);

  const calibrateMut = useMutation({
    mutationFn: () =>
      apiSend<any>(`/api/partner/devices/${id}/calibrate`, "POST", { seconds: 60 }),
    onSuccess: () => {
      setCalibSecLeft(60);
      toast({
        title: "Live calibration started",
        description: "Keep the bin empty — drop nothing for 60 seconds.",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't start calibration",
        description: e.message,
        variant: "destructive",
      }),
  });

  const liveUrl = `/api/partner/devices/${id}/live-fill`;
  const { data: live } = useQuery<LiveFill>({
    queryKey: [liveUrl],
    queryFn: () => apiJson<LiveFill>(liveUrl),
    enabled: enabled && !!id && calibrating,
    refetchInterval: 1000,
  });

  // Derived accessors (safe even before form loads).
  const fill: any = form?.fill ?? {};
  const policy: any = form?.policy ?? {};
  const fire: any = form?.fire ?? {};
  const hours: any = form?.hours ?? {};
  const ui: any = form?.ui ?? {};
  const carousel: any = ui.carousel ?? {};
  const session: any = form?.session ?? {};
  const telemetry: any = form?.telemetry ?? {};
  const camera: any = form?.camera ?? {};

  const emptyMm: number = fill.emptyDistanceMm ?? 500;
  const fullMm: number = fill.fullOffsetMm ?? 76;
  const denom = emptyMm - fullMm;
  const rawMm = live?.rawDistanceMm;
  // fill% computed live from the CURRENT slider positions so the owner watches
  // it hit 0% / 100% as they adjust.
  const computedFill =
    rawMm == null || denom <= 0 ? null : clamp(((emptyMm - rawMm) / denom) * 100, 0, 100);

  const themeOptions = Array.from(
    new Set(["default", ui.theme].filter(Boolean) as string[]),
  );

  if (!device) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-gray-500">
          Select a bin to edit its settings.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header / save bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="font-mono font-semibold">
                {device.serial ?? `Bin #${id}`}
              </div>
              <div className="text-xs text-gray-500">
                Settings v{data?.version ?? 0}
              </div>
            </div>
            {dirty && <Badge variant="outline">Unsaved changes</Badge>}
          </div>
          <Button
            onClick={() => {
              if (!synced || !dirty) {
                toast({ title: "Nothing to save", description: "No changes yet." });
                return;
              }
              saveMut.mutate(patch);
            }}
            disabled={!synced || !dirty || saveMut.isPending}
            data-testid="button-save-settings"
          >
            {saveMut.isPending ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save changes
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-8 text-center text-red-500 text-sm">
            Couldn't load settings: {(error as any)?.message}
          </CardContent>
        </Card>
      ) : isLoading || !form ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ---- Fill calibration (flagship) --------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Fill calibration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Empty distance slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Empty distance (0% fill)</Label>
                  <div className="flex items-center gap-2">
                    <NumInput
                      className="w-24 h-8"
                      value={fill.emptyDistanceMm}
                      min={50}
                      max={5000}
                      step={1}
                      onChange={(n) => setSection("fill", { emptyDistanceMm: n })}
                      testid="input-empty-distance"
                    />
                    <span className="text-sm text-gray-500">mm</span>
                  </div>
                </div>
                <Slider
                  value={[clamp(emptyMm, 50, 5000)]}
                  min={50}
                  max={5000}
                  step={1}
                  onValueChange={([v]) => setSection("fill", { emptyDistanceMm: v })}
                  data-testid="slider-empty-distance"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Sensor-to-floor reading when the bin is empty.
                </p>
              </div>

              {/* Full offset slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Full offset from lid (100%)</Label>
                  <div className="flex items-center gap-2">
                    <NumInput
                      className="w-24 h-8"
                      value={fill.fullOffsetMm}
                      min={0}
                      max={2000}
                      step={1}
                      onChange={(n) => setSection("fill", { fullOffsetMm: n })}
                      testid="input-full-offset"
                    />
                    <span className="text-sm text-gray-500">mm</span>
                  </div>
                </div>
                <Slider
                  value={[clamp(fullMm, 0, 2000)]}
                  min={0}
                  max={2000}
                  step={1}
                  onValueChange={([v]) => setSection("fill", { fullOffsetMm: v })}
                  data-testid="slider-full-offset"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Distance from the lid that counts as 100% full.
                </p>
              </div>

              {denom <= 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Empty distance must be greater than the full offset for the fill%
                  to compute.
                </div>
              )}

              <Separator />

              {/* Live readout */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4 text-center">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Raw distance
                  </div>
                  <div
                    className="text-4xl font-bold tabular-nums mt-1"
                    data-testid="text-live-raw"
                  >
                    {rawMm == null ? "—" : rawMm}
                    <span className="text-lg font-medium text-gray-500"> mm</span>
                  </div>
                </div>
                <div className="rounded-lg border p-4 text-center">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    Fill (from sliders)
                  </div>
                  <div
                    className="text-4xl font-bold tabular-nums mt-1"
                    data-testid="text-live-fill"
                  >
                    {computedFill == null ? "—" : Math.round(computedFill)}
                    <span className="text-lg font-medium text-gray-500"> %</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => calibrateMut.mutate()}
                  disabled={calibrating || calibrateMut.isPending}
                  data-testid="button-start-calibration"
                >
                  {calibrateMut.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Start live calibration
                </Button>
                {calibrating ? (
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-500">
                    Calibrating… {calibSecLeft}s left — drop nothing into the bin.
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">
                    Streams the live sensor reading for 60s. Adjust the sliders
                    until the fill hits 0% empty and 100% full.
                  </span>
                )}
              </div>
              {live?.lastHeartbeatAt && (
                <div className="text-xs text-gray-400">
                  Last heartbeat: {new Date(live.lastHeartbeatAt).toLocaleTimeString()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ---- Detection & policy ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle>Detection &amp; policy</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-100 dark:divide-gray-800">
              <Row label="Allow THC vapes" hint="Accept THC devices as valid drops. Applies after a firmware update.">
                <Switch
                  checked={!!policy.allowThcVapes}
                  onCheckedChange={(v) => setSection("policy", { allowThcVapes: v })}
                  data-testid="switch-allow-thc"
                />
              </Row>

              <Row
                label="Allow other electronics"
                hint="Accept non-vape electronics (e.g. batteries, small devices) as valid drops. Applies after a firmware update."
              >
                <Switch
                  checked={!!policy.allowOtherElectronics}
                  onCheckedChange={(v) => setSection("policy", { allowOtherElectronics: v })}
                  data-testid="switch-allow-other-electronics"
                />
              </Row>

              <Row
                label="Fire detection"
                hint="On by default and should stay on. Turning it off sends an immediate notification to LITTR staff."
              >
                <Switch
                  checked={fire.enabled !== false}
                  onCheckedChange={(v) => setSection("fire", { enabled: v })}
                  data-testid="switch-fire-enabled"
                />
              </Row>
              {fire.enabled === false && (
                <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <span>
                    Fire detection is OFF for this bin. LITTR staff are notified whenever a partner
                    disables it — re-enable it unless there's a specific reason.
                  </span>
                </div>
              )}

              <Row label="Trigger mode" hint="Which sensor(s) raise a fire event.">
                <Select
                  value={String(fire.mode ?? 2)}
                  onValueChange={(v) => setSection("fire", { mode: Number(v) })}
                >
                  <SelectTrigger className="w-full" data-testid="select-fire-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIRE_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              <Row
                label="Temperature threshold"
                hint={`Reading that triggers a temp alarm (stored in °C, shown in °${tempUnit}).`}
              >
                <div className="flex items-center gap-2">
                  <NumInput
                    value={
                      fire.tempC == null
                        ? undefined
                        : tempUnit === "C"
                          ? fire.tempC
                          : Math.round(celsiusToFahrenheit(fire.tempC))
                    }
                    min={tempUnit === "C" ? 0 : 32}
                    max={tempUnit === "C" ? 150 : 302}
                    step={tempUnit === "C" ? 0.5 : 1}
                    onChange={(n) =>
                      setSection("fire", {
                        tempC: tempUnit === "C" ? n : Math.round(fahrenheitToCelsius(n) * 2) / 2,
                      })
                    }
                    testid="input-fire-tempc"
                  />
                  <div className="flex overflow-hidden rounded-md border">
                    {(["C", "F"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setTempUnit(u)}
                        className={cn(
                          "px-2.5 py-1.5 text-sm",
                          tempUnit === u ? "bg-green-500 text-white" : "bg-background hover:bg-muted",
                        )}
                        data-testid={`button-fire-temp-unit-${u}`}
                      >
                        °{u}
                      </button>
                    ))}
                  </div>
                </div>
              </Row>

              <Row
                label="VOC threshold"
                hint={`Air-quality level (as % of sensor range) that triggers a VOC alarm. Recommended: ${VOC_RECOMMENDED_PCT}% to avoid frequent false alarms from nearby vaping or smoke.`}
              >
                <div className="w-full space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium" data-testid="text-fire-voc-pct">
                      {vocPctFromAnalog(fire.vocAnalog ?? vocAnalogFromPct(VOC_RECOMMENDED_PCT))}%
                    </span>
                    <button
                      type="button"
                      title={`Reset to recommended (${VOC_RECOMMENDED_PCT}%)`}
                      aria-label={`Reset VOC threshold to recommended ${VOC_RECOMMENDED_PCT}%`}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-green-600 dark:hover:text-green-500"
                      onClick={() =>
                        setSection("fire", { vocAnalog: vocAnalogFromPct(VOC_RECOMMENDED_PCT) })
                      }
                      data-testid="button-fire-voc-recommended"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>
                  </div>
                  <Slider
                    value={[vocPctFromAnalog(fire.vocAnalog ?? vocAnalogFromPct(VOC_RECOMMENDED_PCT))]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([v]) => setSection("fire", { vocAnalog: vocAnalogFromPct(v) })}
                    data-testid="slider-fire-voc"
                  />
                </div>
              </Row>

              <Row label="VOC warm-up" hint="Seconds to ignore VOC after boot.">
                <NumInput
                  value={fire.vocWarmupSec}
                  min={0}
                  max={3600}
                  step={1}
                  onChange={(n) => setSection("fire", { vocWarmupSec: n })}
                  testid="input-fire-warmup"
                />
              </Row>

              <div className="pt-3 space-y-1">
                <p className="text-sm font-medium">Bin actions on a warning</p>
                <p className="text-xs text-muted-foreground">
                  What the bin itself does on-site. Who gets emailed, texted, or called is set per
                  person in the <span className="font-medium">Notifications</span> tab.
                </p>
                <ActionPicker
                  id="onboth"
                  label="Both sensors tripped"
                  value={fire.onBoth ?? []}
                  onToggle={(a, c) => toggleAction("onBoth", a, c)}
                />
                <ActionPicker
                  id="ontemp"
                  label="Temperature only"
                  value={fire.onTempOnly ?? []}
                  onToggle={(a, c) => toggleAction("onTempOnly", a, c)}
                />
                <ActionPicker
                  id="onvoc"
                  label="VOC only"
                  value={fire.onVocOnly ?? []}
                  onToggle={(a, c) => toggleAction("onVocOnly", a, c)}
                />
              </div>
            </CardContent>
          </Card>

          {/* ---- Operating hours --------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Operating hours</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-100 dark:divide-gray-800">
              <Row
                label="Enforce hours"
                hint="Intended to accept drops only between open and close. The bin does not enforce hours yet — enforcement is coming in a firmware update."
              >
                <Switch
                  checked={!!hours.enabled}
                  onCheckedChange={(v) => setSection("hours", { enabled: v })}
                  data-testid="switch-hours-enabled"
                />
              </Row>
              <Row label="Open">
                <Input
                  type="time"
                  value={hours.open ?? "09:00"}
                  onChange={(e) => setSection("hours", { open: e.target.value })}
                  data-testid="input-hours-open"
                />
              </Row>
              <Row label="Close">
                <Input
                  type="time"
                  value={hours.close ?? "21:00"}
                  onChange={(e) => setSection("hours", { close: e.target.value })}
                  data-testid="input-hours-close"
                />
              </Row>
              <Row label="Timezone" hint="Used to enforce operating hours.">
                <Select
                  value={hours.tz ?? "America/New_York"}
                  onValueChange={(v) => setSection("hours", { tz: v })}
                >
                  <SelectTrigger className="w-full" data-testid="select-hours-tz">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            </CardContent>
          </Card>

          {/* ---- Display & sessions ------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle>Display &amp; sessions</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-100 dark:divide-gray-800">
              <Row label="Wallpaper theme" hint="HMI wallpaper set shown on the bin. Applies after a firmware update.">
                <Select
                  value={ui.theme ?? "default"}
                  onValueChange={(v) => setSection("ui", { theme: v })}
                >
                  <SelectTrigger className="w-full" data-testid="select-ui-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {themeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row
                label="Carousel seconds per page"
                hint="How long each idle carousel page is shown on the bin (5–120s). Applies after a firmware update."
              >
                <NumInput
                  value={carousel.secPerPage}
                  min={5}
                  max={120}
                  step={1}
                  onChange={(n) =>
                    setSection("ui", { carousel: { ...carousel, secPerPage: n } })
                  }
                  testid="input-carousel-sec-per-page"
                />
              </Row>
              <Row
                label="Post-session counter"
                hint="Seconds the drop counter stays up after a session ends (0–600s). Applies after a firmware update."
              >
                <NumInput
                  value={carousel.postSessionCounterSec}
                  min={0}
                  max={600}
                  step={1}
                  onChange={(n) =>
                    setSection("ui", { carousel: { ...carousel, postSessionCounterSec: n } })
                  }
                  testid="input-carousel-post-session"
                />
              </Row>
              <Row label="Stack window" hint="Seconds to group rapid drops into one session.">
                <NumInput
                  value={session.stackWindowSec}
                  min={1}
                  max={120}
                  step={1}
                  onChange={(n) => setSection("session", { stackWindowSec: n })}
                  testid="input-stack-window"
                />
              </Row>
              <Row label="QR time-to-live" hint="Seconds a claim QR stays valid.">
                <NumInput
                  value={session.qrTtlSec}
                  min={5}
                  max={600}
                  step={1}
                  onChange={(n) => setSection("session", { qrTtlSec: n })}
                  testid="input-qr-ttl"
                />
              </Row>
            </CardContent>
          </Card>

          {/* ---- Camera ------------------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle>Camera</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-100 dark:divide-gray-800">
              <Row label="Idle snapshot" hint="Seconds between background reference photos.">
                <NumInput
                  value={camera.idleSnapshotSec}
                  min={1}
                  max={3600}
                  step={1}
                  onChange={(n) => setSection("camera", { idleSnapshotSec: n })}
                  testid="input-camera-snapshot"
                />
              </Row>
            </CardContent>
          </Card>

          {/* ---- Telemetry cadence (STAFF only) ------------------------------ */}
          {isStaff && (
            <Card>
              <CardHeader>
                <CardTitle>Telemetry cadence</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Staff-only. How often the bin reports in — leave at defaults unless tuning fleet
                  bandwidth.
                </p>
              </CardHeader>
              <CardContent className="divide-y divide-gray-100 dark:divide-gray-800">
                <Row label="Idle heartbeat" hint="Seconds between heartbeats when idle.">
                  <NumInput
                    value={telemetry.idleSec}
                    min={5}
                    max={3600}
                    step={1}
                    onChange={(n) => setSection("telemetry", { idleSec: n })}
                    testid="input-telemetry-idle"
                  />
                </Row>
                <Row label="Active heartbeat" hint="Seconds between heartbeats during a session.">
                  <NumInput
                    value={telemetry.activeSec}
                    min={1}
                    max={600}
                    step={1}
                    onChange={(n) => setSection("telemetry", { activeSec: n })}
                    testid="input-telemetry-active"
                  />
                </Row>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ---- helpers ----------------------------------------------------------------

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <Label className="text-sm">{label}</Label>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <div className="w-44 shrink-0 flex justify-end">{children}</div>
    </div>
  );
}

function ActionPicker({
  id,
  label,
  value,
  onToggle,
}: {
  id: string;
  label: string;
  value: FireAction[];
  onToggle: (a: FireAction, checked: boolean) => void;
}) {
  return (
    <div className="py-1.5">
      <Label className="text-sm text-gray-600 dark:text-gray-400">{label}</Label>
      <div className="flex flex-wrap gap-4 mt-1.5">
        {ACTIONS.map((a) => (
          <label
            key={a}
            className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
          >
            <Checkbox
              checked={value.includes(a)}
              onCheckedChange={(c) => onToggle(a, c === true)}
              data-testid={`check-${id}-${a}`}
            />
            {ACTION_LABELS[a]}
          </label>
        ))}
      </div>
    </div>
  );
}

// Numeric input that keeps a local string draft so partial edits ("1.", "")
// don't get clobbered by the parent number; commits only finite parses upward.
function NumInput({
  value,
  onChange,
  min,
  max,
  step,
  className,
  disabled,
  testid,
}: {
  value: number | undefined;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
  testid?: string;
}) {
  const [str, setStr] = useState(value == null ? "" : String(value));

  useEffect(() => {
    // Re-sync from the outside (device switch, slider drag) unless the current
    // draft already parses to the same number.
    if (Number(str) !== value) setStr(value == null ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      type="number"
      className={cn("w-28", className)}
      value={str}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      data-testid={testid}
      onChange={(e) => {
        setStr(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}
