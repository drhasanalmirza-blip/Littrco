import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import { RefreshCcw, Battery, Sparkles, Recycle, QrCode } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import BinWidget, { RemoveBinDialog } from "@/components/BinWidget";
import DeviceLogsDialog from "@/components/DeviceLogsDialog";
import BinSettings from "@/pages/partner/panels/BinSettings";
import Team from "@/pages/partner/panels/Team";
import Pairing from "@/pages/partner/panels/Pairing";
import PartnerAlerts from "@/pages/partner/panels/PartnerAlerts";
import PartnerNotifications from "@/pages/partner/panels/PartnerNotifications";

type ShopRole = "OWNER" | "MANAGER" | "VIEWER" | "STAFF";

/** Mirrors server/notifyRules.ts OFFLINE_AFTER_MS: silent this long ⇒ offline. */
const OFFLINE_AFTER_MS = 10 * 60 * 1000;

/**
 * Matches the staff Overview's predicate: a bin is offline only if it HAS
 * heartbeated and has now been silent past the threshold — the server never
 * demotes `status`, so "LIVE" alone doesn't mean the bin is reachable.
 */
function isOffline(d: { lastHeartbeatAt: string | null }, now: number): boolean {
  if (!d.lastHeartbeatAt) return false;
  return now - new Date(d.lastHeartbeatAt).getTime() > OFFLINE_AFTER_MS;
}

