import { useState, useEffect } from "react";
import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { TrendingUp, Zap, Package, Calendar, Trash2, Flame, AlertTriangle, Recycle, LogOut, Thermometer, Wind, Eye, Monitor, Wifi, ArrowRight, Link2, Coins, Gift, Sun, Moon } from "lucide-react";
import littrOneImage from "@/assets/images/littr-one-official.png";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { unwrapEnvelope } from "@/lib/apiEnvelope";

type PartnerDeviceConfig = {
  session_window_sec?: number;
  accepted_hold_ms?: number;
  warn_enabled?: boolean;
  warn_temp_c?: number;
  warn_voc_analog?: number;
  warn_use_voc_digital?: boolean;
  raw_swap_bytes?: boolean;
};

class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

function PartnerRewardsStore({ shopId }: { shopId: number | undefined }) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: storeItems = [] } = useQuery({
    queryKey: ['partner-store'],
    queryFn: async () => {
      const res = await apiRequest('/api/partner/store');
      if (!res.ok) throw new Error('Failed to fetch store');
      return res.json();
    },
  });

  const { data: ledger = [] } = useQuery<any[]>({
    queryKey: ['partner-rewards-points', shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const res = await apiRequest(`/api/v2/shop/${shopId}/points-ledger`);
      if (!res.ok) throw new Error('Failed to fetch points');
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.entries)) return data.entries;
      return [];
    },
    enabled: !!shopId,
  });

  const totalPoints = (Array.isArray(ledger) ? ledger : []).reduce((sum: number, entry: any) => sum + (entry.points || 0), 0);

  const redeem = useMutation({
    mutationFn: async (storeItemId: number) => {
      const res = await apiRequest('/api/partner/redeem', {
        method: 'POST',
        body: JSON.stringify({ storeItemId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to redeem' }));
        throw new Error(err.message || 'Failed to redeem');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSuccessMessage('Redeemed successfully!');
      queryClient.invalidateQueries({ queryKey: ['partner-rewards-points'] });
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Coins className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-black dark:text-white" data-testid="text-rewards-points-balance">{totalPoints}</p>
              <p className="text-xs text-gray-400">Available Points</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {successMessage && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-600" data-testid="text-redeem-success">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {storeItems.map((item: any) => (
          <Card key={item.id} className="border border-gray-200 dark:border-gray-700" data-testid={`card-store-item-${item.id}`}>
            <CardHeader>
              <CardTitle className="text-lg text-black dark:text-white">{item.name}</CardTitle>
              {item.description && (
                <CardDescription>{item.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-black dark:text-white">{item.cost} points</span>
                <Button
                  size="sm"
                  className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                  onClick={() => redeem.mutate(item.id)}
                  disabled={redeem.isPending || totalPoints < item.cost}
                  data-testid={`button-redeem-${item.id}`}
                >
                  {redeem.isPending ? 'Redeeming...' : 'Redeem'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {storeItems.length === 0 && (
          <div className="col-span-full text-center py-8 text-gray-400">
            <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No rewards available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PartnerDashboard() {
  const { user, role, clearAuth, theme, toggleTheme } = useStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [pairCode, setPairCode] = useState("");
  const [pairResult, setPairResult] = useState<any | null>(null);

  const { data: shops = [], isLoading: shopsLoading, isError: shopsError, error: shopsErrorObj } = useQuery({
    queryKey: ['partner-shops'],
    queryFn: async () => {
      const res = await apiRequest('/api/partner/shops');
      if (res.status === 401) {
        throw new SessionExpiredError();
      }
      if (!res.ok) throw new Error('Failed to fetch shops');
      return res.json();
    },
    // Don't retry an expired-session response — we want the redirect to fire
    // immediately on the first 401 instead of pausing for retry backoff.
    retry: (_failureCount, error) => !(error instanceof SessionExpiredError),
  });

  useEffect(() => {
    if (shopsError && shopsErrorObj instanceof SessionExpiredError) {
      clearAuth();
      setLocation('/partner/login');
    }
  }, [shopsError, shopsErrorObj, clearAuth, setLocation]);

  const shop = shops[0];

  const { data: stats } = useQuery({
    queryKey: ['partner-stats', shop?.id],
    queryFn: async () => {
      if (!shop) return null;
      const res = await apiRequest(`/api/partner/shops/${shop.id}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!shop,
  });

  const { data: rewardConfig } = useQuery({
    queryKey: ['reward-config', shop?.id],
    queryFn: async () => {
      if (!shop) return null;
      const res = await apiRequest(`/api/partner/shops/${shop.id}/reward-config`);
      if (!res.ok) throw new Error('Failed to fetch reward config');
      return res.json();
    },
    enabled: !!shop,
  });

  const { data: dropEvents = [] } = useQuery({
    queryKey: ['partner-drops', shop?.id],
    queryFn: async () => {
      if (!shop) return [];
      const res = await apiRequest(`/api/partner/shops/${shop.id}/drop-events`);
      if (!res.ok) throw new Error('Failed to fetch drop events');
      return res.json();
    },
    enabled: !!shop,
  });

  const { data: shopBins = [] } = useQuery({
    queryKey: ['partner-bins', shop?.id],
    queryFn: async () => {
      if (!shop) return [];
      const res = await apiRequest(`/api/partner/shops/${shop.id}/bins`);
      if (!res.ok) throw new Error('Failed to fetch bins');
      return res.json();
    },
    enabled: !!shop,
  });

  const { data: shopFireAlerts = [] } = useQuery({
    queryKey: ['partner-fire-alerts', shop?.id],
    queryFn: async () => {
      if (!shop) return [];
      const res = await apiRequest(`/api/partner/shops/${shop.id}/fire-alerts`);
      if (!res.ok) throw new Error('Failed to fetch fire alerts');
      return res.json();
    },
    enabled: !!shop,
    refetchInterval: 10000,
  });

  const { data: pointsLedger = [] } = useQuery<any[]>({
    queryKey: ['partner-points-ledger', shop?.id],
    queryFn: async () => {
      if (!shop) return [];
      const res = await apiRequest(`/api/v2/shop/${shop.id}/points-ledger`);
      if (!res.ok) throw new Error('Failed to fetch points ledger');
      const data = await res.json();
      const entries = unwrapEnvelope<any[]>(data, 'entries');
      return Array.isArray(entries) ? entries : [];
    },
    enabled: !!shop,
  });

  const { data: deviceConfig } = useQuery<PartnerDeviceConfig | null>({
    queryKey: ['partner-device-config', shop?.id],
    queryFn: async () => {
      if (!shop) return null;
      const res = await apiRequest(`/api/v2/shop/${shop.id}/device-config`);
      if (!res.ok) throw new Error('Failed to fetch device config');
      const data = await res.json();
      return unwrapEnvelope<PartnerDeviceConfig>(data, 'config') ?? null;
    },
    enabled: !!shop,
  });

  const pairDevice = useMutation({
    mutationKey: ['pair-device'],
    mutationFn: async () => {
      if (!shop) throw new Error('No shop assigned');
      const res = await apiRequest('/api/v2/device/pair-claim', {
        method: 'POST',
        body: JSON.stringify({ pairCode, shopId: shop.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to pair device' }));
        throw new Error(err.message || 'Failed to pair device');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setPairResult(data);
      setPairCode("");
      queryClient.invalidateQueries({ queryKey: ['partner-bins'] });
    },
    onError: (error: any) => {
      setPairResult({ error: error.message });
    },
  });

  const updateDeviceConfig = useMutation({
    mutationKey: ['update-device-config'],
    mutationFn: async (updates: any) => {
      if (!shop) throw new Error('No shop assigned');
      const res = await apiRequest(`/api/v2/shop/${shop.id}/device-config`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update device config');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-device-config'] });
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: any) => {
      if (!shop) throw new Error('No shop assigned');
      const res = await apiRequest(`/api/partner/shops/${shop.id}/reward-config`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update config');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-config'] });
    },
  });

  const requestPickup = useMutation({
    mutationFn: async () => {
      if (!shop) throw new Error('No shop assigned');
      const res = await apiRequest(`/api/partner/shops/${shop.id}/pickup-request`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Pickup requested via dashboard' }),
      });
      if (!res.ok) throw new Error('Failed to request pickup');
      return res.json();
    },
    onSuccess: () => {
      alert('Pickup request submitted! We will contact you soon.');
    },
  });

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    clearAuth();
    setLocation('/');
  };

  if (!user || (role !== 'partner' && role !== 'admin' && role !== 'staff')) {
    return (
      <div className="littr-dashboard flex items-center justify-center">
        <div className="littr-card-solid p-8 rounded-2xl text-center">
          <p className="text-xl mb-4 text-black dark:text-white">Access Denied</p>
          <Button onClick={() => setLocation('/partner/login')} className="littr-btn littr-btn-primary">Partner Login</Button>
        </div>
      </div>
    );
  }

  const isSessionExpired = shopsError && shopsErrorObj instanceof SessionExpiredError;

  if (shopsLoading || isSessionExpired) {
    return (
      <div className="littr-dashboard flex items-center justify-center" data-testid="status-dashboard-loading">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            {isSessionExpired ? 'Redirecting to login...' : 'Loading dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="littr-dashboard">
        <div className="littr-nav px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
              <Recycle className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-bold text-black dark:text-white">Partner Dashboard</h1>
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
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-gray-500 dark:text-gray-400">No shop assigned to your account.</p>
          <p className="text-sm text-gray-400 mt-2">Contact LITTR support for assistance.</p>
        </div>
      </div>
    );
  }

  const totalPointsEarned = (Array.isArray(pointsLedger) ? pointsLedger : []).reduce((sum: number, entry: any) => sum + (entry.points || 0), 0);

  return (
    <div className="littr-dashboard">
      <div className="littr-nav px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
            <Recycle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-black dark:text-white">{shop.name}</h1>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            data-testid="button-theme-toggle-main"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-yellow-400" />
            ) : (
              <Moon className="h-4 w-4 text-gray-500" />
            )}
          </button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800" data-testid="button-logout">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.totalDrops || 0}</p>
                  <p className="text-xs text-gray-400">Total Drops</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.todayDrops || 0}</p>
                  <p className="text-xs text-gray-400">Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.totalPoints || 0}</p>
                  <p className="text-xs text-gray-400">Points Given</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.activeDevices || 0}</p>
                  <p className="text-xs text-gray-400">Active Devices</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8 bg-gradient-to-r from-gray-50 dark:from-gray-800 to-white dark:to-gray-900 border-gray-200 dark:border-gray-700 overflow-hidden" data-testid="card-littr-one-showcase">
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
              <div className="flex justify-center items-center">
                <img 
                  src={littrOneImage} 
                  alt="LITTR One Smart Bin" 
                  className="w-32 h-32 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  data-testid="img-littr-one-partner"
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded" data-testid="badge-new-partner">NEW</span>
                  <h3 className="text-lg font-bold text-black dark:text-white" data-testid="heading-littr-one-partner">LITTR One Smart Bin</h3>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                  Upgrade your shop with our WiFi-enabled smart bin featuring temperature, VOC, and fill sensors.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    <Thermometer className="h-3 w-3 text-red-400" /> Fire Safety
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    <Wind className="h-3 w-3 text-blue-400" /> Air Quality
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    <Eye className="h-3 w-3 text-purple-400" /> Fill Detection
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    <Monitor className="h-3 w-3 text-cyan-400" /> QR Rewards
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    <Wifi className="h-3 w-3 text-yellow-400" /> Real-time Alerts
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-gray-400 line-through text-sm" data-testid="text-price-original-partner">$459.95</span>
                    <span className="text-xl font-bold text-green-600 ml-2" data-testid="text-price-discounted-partner">$169.95</span>
                  </div>
                  <Button size="sm" className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200" data-testid="button-partner-order-bin">
                    Order for Your Shop <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList className="grid grid-cols-3 md:grid-cols-6">
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="bins" className="flex items-center gap-1">
              {shopFireAlerts.filter((a: any) => !a.acknowledged).length > 0 && (
                <Flame className="h-4 w-4 text-red-500 animate-pulse" />
              )}
              Devices
            </TabsTrigger>
            <TabsTrigger value="rewards-config">Rewards</TabsTrigger>
            <TabsTrigger value="pickup">Pickup</TabsTrigger>
            <TabsTrigger value="points" className="flex items-center gap-1">
              <Coins className="h-4 w-4" />
              Points
            </TabsTrigger>
            <TabsTrigger value="rewards" className="flex items-center gap-1">
              <Gift className="h-4 w-4" />
              Rewards
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Vape drops at your location</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Points Awarded</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dropEvents.slice(0, 20).map((event: any) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">+{event.pointsAwarded}</TableCell>
                        <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {dropEvents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-gray-400">
                          No drops yet. When customers recycle, activity will appear here.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bins">
            <div className="space-y-4">
              {shopFireAlerts.filter((a: any) => !a.resolvedAt).length > 0 && (
                <Card className="border-red-500 !bg-red-50 dark:!bg-red-950">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-600">
                      <Flame className="h-5 w-5 animate-pulse" />
                      Fire Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {shopFireAlerts.filter((a: any) => !a.resolvedAt).map((alert: any) => (
                        <div 
                          key={alert.id} 
                          className={`p-3 rounded-lg ${
                            alert.severity === 'CRITICAL' ? 'bg-red-100 dark:bg-red-900 border border-red-500' :
                            alert.severity === 'HIGH' ? 'bg-red-50 dark:bg-red-950 border border-red-400' :
                            'bg-orange-50 dark:bg-orange-950 border border-orange-400'
                          }`}
                          data-testid={`partner-fire-alert-${alert.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            <Badge variant="destructive">{alert.severity}</Badge>
                            <span className="font-medium text-black dark:text-white">{alert.bin?.name || `Bin #${alert.binId}`}</span>
                            {alert.temperature && (
                              <span className="text-sm text-gray-600 dark:text-gray-300">🌡️ {alert.temperature.toFixed(1)}°C</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Contact LITTR support immediately if you notice smoke or fire.
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    Your Bins
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {shopBins.length > 0 ? (
                    <div className="space-y-4">
                      {shopBins.map((bin: any) => (
                        <div 
                          key={bin.id} 
                          className={`p-4 rounded-lg border ${
                            bin.status === 'FIRE_ALERT' ? 'border-red-500 bg-red-50 dark:bg-red-950' :
                            bin.status === 'ONLINE' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950' :
                            'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                          }`}
                          data-testid={`partner-bin-${bin.id}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-semibold text-black dark:text-white">{bin.name}</h4>
                              <Badge variant={bin.status === 'ONLINE' ? 'default' : bin.status === 'FIRE_ALERT' ? 'destructive' : 'secondary'}>
                                {bin.status}
                              </Badge>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-bold text-lg text-green-600">{bin.vapeCount || 0}</div>
                              <div className="text-gray-500 dark:text-gray-400">vapes recycled</div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-sm mb-1 text-gray-600 dark:text-gray-300">
                                <span>Fill Level</span>
                                <span>{bin.fillLevel || 0}%</span>
                              </div>
                              <Progress value={bin.fillLevel || 0} className="h-2" />
                            </div>
                            
                            <div className="flex gap-4 text-sm text-gray-500 dark:text-gray-400">
                              {bin.lastTemperature && (
                                <span>🌡️ {bin.lastTemperature.toFixed(1)}°C</span>
                              )}
                              {bin.lastAirQuality && (
                                <span>💨 AQI: {bin.lastAirQuality}</span>
                              )}
                              {bin.lastSeenAt && (
                                <span>Last seen: {new Date(bin.lastSeenAt).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No bins linked to your shop yet.</p>
                      <p className="text-sm text-gray-400">Contact LITTR to get your smart bin installed.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Bin Settings (Cloud Config)</CardTitle>
                  <CardDescription>Configure your smart bin behavior via cloud settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Session Window (seconds)</Label>
                      <span className="text-sm font-medium">{deviceConfig?.session_window_sec || 60}s</span>
                    </div>
                    <Slider
                      value={[deviceConfig?.session_window_sec || 60]}
                      min={10}
                      max={300}
                      step={5}
                      onValueChange={([value]) => updateDeviceConfig.mutate({ session_window_sec: value })}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label>Accepted Hold Time (seconds)</Label>
                      <span className="text-sm font-medium">{((deviceConfig?.accepted_hold_ms || 5000) / 1000).toFixed(1)}s</span>
                    </div>
                    <Slider
                      value={[deviceConfig?.accepted_hold_ms || 5000]}
                      min={3000}
                      max={30000}
                      step={1000}
                      onValueChange={([value]) => updateDeviceConfig.mutate({ accepted_hold_ms: value })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Warning Enabled</Label>
                      <p className="text-sm text-gray-400">Enable temperature warning alerts</p>
                    </div>
                    <Switch
                      checked={deviceConfig?.warn_enabled ?? false}
                      onCheckedChange={(warn_enabled) => updateDeviceConfig.mutate({ warn_enabled })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Warning Temperature (°C)</Label>
                    <Input
                      type="number"
                      value={deviceConfig?.warn_temp_c ?? 45}
                      onChange={(e) => updateDeviceConfig.mutate({ warn_temp_c: Number(e.target.value) })}
                    />
                  </div>

                  <Button
                    onClick={() => {
                      const cfg = deviceConfig ?? {};
                      const payload: PartnerDeviceConfig = {
                        session_window_sec: cfg.session_window_sec,
                        accepted_hold_ms: cfg.accepted_hold_ms,
                        warn_enabled: cfg.warn_enabled,
                        warn_temp_c: cfg.warn_temp_c,
                        warn_voc_analog: cfg.warn_voc_analog,
                        warn_use_voc_digital: cfg.warn_use_voc_digital,
                        raw_swap_bytes: cfg.raw_swap_bytes,
                      };
                      updateDeviceConfig.mutate(payload);
                    }}
                    disabled={updateDeviceConfig.isPending}
                    className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                    data-testid="button-save-config"
                  >
                    {updateDeviceConfig.isPending ? 'Saving...' : 'Save Config'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Pair a New Smart Bin
                  </CardTitle>
                  <CardDescription>Enter the 6-character pair code displayed on your smart bin to connect it to your shop</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      placeholder="e.g. ABC123"
                      value={pairCode}
                      onChange={(e) => setPairCode(e.target.value.toUpperCase().slice(0, 6))}
                      maxLength={6}
                      className="font-mono text-lg tracking-widest uppercase"
                      data-testid="input-pair-code"
                    />
                    <Button
                      onClick={() => pairDevice.mutate()}
                      disabled={pairDevice.isPending || pairCode.length !== 6}
                      className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                      data-testid="button-pair-device"
                    >
                      {pairDevice.isPending ? 'Pairing...' : 'Pair Device'}
                    </Button>
                  </div>
                  {pairResult && !pairResult.error && (
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-600">
                      Device paired successfully!
                    </div>
                  )}
                  {pairResult?.error && (
                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-600">
                      {pairResult.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rewards-config">
            <Card>
              <CardHeader>
                <CardTitle>Rewards Configuration</CardTitle>
                <CardDescription>Control how rewards work at your location</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Rewards Enabled</Label>
                    <p className="text-sm text-gray-400">Toggle rewards on/off for your location</p>
                  </div>
                  <Switch 
                    checked={rewardConfig?.enabled ?? true}
                    onCheckedChange={(enabled) => updateConfig.mutate({ enabled })}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Daily Spin Cap</Label>
                    <span className="text-sm font-medium">{rewardConfig?.dailySpinCap || 50}</span>
                  </div>
                  <Slider
                    value={[rewardConfig?.dailySpinCap || 50]}
                    min={10}
                    max={200}
                    step={10}
                    onValueChange={([value]) => updateConfig.mutate({ dailySpinCap: value })}
                  />
                  <p className="text-xs text-gray-400">Maximum spins allowed per day per device</p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Minimum Seconds Between Spins</Label>
                    <span className="text-sm font-medium">{rewardConfig?.minSecondsBetweenSpins || 30}s</span>
                  </div>
                  <Slider
                    value={[rewardConfig?.minSecondsBetweenSpins || 30]}
                    min={10}
                    max={120}
                    step={5}
                    onValueChange={([value]) => updateConfig.mutate({ minSecondsBetweenSpins: value })}
                  />
                  <p className="text-xs text-gray-400">Anti-abuse rate limiting</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pickup">
            <Card>
              <CardHeader>
                <CardTitle>Request Pickup</CardTitle>
                <CardDescription>Schedule a bin collection</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    When your bin is getting full, request a pickup and we'll schedule a collection.
                  </p>
                  <Button 
                    size="lg" 
                    onClick={() => requestPickup.mutate()}
                    disabled={requestPickup.isPending}
                    className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                  >
                    {requestPickup.isPending ? 'Requesting...' : 'Request Pickup'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="points">
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Coins className="h-8 w-8 text-yellow-500" />
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-points-total">{totalPointsEarned}</p>
                      <p className="text-xs text-gray-400">Total Points Earned</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Points Ledger</CardTitle>
                  <CardDescription>History of all points earned</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Points</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pointsLedger.map((entry: any, index: number) => (
                        <TableRow key={entry.id || index}>
                          <TableCell className="font-medium">+{entry.points}</TableCell>
                          <TableCell>{entry.reason}</TableCell>
                          <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {pointsLedger.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-gray-400">
                            No points earned yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rewards" className="space-y-4">
            <PartnerRewardsStore shopId={shop?.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
