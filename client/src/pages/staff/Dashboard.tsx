import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo, useEffect } from "react";
import { Building, Users, Cpu, Gift, Package, Mail, HandHeart, TrendingUp, Flame, Trash2, AlertTriangle, Thermometer, Wind, CheckCircle, Recycle, LogOut, Info, X, Phone, Send, FileText, Inbox, Link2, Search, Activity, ShieldAlert, Trash, Sun, Moon, UserCog, Plus, Key, Eye, EyeOff } from "lucide-react";
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

  return (
    <div className="littr-dashboard">
      <div className="littr-nav px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
            <Recycle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-black dark:text-white">Staff Dashboard</h1>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-yellow-400" />
            ) : (
              <Moon className="h-4 w-4 text-gray-500" />
            )}
          </button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800" data-testid="button-logout">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalLeads}</p>
                  <p className="text-xs text-gray-400">Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.activeShops}</p>
                  <p className="text-xs text-gray-400">Active Shops</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Trash2 className="h-8 w-8 text-teal-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalBins}</p>
                  <p className="text-xs text-gray-400">Bins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.activeFireAlerts > 0 ? "border-red-500 !bg-red-50 dark:!bg-red-950" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Flame className={`h-8 w-8 ${stats.activeFireAlerts > 0 ? "text-red-500 animate-pulse" : "text-gray-500"}`} />
                <div>
                  <p className={`text-2xl font-bold ${stats.activeFireAlerts > 0 ? "text-red-500" : ""}`}>{stats.activeFireAlerts}</p>
                  <p className="text-xs text-gray-400">Fire Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.todayDrops}</p>
                  <p className="text-xs text-gray-400">Today's Drops</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Gift className="h-8 w-8 text-pink-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.pendingRedemptions}</p>
                  <p className="text-xs text-gray-400">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList className="grid grid-cols-9 w-full max-w-5xl">
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="shops">Shops</TabsTrigger>
            <TabsTrigger value="bins" className="flex items-center gap-1">
              <Cpu className="h-4 w-4" />
              Smart Bins
            </TabsTrigger>
            <TabsTrigger value="pairing" className="flex items-center gap-1">
              <Link2 className="h-4 w-4" />
              Pairing
              {pairRequests.filter((pr: any) => !pr.claimed && new Date(pr.expiresAt) >= new Date()).length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1">{pairRequests.filter((pr: any) => !pr.claimed && new Date(pr.expiresAt) >= new Date()).length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-1">
              <Send className="h-4 w-4" />
              Emails
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex items-center gap-1">
              <Inbox className="h-4 w-4" />
              Inbox
              {myMailbox?.unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1">{myMailbox.unreadCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1">
              <UserCog className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
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
          </TabsContent>

          <TabsContent value="shops">
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
          </TabsContent>

          <TabsContent value="bins">
            <div className="space-y-4">
              {fireAlerts.length > 0 && (
                <Card className="border-red-500 !bg-red-50 dark:!bg-red-950">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-500">
                      <Flame className="h-5 w-5 animate-pulse" />
                      Active Fire Alerts
                    </CardTitle>
                    <CardDescription className="text-red-500">
                      Immediate attention required for these alerts
                    </CardDescription>
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
                                alert.severity === 'MEDIUM' ? 'text-orange-600' :
                                'text-yellow-600'
                              }`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge 
                                    variant={
                                      alert.severity === 'CRITICAL' || alert.severity === 'HIGH' ? 'destructive' :
                                      alert.severity === 'MEDIUM' ? 'default' : 'secondary'
                                    }
                                    className={
                                      alert.severity === 'CRITICAL' ? 'animate-pulse bg-red-600' :
                                      alert.severity === 'HIGH' ? 'bg-red-500' :
                                      alert.severity === 'MEDIUM' ? 'bg-orange-500' :
                                      'bg-yellow-500 text-black'
                                    }
                                    data-testid={`severity-badge-${alert.id}`}
                                  >
                                    {alert.severity}
                                  </Badge>
                                  <span className="font-semibold text-black dark:text-white">{alert.bin?.name || `Bin #${alert.binId}`}</span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">at {alert.shop?.name || 'Unknown Shop'}</span>
                                </div>
                                <div className="text-sm text-gray-400 mt-1">
                                  {alert.temperature !== null && (
                                    <span className="mr-3">🌡️ {alert.temperature?.toFixed(1)}°C</span>
                                  )}
                                  {alert.temperatureRise !== null && alert.temperatureRise > 0 && (
                                    <span className="text-red-500">↑ +{alert.temperatureRise?.toFixed(1)}°C rise</span>
                                  )}
                                  <span className="ml-3 text-gray-400">
                                    {new Date(alert.createdAt).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!alert.acknowledged && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => acknowledgeAlert.mutate(alert.id)}
                                  disabled={acknowledgeAlert.isPending}
                                  data-testid={`acknowledge-alert-${alert.id}`}
                                >
                                  Acknowledge
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={alert.acknowledged ? "default" : "secondary"}
                                onClick={() => resolveAlert.mutate(alert.id)}
                                disabled={resolveAlert.isPending}
                                data-testid={`resolve-alert-${alert.id}`}
                              >
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

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Cpu className="h-5 w-5" />
                      Smart Bins (ESP32)
                    </CardTitle>
                    <CardDescription>LITTR recycling bins with integrated sensors</CardDescription>
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
                        <TableHead>Fill Level</TableHead>
                        <TableHead>Temperature</TableHead>
                        <TableHead>VOC</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bins.map((bin: any) => (
                        <TableRow key={bin.id} data-testid={`bin-row-${bin.id}`} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                          <TableCell className="font-mono text-xs">{bin.deviceId || bin.id}</TableCell>
                          <TableCell className="font-medium">{bin.name}</TableCell>
                          <TableCell>{bin.shop?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                bin.status === 'ONLINE' ? 'default' : 
                                bin.status === 'FIRE_ALERT' ? 'destructive' :
                                bin.status === 'MAINTENANCE' ? 'secondary' : 'outline'
                              }
                              className={bin.status === 'FIRE_ALERT' ? 'animate-pulse' : ''}
                              data-testid={`bin-status-${bin.id}`}
                            >
                              {bin.status === 'FIRE_ALERT' && <Flame className="h-3 w-3 mr-1" />}
                              {bin.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    bin.fillLevel >= 80 ? 'bg-red-500' :
                                    bin.fillLevel >= 50 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                  }`}
                                  style={{ width: `${bin.fillLevel || 0}%` }}
                                />
                              </div>
                              <span className="text-sm">{bin.fillLevel !== null && bin.fillLevel !== undefined ? `${bin.fillLevel}%` : <span className="text-orange-600 text-xs">CONTACT SUPPORT</span>}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {bin.lastTemperature !== null && bin.lastTemperature !== undefined ? (
                              <span className={bin.lastTemperature >= 45 ? 'text-red-600 font-semibold' : ''}>
                                {bin.lastTemperature?.toFixed(1)}°C
                              </span>
                            ) : <span className="text-orange-600 text-xs">CONTACT SUPPORT</span>}
                          </TableCell>
                          <TableCell>
                            {bin.lastVocAnalog !== null && bin.lastVocAnalog !== undefined ? (
                              <span className={bin.lastVocDigital ? 'text-red-600 font-semibold' : ''}>
                                {bin.lastVocAnalog}
                              </span>
                            ) : <span className="text-orange-600 text-xs">CONTACT SUPPORT</span>}
                          </TableCell>
                          <TableCell>
                            {bin.lastSeenAt ? new Date(bin.lastSeenAt).toLocaleString() : <span className="text-orange-600 text-xs">CONTACT SUPPORT</span>}
                          </TableCell>
                          <TableCell>
                            <BinDetailDialog bin={bin} shops={shops} />
                          </TableCell>
                        </TableRow>
                      ))}
                      {bins.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-gray-400">No bins yet. Add a device to get started.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pairing">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Device Pair Requests
                </CardTitle>
                <CardDescription>ESP32 bins requesting to be paired with a shop</CardDescription>
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
                      <TableHead>Paired At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pairRequests.map((pr: any) => (
                      <TableRow key={pr.id} data-testid={`pair-request-row-${pr.id}`}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{pr.pairCode}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">...{pr.uid?.slice(-8)}</TableCell>
                        <TableCell>{pr.firmwareVersion || 'Unknown'}</TableCell>
                        <TableCell>
                          {pr.claimed ? (
                            <Badge className="bg-green-600">Claimed</Badge>
                          ) : new Date(pr.expiresAt) < new Date() ? (
                            <Badge className="bg-red-600">Expired</Badge>
                          ) : (
                            <Badge className="bg-yellow-600 text-black">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>{pr.shopId ? shops.find((s: any) => s.id === pr.shopId)?.name || 'Unknown' : '—'}</TableCell>
                        <TableCell>{new Date(pr.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {pairRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-400">No pair requests yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
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
                    <CardDescription className="text-amber-600 dark:text-amber-400">Users with 10+ claims or 100+ total points — worth reviewing</CardDescription>
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
                      <CardDescription>All points redeemed from bins — who, when, how many</CardDescription>
                    </div>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        data-testid="activity-log-search"
                        placeholder="Search by email, shop, device..."
                        value={activitySearch}
                        onChange={(e) => setActivitySearch(e.target.value)}
                        className="pl-9"
                      />
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
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Showing {activityLimit} of {filteredActivity.length} claims</p>
                      <Button variant="outline" size="sm" onClick={() => setActivityLimit(prev => prev + 50)}>
                        Load More
                      </Button>
                    </div>
                  )}
                  {filteredActivity.length > 0 && filteredActivity.length <= activityLimit && (
                    <p className="mt-3 text-center text-sm text-gray-400">Showing all {filteredActivity.length} claims</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="emails">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Compose Email
                  </CardTitle>
                  <CardDescription>Send emails to staff, partners, or customers</CardDescription>
                </CardHeader>
                <CardContent>
                  <EmailComposer />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Email Templates
                  </CardTitle>
                  <CardDescription>Quick templates for common communications</CardDescription>
                </CardHeader>
                <CardContent>
                  <EmailTemplates />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Staff Mailboxes
                  </CardTitle>
                  <CardDescription>Manage @littr.co email addresses</CardDescription>
                </CardHeader>
                <CardContent>
                  <MailboxManager mailboxes={mailboxes} queryClient={queryClient} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="messages">
            {!myMailbox ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Mail className="h-12 w-12 text-gray-500 dark:text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Mailbox Found</h3>
                    <p className="text-gray-400">You don't have an @littr.co email address yet. Contact an admin to create one for you.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <InboxPortal 
                myMailbox={myMailbox} 
                inboxMessages={inboxMessages} 
                sentMessages={sentMessages}
                mailboxes={mailboxes}
                queryClient={queryClient}
              />
            )}
          </TabsContent>

          <TabsContent value="volunteers">
            <Card>
              <CardHeader>
                <CardTitle>Volunteer Applications</CardTitle>
              </CardHeader>
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
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-400">No volunteers yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <UsersManagement />
          </TabsContent>
        </Tabs>
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