/** Muted KPI tile, same look as the staff Overview strip. */
function KpiTile({ label, value, tone, testid }: {
  label: string; value: React.ReactNode; tone?: string; testid: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

/** Consistent section header: bold title + one-line muted description. */
function PageHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
interface Shop { id: number; name: string; city: string; status: string; myRole?: ShopRole; }
interface Device {
  id: number; serial: string; label: string | null; status: string; firmwareVersion: string | null;
  vapesSinceEmpty: number; fillPercent: number; lastHeartbeatAt: string | null;
  tempC: number | null; vocRaw: number | null; latestPhotoUrl: string | null;
}
interface DropSession {
  id: number; status: string; detectedDropCount: number; acceptedDropCount: number; batteriesEstimated: number;
  shopPointsAwarded: number; claimToken: string | null; createdAt: string; finalizedAt: string | null;
}

export default function PartnerDashboard() {
  const { user, role, clearAuth, tempUnit } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [settingsDeviceId, setSettingsDeviceId] = useState<number | null>(null);

  // Active tab lives in the URL hash (mirrors the staff redesign) so a refresh
  // or back/forward keeps your place. Slugs equal the tab values.
  const [tab, setTabState] = useState<string>(() => {
    const h = window.location.hash.replace(/^#/, "");
    return h || "bins";
  });
  const setTab = (v: string) => {
    setTabState(v);
    if (window.location.hash.replace(/^#/, "") !== v) window.location.hash = v;
  };
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h) setTabState(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ["/api/partner/shops"],
    queryFn: async () => (await apiRequest("/api/partner/shops")).json(),
    enabled: !!user && (role === "partner" || role === "staff"),
  });

  const shopId = selectedShopId ?? shops[0]?.id ?? null;
  const shop = shops.find(s => s.id === shopId);
  const partnerEnabled = !!user && (role === "partner" || role === "staff");
  // The caller's membership role for the selected shop (STAFF acts as full-access).
  const myRole: ShopRole | undefined = role === "staff" ? "STAFF" : shop?.myRole;
  // Client gating only HIDES controls from a CONFIRMED read-only VIEWER; when the
  // role hasn't loaded (undefined) we show the controls and let the server enforce,
  // so an owner is never accidentally locked out of settings. OWNER/MANAGER manage
  // bins & settings; VIEWER is read-only. (Server enforces on every mutation.)
  const canManage = myRole !== "VIEWER";
  const canPair = myRole !== "VIEWER"; // owner/manager pair; server requires OWNER/MANAGER
  const isOwner = myRole !== "VIEWER" && myRole !== "MANAGER"; // OWNER or STAFF (or unknown)

  const { data: devices = [], refetch: refetchDevices } = useQuery<Device[]>({
    queryKey: [`/api/partner/shops/${shopId}/devices`],
    queryFn: async () => (await apiRequest(`/api/partner/shops/${shopId}/devices`)).json(),
    enabled: !!shopId,
    refetchInterval: 10000,
  });

  const selectedDevice = devices.find(d => d.id === settingsDeviceId) ?? devices[0] ?? null;

  const { data: sessions = [] } = useQuery<DropSession[]>({
    queryKey: [`/api/partner/shops/${shopId}/sessions`],
    queryFn: async () => (await apiRequest(`/api/partner/shops/${shopId}/sessions`)).json(),
    enabled: !!shopId,
    // Drop sessions are created/updated server-side by the device (no client
    // mutation), and the global queryClient never auto-refetches. Poll every 10s
    // (matching the devices query) so the Activity feed reflects live drop
    // activity instead of staying stale until remount (HW_FIXES_R2 W2/F5).
    refetchInterval: 10000,
  });

  const { data: pointsBalance } = useQuery<{ balance: number }>({
    queryKey: [`/api/partner/shops/${shopId}/points/balance`],
    queryFn: async () => (await apiRequest(`/api/partner/shops/${shopId}/points/balance`)).json(),
    enabled: !!shopId,
  });

  const markEmpty = useMutation({
    mutationFn: async (deviceId: number) => {
      const r = await apiRequest(`/api/partner/devices/${deviceId}/mark-empty`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Mark Empty queued", description: "Bin will reset on next poll." });
      refetchDevices();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const removeDevice = useMutation({
    mutationFn: async (deviceId: number) => {
      const r = await apiRequest(`/api/partner/devices/${deviceId}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Bin removed" });
      qc.invalidateQueries({ queryKey: [`/api/partner/shops/${shopId}/devices`] });
    },
    onError: (e: any) => toast({ title: "Failed to remove", description: e.message, variant: "destructive" }),
  });

  if (!user || (role !== "partner" && role !== "staff")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => setLocation("/partner/login")}>Partner Login</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader title="Partner Dashboard" subtitle={shop ? shop.name : undefined} />
        {shops.length > 1 && (
          <div className="mb-4 flex justify-end">
            <select
              className="rounded-md border border-input bg-background px-2 py-1 text-sm"
              value={shopId ?? ""}
              onChange={(e) => setSelectedShopId(Number(e.target.value))}
              data-testid="select-shop"
            >
              {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {!shop ? (
          <Card><CardContent className="p-8 text-center text-gray-500">No shops assigned to your account yet.</CardContent></Card>
        ) : (
          <>
          {/* At-a-glance summary strip (matches the staff Overview KPI style). */}
          {(() => {
            const now = Date.now();
            const liveNow = devices.filter(d => d.status === "LIVE" && !isOffline(d, now)).length;
            const totalVapes = devices.reduce((sum, d) => sum + (d.vapesSinceEmpty ?? 0), 0);
            return (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiTile label="Bins" value={devices.length} testid="stat-partner-bins" />
                <KpiTile
                  label="Live now"
                  value={liveNow}
                  tone={liveNow > 0 ? "text-green-600 dark:text-green-500" : undefined}
                  testid="stat-partner-live"
                />
                <KpiTile label="Vapes recycled" value={totalVapes} testid="stat-partner-vapes" />
                <KpiTile label="Shop points" value={pointsBalance?.balance ?? 0} testid="stat-partner-points" />
              </div>
            );
          })()}

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-4 flex flex-wrap h-auto justify-start">
              <TabsTrigger value="bins" data-testid="tab-bins">Bins</TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
              <TabsTrigger value="points" data-testid="tab-points">Point Shop</TabsTrigger>
              <TabsTrigger value="pairing" data-testid="tab-pairing">Pairing</TabsTrigger>
              <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
              <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
              <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
            </TabsList>

            <TabsContent value="bins" className="space-y-4">
              <PageHeader title="Bins" desc="Your LITTR One bins — live health, logs, and controls." />
              {devices.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Recycle /></EmptyMedia>
                    <EmptyTitle>No bins paired yet</EmptyTitle>
                    <EmptyDescription>Connect your first LITTR One with a pair code — it takes about two minutes.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button onClick={() => setTab("pairing")} data-testid="button-empty-goto-pairing">
                      <QrCode className="mr-1.5 h-4 w-4" /> Go to Pairing
                    </Button>
                  </EmptyContent>
                </Empty>
              ) : devices.map(d => (
                <BinWidget
                  key={d.id}
                  device={d}
                  tempUnit={tempUnit}
                  canManage={canManage}
                  onChanged={() => refetchDevices()}
                  actions={
                    <>
                      {/* Logs are read-only diagnostics — visible to every member incl. VIEWER. */}
                      <DeviceLogsDialog
                        deviceId={d.id}
                        deviceName={d.label && d.label.trim() !== "" ? d.label : d.serial}
                        basePath="/api/partner/devices"
                      />
                      {canManage && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => markEmpty.mutate(d.id)} data-testid={`button-mark-empty-${d.id}`}>
                            <RefreshCcw className="h-4 w-4 mr-1" /> Mark Empty
                          </Button>
                          <RemoveBinDialog
                            deviceId={d.id}
                            deviceName={d.label && d.label.trim() !== "" ? d.label : d.serial}
                            onConfirm={() => removeDevice.mutate(d.id)}
                            pending={removeDevice.isPending}
                          />
                        </>
                      )}
                    </>
                  }
                />
              ))}
            </TabsContent>

            <TabsContent value="activity">
              <PageHeader title="Activity" desc="Every drop session at your bins, live — points and batteries as they land." />
              <Card>
                <CardHeader><CardTitle>Recent Drop Sessions</CardTitle></CardHeader>
                <CardContent>
                  {sessions.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Recycle /></EmptyMedia>
                        <EmptyTitle>No drop sessions yet</EmptyTitle>
                        <EmptyDescription>Sessions appear here the moment someone recycles a vape at one of your bins.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="space-y-2">
                      {sessions.map(s => (
                        <div key={s.id} className="flex items-center justify-between border rounded p-3" data-testid={`row-session-${s.id}`}>
                          <div>
                            <div className="font-semibold">Session #{s.id} · {s.acceptedDropCount} vape(s)</div>
                            {/* Surface detected vs accepted so an in-progress or all-rejected
                                session reads as real activity, not an empty "0 vape(s)" row. */}
                            <div className="text-sm text-gray-500">
                              {s.detectedDropCount} detected / {s.acceptedDropCount} accepted · {new Date(s.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm">{s.batteriesEstimated} Batteries · {s.shopPointsAwarded} Pts</div>
                            <Badge variant="outline">{s.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="points">
              <PageHeader title="Point Shop" desc="Shop points earned from every drop — the rewards store is on its way." />
              <Card className="mb-4">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Shop Points Balance</div>
                    <div className="text-4xl font-bold" data-testid="text-points-balance">{pointsBalance?.balance ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">Earned automatically from every drop at your bins.</div>
                  </div>
                  <Battery className="h-12 w-12 text-green-500" />
                </CardContent>
              </Card>

              {/* Rewards are provided by LITTR and purchased with points — not shop-created. */}
              <Card className="overflow-hidden border-green-500/30">
                <div className="relative flex flex-col items-center gap-4 bg-gradient-to-br from-green-500/10 via-transparent to-green-500/5 px-6 py-14 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/15 text-green-600 dark:text-green-500">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-green-600 dark:text-green-500">
                      <Sparkles className="h-3 w-3" /> Coming soon
                    </div>
                    <h3 className="text-2xl font-bold">Rewards Shop</h3>
                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                      Soon you'll spend your shop points on rewards from LITTR — marketing kits,
                      swag, bill credits, and more. Keep collecting drops; your balance is already
                      growing.
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="pairing">
              <PageHeader title="Pairing" desc="Connect a new LITTR One to this shop with a one-time pair code." />
              {canPair ? (
                <Pairing
                  shopId={shopId ?? 0}
                  enabled={partnerEnabled}
                  pairCodeUrl={`/api/partner/shops/${shopId ?? 0}/pair-code`}
                  devicesUrl={`/api/partner/shops/${shopId ?? 0}/devices`}
                />
              ) : (
                <Card><CardContent className="p-8 text-center text-gray-500">Only owners and managers can pair new bins.</CardContent></Card>
              )}
            </TabsContent>

            <TabsContent value="team">
              <PageHeader title="Team" desc="Who can view and manage this shop's bins." />
              <Team shopId={shopId ?? 0} enabled={partnerEnabled} />
            </TabsContent>

            <TabsContent value="alerts">
              <PageHeader title="Alerts" desc="Fill, temperature, and safety alerts from your bins." />
              <PartnerAlerts shopId={shopId ?? 0} enabled={partnerEnabled} />
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <PageHeader title="Settings" desc="Per-bin behavior: fill calibration, policies, fire safety, and display." />
              {!canManage ? (
                <Card><CardContent className="p-8 text-center text-gray-500">You have view-only access. Ask an owner or manager to change bin settings.</CardContent></Card>
              ) : devices.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-gray-500">No bins yet. Pair a bin first to edit its settings.</CardContent></Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Bin settings</CardTitle>
                      <select
                        className="border rounded px-2 py-1 text-sm mt-2 w-fit bg-transparent"
                        value={selectedDevice?.id ?? ""}
                        onChange={(e) => setSettingsDeviceId(Number(e.target.value))}
                        data-testid="select-settings-device"
                      >
                        {devices.map(d => <option key={d.id} value={d.id}>{d.label ? `${d.label} (${d.serial})` : d.serial}</option>)}
                      </select>
                    </CardHeader>
                  </Card>
                  <BinSettings device={selectedDevice} enabled={partnerEnabled} />
                </>
              )}
            </TabsContent>

            <TabsContent value="notifications">
              <PageHeader title="Notifications" desc="Where and how this shop gets notified — email, SMS, and call levels." />
              <PartnerNotifications shopId={shopId ?? 0} enabled={partnerEnabled} />
            </TabsContent>
          </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
