import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";
import { Building, Users, Cpu, Gift, Package, Mail, HandHeart, TrendingUp, Flame, Trash2, AlertTriangle, Thermometer, Wind, CheckCircle, Recycle, LogOut, Info, X, Phone, Send, FileText, Inbox, Link2, Search, Activity, ShieldAlert, Trash, Sun, Moon, UserCog, Plus, Key, Eye, EyeOff, ClipboardList, Tags, Settings2, Image, RefreshCw, Edit, Save, ChevronRight, Camera, Wifi, WifiOff, Zap, ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MailboxManager } from "@/components/staff/MailboxManager";
import { InboxPortal } from "@/components/staff/InboxPortal";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";

function DeleteShopButton({ shopId, shopName }: { shopId: number; shopName: string }) {
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/staff/shops/${shopId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete shop');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shops'] });
      setOpen(false);
    }
  });

  useEffect(() => {
    if (!open) { setCountdown(5); return; }
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, countdown]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          data-testid={`button-delete-shop-${shopId}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Shop?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <span className="font-semibold">{shopName}</span> and all associated data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteMutation.error && (
          <p className="text-sm text-red-500" data-testid="text-delete-shop-error">{(deleteMutation.error as Error).message}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete-shop">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
            onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }}
            disabled={countdown > 0 || deleteMutation.isPending}
            data-testid="button-confirm-delete-shop"
          >
            {deleteMutation.isPending ? 'Removing...' : countdown > 0 ? `Remove Shop (${countdown}s)` : 'Remove Shop'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function StaffDashboard() {
  const { user, role, clearAuth, theme, toggleTheme } = useStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: leads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/leads');
      if (!res.ok) throw new Error('Failed to fetch leads');
      return res.json();
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ['shops'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/shops');
      if (!res.ok) throw new Error('Failed to fetch shops');
      return res.json();
    },
  });

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/devices');
      if (!res.ok) throw new Error('Failed to fetch devices');
      return res.json();
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/contacts');
      if (!res.ok) throw new Error('Failed to fetch contacts');
      return res.json();
    },
  });

  const { data: volunteers = [] } = useQuery({
    queryKey: ['volunteers'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/volunteers');
      if (!res.ok) throw new Error('Failed to fetch volunteers');
      return res.json();
    },
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ['redemptions'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/redemptions');
      if (!res.ok) throw new Error('Failed to fetch redemptions');
      return res.json();
    },
  });

  const { data: dropEvents = [] } = useQuery({
    queryKey: ['dropEvents'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/drop-events');
      if (!res.ok) throw new Error('Failed to fetch drop events');
      return res.json();
    },
  });

  const { data: bins = [] } = useQuery({
    queryKey: ['bins'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/bins');
      if (!res.ok) throw new Error('Failed to fetch bins');
      return res.json();
    },
  });

  const { data: fireAlerts = [] } = useQuery({
    queryKey: ['fireAlerts'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/fire-alerts');
      if (!res.ok) throw new Error('Failed to fetch fire alerts');
      return res.json();
    },
  });

  const { data: pairRequests = [] } = useQuery({
    queryKey: ['pair-requests'],
    queryFn: async () => {
      const res = await apiRequest('/api/v2/staff/pair-requests');
      if (!res.ok) throw new Error('Failed to fetch pair requests');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: pendingSetupBins = [] } = useQuery({
    queryKey: ['pending-setup-bins'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/bins/pending-setup');
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: allPartnerPoints = [] } = useQuery({
    queryKey: ['all-partner-points'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/partner-points');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: activityLog = [] } = useQuery({
    queryKey: ['activity-log'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/activity-log');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const [activitySearch, setActivitySearch] = useState("");
  const [activityLimit, setActivityLimit] = useState(50);

  const filteredActivity = useMemo(() => {
    if (!activitySearch.trim()) return activityLog;
    const q = activitySearch.toLowerCase();
    return activityLog.filter((entry: any) =>
      entry.userEmail?.toLowerCase().includes(q) ||
      entry.shopName?.toLowerCase().includes(q) ||
      entry.deviceName?.toLowerCase().includes(q)
    );
  }, [activityLog, activitySearch]);

  const activityStats = useMemo(() => {
    const totalClaims = activityLog.length;
    const totalPoints = activityLog.reduce((sum: number, e: any) => sum + (e.pointsClaimed || 0), 0);
    const uniqueUsers = new Set(activityLog.map((e: any) => e.userEmail)).size;
    const userCounts: Record<string, { count: number; points: number; lastClaim: string }> = {};
    activityLog.forEach((e: any) => {
      if (!userCounts[e.userEmail]) userCounts[e.userEmail] = { count: 0, points: 0, lastClaim: e.claimedAt };
      userCounts[e.userEmail].count++;
      userCounts[e.userEmail].points += e.pointsClaimed || 0;
      if (e.claimedAt > userCounts[e.userEmail].lastClaim) userCounts[e.userEmail].lastClaim = e.claimedAt;
    });
    const flaggedUsers = Object.entries(userCounts)
      .filter(([, v]) => v.count >= 10 || v.points >= 100)
      .map(([email, v]) => ({ email, ...v }))
      .sort((a, b) => b.points - a.points);
    return { totalClaims, totalPoints, uniqueUsers, flaggedUsers };
  }, [activityLog]);

  const [section, setSection] = useState<string | null>(null);

  const { data: mailboxes = [] } = useQuery({
    queryKey: ['mailboxes'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/mailboxes');
      if (!res.ok) throw new Error('Failed to fetch mailboxes');
      return res.json();
    },
  });

  const { data: myMailbox } = useQuery({
    queryKey: ['myMailbox'],
    queryFn: async () => {
      const res = await apiRequest('/api/inbox/mailbox');
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: inboxMessages = [] } = useQuery({
    queryKey: ['inboxMessages'],
    queryFn: async () => {
      const res = await apiRequest('/api/inbox/messages');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!myMailbox,
  });

  const { data: sentMessages = [] } = useQuery({
    queryKey: ['sentMessages'],
    queryFn: async () => {
      const res = await apiRequest('/api/inbox/sent');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!myMailbox,
  });

  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId: number) => {
      const res = await apiRequest(`/api/staff/fire-alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to acknowledge alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fireAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async (alertId: number) => {
      const res = await apiRequest(`/api/staff/fire-alerts/${alertId}/resolve`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to resolve alert');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fireAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });
    },
  });

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    clearAuth();
    setLocation('/');
  };

  if (role !== 'staff' && role !== 'admin') {
    return (
      <div className="littr-dashboard flex items-center justify-center">
        <div className="littr-card-solid p-8 rounded-2xl text-center">
          <p className="text-xl mb-4 text-black dark:text-white">Access Denied</p>
          <Button onClick={() => setLocation('/staff/login')} className="littr-btn littr-btn-primary">Staff Login</Button>
        </div>
      </div>
    );
  }

  const stats = {
    totalLeads: leads.length,
    activeShops: shops.filter((s: any) => s.status === 'VERIFIED').length,
    totalDevices: devices.length,
    pendingRedemptions: redemptions.filter((r: any) => r.status === 'PENDING').length,
    todayDrops: dropEvents.filter((e: any) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return new Date(e.createdAt) >= today;
    }).length,
    activeFireAlerts: fireAlerts.filter((a: any) => !a.acknowledged).length,
    totalBins: bins.length,
  };

  const pendingPairCount = pairRequests.filter((pr: any) => !pr.claimed && new Date(pr.expiresAt) >= new Date()).length;
  const pendingSetupCount = pendingSetupBins.length;
  const unreadInboxCount = myMailbox?.unreadCount || 0;

  const navGroups = [
    {
      title: "Operations",
      items: [
        { id: "leads", label: "Leads", desc: "Business inquiries", icon: Package, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", count: stats.totalLeads },
        { id: "shops", label: "Shops", desc: "Partner locations", icon: Building, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950", count: stats.activeShops },
        { id: "bins", label: "Bins", desc: "Hardware, setup & camera modules", icon: Cpu, color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-950", count: stats.totalBins, badge: (pendingPairCount + pendingSetupCount) > 0 ? (pendingPairCount + pendingSetupCount) : undefined },
      ],
    },
    {
      title: "AI & Classification",
      items: [
        { id: "drop-review", label: "Drop Review", desc: "Review & override AI", icon: ClipboardList, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950" },
        { id: "taxonomy", label: "Taxonomy", desc: "Brands, subtypes, flavors", icon: Tags, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950" },
        { id: "activity", label: "Activity", desc: "Drops & claims today", icon: TrendingUp, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950", count: stats.todayDrops },
      ],
    },
    {
      title: "Communications",
      items: [
        { id: "emails", label: "Emails", desc: "Send & templates", icon: Send, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950" },
        { id: "messages", label: "Inbox", desc: "Internal messages", icon: Inbox, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950", badge: unreadInboxCount > 0 ? unreadInboxCount : undefined },
      ],
    },
    {
      title: "People",
      items: [
        { id: "volunteers", label: "Volunteers", desc: "Sign-ups & outreach", icon: HandHeart, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950" },
        { id: "users", label: "Users", desc: "Accounts & roles", icon: UserCog, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-950" },
      ],
    },
  ];

  const allNavItems = navGroups.flatMap(g => g.items);

  const renderSectionContent = () => {
    switch (section) {
      case "leads": return renderLeads();
      case "shops": return renderShops();
      case "bins":
      case "devices":
      case "modules":
      case "pending-setup":
        return renderDevices();
      case "drop-review": return <DropReviewTab />;
      case "taxonomy": return <TaxonomyTab />;
      case "activity": return renderActivity();
      case "emails": return renderEmails();
      case "messages": return renderMessages();
      case "volunteers": return renderVolunteers();
      case "users": return <UsersManagement />;
      default: return null;
    }
  };

  const renderLeads = () => (
    <Card>
      <CardHeader>
        <CardTitle>Bin Request Leads</CardTitle>
        <CardDescription>Businesses requesting recycling bins</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead: any) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">{lead.businessName}</TableCell>
                <TableCell>
                  {lead.contactName}<br />
                  <span className="text-xs text-gray-400">{lead.email}</span>
                </TableCell>
                <TableCell>{lead.address}</TableCell>
                <TableCell>
                  <Badge variant={lead.status === 'NEW' ? 'default' : lead.status === 'CONVERTED' ? 'outline' : 'secondary'}>
                    {lead.status}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(lead.createdAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400">No leads yet</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderShops = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Partner Shops</CardTitle>
          <CardDescription>Manage verified partner locations</CardDescription>
        </div>
        <CreateShopDialog />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Service Area</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shops.map((shop: any) => (
              <TableRow key={shop.id}>
                <TableCell className="font-medium">{shop.name}</TableCell>
                <TableCell>{shop.address}, {shop.city}</TableCell>
                <TableCell>{shop.serviceArea}</TableCell>
                <TableCell>
                  <Badge variant={shop.status === 'VERIFIED' ? 'default' : shop.status === 'PENDING' ? 'secondary' : 'destructive'}>
                    {shop.status}
                  </Badge>
                </TableCell>
                <TableCell className="flex items-center gap-2">
                  <ShopActionsMenu shop={shop} />
                  <DeleteShopButton shopId={shop.id} shopName={shop.name} />
                </TableCell>
              </TableRow>
            ))}
            {shops.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-400">No shops yet</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const renderDevices = () => (
    <div className="space-y-6">
      {fireAlerts.length > 0 && (
        <Card className="border-red-500 !bg-red-50 dark:!bg-red-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <Flame className="h-5 w-5 animate-pulse" />
              Active Fire Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fireAlerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.severity === 'CRITICAL' ? 'bg-red-50 dark:bg-red-950 border-red-500 animate-pulse' :
                    alert.severity === 'HIGH' ? 'bg-red-50 dark:bg-red-950 border-red-400' :
                    alert.severity === 'MEDIUM' ? 'bg-orange-50 dark:bg-orange-950 border-orange-400' :
                    'bg-yellow-50 dark:bg-yellow-950 border-yellow-400'
                  }`}
                  data-testid={`fire-alert-${alert.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Flame className={`h-6 w-6 ${
                        alert.severity === 'CRITICAL' ? 'text-red-500 animate-pulse' :
                        alert.severity === 'HIGH' ? 'text-red-500' :
                        alert.severity === 'MEDIUM' ? 'text-orange-600' : 'text-yellow-600'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'destructive' : alert.severity === 'MEDIUM' ? 'default' : 'secondary'}
                            className={alert.severity === 'CRITICAL' ? 'animate-pulse bg-red-600' : alert.severity === 'HIGH' ? 'bg-red-500' : alert.severity === 'MEDIUM' ? 'bg-orange-500' : 'bg-yellow-500 text-black'}
                            data-testid={`severity-badge-${alert.id}`}
                          >
                            {alert.severity}
                          </Badge>
                          <span className="font-semibold text-black dark:text-white">{alert.bin?.name || `Bin #${alert.binId}`}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">at {alert.shop?.name || 'Unknown Shop'}</span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {alert.temperature !== null && <span className="mr-3">{alert.temperature?.toFixed(1)}°C</span>}
                          {alert.temperatureRise !== null && alert.temperatureRise > 0 && <span className="text-red-500">+{alert.temperatureRise?.toFixed(1)}°C rise</span>}
                          <span className="ml-3 text-gray-400">{new Date(alert.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!alert.acknowledged && (
                        <Button size="sm" variant="outline" onClick={() => acknowledgeAlert.mutate(alert.id)} disabled={acknowledgeAlert.isPending} data-testid={`acknowledge-alert-${alert.id}`}>
                          Acknowledge
                        </Button>
                      )}
                      <Button size="sm" variant={alert.acknowledged ? "default" : "secondary"} onClick={() => resolveAlert.mutate(alert.id)} disabled={resolveAlert.isPending} data-testid={`resolve-alert-${alert.id}`}>
                        Resolve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="bin-lifecycle-pipeline">
        <div className="p-4 rounded-2xl border border-blue-100 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40">
          <div className="flex items-center gap-2 mb-1">
            <Link2 className="h-4 w-4 text-blue-500" />
            <span className="text-[11px] uppercase tracking-wide text-blue-700 dark:text-blue-300">Awaiting Assignment</span>
          </div>
          <p className="text-2xl font-bold text-black dark:text-white" data-testid="stat-awaiting-pair">{pendingPairCount}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">New hardware to assign to a bin</p>
        </div>
        <div className={`p-4 rounded-2xl border ${pendingSetupCount > 0 ? 'border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/40' : 'border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className={`h-4 w-4 ${pendingSetupCount > 0 ? 'text-amber-500' : 'text-gray-400'}`} />
            <span className={`text-[11px] uppercase tracking-wide ${pendingSetupCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500'}`}>Legacy Pending</span>
          </div>
          <p className="text-2xl font-bold text-black dark:text-white" data-testid="stat-pending-setup">{pendingSetupCount}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{pendingSetupCount > 0 ? 'Older bins still needing setup' : 'None — assign on pair'}</p>
        </div>
        <div className="p-4 rounded-2xl border border-green-200 dark:border-green-900 bg-green-50/60 dark:bg-green-950/40">
          <div className="flex items-center gap-2 mb-1">
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-[11px] uppercase tracking-wide text-green-700 dark:text-green-300">Active</span>
          </div>
          <p className="text-2xl font-bold text-black dark:text-white" data-testid="stat-active-bins">{bins.filter((b: any) => b.status === 'ONLINE').length}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Online and reporting</p>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40">
          <div className="flex items-center gap-2 mb-1">
            <WifiOff className="h-4 w-4 text-gray-500" />
            <span className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-400">Offline / Other</span>
          </div>
          <p className="text-2xl font-bold text-black dark:text-white" data-testid="stat-offline-bins">{bins.filter((b: any) => b.status !== 'ONLINE' && b.status !== 'PENDING_SETUP').length}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Offline, maintenance, alerts</p>
        </div>
      </div>

      <Tabs defaultValue={pendingPairCount > 0 ? 'fleet' : (pendingSetupCount > 0 ? 'pending' : 'fleet')} className="space-y-4" data-testid="bins-subtabs">
        <TabsList className={`grid ${pendingSetupCount > 0 ? 'grid-cols-4' : 'grid-cols-3'} w-full max-w-2xl`}>
          <TabsTrigger value="fleet" data-testid="subtab-fleet">
            <Cpu className="h-3.5 w-3.5 mr-1.5" />
            Fleet
          </TabsTrigger>
          {pendingSetupCount > 0 && (
            <TabsTrigger value="pending" data-testid="subtab-pending-setup">
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              Legacy Setup
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px] bg-amber-500 text-white">{pendingSetupCount}</Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="modules" data-testid="subtab-modules">
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            Camera Modules
          </TabsTrigger>
          <TabsTrigger value="capabilities" data-testid="subtab-capabilities">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            Capabilities
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fleet" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Smart Bins
                </CardTitle>
                <CardDescription>All ESP32 recycling bins with sensors. Click a row for full details.</CardDescription>
              </div>
              <CreateDeviceDialog shops={shops} />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Shop</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Fill</TableHead>
                    <TableHead>Temp</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead className="text-right">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bins.map((bin: any) => (
                    <TableRow key={bin.id} data-testid={`bin-row-${bin.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <TableCell className="font-mono text-xs">{bin.deviceId || bin.id}</TableCell>
                      <TableCell className="font-medium">{bin.name || <span className="text-amber-600 italic text-xs">unnamed</span>}</TableCell>
                      <TableCell>{bin.shop?.name || <span className="text-gray-400 text-xs">—</span>}</TableCell>
                      <TableCell>
                        <Badge
                          variant={bin.status === 'ONLINE' ? 'default' : bin.status === 'FIRE_ALERT' ? 'destructive' : bin.status === 'MAINTENANCE' ? 'secondary' : 'outline'}
                          className={
                            bin.status === 'FIRE_ALERT' ? 'animate-pulse' :
                            bin.status === 'PENDING_SETUP' ? 'border-amber-400 text-amber-600' : ''
                          }
                          data-testid={`bin-status-${bin.id}`}
                        >
                          {bin.status === 'FIRE_ALERT' && <Flame className="h-3 w-3 mr-1" />}
                          {bin.status === 'PENDING_SETUP' ? 'PENDING SETUP' : bin.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {bin.mode ? (
                          <Badge variant="outline" className={bin.mode === 'demo' ? 'border-blue-300 text-blue-600' : 'border-green-300 text-green-600'}>
                            {bin.mode}
                          </Badge>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </TableCell>
                      <TableCell>
                        {bin.cameraModel && bin.cameraModel !== 'none' ? (
                          <Badge variant="outline" className="border-violet-300 text-violet-600 text-xs">
                            {bin.cameraModel === 's3cam' ? <Cpu className="h-3 w-3 mr-1" /> : <Phone className="h-3 w-3 mr-1" />}
                            {bin.cameraModel === 's3cam' ? 'S3-CAM' : 'Android'}
                          </Badge>
                        ) : <span className="text-gray-400 text-xs">none</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-14 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${bin.fillLevel >= 80 ? 'bg-red-500' : bin.fillLevel >= 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${bin.fillLevel || 0}%` }} />
                          </div>
                          <span className="text-xs">{bin.fillLevel != null ? `${bin.fillLevel}%` : <span className="text-gray-400">—</span>}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {bin.lastTemperature != null ? (
                          <span className={bin.lastTemperature >= 45 ? 'text-red-600 font-semibold text-xs' : 'text-xs'}>{bin.lastTemperature?.toFixed(1)}°C</span>
                        ) : <span className="text-gray-400 text-xs">--</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {bin.lastSeenAt ? new Date(bin.lastSeenAt).toLocaleString() : <span className="text-gray-400">Never</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <BinDetailDialog bin={bin} shops={shops} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {bins.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-gray-400 py-8">No bins yet. Add a device to get started.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4" />
                Pair Requests
                {pendingPairCount > 0 && <Badge className="bg-blue-500">{pendingPairCount} open</Badge>}
              </CardTitle>
              <CardDescription>ESP32 devices waiting to be claimed by a shop</CardDescription>
            </CardHeader>
            <CardContent>
              <Table data-testid="table-pair-requests">
                <TableHeader>
                  <TableRow>
                    <TableHead>Pair Code</TableHead>
                    <TableHead>Device UID</TableHead>
                    <TableHead>Firmware</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Shop</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pairRequests.map((pr: any) => {
                    const isPending = !pr.claimed && new Date(pr.expiresAt) >= new Date();
                    return (
                      <TableRow key={pr.id} data-testid={`pair-request-row-${pr.id}`}>
                        <TableCell><Badge variant="outline" className="font-mono">{pr.pairCode}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">...{pr.uid?.slice(-8)}</TableCell>
                        <TableCell>{pr.firmwareVersion || 'Unknown'}</TableCell>
                        <TableCell>
                          {pr.claimed ? <Badge className="bg-green-600">Assigned</Badge> :
                           new Date(pr.expiresAt) < new Date() ? <Badge className="bg-red-600">Expired</Badge> :
                           <Badge className="bg-yellow-600 text-black">Awaiting</Badge>}
                        </TableCell>
                        <TableCell>{pr.shopId ? shops.find((s: any) => s.id === pr.shopId)?.name || 'Unknown' : '—'}</TableCell>
                        <TableCell className="text-xs">{new Date(pr.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {isPending ? (
                            <AssignPairRequestDialog pairRequest={pr} shops={shops} />
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {pairRequests.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-4">No pair requests yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-amber-500" />
                Pending Setup
              </CardTitle>
              <CardDescription>Newly paired bins need a name, mode, and camera model before they go live.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <PendingSetupTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="modules">
          <ModulesTab bins={bins} shops={shops} />
        </TabsContent>

        <TabsContent value="capabilities">
          <BinCapabilitiesTab bins={bins} />
        </TabsContent>
      </Tabs>
    </div>
  );

  const renderActivity = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/10">
                <Activity className="h-5 w-5 text-black dark:text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="activity-log-count">{activityStats.totalClaims}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Claims</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/10">
                <TrendingUp className="h-5 w-5 text-black dark:text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activityStats.totalPoints.toLocaleString()}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Points Redeemed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/10">
                <Users className="h-5 w-5 text-black dark:text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activityStats.uniqueUsers}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Unique Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {activityStats.flaggedUsers.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-base">
              <ShieldAlert className="h-5 w-5" />
              High-Activity Users
            </CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-400">Users with 10+ claims or 100+ total points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activityStats.flaggedUsers.map((u: any) => (
                <div key={u.email} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white dark:bg-gray-900 border border-amber-100 dark:border-amber-800">
                  <span className="font-medium text-sm">{u.email}</span>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <span>{u.count} claims</span>
                    <span className="font-semibold text-amber-700 dark:text-amber-300">{u.points} pts</span>
                    <span className="text-xs text-gray-400">last: {new Date(u.lastClaim).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Claims Log</CardTitle>
              <CardDescription>All points redeemed from bins</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input data-testid="activity-log-search" placeholder="Search..." value={activitySearch} onChange={(e) => setActivitySearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table data-testid="activity-log-table">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Device</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead className="text-right">Drops</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Claimed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActivity.slice(0, activityLimit).map((entry: any) => (
                <TableRow key={`${entry.source}-${entry.id}`}>
                  <TableCell className="font-medium text-sm">{entry.userEmail}</TableCell>
                  <TableCell className="text-sm">{entry.shopName}</TableCell>
                  <TableCell className="text-sm text-gray-500 dark:text-gray-400">{entry.deviceName}</TableCell>
                  <TableCell className="text-right font-semibold">+{entry.pointsClaimed}</TableCell>
                  <TableCell className="text-right text-gray-500 dark:text-gray-400">{entry.dropCount}</TableCell>
                  <TableCell>
                    <Badge variant={entry.source === 'v2' ? 'default' : 'secondary'} className={entry.source === 'v2' ? 'bg-black text-white text-xs' : 'text-xs'}>
                      {entry.source.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 dark:text-gray-400">{new Date(entry.claimedAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {filteredActivity.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                    {activitySearch ? "No matching claims found" : "No claims recorded yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filteredActivity.length > activityLimit && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Showing {activityLimit} of {filteredActivity.length}</p>
              <Button variant="outline" size="sm" onClick={() => setActivityLimit(prev => prev + 50)}>Load More</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderEmails = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />Compose Email</CardTitle>
          <CardDescription>Send emails to staff, partners, or customers</CardDescription>
        </CardHeader>
        <CardContent><EmailComposer /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Email Templates</CardTitle>
          <CardDescription>Quick templates for common communications</CardDescription>
        </CardHeader>
        <CardContent><EmailTemplates /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Staff Mailboxes</CardTitle>
          <CardDescription>Manage @littr.co email addresses</CardDescription>
        </CardHeader>
        <CardContent><MailboxManager mailboxes={mailboxes} queryClient={queryClient} /></CardContent>
      </Card>
    </div>
  );

  const renderMessages = () => (
    !myMailbox ? (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-gray-500 dark:text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Mailbox Found</h3>
            <p className="text-gray-400">You don't have an @littr.co email address yet.</p>
          </div>
        </CardContent>
      </Card>
    ) : (
      <InboxPortal myMailbox={myMailbox} inboxMessages={inboxMessages} sentMessages={sentMessages} mailboxes={mailboxes} queryClient={queryClient} />
    )
  );

  const renderVolunteers = () => (
    <Card>
      <CardHeader><CardTitle>Volunteer Applications</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Interest</TableHead>
              <TableHead>Availability</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {volunteers.map((v: any) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell>{v.email}</TableCell>
                <TableCell>{v.interest}</TableCell>
                <TableCell>{v.availability}</TableCell>
              </TableRow>
            ))}
            {volunteers.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-gray-400">No volunteers yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="littr-dashboard min-h-screen">
      <div className="littr-nav px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {section && (
            <button onClick={() => setSection(null)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" data-testid="button-nav-back">
              <ArrowLeft className="h-5 w-5 text-gray-500" />
            </button>
          )}
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
            <Recycle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-black dark:text-white">{section ? allNavItems.find(s => s.id === section)?.label || 'Dashboard' : 'LITTR Admin'}</h1>
            <p className="text-xs text-gray-400">{section ? allNavItems.find(s => s.id === section)?.desc : user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleTheme} data-testid="button-theme-toggle" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4 text-yellow-400" /> : <Moon className="h-4 w-4 text-gray-500" />}
          </button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800" data-testid="button-logout">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {!section ? (
          <div className="space-y-6">
            {stats.activeFireAlerts > 0 && (
              <button onClick={() => setSection('bins')} className="w-full text-left" data-testid="button-fire-alert-banner">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 hover:shadow-md transition-shadow">
                  <div className="p-2 rounded-full bg-red-500/10">
                    <Flame className="h-6 w-6 text-red-500 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-red-600">{stats.activeFireAlerts} Active Fire Alert{stats.activeFireAlerts > 1 ? 's' : ''}</p>
                    <p className="text-sm text-red-500">Tap to view details</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-red-400" />
                </div>
              </button>
            )}

            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <p className="text-2xl font-bold text-black dark:text-white" data-testid="stat-today-drops">{stats.todayDrops}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Today</p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <p className="text-2xl font-bold text-black dark:text-white" data-testid="stat-shops">{stats.activeShops}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Shops</p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <p className="text-2xl font-bold text-black dark:text-white" data-testid="stat-bins">{stats.totalBins}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Bins</p>
              </div>
              <div className="text-center p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
                <p className="text-2xl font-bold text-black dark:text-white" data-testid="stat-pending">{stats.pendingRedemptions}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Pending</p>
              </div>
            </div>

            {navGroups.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1">{group.title}</p>
                <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSection(item.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                        data-testid={`nav-section-${item.id}`}
                      >
                        <div className={`p-2 rounded-xl ${item.bg} shrink-0`}>
                          <Icon className={`h-5 w-5 ${item.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.label}</span>
                            {item.badge && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{item.badge}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{item.desc}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.count !== undefined && (
                            <span className="text-sm font-medium text-gray-400 dark:text-gray-500 tabular-nums">{item.count}</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-200">
            {renderSectionContent()}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersManagement() {
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("CUSTOMER");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(5);
  const [shopAssignUserId, setShopAssignUserId] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string>("");

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const filteredUsers = useMemo(() => {
    let filtered = allUsers;
    if (roleFilter !== "ALL") {
      filtered = filtered.filter((u: any) => u.role === roleFilter);
    }
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      filtered = filtered.filter((u: any) =>
        u.email?.toLowerCase().includes(q) || u.id?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [allUsers, roleFilter, userSearch]);

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest(`/api/staff/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Failed to update role');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/staff/users', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Failed to create user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setCreateOpen(false);
      setNewEmail("");
      setNewPassword("");
      setNewRole("CUSTOMER");
    },
  });

  const resetUserPassword = useMutation({
    mutationFn: async () => {
      if (!resetUserId) return;
      const res = await apiRequest(`/api/staff/users/${resetUserId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: resetPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Failed to reset password');
      }
      return res.json();
    },
    onSuccess: () => {
      setResetUserId(null);
      setResetPassword("");
    },
  });

  useEffect(() => {
    if (!deleteUserId) { setDeleteCountdown(5); return; }
    if (deleteCountdown <= 0) return;
    const timer = setTimeout(() => setDeleteCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [deleteUserId, deleteCountdown]);

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest(`/api/staff/users/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Failed to delete user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setDeleteUserId(null);
    },
  });

  const { data: allShops = [] } = useQuery({
    queryKey: ['shops'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/shops');
      if (!res.ok) throw new Error('Failed to fetch shops');
      return res.json();
    },
  });

  const { data: userShops = [], refetch: refetchUserShops } = useQuery({
    queryKey: ['user-shops', shopAssignUserId],
    queryFn: async () => {
      if (!shopAssignUserId) return [];
      const res = await apiRequest(`/api/staff/users/${shopAssignUserId}/shops`);
      if (!res.ok) throw new Error('Failed to fetch user shops');
      return res.json();
    },
    enabled: !!shopAssignUserId,
  });

  const assignShop = useMutation({
    mutationFn: async ({ userId, shopId }: { userId: string; shopId: number }) => {
      const res = await apiRequest(`/api/staff/users/${userId}/shops`, {
        method: 'POST',
        body: JSON.stringify({ shopId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Failed to assign shop');
      }
      return res.json();
    },
    onSuccess: () => {
      refetchUserShops();
      setSelectedShopId("");
    },
  });

  const removeShopAssignment = useMutation({
    mutationFn: async ({ userId, shopId }: { userId: string; shopId: number }) => {
      const res = await apiRequest(`/api/staff/users/${userId}/shops/${shopId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || 'Failed to remove shop');
      }
      return res.json();
    },
    onSuccess: () => {
      refetchUserShops();
    },
  });

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { STAFF: 0, PARTNER: 0, CUSTOMER: 0 };
    allUsers.forEach((u: any) => { counts[u.role] = (counts[u.role] || 0) + 1; });
    return counts;
  }, [allUsers]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-users">{allUsers.length}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-staff-count">{roleCounts.STAFF}</p>
                <p className="text-xs text-muted-foreground">Staff</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-partner-count">{roleCounts.PARTNER}</p>
                <p className="text-xs text-muted-foreground">Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserCog className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-customer-count">{roleCounts.CUSTOMER}</p>
                <p className="text-xs text-muted-foreground">Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>User Accounts</CardTitle>
            <CardDescription>Manage all user accounts, roles, and credentials</CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" data-testid="button-create-user">
                <Plus className="h-4 w-4 mr-1" />
                Create Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    data-testid="input-new-user-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      data-testid="input-new-user-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      data-testid="button-toggle-new-password"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger data-testid="select-new-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CUSTOMER">Customer</SelectItem>
                      <SelectItem value="PARTNER">Partner</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {createUser.error && (
                  <p className="text-sm text-red-500" data-testid="text-create-error">{(createUser.error as Error).message}</p>
                )}
                <Button
                  className="w-full bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => createUser.mutate()}
                  disabled={createUser.isPending || !newEmail || !newPassword}
                  data-testid="button-submit-create-user"
                >
                  {createUser.isPending ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-10"
                data-testid="input-user-search"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-role-filter">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="STAFF">Staff</SelectItem>
                <SelectItem value="PARTNER">Partner</SelectItem>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u: any) => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell className="font-medium">{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(role) => updateRole.mutate({ userId: u.id, role })}
                    >
                      <SelectTrigger className="w-[120px] h-8" data-testid={`select-role-${u.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CUSTOMER">Customer</SelectItem>
                        <SelectItem value="PARTNER">Partner</SelectItem>
                        <SelectItem value="STAFF">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {u.themePreference || 'light'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {u.role === 'PARTNER' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setShopAssignUserId(u.id); setSelectedShopId(""); }}
                          data-testid={`button-assign-shops-${u.id}`}
                        >
                          <Building className="h-4 w-4 mr-1" />
                          Shops
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setResetUserId(u.id); setResetPassword(""); }}
                        data-testid={`button-reset-password-${u.id}`}
                      >
                        <Key className="h-4 w-4 mr-1" />
                        Reset Password
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => setDeleteUserId(u.id)}
                        data-testid={`button-delete-user-${u.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">No users found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!resetUserId} onOpenChange={(open) => { if (!open) setResetUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Set a new password for {allUsers.find((u: any) => u.id === resetUserId)?.email}
            </p>
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showResetPassword ? "text" : "password"}
                  placeholder="Min 6 characters"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  data-testid="input-reset-password"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-reset-password"
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {resetUserPassword.error && (
              <p className="text-sm text-red-500">{(resetUserPassword.error as Error).message}</p>
            )}
            <Button
              className="w-full"
              onClick={() => resetUserPassword.mutate()}
              disabled={resetUserPassword.isPending || resetPassword.length < 6}
              data-testid="button-submit-reset-password"
            >
              {resetUserPassword.isPending ? 'Resetting...' : 'Reset Password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => { if (!open) setDeleteUserId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-semibold">{allUsers.find((u: any) => u.id === deleteUserId)?.email}</span> and all their session data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteUser.error && (
            <p className="text-sm text-red-500" data-testid="text-delete-error">{(deleteUser.error as Error).message}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-user">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
              onClick={(e) => { e.preventDefault(); if (deleteUserId) deleteUser.mutate(deleteUserId); }}
              disabled={deleteCountdown > 0 || deleteUser.isPending}
              data-testid="button-confirm-delete-user"
            >
              {deleteUser.isPending ? 'Removing...' : deleteCountdown > 0 ? `Remove User (${deleteCountdown}s)` : 'Remove User'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!shopAssignUserId} onOpenChange={(open) => { if (!open) setShopAssignUserId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Shop Assignments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Assign shops to <span className="font-semibold">{allUsers.find((u: any) => u.id === shopAssignUserId)?.email}</span>
            </p>

            <div className="space-y-2">
              <Label>Assigned Shops</Label>
              {userShops.length === 0 ? (
                <p className="text-sm text-muted-foreground italic" data-testid="text-no-shops-assigned">No shops assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {userShops.map((ms: any) => (
                    <div key={ms.shopId} className="flex items-center justify-between rounded-md border p-2" data-testid={`row-assigned-shop-${ms.shopId}`}>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">{ms.shopName}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => { if (shopAssignUserId) removeShopAssignment.mutate({ userId: shopAssignUserId, shopId: ms.shopId }); }}
                        disabled={removeShopAssignment.isPending}
                        data-testid={`button-remove-shop-${ms.shopId}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Add Shop</Label>
              <div className="flex gap-2">
                <Select value={selectedShopId} onValueChange={setSelectedShopId}>
                  <SelectTrigger className="flex-1" data-testid="select-assign-shop">
                    <SelectValue placeholder="Select a shop..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allShops
                      .filter((s: any) => !userShops.some((ms: any) => ms.shopId === s.id))
                      .map((s: any) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => { if (shopAssignUserId && selectedShopId) assignShop.mutate({ userId: shopAssignUserId, shopId: parseInt(selectedShopId) }); }}
                  disabled={!selectedShopId || assignShop.isPending}
                  data-testid="button-submit-assign-shop"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Assign
                </Button>
              </div>
              {assignShop.error && (
                <p className="text-sm text-red-500" data-testid="text-assign-error">{(assignShop.error as Error).message}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateShopDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [serviceArea, setServiceArea] = useState('Rochester');
  const queryClient = useQueryClient();

  const createShop = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/staff/shops', {
        method: 'POST',
        body: JSON.stringify({ name, address, city, serviceArea, status: 'PENDING' }),
      });
      if (!res.ok) throw new Error('Failed to create shop');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shops'] });
      setOpen(false);
      setName('');
      setAddress('');
      setCity('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add Shop</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Partner Shop</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Shop Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Elite Smoke Shop" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </div>
          <div>
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Rochester" />
          </div>
          <div>
            <Label>Service Area</Label>
            <Select value={serviceArea} onValueChange={setServiceArea}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Buffalo">Buffalo</SelectItem>
                <SelectItem value="Rochester">Rochester</SelectItem>
                <SelectItem value="Syracuse">Syracuse</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => createShop.mutate()} disabled={createShop.isPending} className="w-full">
            {createShop.isPending ? 'Creating...' : 'Create Shop'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BinDetailDialog({ bin, shops }: { bin: any; shops: any[] }) {
  const [open, setOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const queryClient = useQueryClient();

  const deleteBin = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/staff/bins/${bin.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete bin');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setOpen(false);
      setDeleteConfirmOpen(false);
    },
  });

  const formatValue = (value: any, suffix: string = '') => {
    if (value === null || value === undefined) {
      return <span className="text-orange-600 flex items-center gap-1"><Phone className="h-3 w-3" /> CONTACT SUPPORT</span>;
    }
    return `${value}${suffix}`;
  };

  const formatNullable = (value: any) => {
    if (value === null || value === undefined) return 'N/A';
    return value;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" data-testid={`view-bin-${bin.id}`}>
            <Info className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              {bin.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-500 dark:text-gray-400 text-xs">Bin ID</Label>
                <p className="font-mono">{bin.id}</p>
              </div>
              <div>
                <Label className="text-gray-500 dark:text-gray-400 text-xs">Device ID</Label>
                <p className="font-mono">{formatNullable(bin.deviceId)}</p>
              </div>
              <div>
                <Label className="text-gray-500 dark:text-gray-400 text-xs">Shop</Label>
                <p>{bin.shop?.name || 'Unknown'}</p>
              </div>
              <div>
                <Label className="text-gray-500 dark:text-gray-400 text-xs">Bin Type</Label>
                <p>{formatNullable(bin.binType)}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Sensor Data
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-xs">Status</Label>
                  <div>
                    <Badge 
                      variant={
                        bin.status === 'ONLINE' ? 'default' : 
                        bin.status === 'FIRE_ALERT' ? 'destructive' :
                        bin.status === 'MAINTENANCE' ? 'secondary' : 'outline'
                      }
                    >
                      {bin.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-xs">Fill Level</Label>
                  <p>{formatValue(bin.fillLevel, '%')}</p>
                </div>
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-xs">Temperature (DS18B20)</Label>
                  <p className={bin.lastTemperature >= 60 ? 'text-red-500 font-bold' : ''}>
                    {formatValue(bin.lastTemperature !== null && bin.lastTemperature !== undefined ? bin.lastTemperature?.toFixed(1) : null, '°C')}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-xs">VOC Analog (MQ135)</Label>
                  <p>{formatValue(bin.lastVocAnalog)}</p>
                </div>
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-xs">VOC Digital Alert</Label>
                  <p className={bin.lastVocDigital ? 'text-red-500 font-bold' : ''}>
                    {bin.lastVocDigital === null || bin.lastVocDigital === undefined ? (
                      <span className="text-orange-600 flex items-center gap-1"><Phone className="h-3 w-3" /> CONTACT SUPPORT</span>
                    ) : bin.lastVocDigital ? 'ALERT' : 'Normal'}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-xs">Vape Count</Label>
                  <p>{formatValue(bin.vapeCount)}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="font-medium mb-3">Device Info</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-xs">Device Status</Label>
                  <p>{bin.device?.status || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-xs">Last Seen</Label>
                  <p>{bin.lastSeenAt ? new Date(bin.lastSeenAt).toLocaleString() : formatValue(null)}</p>
                </div>
                <div>
                  <Label className="text-gray-500 dark:text-gray-400 text-xs">Created</Label>
                  <p>{bin.createdAt ? new Date(bin.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between">
              <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" data-testid={`delete-bin-${bin.id}`}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove Bin
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Bin?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove "{bin.name}" and all its sensor history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteBin.mutate()}
                      className="bg-red-600 hover:bg-red-700"
                      data-testid={`confirm-delete-bin-${bin.id}`}
                    >
                      {deleteBin.isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssignPairRequestDialog({ pairRequest, shops }: { pairRequest: any; shops: any[] }) {
  const [open, setOpen] = useState(false);
  const [shopId, setShopId] = useState('');
  const [name, setName] = useState(`Bin ${pairRequest.uid?.slice(-4)?.toUpperCase() ?? ''}`);
  const [mode, setMode] = useState<'demo' | 'normal'>('demo');
  const [cameraModel, setCameraModel] = useState<'none' | 's3cam' | 'android_cam'>('none');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const assign = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/v2/staff/pair-requests/${pairRequest.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ shopId: parseInt(shopId), name, mode, cameraModel }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Assign failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pair-requests'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['pending-setup-bins'] });
      setOpen(false);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const verifiedShops = shops.filter((s: any) => s.status === 'VERIFIED');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" data-testid={`button-assign-pair-${pairRequest.id}`}>
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Pair Request to Smart Bin</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-xs">
            <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Pair Code</span><span className="font-mono font-bold">{pairRequest.pairCode}</span></div>
            <div className="flex justify-between mt-1"><span className="text-gray-600 dark:text-gray-400">Device UID</span><span className="font-mono">{pairRequest.uid}</span></div>
            <div className="flex justify-between mt-1"><span className="text-gray-600 dark:text-gray-400">Firmware</span><span>{pairRequest.firmwareVersion || 'Unknown'}</span></div>
          </div>

          <div>
            <Label>Assign to Shop</Label>
            <Select value={shopId} onValueChange={setShopId}>
              <SelectTrigger data-testid="select-assign-shop"><SelectValue placeholder="Select a verified shop" /></SelectTrigger>
              <SelectContent>
                {verifiedShops.map((shop: any) => (
                  <SelectItem key={shop.id} value={shop.id.toString()}>{shop.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {verifiedShops.length === 0 && <p className="text-xs text-amber-600 mt-1">No verified shops available.</p>}
          </div>

          <div>
            <Label>Bin Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front Counter Bin" data-testid="input-assign-name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as 'demo' | 'normal')}>
                <SelectTrigger data-testid="select-assign-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo (random 1–10)</SelectItem>
                  <SelectItem value="normal">Normal (reward config)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Camera Module</Label>
              <Select value={cameraModel} onValueChange={(v) => setCameraModel(v as 'none' | 's3cam' | 'android_cam')}>
                <SelectTrigger data-testid="select-assign-camera"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="s3cam">ESP32-S3-CAM</SelectItem>
                  <SelectItem value="android_cam">Android Cam</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            The bin will be created in <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 rounded">OFFLINE</code> and lift to <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1 rounded">ONLINE</code> on first telemetry.
          </p>

          {error && <p className="text-xs text-red-600" data-testid="text-assign-error">{error}</p>}

          <Button
            onClick={() => assign.mutate()}
            disabled={assign.isPending || !shopId || !name}
            className="w-full"
            data-testid="button-assign-submit"
          >
            {assign.isPending ? 'Assigning…' : 'Assign & Activate'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateDeviceDialog({ shops }: { shops: any[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [shopId, setShopId] = useState('');
  const [deviceCredentials, setDeviceCredentials] = useState<{ deviceId: number; deviceKey: string } | null>(null);
  const queryClient = useQueryClient();

  const createDevice = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/staff/devices', {
        method: 'POST',
        body: JSON.stringify({ name, shopId: parseInt(shopId) }),
      });
      if (!res.ok) throw new Error('Failed to create device');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });
      setDeviceCredentials({ deviceId: data.deviceId, deviceKey: data.deviceKey });
      setName('');
      setShopId('');
    },
  });

  const verifiedShops = shops.filter((s: any) => s.status === 'VERIFIED');

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDeviceCredentials(null); }}>
      <DialogTrigger asChild>
        <Button size="sm">Add Device</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add ESP32 Device</DialogTitle>
        </DialogHeader>
        {deviceCredentials ? (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Save these credentials now!</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">They will not be shown again. Both values are required for the API.</p>
              
              <div className="mb-3">
                <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">Device ID (X-Device-Id):</p>
                <code className="block p-2 bg-black text-green-600 rounded text-sm font-mono">
                  {deviceCredentials.deviceId}
                </code>
              </div>
              
              <div>
                <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">Device Key (X-Device-Key):</p>
                <code className="block p-2 bg-black text-green-600 rounded text-xs break-all font-mono">
                  {deviceCredentials.deviceKey}
                </code>
              </div>
            </div>
            <Button onClick={() => { setOpen(false); setDeviceCredentials(null); }} className="w-full">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Device Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bin #1" />
            </div>
            <div>
              <Label>Shop</Label>
              <Select value={shopId} onValueChange={setShopId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a verified shop" />
                </SelectTrigger>
                <SelectContent>
                  {verifiedShops.map((shop: any) => (
                    <SelectItem key={shop.id} value={shop.id.toString()}>{shop.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {verifiedShops.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No verified shops. Verify a shop first.</p>
              )}
            </div>
            <Button 
              onClick={() => createDevice.mutate()} 
              disabled={createDevice.isPending || !name || !shopId} 
              className="w-full"
            >
              {createDevice.isPending ? 'Creating...' : 'Create Device'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShopActionsMenu({ shop }: { shop: any }) {
  const queryClient = useQueryClient();
  
  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest(`/api/staff/shops/${shop.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shops'] });
    },
  });

  if (shop.status === 'PENDING') {
    return (
      <Button size="sm" variant="outline" onClick={() => updateStatus.mutate('VERIFIED')}>
        Verify
      </Button>
    );
  }
  
  if (shop.status === 'VERIFIED') {
    return (
      <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate('SUSPENDED')}>
        Suspend
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate('VERIFIED')}>
      Reactivate
    </Button>
  );
}

function EmailComposer() {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const sendEmail = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/admin/send-email', {
        method: 'POST',
        body: JSON.stringify({
          to,
          subject,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6;">
            ${message.split('\n').map(p => `<p style="margin: 0 0 16px 0; color: #333;">${p}</p>`).join('')}
            <p style="margin: 32px 0 0 0; color: #000; font-weight: 500;">— The LITTR Team</p>
          </div>`,
        }),
      });
      if (!res.ok) throw new Error('Failed to send email');
      return res.json();
    },
    onSuccess: () => {
      setStatus('sent');
      setTo('');
      setSubject('');
      setMessage('');
      setTimeout(() => setStatus('idle'), 3000);
    },
    onError: () => {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    },
  });

  const handleSend = () => {
    if (!to || !subject || !message) return;
    setStatus('sending');
    sendEmail.mutate();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="email-to">To</Label>
        <Input 
          id="email-to"
          type="email" 
          placeholder="recipient@example.com" 
          value={to}
          onChange={(e) => setTo(e.target.value)}
          data-testid="email-to"
        />
      </div>
      <div>
        <Label htmlFor="email-subject">Subject</Label>
        <Input 
          id="email-subject"
          placeholder="Email subject..." 
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          data-testid="email-subject"
        />
      </div>
      <div>
        <Label htmlFor="email-message">Message</Label>
        <Textarea 
          id="email-message"
          placeholder="Write your message here..." 
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="resize-none"
          data-testid="email-message"
        />
      </div>
      <Button 
        onClick={handleSend} 
        disabled={!to || !subject || !message || status === 'sending'}
        className="w-full"
        data-testid="send-email-btn"
      >
        {status === 'sending' ? (
          <>Sending...</>
        ) : status === 'sent' ? (
          <><CheckCircle className="h-4 w-4 mr-2" /> Sent!</>
        ) : status === 'error' ? (
          <>Failed to send</>
        ) : (
          <><Send className="h-4 w-4 mr-2" /> Send Email</>
        )}
      </Button>
    </div>
  );
}

function EmailTemplates() {
  const templates = [
    {
      name: 'Welcome Partner',
      subject: 'Welcome to the LITTR Partner Program!',
      body: `Hi there,

Welcome to the LITTR.co partner program! We're excited to have you on board.

Your bin is now set up and ready to accept vape recycling. Customers can scan the QR code to earn points instantly.

If you have any questions, don't hesitate to reach out.`,
    },
    {
      name: 'Bin Pickup Scheduled',
      subject: 'Your LITTR Bin Pickup is Scheduled',
      body: `Hi there,

This is a confirmation that your bin pickup has been scheduled.

Our team will arrive during business hours to collect and replace your recycling bin. No action is needed on your end.

Thank you for being part of the solution!`,
    },
    {
      name: 'Points Reminder',
      subject: 'Don\'t forget your LITTR points!',
      body: `Hi there,

Just a friendly reminder that you have points waiting in your LITTR wallet!

Visit littr.co/app to check your balance and redeem rewards. Your points never expire, so take your time browsing our reward store.

Keep recycling and earning!`,
    },
    {
      name: 'Fire Alert Follow-up',
      subject: 'LITTR Safety Alert - Follow Up',
      body: `Hi there,

Our monitoring system detected a safety alert from your LITTR bin earlier. Our team has reviewed the situation.

Please ensure the bin area is clear of any obstructions and that vapes are being disposed of properly.

If you have any concerns, please contact us immediately.`,
    },
  ];

  const [selectedTemplate, setSelectedTemplate] = useState<typeof templates[0] | null>(null);

  const copyToClipboard = (template: typeof templates[0]) => {
    navigator.clipboard.writeText(`Subject: ${template.subject}\n\n${template.body}`);
    setSelectedTemplate(template);
    setTimeout(() => setSelectedTemplate(null), 2000);
  };

  return (
    <div className="space-y-3">
      {templates.map((template, i) => (
        <div 
          key={i}
          className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-500 dark:hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => copyToClipboard(template)}
          data-testid={`template-${i}`}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">{template.name}</h4>
            {selectedTemplate === template ? (
              <Badge variant="outline" className="text-green-600 border-green-400">
                <CheckCircle className="h-3 w-3 mr-1" /> Copied!
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500 dark:text-gray-400">Click to copy</Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{template.subject}</p>
        </div>
      ))}
    </div>
  );
}

function DropReviewTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDrop, setSelectedDrop] = useState<any>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideCategory, setOverrideCategory] = useState("");
  const [overrideBrand, setOverrideBrand] = useState("");
  const [overrideSubtype, setOverrideSubtype] = useState("");
  const [overrideFlavor, setOverrideFlavor] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("");

  const { data: dropsResponse, isLoading } = useQuery({
    queryKey: ['staff-drops'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/drops');
      if (!res.ok) throw new Error('Failed to fetch drops');
      return res.json();
    },
  });

  const drops = dropsResponse?.data || dropsResponse || [];

  const { data: dropImagesData } = useQuery({
    queryKey: ['drop-images', selectedDrop?.id],
    queryFn: async () => {
      if (!selectedDrop) return [];
      const res = await apiRequest(`/api/drops/${selectedDrop.id}`);
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!selectedDrop,
  });

  const filteredDrops = useMemo(() => {
    if (statusFilter === "all") return drops;
    return drops.filter((d: any) => d.status === statusFilter);
  }, [drops, statusFilter]);

  const overrideMutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (overrideCategory) body.category = overrideCategory;
      if (overrideBrand) body.brand = overrideBrand;
      if (overrideSubtype) body.subtype = overrideSubtype;
      if (overrideFlavor) body.flavor = overrideFlavor;
      if (overrideStatus) body.status = overrideStatus;
      const res = await apiRequest(`/api/staff/drops/${selectedDrop.id}/override`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to override');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-drops'] });
      setOverrideOpen(false);
      setSelectedDrop(null);
    },
  });

  const rerunAiMutation = useMutation({
    mutationFn: async (dropId: number) => {
      const res = await apiRequest(`/api/staff/drops/${dropId}/rerun-ai`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to rerun AI');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-drops'] });
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500';
      case 'denied': return 'bg-red-500';
      case 'awaiting_ai': return 'bg-yellow-500 text-black';
      case 'appealed': return 'bg-orange-500';
      case 'corrected': return 'bg-blue-500';
      default: return '';
    }
  };

  const openOverride = (drop: any) => {
    setSelectedDrop(drop);
    setOverrideCategory(drop.category || "");
    setOverrideBrand(drop.brand || "");
    setOverrideSubtype(drop.subtype || "");
    setOverrideFlavor(drop.flavor || "");
    setOverrideStatus(drop.status || "");
    setOverrideOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Drop Review
            </CardTitle>
            <CardDescription>Review AI-classified drops, override classifications, and manage appeals</CardDescription>
            <a
              href="/admin/review"
              className="inline-block mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              data-testid="link-classifier-review"
            >
              → Open Classifier Review Queue (Task #5)
            </a>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-drop-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="awaiting_ai">Awaiting AI</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="denied">Denied</SelectItem>
              <SelectItem value="appealed">Appealed</SelectItem>
              <SelectItem value="corrected">Corrected</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading drops...</div>
          ) : (
            <Table data-testid="table-drop-review">
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Subtype</TableHead>
                  <TableHead>Flavor</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Points</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrops.map((drop: any) => (
                  <TableRow key={drop.id} data-testid={`row-drop-${drop.id}`}>
                    <TableCell className="font-mono text-xs">{drop.id}</TableCell>
                    <TableCell>
                      <Badge className={statusColor(drop.status)} data-testid={`badge-drop-status-${drop.id}`}>
                        {drop.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{drop.category || '—'}</TableCell>
                    <TableCell>{drop.brand || '—'}</TableCell>
                    <TableCell>{drop.subtype || '—'}</TableCell>
                    <TableCell>{drop.flavor || '—'}</TableCell>
                    <TableCell>
                      {drop.aiConfidence !== null && drop.aiConfidence !== undefined
                        ? `${(drop.aiConfidence * 100).toFixed(0)}%`
                        : '—'}
                    </TableCell>
                    <TableCell>{drop.pointsAwarded}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(drop.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDrop(drop)}
                          data-testid={`button-view-drop-${drop.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openOverride(drop)}
                          data-testid={`button-override-drop-${drop.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => rerunAiMutation.mutate(drop.id)}
                          disabled={rerunAiMutation.isPending}
                          data-testid={`button-rerun-ai-${drop.id}`}
                        >
                          <RefreshCw className={`h-4 w-4 ${rerunAiMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredDrops.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                      {statusFilter !== "all" ? "No drops with this status" : "No drops recorded yet"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDrop && !overrideOpen} onOpenChange={(open) => { if (!open) setSelectedDrop(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Drop #{selectedDrop?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedDrop && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div><Badge className={statusColor(selectedDrop.status)}>{selectedDrop.status}</Badge></div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <p className="font-medium">{selectedDrop.category || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Brand</Label>
                  <p className="font-medium">{selectedDrop.brand || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Subtype</Label>
                  <p className="font-medium">{selectedDrop.subtype || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Flavor</Label>
                  <p className="font-medium">{selectedDrop.flavor || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">AI Confidence</Label>
                  <p className="font-medium">
                    {selectedDrop.aiConfidence !== null && selectedDrop.aiConfidence !== undefined
                      ? `${(selectedDrop.aiConfidence * 100).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Weight</Label>
                  <p className="font-medium">{selectedDrop.weightGrams ? `${selectedDrop.weightGrams}g` : 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Points</Label>
                  <p className="font-medium">{selectedDrop.pointsAwarded}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Override By</Label>
                  <p className="font-medium text-sm">{selectedDrop.overrideSource || 'None'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">AI Model</Label>
                  <p className="font-medium text-sm">{selectedDrop.aiModelVersion || 'N/A'}</p>
                </div>
              </div>
              {(() => { const imgs = dropImagesData?.data?.images || dropImagesData?.images || []; return imgs.length > 0 ? (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Images</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {imgs.map((img: any) => (
                      <div key={img.id} className="relative rounded-lg overflow-hidden border">
                        <img src={img.storageUrl} alt={img.imageRole} className="w-full h-32 object-cover" />
                        <Badge className="absolute bottom-1 left-1 text-xs" variant="secondary">{img.imageRole}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null})()}
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => openOverride(selectedDrop)} data-testid="button-override-from-detail">
                  <Edit className="h-4 w-4 mr-1" />
                  Override
                </Button>
                <Button size="sm" variant="outline" onClick={() => rerunAiMutation.mutate(selectedDrop.id)} disabled={rerunAiMutation.isPending} data-testid="button-rerun-from-detail">
                  <RefreshCw className={`h-4 w-4 mr-1 ${rerunAiMutation.isPending ? 'animate-spin' : ''}`} />
                  Re-run AI
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={overrideOpen} onOpenChange={(open) => { if (!open) { setOverrideOpen(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Drop #{selectedDrop?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                <SelectTrigger data-testid="select-override-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awaiting_ai">Awaiting AI</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="appealed">Appealed</SelectItem>
                  <SelectItem value="corrected">Corrected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={overrideCategory} onValueChange={setOverrideCategory}>
                <SelectTrigger data-testid="select-override-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nicotine">Nicotine</SelectItem>
                  <SelectItem value="THC">THC</SelectItem>
                  <SelectItem value="Trash">Trash</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Brand</Label>
              <Input
                value={overrideBrand}
                onChange={(e) => setOverrideBrand(e.target.value)}
                placeholder="Brand name"
                data-testid="input-override-brand"
              />
            </div>
            <div className="space-y-2">
              <Label>Subtype</Label>
              <Input
                value={overrideSubtype}
                onChange={(e) => setOverrideSubtype(e.target.value)}
                placeholder="Subtype"
                data-testid="input-override-subtype"
              />
            </div>
            <div className="space-y-2">
              <Label>Flavor</Label>
              <Input
                value={overrideFlavor}
                onChange={(e) => setOverrideFlavor(e.target.value)}
                placeholder="Flavor"
                data-testid="input-override-flavor"
              />
            </div>
            {overrideMutation.error && (
              <p className="text-sm text-red-500" data-testid="text-override-error">{(overrideMutation.error as Error).message}</p>
            )}
            <Button
              className="w-full"
              onClick={() => overrideMutation.mutate()}
              disabled={overrideMutation.isPending}
              data-testid="button-submit-override"
            >
              {overrideMutation.isPending ? 'Saving...' : 'Save Override'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaxonomyTab() {
  const queryClient = useQueryClient();
  const [newBrandName, setNewBrandName] = useState("");
  const [newSubtypeName, setNewSubtypeName] = useState("");
  const [newSubtypeBrandId, setNewSubtypeBrandId] = useState("");
  const [newFlavorName, setNewFlavorName] = useState("");
  const [editingBrand, setEditingBrand] = useState<{ id: number; name: string } | null>(null);

  const { data: brandsResponse } = useQuery({
    queryKey: ['taxonomy-brands'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/brands');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });
  const brandsList = brandsResponse?.data || brandsResponse || [];

  const { data: subtypesResponse } = useQuery({
    queryKey: ['taxonomy-subtypes'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/subtypes');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });
  const subtypesList = subtypesResponse?.data || subtypesResponse || [];

  const { data: flavorsResponse } = useQuery({
    queryKey: ['taxonomy-flavors'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/flavors');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });
  const flavorsList = flavorsResponse?.data || flavorsResponse || [];

  const createBrand = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/staff/brands', {
        method: 'POST',
        body: JSON.stringify({ name: newBrandName, suggested: false }),
      });
      if (!res.ok) throw new Error('Failed to create brand');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-brands'] });
      setNewBrandName("");
    },
  });

  const updateBrand = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest(`/api/staff/brands/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to update brand');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-brands'] });
      setEditingBrand(null);
    },
  });

  const deleteBrand = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/staff/brands/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete brand');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-brands'] });
      queryClient.invalidateQueries({ queryKey: ['taxonomy-subtypes'] });
    },
  });

  const createSubtype = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/staff/subtypes', {
        method: 'POST',
        body: JSON.stringify({ brandId: parseInt(newSubtypeBrandId), name: newSubtypeName, suggested: false }),
      });
      if (!res.ok) throw new Error('Failed to create subtype');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-subtypes'] });
      setNewSubtypeName("");
    },
  });

  const deleteSubtype = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/staff/subtypes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete subtype');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-subtypes'] });
    },
  });

  const createFlavor = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/staff/flavors', {
        method: 'POST',
        body: JSON.stringify({ name: newFlavorName, suggested: false }),
      });
      if (!res.ok) throw new Error('Failed to create flavor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-flavors'] });
      setNewFlavorName("");
    },
  });

  const deleteFlavor = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/staff/flavors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete flavor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy-flavors'] });
    },
  });

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4" />
            Brands
          </CardTitle>
          <CardDescription>{brandsList.length} brands</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="New brand name"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              data-testid="input-new-brand"
            />
            <Button
              size="sm"
              onClick={() => createBrand.mutate()}
              disabled={!newBrandName.trim() || createBrand.isPending}
              data-testid="button-add-brand"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {brandsList.map((brand: any) => (
              <div key={brand.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted" data-testid={`row-brand-${brand.id}`}>
                {editingBrand?.id === brand.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={editingBrand!.name}
                      onChange={(e) => setEditingBrand({ id: brand.id, name: e.target.value })}
                      className="h-7 text-sm"
                      data-testid={`input-edit-brand-${brand.id}`}
                    />
                    <Button size="sm" variant="ghost" onClick={() => updateBrand.mutate({ id: brand.id, name: editingBrand!.name })} data-testid={`button-save-brand-${brand.id}`}>
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingBrand(null)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{brand.name}</span>
                      {brand.suggested && <Badge variant="outline" className="text-xs h-5">suggested</Badge>}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingBrand({ id: brand.id, name: brand.name })} data-testid={`button-edit-brand-${brand.id}`}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => deleteBrand.mutate(brand.id)} data-testid={`button-delete-brand-${brand.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {brandsList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No brands yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4" />
            Subtypes
          </CardTitle>
          <CardDescription>{subtypesList.length} subtypes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 mb-4">
            <Select value={newSubtypeBrandId} onValueChange={setNewSubtypeBrandId}>
              <SelectTrigger data-testid="select-subtype-brand">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {brandsList.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                placeholder="New subtype name"
                value={newSubtypeName}
                onChange={(e) => setNewSubtypeName(e.target.value)}
                data-testid="input-new-subtype"
              />
              <Button
                size="sm"
                onClick={() => createSubtype.mutate()}
                disabled={!newSubtypeName.trim() || !newSubtypeBrandId || createSubtype.isPending}
                data-testid="button-add-subtype"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {subtypesList.map((sub: any) => {
              const parentBrand = brandsList.find((b: any) => b.id === sub.brandId);
              return (
                <div key={sub.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted" data-testid={`row-subtype-${sub.id}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{sub.name}</span>
                    <span className="text-xs text-muted-foreground">({parentBrand?.name || '?'})</span>
                    {sub.suggested && <Badge variant="outline" className="text-xs h-5">suggested</Badge>}
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => deleteSubtype.mutate(sub.id)} data-testid={`button-delete-subtype-${sub.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            {subtypesList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No subtypes yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="h-4 w-4" />
            Flavors
          </CardTitle>
          <CardDescription>{flavorsList.length} flavors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="New flavor name"
              value={newFlavorName}
              onChange={(e) => setNewFlavorName(e.target.value)}
              data-testid="input-new-flavor"
            />
            <Button
              size="sm"
              onClick={() => createFlavor.mutate()}
              disabled={!newFlavorName.trim() || createFlavor.isPending}
              data-testid="button-add-flavor"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {flavorsList.map((flavor: any) => (
              <div key={flavor.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted" data-testid={`row-flavor-${flavor.id}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{flavor.name}</span>
                  {flavor.suggested && <Badge variant="outline" className="text-xs h-5">suggested</Badge>}
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={() => deleteFlavor.mutate(flavor.id)} data-testid={`button-delete-flavor-${flavor.id}`}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {flavorsList.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No flavors yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ModulesTab({ bins, shops }: { bins: any[]; shops: any[] }) {
  const queryClient = useQueryClient();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedBinId, setSelectedBinId] = useState("");
  const [moduleType, setModuleType] = useState("s3cam");
  const [newModuleToken, setNewModuleToken] = useState<string | null>(null);

  const { data: modulesResponse, isLoading } = useQuery({
    queryKey: ['staff-modules'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/modules');
      if (!res.ok) throw new Error('Failed to fetch modules');
      return res.json();
    },
  });
  const modules = modulesResponse?.data || [];

  const registerModule = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/staff/modules/register', {
        method: 'POST',
        body: JSON.stringify({ binId: parseInt(selectedBinId), moduleType }),
      });
      if (!res.ok) throw new Error('Failed to register module');
      return res.json();
    },
    onSuccess: (data) => {
      setNewModuleToken(data.data?.moduleToken || null);
      queryClient.invalidateQueries({ queryKey: ['staff-modules'] });
    },
  });

  const deregisterModule = useMutation({
    mutationFn: async (binId: number) => {
      const res = await apiRequest(`/api/staff/modules/${binId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to deregister');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-modules'] });
    },
  });

  const activeModules = modules.filter((m: any) => m.cameraMode !== 'none' && m.moduleToken);
  const binsWithoutModules = bins.filter(b => !modules.some((m: any) => m.binId === b.id && m.cameraMode !== 'none'));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Camera className="h-4 w-4 text-violet-500" />
          </div>
          <p className="text-2xl font-bold text-black dark:text-white" data-testid="stat-active-modules">{activeModules.length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Active Modules</p>
        </div>
        <div className="text-center p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Cpu className="h-4 w-4 text-teal-500" />
          </div>
          <p className="text-2xl font-bold text-black dark:text-white">{modules.filter((m: any) => m.cameraMode === 's3cam').length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">ESP32-S3-CAM</p>
        </div>
        <div className="text-center p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Phone className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-black dark:text-white">{modules.filter((m: any) => m.cameraMode === 'android_cam').length}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Android Cam</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Modules
            </CardTitle>
            <CardDescription>Pair camera modules with bins to enable AI drop classification</CardDescription>
          </div>
          <Dialog open={registerOpen} onOpenChange={(o) => { setRegisterOpen(o); if (!o) { setNewModuleToken(null); setSelectedBinId(""); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-violet-500 hover:bg-violet-600 text-white" data-testid="button-register-module">
                <Plus className="h-4 w-4 mr-1" />
                Register Module
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Register Camera Module
                </DialogTitle>
              </DialogHeader>
              {newModuleToken ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl">
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Save this token now!</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">This is the only time the full token will be shown. Flash it to the module or copy it.</p>
                    <div>
                      <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">Module Token (X-Module-Token):</p>
                      <code className="block p-3 bg-black text-green-400 rounded-lg text-xs break-all font-mono" data-testid="text-new-module-token">
                        {newModuleToken}
                      </code>
                    </div>
                  </div>
                  <div className="p-3 bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 rounded-xl">
                    <p className="text-sm font-medium text-violet-800 dark:text-violet-200 mb-1">What's next?</p>
                    <ol className="text-xs text-violet-700 dark:text-violet-300 space-y-1 list-decimal list-inside">
                      <li>Flash this token to the camera module</li>
                      <li>Module will authenticate using X-Module-Token header</li>
                      <li>Drops from this bin will now trigger AI classification</li>
                    </ol>
                  </div>
                  <Button onClick={() => { setRegisterOpen(false); setNewModuleToken(null); }} className="w-full" data-testid="button-done-register">Done</Button>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Select Bin</Label>
                    <Select value={selectedBinId} onValueChange={setSelectedBinId}>
                      <SelectTrigger data-testid="select-module-bin">
                        <SelectValue placeholder="Choose a bin to pair..." />
                      </SelectTrigger>
                      <SelectContent>
                        {binsWithoutModules.map((bin: any) => (
                          <SelectItem key={bin.id} value={String(bin.id)}>
                            {bin.name} (ID: {bin.id}) — {bin.shop?.name || 'Unassigned'}
                          </SelectItem>
                        ))}
                        {binsWithoutModules.length === 0 && (
                          <SelectItem value="_none" disabled>All bins already have modules</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Module Type</Label>
                    <Select value={moduleType} onValueChange={setModuleType}>
                      <SelectTrigger data-testid="select-module-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="s3cam">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4" />
                            ESP32-S3-CAM
                          </div>
                        </SelectItem>
                        <SelectItem value="android_cam">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            Android Camera (Pixel 3a)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    <p className="font-medium text-gray-600 dark:text-gray-300">This will:</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Generate a unique module token for authentication</li>
                      <li>Enable camera mode on the bin</li>
                      <li>Allow AI classification for drops at this bin</li>
                    </ul>
                  </div>
                  {registerModule.error && (
                    <p className="text-sm text-red-500" data-testid="text-register-error">{(registerModule.error as Error).message}</p>
                  )}
                  <Button
                    className="w-full bg-violet-500 hover:bg-violet-600 text-white"
                    onClick={() => registerModule.mutate()}
                    disabled={registerModule.isPending || !selectedBinId}
                    data-testid="button-submit-register"
                  >
                    {registerModule.isPending ? 'Registering...' : 'Register & Generate Token'}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading modules...</div>
          ) : activeModules.length > 0 ? (
            <div className="space-y-3">
              {activeModules.map((mod: any) => (
                <div
                  key={mod.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  data-testid={`module-row-${mod.binId}`}
                >
                  <div className={`p-2.5 rounded-xl ${mod.cameraMode === 's3cam' ? 'bg-teal-50 dark:bg-teal-950' : 'bg-blue-50 dark:bg-blue-950'}`}>
                    {mod.cameraMode === 's3cam' ? (
                      <Cpu className="h-5 w-5 text-teal-500" />
                    ) : (
                      <Phone className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
                        {mod.bin?.name || `Bin #${mod.binId}`}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {mod.cameraMode === 's3cam' ? 'ESP32-S3-CAM' : 'Android'}
                      </Badge>
                      {mod.moduleToken && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                          <Wifi className="h-3 w-3 mr-1" />
                          Paired
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span>Token: <code className="font-mono">{mod.moduleToken || 'N/A'}</code></span>
                      <span>Upload: {mod.uploadPolicy}</span>
                      {mod.hasWeight && <span className="text-green-500">Weight sensor</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950" data-testid={`button-deregister-${mod.binId}`}>
                          <WifiOff className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deregister Module?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will disconnect the camera module from {mod.bin?.name || `Bin #${mod.binId}`}. AI classification will be disabled for drops at this bin. The physical module will need to be re-registered.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600 text-white"
                            onClick={() => deregisterModule.mutate(mod.binId)}
                          >
                            Deregister
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="p-4 rounded-full bg-violet-50 dark:bg-violet-950 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Camera className="h-8 w-8 text-violet-400" />
              </div>
              <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">No camera modules registered</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
                Register an ESP32-S3-CAM or Android camera module to a bin to enable AI-powered drop classification and reward authentication.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

function BinCapabilitiesTab({ bins }: { bins: any[] }) {
  const queryClient = useQueryClient();
  const [selectedBinId, setSelectedBinId] = useState<string>("");
  const [hasWeight, setHasWeight] = useState(false);
  const [cameraMode, setCameraMode] = useState("none");
  const [uploadPolicy, setUploadPolicy] = useState("drop_only");
  const [debugMode, setDebugMode] = useState(false);
  const [cadenceJson, setCadenceJson] = useState('{"idleIntervalSec":60,"burstIntervalSec":1,"burstDurationSec":15,"cooldownIntervalSec":5,"cooldownDurationSec":60}');
  const [loadedBinId, setLoadedBinId] = useState<number | null>(null);

  const { data: capData, refetch: refetchCap } = useQuery({
    queryKey: ['bin-capabilities', selectedBinId],
    queryFn: async () => {
      if (!selectedBinId) return null;
      const res = await apiRequest(`/api/bins/${selectedBinId}/capabilities`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: false,
  });

  const loadCapabilities = async () => {
    if (!selectedBinId) return;
    try {
      const res = await apiRequest(`/api/bins/${selectedBinId}/capabilities`);
      if (res.ok) {
        const cap = await res.json();
        setHasWeight(cap.hasWeight || false);
        setCameraMode(cap.cameraMode || "none");
        setUploadPolicy(cap.uploadPolicy || "drop_only");
        setDebugMode(cap.debugMode || false);
        setCadenceJson(cap.cameraCadenceJson ? JSON.stringify(cap.cameraCadenceJson, null, 2) : '{"idleIntervalSec":60,"burstIntervalSec":1,"burstDurationSec":15,"cooldownIntervalSec":5,"cooldownDurationSec":60}');
        setLoadedBinId(parseInt(selectedBinId));
      } else {
        setHasWeight(false);
        setCameraMode("none");
        setUploadPolicy("drop_only");
        setDebugMode(false);
        setCadenceJson('{"idleIntervalSec":60,"burstIntervalSec":1,"burstDurationSec":15,"cooldownIntervalSec":5,"cooldownDurationSec":60}');
        setLoadedBinId(parseInt(selectedBinId));
      }
    } catch {
      setLoadedBinId(parseInt(selectedBinId));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsedCadence;
      try {
        parsedCadence = JSON.parse(cadenceJson);
      } catch {
        throw new Error('Invalid cadence JSON');
      }
      const res = await apiRequest(`/api/bins/${selectedBinId}/capabilities`, {
        method: 'PATCH',
        body: JSON.stringify({
          binId: parseInt(selectedBinId),
          hasWeight,
          cameraMode,
          uploadPolicy,
          debugMode,
          cameraCadenceJson: parsedCadence,
        }),
      });
      if (!res.ok) throw new Error('Failed to update capabilities');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bin-capabilities'] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Bin Capabilities
        </CardTitle>
        <CardDescription>Configure camera mode, weight sensor, and capture cadence for each bin</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Select Bin</Label>
              <Select value={selectedBinId} onValueChange={setSelectedBinId}>
                <SelectTrigger data-testid="select-bin-for-caps">
                  <SelectValue placeholder="Choose a bin..." />
                </SelectTrigger>
                <SelectContent>
                  {bins.map((bin: any) => (
                    <SelectItem key={bin.id} value={String(bin.id)}>
                      {bin.name} (ID: {bin.id}) — {bin.shop?.name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={loadCapabilities} disabled={!selectedBinId} data-testid="button-load-caps">
              Load
            </Button>
          </div>

          {loadedBinId && (
            <div className="space-y-4 border rounded-lg p-4">
              <h3 className="font-medium">Configuration for Bin #{loadedBinId}</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Has Weight Sensor</Label>
                  <Select value={hasWeight ? "true" : "false"} onValueChange={(v) => setHasWeight(v === "true")}>
                    <SelectTrigger data-testid="select-has-weight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Camera Mode</Label>
                  <Select value={cameraMode} onValueChange={setCameraMode}>
                    <SelectTrigger data-testid="select-camera-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="s3cam">ESP32-S3-CAM</SelectItem>
                      <SelectItem value="android_cam">Android Camera</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Upload Policy</Label>
                  <Select value={uploadPolicy} onValueChange={setUploadPolicy}>
                    <SelectTrigger data-testid="select-upload-policy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drop_only">Drop Only</SelectItem>
                      <SelectItem value="drop_plus_baseline">Drop + Baseline</SelectItem>
                      <SelectItem value="debug_all">Debug All</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Debug Mode</Label>
                  <Select value={debugMode ? "true" : "false"} onValueChange={(v) => setDebugMode(v === "true")}>
                    <SelectTrigger data-testid="select-debug-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">Off</SelectItem>
                      <SelectItem value="true">On</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Camera Cadence (JSON)</Label>
                <Textarea
                  value={cadenceJson}
                  onChange={(e) => setCadenceJson(e.target.value)}
                  className="font-mono text-sm h-32"
                  data-testid="textarea-cadence-json"
                />
                <p className="text-xs text-muted-foreground">Fields: idleIntervalSec, burstIntervalSec, burstDurationSec, cooldownIntervalSec, cooldownDurationSec</p>
              </div>

              {saveMutation.error && (
                <p className="text-sm text-red-500" data-testid="text-caps-error">{(saveMutation.error as Error).message}</p>
              )}
              {saveMutation.isSuccess && (
                <p className="text-sm text-green-600" data-testid="text-caps-success">Capabilities saved successfully!</p>
              )}

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full"
                data-testid="button-save-caps"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save Capabilities'}
              </Button>
            </div>
          )}

          {bins.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No bins found. Create a device first to generate bins.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type BinMode = 'demo' | 'normal';
type CameraModel = 'none' | 's3cam' | 'android_cam';

interface PendingSetupBin {
  id: number;
  name?: string | null;
  uid?: string | null;
  shopId?: number | null;
  mode?: BinMode | null;
  cameraModel?: CameraModel | null;
  status?: string | null;
  createdAt?: string | null;
  shop?: { id: number; name: string; address?: string | null } | null;
  device?: { id: number; name?: string | null; uid?: string | null; lastSeenAt?: string | null } | null;
}

interface SetupForm {
  name: string;
  mode: BinMode;
  cameraModel: CameraModel;
}

interface SetupPayload extends SetupForm {}

function PendingSetupTab() {
  const queryClient = useQueryClient();
  const { data: bins = [], isLoading } = useQuery<PendingSetupBin[]>({
    queryKey: ['pending-setup-bins'],
    queryFn: async () => {
      const res = await apiRequest('/api/staff/bins/pending-setup');
      if (!res.ok) return [];
      return res.json() as Promise<PendingSetupBin[]>;
    },
    refetchInterval: 15000,
  });

  const [forms, setForms] = useState<Record<number, SetupForm>>({});

  const getForm = (bin: PendingSetupBin): SetupForm =>
    forms[bin.id] ?? {
      name: bin.name ?? '',
      mode: bin.mode ?? 'demo',
      cameraModel: bin.cameraModel ?? 'none',
    };
  const setForm = (bin: PendingSetupBin, patch: Partial<SetupForm>) =>
    setForms(prev => ({ ...prev, [bin.id]: { ...getForm(bin), ...prev[bin.id], ...patch } }));

  const setupMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: SetupPayload }) => {
      const res = await apiRequest(`/api/staff/bins/${id}/setup`, { method: 'PATCH', body: JSON.stringify(body) });
      if (!res.ok) throw new Error('Setup failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-setup-bins'] });
      queryClient.invalidateQueries({ queryKey: ['bins'] });
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  if (bins.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-500" data-testid="text-no-pending-setup">
        No bins awaiting setup. Newly paired bins will appear here.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3" data-testid="list-pending-setup">
      {bins.map((bin) => {
        const f = getForm(bin);
        return (
          <Card key={bin.id} className="border-amber-400" data-testid={`card-pending-bin-${bin.id}`}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Bin #{bin.id}{bin.uid ? ` · ${bin.uid}` : ''}</span>
                <Badge variant="outline" className="border-amber-400 text-amber-600">Pending Setup</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-gray-500">Shop ID: {bin.shopId ?? '—'} · Paired: {bin.createdAt ? new Date(bin.createdAt).toLocaleString() : '—'}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Bin Name</label>
                  <Input
                    value={f.name}
                    onChange={(e) => setForm(bin, { name: e.target.value })}
                    placeholder="e.g. Front counter"
                    data-testid={`input-bin-name-${bin.id}`}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Mode</label>
                  <Select value={f.mode} onValueChange={(v) => setForm(bin, { mode: v === 'normal' ? 'normal' : 'demo' })}>
                    <SelectTrigger data-testid={`select-bin-mode-${bin.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Demo (random 1–10 pts)</SelectItem>
                      <SelectItem value="normal">Normal (reward table)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Camera Model</label>
                  <Select
                    value={f.cameraModel}
                    onValueChange={(v) => setForm(bin, { cameraModel: v === 's3cam' || v === 'android_cam' ? v : 'none' })}
                  >
                    <SelectTrigger data-testid={`select-bin-camera-${bin.id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="s3cam">ESP32-S3-CAM</SelectItem>
                      <SelectItem value="android_cam">Android Camera</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => setupMutation.mutate({ id: bin.id, body: f })}
                  disabled={setupMutation.isPending}
                  data-testid={`button-complete-setup-${bin.id}`}
                >
                  {setupMutation.isPending ? 'Saving…' : 'Complete Setup & Activate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
