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
import { Bluetooth, Trash2, Plus, LogOut, RefreshCcw, Battery } from "lucide-react";
import { pairBinOverBLE, isWebBluetoothAvailable } from "@/lib/ble";

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
  const [addBinOpen, setAddBinOpen] = useState(false);

  const { data: shops = [] } = useQuery<Shop[]>({
    queryKey: ["/api/partner/shops"],
    queryFn: async () => (await apiRequest("/api/partner/shops")).json(),
    enabled: !!user && (role === "partner" || role === "staff"),
  });

  const shopId = selectedShopId ?? shops[0]?.id ?? null;
  const shop = shops.find(s => s.id === shopId);

  const { data: devices = [], refetch: refetchDevices } = useQuery<Device[]>({
    queryKey: [`/api/partner/shops/${shopId}/devices`],
    queryFn: async () => (await apiRequest(`/api/partner/shops/${shopId}/devices`)).json(),
    enabled: !!shopId,
    refetchInterval: 10000,
  });

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
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Mark Empty queued", description: "Bin will reset on next poll." });
      refetchDevices();
    },
  });

  const createReward = useMutation({
    mutationFn: async (data: { name: string; cost: number; description?: string }) => {
      const r = await apiRequest(`/api/partner/shops/${shopId}/rewards`, { method: "POST", body: JSON.stringify(data) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/partner/shops/${shopId}/rewards`] }),
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Partner Dashboard</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <div className="flex gap-2 items-center">
            {shops.length > 1 && (
              <select className="border rounded px-2 py-1 text-sm" value={shopId ?? ""}
                onChange={(e) => setSelectedShopId(Number(e.target.value))} data-testid="select-shop">
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <Button variant="ghost" size="sm" onClick={async () => { await apiRequest("/api/auth/logout", { method: "POST" }); clearAuth(); setLocation("/"); }} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!shop ? (
          <Card><CardContent className="p-8 text-center text-gray-500">No shops assigned to your account yet.</CardContent></Card>
        ) : (
          <Tabs defaultValue="bins">
            <TabsList className="mb-4">
              <TabsTrigger value="bins" data-testid="tab-bins">Bins</TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
              <TabsTrigger value="points" data-testid="tab-points">Point Shop</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="bins" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setAddBinOpen(true)} data-testid="button-add-bin">
                  <Plus className="h-4 w-4 mr-1" /> Add Bin
                </Button>
              </div>
              {devices.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-gray-500">No bins paired yet. Click "Add Bin" to pair one over Bluetooth.</CardContent></Card>
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
                  </div>
                  <Battery className="h-12 w-12 text-green-500" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Rewards Catalog</CardTitle>
                  <AddRewardButton onAdd={(d) => createReward.mutate(d)} />
                </CardHeader>
                <CardContent className="space-y-2">
                  {rewards.length === 0 ? <p className="text-sm text-gray-500">No rewards yet.</p> : rewards.map(r => (
                    <div key={r.id} className="flex items-center justify-between border rounded p-3" data-testid={`row-reward-${r.id}`}>
                      <div>
                        <div className="font-semibold">{r.name}</div>
                        {r.description && <div className="text-sm text-gray-500">{r.description}</div>}
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge>{r.cost} pts</Badge>
                        <Button size="sm" disabled={(pointsBalance?.balance ?? 0) < r.cost} onClick={() => redeemReward.mutate(r.id)} data-testid={`button-redeem-${r.id}`}>Redeem</Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <DeviceSettingsPanel devices={devices} />
            </TabsContent>
          </Tabs>
        )}

        {addBinOpen && shop && (
          <AddBinDialog shop={shop} onClose={() => setAddBinOpen(false)} onPaired={refetchDevices} />
        )}
      </div>
    </div>
  );
}

function AddRewardButton({ onAdd }: { onAdd: (d: { name: string; cost: number; description?: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cost, setCost] = useState(10);
  const [desc, setDesc] = useState("");
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-add-reward"><Plus className="h-4 w-4 mr-1" />New Reward</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Reward</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} data-testid="input-reward-name" /></div>
            <div><Label>Cost (points)</Label><Input type="number" value={cost} onChange={e => setCost(Number(e.target.value))} data-testid="input-reward-cost" /></div>
            <div><Label>Description (optional)</Label><Input value={desc} onChange={e => setDesc(e.target.value)} data-testid="input-reward-desc" /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => { onAdd({ name, cost, description: desc || undefined }); setOpen(false); setName(""); setCost(10); setDesc(""); }} data-testid="button-save-reward">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeviceSettingsPanel({ devices }: { devices: Device[] }) {
  const [selected, setSelected] = useState<number | null>(devices[0]?.id ?? null);
  const id = selected ?? devices[0]?.id;
  const { data, refetch } = useQuery<{ settingsJson: any; version: number }>({
    queryKey: [`/api/partner/devices/${id}/settings`],
    queryFn: async () => (await apiRequest(`/api/partner/devices/${id}/settings`)).json(),
    enabled: !!id,
  });
  const [text, setText] = useState("");
  const { toast } = useToast();

  if (devices.length === 0) return <p className="text-sm text-gray-500">No devices yet.</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Settings</CardTitle>
        <select className="border rounded px-2 py-1 text-sm mt-2 w-fit" value={id ?? ""} onChange={(e) => setSelected(Number(e.target.value))} data-testid="select-settings-device">
          {devices.map(d => <option key={d.id} value={d.id}>{d.serial}</option>)}
        </select>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-gray-500 mb-2">Version: {data?.version ?? 0}</div>
        <textarea
          className="w-full h-64 font-mono text-xs border rounded p-2 bg-gray-50 dark:bg-gray-900"
          defaultValue={JSON.stringify(data?.settingsJson || {}, null, 2)}
          onChange={(e) => setText(e.target.value)}
          data-testid="textarea-settings"
        />
        <Button className="mt-3" onClick={async () => {
          try {
            const parsed = JSON.parse(text || JSON.stringify(data?.settingsJson || {}));
            const r = await apiRequest(`/api/partner/devices/${id}/settings`, { method: "PUT", body: JSON.stringify(parsed) });
            if (!r.ok) throw new Error("Save failed");
            toast({ title: "Settings saved", description: "Bin will pull on next poll." });
            refetch();
          } catch (e: any) {
            toast({ title: "Invalid JSON", description: e.message, variant: "destructive" });
          }
        }} data-testid="button-save-settings">Save</Button>
      </CardContent>
    </Card>
  );
}

function AddBinDialog({ shop, onClose, onPaired }: { shop: Shop; onClose: () => void; onPaired: () => void }) {
  const [state, setState] = useState<"idle" | "init" | "bt" | "waiting" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const supported = isWebBluetoothAvailable();

  async function start() {
    setState("init");
    setMsg("Reserving slot…");
    try {
      const r = await apiRequest("/api/partner/bins/pair-init", { method: "POST", body: JSON.stringify({ shopId: shop.id }) });
      if (!r.ok) throw new Error("pair-init failed");
      const { deviceKey, nonce, serial } = await r.json();
      setMsg("Pick your bin in the Bluetooth picker…");
      setState("bt");
      await pairBinOverBLE({ deviceKey, nonce, serial });
      setMsg("Waiting for bin to come online…");
      setState("waiting");
      // Poll devices for ~30s
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000));
        onPaired();
      }
      setState("done");
    } catch (e: any) {
      setMsg(e.message || "Pairing failed");
      setState("error");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Bin to {shop.name}</DialogTitle></DialogHeader>
        {!supported ? (
          <div className="space-y-3">
            <p className="text-sm">Web Bluetooth is not available in this browser. Use Chrome or Edge on desktop or Android to pair a bin.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : state === "idle" ? (
          <div className="space-y-3">
            <p className="text-sm">Power on the bin so it advertises over Bluetooth, then click below.</p>
            <Button onClick={start} data-testid="button-start-pair"><Bluetooth className="h-4 w-4 mr-1" /> Find Bin</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">{msg}</p>
            {state === "done" && <Button onClick={onClose}>Done</Button>}
            {state === "error" && <Button onClick={onClose} variant="outline">Close</Button>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
