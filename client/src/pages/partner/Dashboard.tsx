import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, RefreshCcw, Battery, Sparkles } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import BinSettings from "@/pages/partner/panels/BinSettings";
import Team from "@/pages/partner/panels/Team";
import Pairing from "@/pages/partner/panels/Pairing";
import PartnerAlerts from "@/pages/partner/panels/PartnerAlerts";
import PartnerNotifications from "@/pages/partner/panels/PartnerNotifications";

interface Shop { id: number; name: string; city: string; status: string; }
interface Device {
  id: number; serial: string; status: string; firmwareVersion: string | null;
  vapesSinceEmpty: number; fillPercent: number; lastHeartbeatAt: string | null;
  tempC: number | null; latestPhotoUrl: string | null;
}
interface DropSession {
  id: number; status: string; acceptedDropCount: number; batteriesEstimated: number;
  shopPointsAwarded: number; claimToken: string | null; createdAt: string; finalizedAt: string | null;
}

export default function PartnerDashboard() {
  const { user, role, clearAuth } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [settingsDeviceId, setSettingsDeviceId] = useState<number | null>(null);

  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ["/api/partner/shops"],
    queryFn: async () => (await apiRequest("/api/partner/shops")).json(),
    enabled: !!user && (role === "partner" || role === "staff"),
  });

  const shopId = selectedShopId ?? shops[0]?.id ?? null;
  const shop = shops.find(s => s.id === shopId);
  const partnerEnabled = !!user && (role === "partner" || role === "staff");

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
  });

  const { data: pointsBalance } = useQuery<{ balance: number }>({
    queryKey: [`/api/partner/shops/${shopId}/points/balance`],
    queryFn: async () => (await apiRequest(`/api/partner/shops/${shopId}/points/balance`)).json(),
    enabled: !!shopId,
  });

  const { data: rewards = [] } = useQuery<any[]>({
    queryKey: [`/api/partner/shops/${shopId}/rewards`],
    queryFn: async () => (await apiRequest(`/api/partner/shops/${shopId}/rewards`)).json(),
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

  const createReward = useMutation({
    mutationFn: async (data: { name: string; cost: number; description?: string }) => {
      const r = await apiRequest(`/api/partner/shops/${shopId}/rewards`, { method: "POST", body: JSON.stringify(data) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Reward created" });
      qc.invalidateQueries({ queryKey: [`/api/partner/shops/${shopId}/rewards`] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const redeemReward = useMutation({
    mutationFn: async (rewardId: number) => {
      const r = await apiRequest(`/api/partner/shops/${shopId}/rewards/${rewardId}/redeem`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Reward redeemed" });
      qc.invalidateQueries({ queryKey: [`/api/partner/shops/${shopId}/points/balance`] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
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
          <Tabs defaultValue="bins">
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
              {devices.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-gray-500">No bins paired yet. Open the "Pairing" tab to connect one with a pair code.</CardContent></Card>
              ) : devices.map(d => (
                <Card key={d.id} data-testid={`card-device-${d.id}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{d.serial}</span>
                        <Badge variant={d.status === "LIVE" ? "default" : "secondary"}>{d.status}</Badge>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Fill: {d.fillPercent}% · {d.vapesSinceEmpty} vapes since empty
                        {d.firmwareVersion && ` · fw ${d.firmwareVersion}`}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Last seen: {d.lastHeartbeatAt ? new Date(d.lastHeartbeatAt).toLocaleString() : "never"}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => markEmpty.mutate(d.id)} data-testid={`button-mark-empty-${d.id}`}>
                      <RefreshCcw className="h-4 w-4 mr-1" /> Mark Empty
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader><CardTitle>Recent Drop Sessions</CardTitle></CardHeader>
                <CardContent>
                  {sessions.length === 0 ? (
                    <p className="text-sm text-gray-500">No drop sessions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {sessions.map(s => (
                        <div key={s.id} className="flex items-center justify-between border rounded p-3" data-testid={`row-session-${s.id}`}>
                          <div>
                            <div className="font-semibold">Session #{s.id} · {s.acceptedDropCount} vape(s)</div>
                            <div className="text-sm text-gray-500">{new Date(s.createdAt).toLocaleString()}</div>
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
              <Pairing shopId={shopId ?? 0} enabled={partnerEnabled} />
            </TabsContent>

            <TabsContent value="team">
              <Team shopId={shopId ?? 0} enabled={partnerEnabled} />
            </TabsContent>

            <TabsContent value="alerts">
              <PartnerAlerts shopId={shopId ?? 0} enabled={partnerEnabled} />
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              {devices.length === 0 ? (
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
                        {devices.map(d => <option key={d.id} value={d.id}>{d.serial}</option>)}
                      </select>
                    </CardHeader>
                  </Card>
                  <BinSettings device={selectedDevice} enabled={partnerEnabled} />
                </>
              )}
            </TabsContent>

            <TabsContent value="notifications">
              <PartnerNotifications shopId={shopId ?? 0} enabled={partnerEnabled} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function AddRewardButton({ onAdd }: { onAdd: (d: { name: string; cost: number; description?: string }) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cost, setCost] = useState(10);
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Only close/reset the dialog once the create actually succeeds. On failure
  // (e.g. a VIEWER member's 403) the mutation's onError surfaces a toast and the
  // dialog stays open with the entered values so the user can see it failed and retry.
  const submit = async () => {
    setSaving(true);
    try {
      await onAdd({ name, cost, description: desc || undefined });
      setOpen(false);
      setName("");
      setCost(10);
      setDesc("");
    } catch {
      // Error is reported by the mutation's onError toast; keep the dialog open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-add-reward"><Plus className="h-4 w-4 mr-1" />New Reward</Button>
      <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Reward</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} data-testid="input-reward-name" /></div>
            <div><Label>Cost (points)</Label><Input type="number" value={cost} onChange={e => setCost(Number(e.target.value))} data-testid="input-reward-cost" /></div>
            <div><Label>Description (optional)</Label><Input value={desc} onChange={e => setDesc(e.target.value)} data-testid="input-reward-desc" /></div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={saving} data-testid="button-save-reward">{saving ? "Creating…" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
