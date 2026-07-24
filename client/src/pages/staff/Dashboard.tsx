import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, Camera, ChevronDown, ClipboardCheck, Cpu, HardDrive, History, Inbox,
  LayoutDashboard, MapPin, Megaphone, MoreHorizontal, Package, Phone, Plus,
  QrCode, Recycle, Store, Terminal, Trash2, UserPlus, Users as UsersIcon,
  Wrench, X, Mail,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import BinWidget, { RemoveBinDialog, ResetSdDialog } from "@/components/BinWidget";
import DeviceLogsDialog from "@/components/DeviceLogsDialog";
import Overview from "@/pages/staff/panels/Overview";
import ReviewQueue from "@/pages/staff/panels/ReviewQueue";
import Sessions from "@/pages/staff/panels/Sessions";
import StaffPairing from "@/pages/staff/panels/Pairing";
import Alerts from "@/pages/staff/panels/Alerts";
import LiveCamera from "@/pages/staff/panels/LiveCamera";
import Firmware from "@/pages/staff/panels/Firmware";
import DeviceOps from "@/pages/staff/panels/DeviceOps";
import ContentPacks from "@/pages/staff/panels/ContentPacks";
import StaffNotifications from "@/pages/staff/panels/StaffNotifications";

/* ------------------------------------------------------------------ */
/* Navigation model (STAFF_UI_REDESIGN §1)                             */
/* ------------------------------------------------------------------ */

type ViewKey =
  | "overview"
  | "devices" | "pairing" | "commands" | "camera" | "deviceops"
  | "sessions" | "review" | "alerts"
  | "firmware" | "content" | "notifications"
  | "shops" | "users" | "leads";

interface NavItem { key: ViewKey; label: string; icon: LucideIcon }

