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
import { TrendingUp, Zap, Package, Calendar } from "lucide-react";

export default function PartnerDashboard() {
  const { user, role, clearAuth } = useStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl mb-4">Access Denied</p>
          <Button onClick={() => setLocation('/partner/login')}>Partner Login</Button>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-black text-white p-4 flex justify-between items-center">
          <h1 className="font-bold">Partner Dashboard</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
        </div>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-gray-500">No shop assigned to your account.</p>
          <p className="text-sm text-gray-400 mt-2">Contact LITTR support for assistance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black text-white p-4 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-lg">{shop.name}</h1>
          <p className="text-sm text-gray-400">{user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
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

        <Tabs defaultValue="activity" className="space-y-4">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="rewards">Rewards Config</TabsTrigger>
            <TabsTrigger value="pickup">Request Pickup</TabsTrigger>
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
        </Tabs>
      </div>
    </div>
  );
}
