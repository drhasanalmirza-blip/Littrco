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
import { useToast } from "@/hooks/use-toast";
import { LogOut, Plus } from "lucide-react";

export default function StaffDashboard() {
  const { user, role, clearAuth } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: devices = [] } = useQuery<any[]>({
    queryKey: ["/api/staff/devices"],
    queryFn: async () => (await apiRequest("/api/staff/devices")).json(),
    enabled: !!user && role === "staff",
    refetchInterval: 10000,
  });
  const { data: shops = [] } = useQuery<any[]>({
    queryKey: ["/api/staff/shops"],
    queryFn: async () => (await apiRequest("/api/staff/shops")).json(),
    enabled: !!user && role === "staff",
  });
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/staff/users"],
    queryFn: async () => (await apiRequest("/api/staff/users")).json(),
    enabled: !!user && role === "staff",
  });
  const { data: leads = [] } = useQuery<any[]>({
    queryKey: ["/api/staff/leads"],
    queryFn: async () => (await apiRequest("/api/staff/leads")).json(),
    enabled: !!user && role === "staff",
  });

  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const { data: commands = [], refetch: refetchCmds } = useQuery<any[]>({
    queryKey: [`/api/staff/devices/${selectedDeviceId}/commands`],
    queryFn: async () => (await apiRequest(`/api/staff/devices/${selectedDeviceId}/commands`)).json(),
    enabled: !!selectedDeviceId,
  });

  const enqueue = useMutation({
    mutationFn: async ({ deviceId, type }: { deviceId: number; type: string }) => {
      const r = await apiRequest(`/api/staff/devices/${deviceId}/commands`, { method: "POST", body: JSON.stringify({ type }) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Command queued" }); refetchCmds(); },
  });

  const createShop = useMutation({
    mutationFn: async (d: any) => {
      const r = await apiRequest("/api/staff/shops", { method: "POST", body: JSON.stringify(d) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Shop created" }); qc.invalidateQueries({ queryKey: ["/api/staff/shops"] }); },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const r = await apiRequest(`/api/staff/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/staff/users"] }),
  });

  const addMember = useMutation({
    mutationFn: async ({ shopId, userId }: { shopId: number; userId: string }) => {
      const r = await apiRequest(`/api/staff/shops/${shopId}/members`, { method: "POST", body: JSON.stringify({ userId, role: "OWNER" }) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => toast({ title: "Member added" }),
  });

  if (!user || role !== "staff") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => setLocation("/staff/login")}>Staff Login</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Staff Dashboard</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={async () => { await apiRequest("/api/auth/logout", { method: "POST" }); clearAuth(); setLocation("/"); }} data-testid="button-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="devices">
          <TabsList className="mb-4">
            <TabsTrigger value="devices" data-testid="tab-devices">Devices</TabsTrigger>
            <TabsTrigger value="commands" data-testid="tab-commands">Command Queue</TabsTrigger>
            <TabsTrigger value="shops" data-testid="tab-shops">Shops</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-leads">Leads</TabsTrigger>
          </TabsList>

          <TabsContent value="devices" className="space-y-3">
            {devices.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-gray-500">No devices yet.</CardContent></Card>
            ) : devices.map(d => (
              <Card key={d.id} data-testid={`card-device-${d.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold">{d.serial}</span>
                        <Badge variant={d.status === "LIVE" ? "default" : "secondary"}>{d.status}</Badge>
                        {d.firmwareVersion && <Badge variant="outline">fw {d.firmwareVersion}</Badge>}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Shop: {shops.find(s => s.id === d.shopId)?.name || d.shopId || "—"}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setSelectedDeviceId(d.id)} data-testid={`button-view-cmds-${d.id}`}>View Commands</Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
                    <Stat label="Fill" value={`${d.fillPercent}%`} />
                    <Stat label="Vapes" value={d.vapesSinceEmpty} />
                    <Stat label="Temp" value={d.tempC != null ? `${d.tempC}°C` : "—"} />
                    <Stat label="VOC" value={d.vocRaw ?? "—"} />
                    <Stat label="RSSI" value={d.wifiRssi ?? "—"} />
                    <Stat label="SD free" value={d.sdFreeMb != null ? `${d.sdFreeMb} MB` : "—"} />
                    <Stat label="Last seen" value={d.lastHeartbeatAt ? new Date(d.lastHeartbeatAt).toLocaleString() : "never"} />
                    <Stat label="Errors" value={d.errorLog ? d.errorLog.slice(0, 40) : "—"} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="commands">
            <Card>
              <CardHeader>
                <CardTitle>Command Queue</CardTitle>
                <select className="border rounded px-2 py-1 text-sm mt-2 w-fit" value={selectedDeviceId ?? ""} onChange={(e) => setSelectedDeviceId(Number(e.target.value))} data-testid="select-cmd-device">
                  <option value="">Pick a device…</option>
                  {devices.map(d => <option key={d.id} value={d.id}>{d.serial}</option>)}
                </select>
              </CardHeader>
              <CardContent>
                {selectedDeviceId ? (
                  <>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {["RESET_FILL_AND_COUNT", "REBOOT", "TAKE_PHOTO", "PING"].map(t => (
                        <Button key={t} size="sm" variant="outline" onClick={() => enqueue.mutate({ deviceId: selectedDeviceId, type: t })} data-testid={`button-cmd-${t}`}>{t}</Button>
                      ))}
                    </div>
                    {commands.length === 0 ? <p className="text-sm text-gray-500">No commands.</p> : (
                      <div className="space-y-1">
                        {commands.map(c => (
                          <div key={c.id} className="flex justify-between border rounded p-2 text-sm" data-testid={`row-cmd-${c.id}`}>
                            <span>#{c.id} {c.type}</span>
                            <Badge variant={c.status === "ACKED" ? "default" : "secondary"}>{c.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : <p className="text-sm text-gray-500">Pick a device to view its command queue.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shops" className="space-y-3">
            <CreateShopForm onCreate={(d) => createShop.mutate(d)} />
            {shops.map(s => (
              <Card key={s.id} data-testid={`card-shop-${s.id}`}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-sm text-gray-500">{s.address}, {s.city}</div>
                  </div>
                  <Badge>{s.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardContent className="p-4 space-y-2">
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between border rounded p-2" data-testid={`row-user-${u.id}`}>
                    <div className="text-sm">
                      <div>{u.email}</div>
                      <div className="text-xs text-gray-500">{u.role}</div>
                    </div>
                    <div className="flex gap-1">
                      {["STAFF", "PARTNER", "CUSTOMER"].map(r => (
                        <Button key={r} size="sm" variant={u.role === r ? "default" : "outline"} onClick={() => updateRole.mutate({ id: u.id, role: r })} data-testid={`button-role-${r}-${u.id}`}>{r}</Button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="mt-4">
              <CardHeader><CardTitle>Assign Partner to Shop</CardTitle></CardHeader>
              <CardContent>
                <AssignMemberForm shops={shops} users={users} onSubmit={(d) => addMember.mutate(d)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardContent className="p-4 space-y-2">
                {leads.length === 0 ? <p className="text-sm text-gray-500">No leads.</p> : leads.map((l: any) => (
                  <div key={l.id} className="border rounded p-2 text-sm" data-testid={`row-lead-${l.id}`}>
                    <div className="font-semibold">{l.businessName}</div>
                    <div className="text-xs text-gray-500">{l.contactName} · {l.email} · {l.phone}</div>
                    <div className="text-xs">{l.address}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="bg-gray-100 dark:bg-gray-900 rounded p-2"><div className="text-gray-500">{label}</div><div className="font-semibold">{String(value)}</div></div>;
}

function CreateShopForm({ onCreate }: { onCreate: (d: any) => void }) {
  const [d, setD] = useState({ name: "", address: "", city: "", serviceArea: "Upstate NY", phone: "" });
  return (
    <Card>
      <CardHeader><CardTitle>New Shop</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} data-testid="input-shop-name" />
        <Input placeholder="Address" value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} data-testid="input-shop-address" />
        <Input placeholder="City" value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} data-testid="input-shop-city" />
        <Input placeholder="Service Area" value={d.serviceArea} onChange={(e) => setD({ ...d, serviceArea: e.target.value })} />
        <Input placeholder="Phone" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
        <Button onClick={() => onCreate(d)} data-testid="button-create-shop"><Plus className="h-4 w-4 mr-1" />Create</Button>
      </CardContent>
    </Card>
  );
}

function AssignMemberForm({ shops, users, onSubmit }: { shops: any[]; users: any[]; onSubmit: (d: { shopId: number; userId: string }) => void }) {
  const [shopId, setShopId] = useState<number | null>(null);
  const [userId, setUserId] = useState<string>("");
  return (
    <div className="flex gap-2 flex-wrap">
      <select className="border rounded px-2 py-1" value={shopId ?? ""} onChange={(e) => setShopId(Number(e.target.value))} data-testid="select-assign-shop">
        <option value="">Shop…</option>
        {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select className="border rounded px-2 py-1" value={userId} onChange={(e) => setUserId(e.target.value)} data-testid="select-assign-user">
        <option value="">Partner user…</option>
        {users.filter((u: any) => u.role === "PARTNER").map((u: any) => <option key={u.id} value={u.id}>{u.email}</option>)}
      </select>
      <Button disabled={!shopId || !userId} onClick={() => shopId && userId && onSubmit({ shopId, userId })} data-testid="button-assign-member">Assign</Button>
    </div>
  );
}
