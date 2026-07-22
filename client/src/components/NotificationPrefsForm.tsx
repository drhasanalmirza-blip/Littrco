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
import { X, Plus } from "lucide-react";

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
}

export interface NotificationPrefs {
  shopId?: number | null;
  channelsJson: NotificationChannels;
  eventsJson: NotificationEvents;
  phone: string | null;
  updatedAt?: string;
}

export interface NotificationPrefsFormProps {
  /** URL to GET the effective (defaults-merged) prefs. */
  getUrl: string;
  /** URL to PUT { channelsJson, eventsJson, phone }. */
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

const EVENTS: { key: keyof Omit<NotificationEvents, "fillLevels">; label: string }[] = [
  { key: "full", label: "Bin full (100%)" },
  { key: "fire", label: "Fire / smoke" },
  { key: "tempHigh", label: "High temperature" },
  { key: "vocHigh", label: "High VOC" },
  { key: "offline", label: "Device offline" },
  { key: "drops", label: "New drops" },
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
};

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
  const [phone, setPhone] = useState<string>("");
  const [newLevel, setNewLevel] = useState<string>("");

  // Sync local editable state from server whenever fresh prefs load.
  useEffect(() => {
    if (!data) return;
    setChannels({ ...DEFAULT_CHANNELS, ...(data.channelsJson || {}) });
    setEvents({
      ...DEFAULT_EVENTS,
      ...(data.eventsJson || {}),
      fillLevels: Array.isArray(data.eventsJson?.fillLevels) ? data.eventsJson.fillLevels : [],
    });
    setPhone(data.phone ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      apiSend(putUrl, "PUT", {
        channelsJson: channels,
        eventsJson: events,
        phone: phone.trim() === "" ? null : phone.trim(),
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
            Email is delivered today. SMS, phone call, and push are stored but not yet delivered.
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

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="notif-phone" className="text-sm font-semibold">
            Phone number
          </Label>
          <Input
            id="notif-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="For future SMS / call alerts"
            className="max-w-xs"
            data-testid="input-notif-phone"
          />
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
