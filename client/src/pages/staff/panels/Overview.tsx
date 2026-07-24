import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiJson";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  HardDrive,
  QrCode,
  Thermometer,
  WifiOff,
} from "lucide-react";

/**
 * Staff landing view (STAFF_UI_REDESIGN §2): fleet-at-a-glance KPIs, a
 * "needs attention" list derived from /api/staff/devices, and the most recent
 * open alerts. Reuses the exact query shapes (and cache keys) of the Alerts and
 * ReviewQueue panels — no new endpoints.
 */

interface StaffDevice {
  id: number;
  serial: string;
  label?: string | null;
  status: string;
  vapesSinceEmpty?: number | null;
  errorLog?: string | null;
  tempDevices?: number | null;
  sdFreeMb?: number | null;
  lastHeartbeatAt?: string | null;
}

interface StaffAlert {
  id: number;
  deviceId: number;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

// Same custom severity coloring as panels/Alerts.tsx (Badge has no yellow/gray variant).
const SEVERITY_CLASS: Record<StaffAlert["severity"], string> = {
  INFO: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  WARNING: "bg-yellow-200 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-300",
  CRITICAL: "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300",
};

/** Bins with less free sensor-SD space than this are flagged. */
const LOW_SD_MB = 100;
const ALERTS_LIMIT = 200;
const REVIEW_LIMIT = 50;
/** Mirrors server/notifyRules.ts OFFLINE_AFTER_MS (§5.1): silent this long ⇒ offline. */
const OFFLINE_AFTER_MS = 10 * 60 * 1000;

/**
 * Mirrors server isSilentTooLong() (server/notifyRules.ts): a device is offline
 * only if it HAS heartbeated before and has now been silent past the threshold.
 * Never-heartbeated (PROVISIONING) devices are "not claimed yet", not offline.
 */
function isOffline(d: StaffDevice, now: number): boolean {
  if (!d.lastHeartbeatAt) return false;
  return now - new Date(d.lastHeartbeatAt).getTime() > OFFLINE_AFTER_MS;
}

function binName(d: StaffDevice): string {
  return d.label && String(d.label).trim() !== "" ? d.label : d.serial;
}

function KpiTile({
  label,
  value,
  tone,
  testid,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
  testid: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", tone)}>{value}</div>
    </div>
  );
}

interface AttentionItem {
  key: string;
  device: StaffDevice;
  icon: React.ComponentType<{ className?: string }>;
  problem: string;
  tone: "red" | "amber";
  onClick: () => void;
}

export default function Overview({
  enabled,
  devices,
  onNavigate,
  onViewCommands,
}: {
  enabled: boolean;
  devices: StaffDevice[];
  /** Jump to another sidebar destination (sets the location hash). */
  onNavigate: (view: string) => void;
  /** Jump to the Commands view with a device preselected. */
  onViewCommands: (deviceId: number) => void;
}) {
  // Same shape + key as panels/Alerts.tsx (active view) so the cache is shared.
  const alertsUrl = `/api/staff/alerts?active=true&limit=${ALERTS_LIMIT}`;
  const { data: alerts = [] } = useQuery<StaffAlert[]>({
    queryKey: [alertsUrl],
    queryFn: () => apiJson<StaffAlert[]>(alertsUrl),
    enabled,
    refetchInterval: 10000,
  });

  // Same shape + key as panels/ReviewQueue.tsx default filters (UNREVIEWED, page 1).
  const reviewUrl = `/api/staff/review/queue?status=UNREVIEWED&limit=${REVIEW_LIMIT}&offset=0`;
  const { data: unreviewed = [] } = useQuery<any[]>({
    queryKey: [reviewUrl],
    queryFn: () => apiJson<any[]>(reviewUrl),
    enabled,
    refetchInterval: 15000,
  });

  const now = Date.now();
  // "Live now" requires BOTH a LIVE status and a fresh heartbeat — the server
  // never demotes status, so a silent-for-hours bin would otherwise still count.
  const liveNow = devices.filter((d) => d.status === "LIVE" && !isOffline(d, now)).length;
  const offline = devices.filter((d) => isOffline(d, now)).length;
  const totalVapes = devices.reduce((sum, d) => sum + (d.vapesSinceEmpty ?? 0), 0);
  // Both feeds are capped server-side; show "N+" when we hit the cap.
  const openAlerts = alerts.length >= ALERTS_LIMIT ? `${ALERTS_LIMIT}+` : alerts.length;
  const unreviewedCount = unreviewed.length >= REVIEW_LIMIT ? `${REVIEW_LIMIT}+` : unreviewed.length;

  const attention: AttentionItem[] = [];
  for (const d of devices) {
    // Retired bins are intentionally out of service — nothing actionable.
    if (d.status === "RETIRED") continue;
    if (d.status === "PROVISIONING") {
      // Created but never claimed/heartbeated — not "offline" (the server's own
      // offline logic excludes never-heartbeated devices). Point at Pairing.
      attention.push({
        key: `unclaimed-${d.id}`,
        device: d,
        icon: QrCode,
        problem: "Not claimed yet — pair this bin to bring it online",
        tone: "amber",
        onClick: () => onNavigate("pairing"),
      });
    } else if (isOffline(d, now)) {
      attention.push({
        key: `offline-${d.id}`,
        device: d,
        icon: WifiOff,
        problem: `Offline — last seen ${new Date(d.lastHeartbeatAt!).toLocaleString()}`,
        tone: "red",
        onClick: () => onNavigate("devices"),
      });
    }
    if (d.errorLog) {
      attention.push({
        key: `error-${d.id}`,
        device: d,
        icon: AlertTriangle,
        problem: `Error: ${String(d.errorLog).slice(0, 80)}`,
        tone: "amber",
        onClick: () => onNavigate("devices"),
      });
    }
    if (d.tempDevices === 0) {
      attention.push({
        key: `temp-${d.id}`,
        device: d,
        icon: Thermometer,
        problem: "Temp probe not detected (0 devices on the 1-Wire bus)",
        tone: "amber",
        onClick: () => onNavigate("devices"),
      });
    }
    if (d.sdFreeMb != null && d.sdFreeMb < LOW_SD_MB) {
      attention.push({
        key: `sd-${d.id}`,
        device: d,
        icon: HardDrive,
        problem: `Low SD space — ${d.sdFreeMb} MB free`,
        tone: "amber",
        onClick: () => onViewCommands(d.id),
      });
    }
  }
  // Red (offline) issues first.
  attention.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "red" ? -1 : 1));

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Bins" value={devices.length} testid="stat-bins-total" />
        <KpiTile
          label="Live now"
          value={liveNow}
          tone={liveNow > 0 ? "text-green-600 dark:text-green-500" : undefined}
          testid="stat-bins-live"
        />
        <KpiTile
          label="Offline"
          value={offline}
          tone={offline > 0 ? "text-red-600 dark:text-red-500" : undefined}
          testid="stat-bins-offline"
        />
        <KpiTile label="Vapes in bins" value={totalVapes} testid="stat-total-vapes" />
        <KpiTile
          label="Open alerts"
          value={openAlerts}
          tone={alerts.length > 0 ? "text-amber-600 dark:text-amber-500" : undefined}
          testid="stat-open-alerts"
        />
        <KpiTile
          label="Unreviewed"
          value={unreviewedCount}
          tone={unreviewed.length > 0 ? "text-amber-600 dark:text-amber-500" : undefined}
          testid="stat-unreviewed"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Needs attention */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            {attention.length === 0 ? (
              <div
                className="flex items-center gap-2 py-4 text-sm text-muted-foreground"
                data-testid="text-attention-clear"
              >
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
                All bins healthy — nothing needs attention.
              </div>
            ) : (
              <div className="divide-y">
                {attention.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:bg-muted/50"
                    data-testid={`row-attention-${item.key}`}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 flex-none",
                        item.tone === "red"
                          ? "text-red-600 dark:text-red-500"
                          : "text-amber-600 dark:text-amber-500",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{binName(item.device)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.problem}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent alerts</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("alerts")}
              data-testid="button-overview-all-alerts"
            >
              View all <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground" data-testid="text-no-recent-alerts">
                No active alerts.
              </p>
            ) : (
              <div className="divide-y">
                {alerts.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-start gap-3 py-2.5 text-sm" data-testid={`row-overview-alert-${a.id}`}>
                    <Badge className={cn("mt-0.5 border-transparent", SEVERITY_CLASS[a.severity])}>
                      {a.severity}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{a.message}</div>
                      <div className="text-xs text-muted-foreground">
                        Bin #{a.deviceId} · {new Date(a.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