// View keys double as location-hash slugs AND keep the historical
// `tab-<key>` data-testids (hard constraint: every testid preserved).
const NAV_GROUPS: { label: string | null; items: NavItem[] }[] = [
  {
    label: null,
    items: [{ key: "overview", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Fleet",
    items: [
      { key: "devices", label: "Bins", icon: Trash2 },
      { key: "pairing", label: "Pairing", icon: QrCode },
      { key: "commands", label: "Commands", icon: Terminal },
      { key: "camera", label: "Live Camera", icon: Camera },
      { key: "deviceops", label: "Device Ops", icon: Wrench },
    ],
  },
  {
    label: "Activity",
    items: [
      { key: "sessions", label: "Sessions", icon: History },
      { key: "review", label: "Review", icon: ClipboardCheck },
      { key: "alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "Platform",
    items: [
      { key: "firmware", label: "Firmware", icon: Cpu },
      { key: "content", label: "Content", icon: Package },
      { key: "notifications", label: "Notifications", icon: Megaphone },
    ],
  },
  {
    label: "People",
    items: [
      { key: "shops", label: "Shops", icon: Store },
      { key: "users", label: "Users", icon: UsersIcon },
      { key: "leads", label: "Leads", icon: UserPlus },
    ],
  },
];

const VIEW_KEYS = new Set<string>(NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key)));

/** Per-section page header copy (STAFF_UI_REDESIGN §4). */
const PAGE_META: Record<ViewKey, { title: string; description: string }> = {
  overview: { title: "Overview", description: "Fleet at a glance — live status, attention items, and recent alerts." },
  devices: { title: "Bins", description: "Every LITTR One in the fleet, live health and controls." },
  pairing: { title: "Pairing", description: "Pick a shop and pair a new bin with a claim code." },
  commands: { title: "Commands", description: "Queue commands to a bin and track acknowledgement." },
  camera: { title: "Live Camera", description: "On-demand snapshots straight from a bin's camera." },
  deviceops: { title: "Device Ops", description: "Firmware targets and per-bin operational settings." },
  sessions: { title: "Sessions", description: "Disposal sessions across the fleet — filter, page, export." },
  review: { title: "Review", description: "Approve or reject detected drops from the review queue." },
  alerts: { title: "Alerts", description: "Active and resolved device alerts." },
  firmware: { title: "Firmware", description: "Upload builds and manage firmware rollout." },
  content: { title: "Content", description: "Content packs delivered to the bins' displays." },
  notifications: { title: "Notifications", description: "Your staff notification preferences for all bins." },
  shops: { title: "Shops", description: "Partner shops that host LITTR bins." },
  users: { title: "Users", description: "Accounts, roles, and partner-shop assignment." },
  leads: { title: "Leads", description: "Inbound partner interest from the marketing site." },
};

/** Read the active view from the location hash; default #overview. */
function viewFromHash(): ViewKey {
  const h = window.location.hash.replace(/^#/, "");
  return (VIEW_KEYS.has(h) ? h : "overview") as ViewKey;
}

function StaffSidebar({ view, onNavigate }: { view: ViewKey; onNavigate: (v: ViewKey) => void }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const go = (v: ViewKey) => {
    onNavigate(v);
    if (isMobile) setOpenMobile(false);
  };
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-green-500">
            <Recycle className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">LITTR Staff</div>
            <div className="text-xs text-muted-foreground">Fleet control</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label ?? "root"}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      isActive={view === item.key}
                      onClick={() => go(item.key)}
                      data-testid={`tab-${item.key}`}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

function PageHeader({ view }: { view: ViewKey }) {
  const meta = PAGE_META[view];
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{meta.title}</h2>
      <p className="text-sm text-muted-foreground">{meta.description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bin-card actions (STAFF_UI_REDESIGN §3)                             */
/* ------------------------------------------------------------------ */

/**
 * Staff bin-card actions: Logs + Commands stay visible; destructive actions
 * live behind a "⋯" menu. The confirm dialogs are CONTROLLED siblings of the
 * DropdownMenu — a trigger inside a DropdownMenuItem would unmount with the
 * menu when it closes on select, killing the dialog. Menu items only set state.
 */
function StaffBinActions({
  device,
  onViewCommands,
  onResetSd,
  resetPending,
  onRemove,
  removePending,
}: {
  device: any;
  onViewCommands: () => void;
  onResetSd: () => void;
  resetPending: boolean;
  onRemove: () => void;
  removePending: boolean;
}) {
  const [resetOpen, setResetOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const name = device.label && String(device.label).trim() !== "" ? device.label : device.serial;
  return (
    <>
      <DeviceLogsDialog deviceId={device.id} deviceName={name} basePath="/api/staff/devices" />
      <Button size="sm" variant="outline" onClick={onViewCommands} data-testid={`button-view-cmds-${device.id}`}>
        <Terminal className="mr-1 h-4 w-4" /> Commands
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label="More bin actions"
            data-testid={`button-bin-menu-${device.id}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => setResetOpen(true)}
            data-testid={`button-reset-sd-${device.id}`}
          >
            <HardDrive className="mr-2 h-4 w-4" /> Reset SD data
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setRemoveOpen(true)}
            className="text-red-600 focus:text-red-600 dark:text-red-500 dark:focus:text-red-500"
            data-testid={`button-remove-bin-${device.id}`}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Remove bin
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResetSdDialog
        deviceId={device.id}
        deviceName={name}
        open={resetOpen}
        onOpenChange={setResetOpen}
        onConfirm={onResetSd}
        pending={resetPending}
      />
      <RemoveBinDialog
        deviceId={device.id}
        deviceName={name}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onConfirm={onRemove}
        pending={removePending}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function StaffDashboard() {
  const { user, role, tempUnit } = useStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: devices = [], refetch: refetchDevices } = useQuery<any[]>({
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

  // Active view <-> location hash (init from hash; back/forward + refresh keep
  // your place; default #overview).
  const [view, setViewState] = useState<ViewKey>(viewFromHash);
  useEffect(() => {
    const onHashChange = () => setViewState(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const setView = (v: ViewKey) => {
    setViewState(v);
    if (window.location.hash !== `#${v}`) window.location.hash = v;
  };

  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const { data: commands = [], refetch: refetchCmds } = useQuery<any[]>({
    queryKey: [`/api/staff/devices/${selectedDeviceId}/commands`],
    queryFn: async () => (await apiRequest(`/api/staff/devices/${selectedDeviceId}/commands`)).json(),
    enabled: !!selectedDeviceId,
    refetchInterval: selectedDeviceId ? 5000 : false,
  });

  // Jump to the Commands view for a specific device (bin card / Overview deep-link).
  const viewCommands = (deviceId: number) => { setSelectedDeviceId(deviceId); setView("commands"); };

  const cancelCmd = useMutation({
    mutationFn: async ({ deviceId, commandId }: { deviceId: number; commandId: number }) => {
      const r = await apiRequest(`/api/staff/devices/${deviceId}/commands/${commandId}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Command cancelled" }); refetchCmds(); },
    onError: (e: any) => toast({ title: "Couldn't cancel", description: e.message, variant: "destructive" }),
  });

  const enqueue = useMutation({
    mutationFn: async ({ deviceId, type }: { deviceId: number; type: string }) => {
      const r = await apiRequest(`/api/staff/devices/${deviceId}/commands`, { method: "POST", body: JSON.stringify({ type }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Command queued" }); refetchCmds(); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const removeDevice = useMutation({
    mutationFn: async (deviceId: number) => {
      const r = await apiRequest(`/api/staff/devices/${deviceId}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Bin removed" }); qc.invalidateQueries({ queryKey: ["/api/staff/devices"] }); },
    onError: (e: any) => toast({ title: "Failed to remove", description: e.message, variant: "destructive" }),
  });

  const createShop = useMutation({
    mutationFn: async (d: any) => {
      const r = await apiRequest("/api/staff/shops", { method: "POST", body: JSON.stringify(d) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Shop created" }); qc.invalidateQueries({ queryKey: ["/api/staff/shops"] }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const r = await apiRequest(`/api/staff/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return r.json();
    },
    onSuccess: () => { toast({ title: "Role updated" }); qc.invalidateQueries({ queryKey: ["/api/staff/users"] }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const addMember = useMutation({
    mutationFn: async ({ shopId, userId }: { shopId: number; userId: string }) => {
      const r = await apiRequest(`/api/staff/shops/${shopId}/members`, { method: "POST", body: JSON.stringify({ userId, role: "OWNER" }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return r.json();
    },
    onSuccess: () => toast({ title: "Member added" }),
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!user || role !== "staff") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Button onClick={() => setLocation("/staff/login")}>Staff Login</Button>
      </div>
    );
  }

  const staffEnabled = !!user && role === "staff";

  return (
    <SidebarProvider>
      <StaffSidebar view={view} onNavigate={setView} />
      <SidebarInset>
        <div className="mx-auto w-full max-w-7xl px-4 py-4 md:px-8 md:py-6">
          <div className="flex items-start gap-2">
            <SidebarTrigger className="mt-2.5 flex-none" data-testid="button-sidebar-toggle" />
            <div className="min-w-0 flex-1">
              <DashboardHeader title="Staff Dashboard" subtitle="LITTR One fleet control" />
            </div>
          </div>

          <PageHeader view={view} />

          {view === "overview" && (
            <Overview
              enabled={staffEnabled}
              devices={devices}
              onNavigate={(v) => setView(v as ViewKey)}
              onViewCommands={viewCommands}
            />
          )}

          {view === "devices" && (
            devices.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Trash2 /></EmptyMedia>
                  <EmptyTitle>No bins yet</EmptyTitle>
                  <EmptyDescription>Pair the first LITTR One from the Pairing page.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setView("pairing")} data-testid="button-empty-goto-pairing">
                    <QrCode className="mr-1.5 h-4 w-4" /> Go to Pairing
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <div className="space-y-3">
                {devices.map(d => (
                  <BinWidget
                    key={d.id}
                    device={d}
                    tempUnit={tempUnit}
                    canManage
                    shopName={shops.find(s => s.id === d.shopId)?.name || (d.shopId ? `Shop #${d.shopId}` : "Unassigned")}
                    onChanged={() => refetchDevices()}
                    extraStats={[
                      { label: "RSSI", value: d.wifiRssi ?? "—" },
                      { label: "SD free", value: d.sdFreeMb != null ? `${d.sdFreeMb} MB` : "—" },
                      // Temp diagnostics (HW_FIXES_R3): "0 devices" (red) ⇒ the DS18B20
                      // isn't enumerating on the 1-Wire bus (wiring / GPIO45 strapping);
                      // a count with a raw of 85.0/−127 ⇒ probe present but not ready.
                      {
                        label: "Temp bus",
                        value: d.tempDevices == null ? "—"
                          : d.tempDevices === 0
                            ? <span className="text-red-600 dark:text-red-500">0 devices</span>
                            : `${d.tempDevices} dev`,
                      },
                      { label: "Temp raw", value: d.tempRawC != null ? `${d.tempRawC.toFixed(1)}°C` : "—" },
                      { label: "Errors", value: d.errorLog ? d.errorLog.slice(0, 40) : "—" },
                    ]}
                    actions={
                      <StaffBinActions
                        device={d}
                        onViewCommands={() => viewCommands(d.id)}
                        onResetSd={() => enqueue.mutate({ deviceId: d.id, type: "FORMAT_SD" })}
                        resetPending={enqueue.isPending}
                        onRemove={() => removeDevice.mutate(d.id)}
                        removePending={removeDevice.isPending}
                      />
                    }
                  />
                ))}
              </div>
            )
          )}

          {view === "commands" && (
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
                      {/* UPDATE_ASSETS = M4 content packs: bin pulls the newest active
                          pack (staff Content page) and pushes changed wallpapers to the
                          HMI screen without a reboot. */}
                      {["RESET_FILL_AND_COUNT", "REBOOT", "TAKE_PHOTO", "PING", "UPDATE_ASSETS"].map(t => (
                        <Button key={t} size="sm" variant="outline" onClick={() => enqueue.mutate({ deviceId: selectedDeviceId, type: t })} data-testid={`button-cmd-${t}`}>{t}</Button>
                      ))}
                    </div>
                    {commands.length === 0 ? <p className="text-sm text-gray-500">No commands.</p> : (
                      <div className="space-y-1">
                        {commands.map(c => (
                          <div key={c.id} className="flex items-center justify-between gap-2 border rounded p-2 text-sm" data-testid={`row-cmd-${c.id}`}>
                            <span>#{c.id} {c.type}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant={c.status === "ACKED" ? "default" : c.status === "FAILED" ? "destructive" : "secondary"}>{c.status}</Badge>
                              {c.status === "PENDING" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-destructive hover:text-destructive"
                                  onClick={() => cancelCmd.mutate({ deviceId: selectedDeviceId, commandId: c.id })}
                                  disabled={cancelCmd.isPending}
                                  data-testid={`button-cancel-cmd-${c.id}`}
                                >
                                  <X className="mr-1 h-3.5 w-3.5" /> Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">Only PENDING commands can be cancelled — once the bin picks one up it can't be recalled.</p>
                  </>
                ) : (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Terminal /></EmptyMedia>
                      <EmptyTitle>No device selected</EmptyTitle>
                      <EmptyDescription>Pick a device above to view and queue its commands.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </CardContent>
            </Card>
          )}

          {view === "pairing" && <StaffPairing enabled={staffEnabled} />}
          {view === "review" && <ReviewQueue enabled={staffEnabled} />}
          {view === "sessions" && <Sessions enabled={staffEnabled} />}
          {view === "alerts" && <Alerts enabled={staffEnabled} />}
          {view === "camera" && <LiveCamera enabled={staffEnabled} />}
          {view === "firmware" && <Firmware enabled={staffEnabled} />}
          {view === "deviceops" && <DeviceOps enabled={staffEnabled} />}
          {view === "content" && <ContentPacks enabled={staffEnabled} />}
          {view === "notifications" && <StaffNotifications enabled={staffEnabled} />}

          {view === "shops" && (
            <div className="space-y-3">
              <CreateShopForm onCreate={(d) => createShop.mutate(d)} />
              {shops.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Store /></EmptyMedia>
                    <EmptyTitle>No shops yet</EmptyTitle>
                    <EmptyDescription>Create the first partner shop above.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {shops.map(s => (
                    <Card key={s.id} data-testid={`card-shop-${s.id}`}>
                      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">{s.name}</CardTitle>
                          <p className="mt-0.5 text-sm text-muted-foreground">{s.address}, {s.city}</p>
                        </div>
                        <Badge className="flex-none">{s.status}</Badge>
                      </CardHeader>
                      {(s.serviceArea || s.phone) && (
                        <CardContent className="pt-0 text-sm text-muted-foreground">
                          {s.serviceArea}{s.serviceArea && s.phone ? " · " : ""}{s.phone}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === "users" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-0">
                  {users.length === 0 ? (
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><UsersIcon /></EmptyMedia>
                        <EmptyTitle>No users</EmptyTitle>
                        <EmptyDescription>Accounts appear here as people sign up.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Email</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead className="text-right">Set role</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((u: any) => (
                            <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                              <TableCell className="font-medium">{u.email}</TableCell>
                              <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {["STAFF", "PARTNER", "CUSTOMER"].map(r => (
                                    <Button key={r} size="sm" variant={u.role === r ? "default" : "outline"} onClick={() => updateRole.mutate({ id: u.id, role: r })} data-testid={`button-role-${r}-${u.id}`}>{r}</Button>
                                  ))}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Assign Partner to Shop</CardTitle></CardHeader>
                <CardContent>
                  <AssignMemberForm shops={shops} users={users} onSubmit={(d) => addMember.mutate(d)} />
                </CardContent>
              </Card>
            </div>
          )}

          {view === "leads" && (
            leads.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
                  <EmptyTitle>No leads yet</EmptyTitle>
                  <EmptyDescription>Partner sign-ups from the marketing site land here.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {leads.map((l: any) => (
                  <Card key={l.id} data-testid={`row-lead-${l.id}`}>
                    <CardContent className="p-4">
                      <div className="font-semibold">{l.businessName}</div>
                      {l.contactName && <div className="text-sm text-muted-foreground">{l.contactName}</div>}
                      <div className="mt-2 space-y-1 text-sm">
                        {l.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 flex-none" /><span className="truncate">{l.email}</span>
                          </div>
                        )}
                        {l.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 flex-none" /><span>{l.phone}</span>
                          </div>
                        )}
                        {l.address && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 flex-none" /><span className="truncate">{l.address}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** New-shop form, collapsed by default behind a "New shop" header button (§4). */
function CreateShopForm({ onCreate }: { onCreate: (d: any) => void }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ name: "", address: "", city: "", serviceArea: "Upstate NY", phone: "" });
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="flex flex-row items-center space-y-0 py-4">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-toggle-create-shop">
              <Plus className="mr-1 h-4 w-4" /> New shop
              <ChevronDown className={`ml-1 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="grid grid-cols-1 gap-2 pt-0 md:grid-cols-2">
            <Input placeholder="Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} data-testid="input-shop-name" />
            <Input placeholder="Address" value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} data-testid="input-shop-address" />
            <Input placeholder="City" value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} data-testid="input-shop-city" />
            <Input placeholder="Service Area" value={d.serviceArea} onChange={(e) => setD({ ...d, serviceArea: e.target.value })} />
            <Input placeholder="Phone" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} />
            <Button onClick={() => onCreate(d)} data-testid="button-create-shop"><Plus className="h-4 w-4 mr-1" />Create</Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
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
