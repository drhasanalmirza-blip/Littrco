import { useState } from "react";
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
import { TrendingUp, Zap, Package, Calendar, Trash2, Flame, AlertTriangle, Recycle, LogOut, Thermometer, Wind, Eye, Monitor, Wifi, ArrowRight, Link2, Coins } from "lucide-react";
import littrOneImage from "@/assets/images/littr-one-official.png";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function PartnerDashboard() {
  const { user, role, clearAuth } = useStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [pairCode, setPairCode] = useState("");
  const [pairResult, setPairResult] = useState<any | null>(null);

  const { data: shops = [] } = useQuery({
    queryKey: ['partner-shops'],
    queryFn: async () => {
      const res = await apiRequest('/api/partner/shops');
      if (!res.ok) throw new Error('Failed to fetch shops');
      return res.json();
    },
  });

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

  const { data: pointsLedger = [] } = useQuery({
    queryKey: ['partner-points-ledger', shop?.id],
    queryFn: async () => {
      if (!shop) return [];
      const res = await apiRequest(`/api/v2/shop/${shop.id}/points-ledger`);
      if (!res.ok) throw new Error('Failed to fetch points ledger');
      return res.json();
    },
    enabled: !!shop,
  });

  const { data: deviceConfig } = useQuery({
    queryKey: ['partner-device-config', shop?.id],
    queryFn: async () => {
      if (!shop) return null;
      const res = await apiRequest(`/api/v2/shop/${shop.id}/device-config`);
      if (!res.ok) throw new Error('Failed to fetch device config');
      return res.json();
    },
    enabled: !!shop,
  });

  const pairDevice = useMutation({
    mutationKey: ['pair-device'],
    mutationFn: async () => {
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

  if (role !== 'partner' && role !== 'admin') {
    return (
      <div className="littr-dashboard flex items-center justify-center">
        <div className="littr-card-solid p-8 rounded-2xl text-center">
          <p className="text-xl mb-4 text-white">Access Denied</p>
          <Button onClick={() => setLocation('/partner/login')} className="littr-btn littr-btn-primary">Partner Login</Button>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="littr-dashboard">
        <div className="littr-nav px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 littr-gradient-green rounded-xl flex items-center justify-center">
              <Recycle className="h-5 w-5 text-white" />
            </div>
            <h1 className="font-bold text-white">Partner Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white hover:bg-white/10">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-gray-400">No shop assigned to your account.</p>
          <p className="text-sm text-gray-500 mt-2">Contact LITTR support for assistance.</p>
        </div>
      </div>
    );
  }

  const totalPointsEarned = pointsLedger.reduce((sum: number, entry: any) => sum + (entry.points || 0), 0);

  return (
    <div className="littr-dashboard">
      <div className="littr-nav px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 littr-gradient-green rounded-xl flex items-center justify-center">
            <Recycle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white">{shop.name}</h1>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white hover:bg-white/10" data-testid="button-logout">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats?.totalDrops || 0}</p>
                  <p className="text-xs text-gray-500">Total Drops</p>
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
                  <p className="text-xs text-gray-500">Today</p>
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
                  <p className="text-xs text-gray-500">Points Given</p>
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
                  <p className="text-xs text-gray-500">Active Devices</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* LITTR One Showcase */}
        <Card className="mb-8 bg-gradient-to-r from-zinc-900 to-zinc-800 border-green-500/30 overflow-hidden" data-testid="card-littr-one-showcase">
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
                  <span className="bg-green-500 text-black text-xs font-bold px-2 py-0.5 rounded" data-testid="badge-new-partner">NEW</span>
                  <h3 className="text-lg font-bold text-white" data-testid="heading-littr-one-partner">LITTR One Smart Bin</h3>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  Upgrade your shop with our WiFi-enabled smart bin featuring temperature, VOC, and fill sensors.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-zinc-800 px-2 py-1 rounded">
                    <Thermometer className="h-3 w-3 text-red-400" /> Fire Safety
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-zinc-800 px-2 py-1 rounded">
                    <Wind className="h-3 w-3 text-blue-400" /> Air Quality
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-zinc-800 px-2 py-1 rounded">
                    <Eye className="h-3 w-3 text-purple-400" /> Fill Detection
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-zinc-800 px-2 py-1 rounded">
                    <Monitor className="h-3 w-3 text-cyan-400" /> QR Rewards
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 bg-zinc-800 px-2 py-1 rounded">
                    <Wifi className="h-3 w-3 text-yellow-400" /> Real-time Alerts
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-gray-500 line-through text-sm" data-testid="text-price-original-partner">$459.95</span>
                    <span className="text-xl font-bold text-green-500 ml-2" data-testid="text-price-discounted-partner">$169.95</span>
                  </div>
                  <Button size="sm" className="bg-green-500 hover:bg-green-600 text-black" data-testid="button-partner-order-bin">
                    Order for Your Shop <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="bins" className="flex items-center gap-1">
              {shopFireAlerts.filter((a: any) => !a.acknowledged).length > 0 && (
                <Flame className="h-4 w-4 text-red-500 animate-pulse" />
              )}
              Bins
            </TabsTrigger>
            <TabsTrigger value="rewards">Rewards Config</TabsTrigger>
            <TabsTrigger value="pickup">Request Pickup</TabsTrigger>
            <TabsTrigger value="pair" className="flex items-center gap-1">
              <Link2 className="h-4 w-4" />
              Pair Device
            </TabsTrigger>
            <TabsTrigger value="points" className="flex items-center gap-1">
              <Coins className="h-4 w-4" />
              Points
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
                        <TableCell colSpan={2} className="text-center text-gray-500">
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
                <Card className="border-red-500 !bg-red-900/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-400">
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
                            alert.severity === 'CRITICAL' ? 'bg-red-900/50 border border-red-500' :
                            alert.severity === 'HIGH' ? 'bg-red-900/40 border border-red-400' :
                            'bg-orange-900/40 border border-orange-400'
                          }`}
                          data-testid={`partner-fire-alert-${alert.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                            <Badge variant="destructive">{alert.severity}</Badge>
                            <span className="font-medium text-white">{alert.bin?.name || `Bin #${alert.binId}`}</span>
                            {alert.temperature && (
                              <span className="text-sm text-gray-300">🌡️ {alert.temperature.toFixed(1)}°C</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
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
                            bin.status === 'FIRE_ALERT' ? 'border-red-500 bg-red-900/30' :
                            bin.status === 'ONLINE' ? 'border-green-500/30 bg-green-900/20' :
                            'border-gray-600 bg-gray-800/50'
                          }`}
                          data-testid={`partner-bin-${bin.id}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-semibold text-white">{bin.name}</h4>
                              <Badge variant={bin.status === 'ONLINE' ? 'default' : bin.status === 'FIRE_ALERT' ? 'destructive' : 'secondary'}>
                                {bin.status}
                              </Badge>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-bold text-lg text-green-400">{bin.vapeCount || 0}</div>
                              <div className="text-gray-400">vapes recycled</div>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <div className="flex justify-between text-sm mb-1 text-gray-300">
                                <span>Fill Level</span>
                                <span>{bin.fillLevel || 0}%</span>
                              </div>
                              <Progress value={bin.fillLevel || 0} className="h-2" />
                            </div>
                            
                            <div className="flex gap-4 text-sm text-gray-400">
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
                    <div className="text-center py-8 text-gray-400">
                      <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>No bins linked to your shop yet.</p>
                      <p className="text-sm text-gray-500">Contact LITTR to get your smart bin installed.</p>
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
                      <p className="text-sm text-gray-500">Enable temperature warning alerts</p>
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
                    onClick={() => updateDeviceConfig.mutate(deviceConfig || {})}
                    disabled={updateDeviceConfig.isPending}
                    data-testid="button-save-config"
                  >
                    {updateDeviceConfig.isPending ? 'Saving...' : 'Save Config'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="rewards">
            <Card>
              <CardHeader>
                <CardTitle>Rewards Configuration</CardTitle>
                <CardDescription>Control how rewards work at your location</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Rewards Enabled</Label>
                    <p className="text-sm text-gray-500">Toggle rewards on/off for your location</p>
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
                  <p className="text-xs text-gray-500">Maximum spins allowed per day per device</p>
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
                  <p className="text-xs text-gray-500">Anti-abuse rate limiting</p>
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
                  <p className="text-gray-600 mb-4">
                    When your bin is getting full, request a pickup and we'll schedule a collection.
                  </p>
                  <Button 
                    size="lg" 
                    onClick={() => requestPickup.mutate()}
                    disabled={requestPickup.isPending}
                  >
                    {requestPickup.isPending ? 'Requesting...' : 'Request Pickup'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pair">
            <Card>
              <CardHeader>
                <CardTitle>Pair a New Smart Bin</CardTitle>
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
                    data-testid="button-pair-device"
                  >
                    {pairDevice.isPending ? 'Pairing...' : 'Pair Device'}
                  </Button>
                </div>
                {pairResult && !pairResult.error && (
                  <div className="p-3 rounded-lg bg-green-900/30 border border-green-500 text-green-400">
                    Device paired successfully!
                  </div>
                )}
                {pairResult?.error && (
                  <div className="p-3 rounded-lg bg-red-900/30 border border-red-500 text-red-400">
                    {pairResult.error}
                  </div>
                )}
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
                      <p className="text-xs text-gray-500">Total Points Earned</p>
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
                          <TableCell colSpan={3} className="text-center text-gray-500">
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
        </Tabs>
      </div>
    </div>
  );
}
