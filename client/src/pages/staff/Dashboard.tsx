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
import { useState } from "react";
import { Building, Users, Cpu, Gift, Package, Mail, HandHeart, TrendingUp, Flame, Trash2, AlertTriangle, Thermometer, Wind, CheckCircle, Recycle, LogOut } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function StaffDashboard() {
  const { user, role, clearAuth } = useStore();
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
          <p className="text-xl mb-4 text-white">Access Denied</p>
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
          <div className="w-10 h-10 littr-gradient-green rounded-xl flex items-center justify-center">
            <Recycle className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white">Staff Dashboard</h1>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-white hover:bg-white/10" data-testid="button-logout">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalLeads}</p>
                  <p className="text-xs text-gray-500">Leads</p>
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
                  <p className="text-xs text-gray-500">Active Shops</p>
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
                  <p className="text-xs text-gray-500">Bins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.activeFireAlerts > 0 ? "border-red-500 !bg-red-900/30" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Flame className={`h-8 w-8 ${stats.activeFireAlerts > 0 ? "text-red-500 animate-pulse" : "text-gray-400"}`} />
                <div>
                  <p className={`text-2xl font-bold ${stats.activeFireAlerts > 0 ? "text-red-400" : ""}`}>{stats.activeFireAlerts}</p>
                  <p className="text-xs text-gray-500">Fire Alerts</p>
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
                  <p className="text-xs text-gray-500">Today's Drops</p>
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
                  <p className="text-xs text-gray-500">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="leads" className="space-y-4">
          <TabsList className="grid grid-cols-7 w-full max-w-3xl">
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="shops">Shops</TabsTrigger>
            <TabsTrigger value="bins" className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" />
              Bins
            </TabsTrigger>
            <TabsTrigger value="devices">Devices</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="volunteers">Volunteers</TabsTrigger>
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
                          <span className="text-xs text-gray-500">{lead.email}</span>
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
                        <TableCell colSpan={5} className="text-center text-gray-500">No leads yet</TableCell>
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
                        <TableCell>
                          <ShopActionsMenu shop={shop} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {shops.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500">No shops yet</TableCell>
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
                <Card className="border-red-500 !bg-red-900/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-400">
                      <Flame className="h-5 w-5 animate-pulse" />
                      Active Fire Alerts
                    </CardTitle>
                    <CardDescription className="text-red-300/70">
                      Immediate attention required for these alerts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {fireAlerts.map((alert: any) => (
                        <div 
                          key={alert.id} 
                          className={`p-4 rounded-lg border ${
                            alert.severity === 'CRITICAL' ? 'bg-red-900/50 border-red-500 animate-pulse' :
                            alert.severity === 'HIGH' ? 'bg-red-900/40 border-red-400' :
                            alert.severity === 'MEDIUM' ? 'bg-orange-900/40 border-orange-400' :
                            'bg-yellow-900/40 border-yellow-400'
                          }`}
                          data-testid={`fire-alert-${alert.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Flame className={`h-6 w-6 ${
                                alert.severity === 'CRITICAL' ? 'text-red-500 animate-pulse' :
                                alert.severity === 'HIGH' ? 'text-red-400' :
                                alert.severity === 'MEDIUM' ? 'text-orange-400' :
                                'text-yellow-400'
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
                                  <span className="font-semibold text-white">{alert.bin?.name || `Bin #${alert.binId}`}</span>
                                  <span className="text-sm text-gray-400">at {alert.shop?.name || 'Unknown Shop'}</span>
                                </div>
                                <div className="text-sm text-gray-300 mt-1">
                                  {alert.temperature !== null && (
                                    <span className="mr-3">🌡️ {alert.temperature?.toFixed(1)}°C</span>
                                  )}
                                  {alert.temperatureRise !== null && alert.temperatureRise > 0 && (
                                    <span className="text-red-400">↑ +{alert.temperatureRise?.toFixed(1)}°C rise</span>
                                  )}
                                  <span className="ml-3 text-gray-500">
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
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="h-5 w-5" />
                    All Bins
                  </CardTitle>
                  <CardDescription>Smart recycling bins across all locations</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Shop</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Fill Level</TableHead>
                        <TableHead>Vape Count</TableHead>
                        <TableHead>Temperature</TableHead>
                        <TableHead>Air Quality</TableHead>
                        <TableHead>Last Seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bins.map((bin: any) => (
                        <TableRow key={bin.id} data-testid={`bin-row-${bin.id}`}>
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
                              <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    bin.fillLevel >= 80 ? 'bg-red-500' :
                                    bin.fillLevel >= 50 ? 'bg-yellow-500' :
                                    'bg-green-500'
                                  }`}
                                  style={{ width: `${bin.fillLevel || 0}%` }}
                                />
                              </div>
                              <span className="text-sm">{bin.fillLevel || 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{bin.vapeCount || 0}</TableCell>
                          <TableCell>
                            {bin.lastTemperature !== null ? (
                              <span className={bin.lastTemperature >= 45 ? 'text-red-600 font-semibold' : ''}>
                                {bin.lastTemperature?.toFixed(1)}°C
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{bin.lastAirQuality !== null ? bin.lastAirQuality : '-'}</TableCell>
                          <TableCell>
                            {bin.lastSeenAt ? new Date(bin.lastSeenAt).toLocaleString() : 'Never'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {bins.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-gray-500">No bins yet</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="devices">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>ESP32 Devices</CardTitle>
                  <CardDescription>LITTR bin controllers</CardDescription>
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
                      <TableHead>Last Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device: any) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-mono text-xs">{device.id}</TableCell>
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell>{device.shopName}</TableCell>
                        <TableCell>
                          <Badge variant={device.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {device.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : 'Never'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {devices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500">No devices yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Drop Events</CardTitle>
                <CardDescription>Vape recycling activity across all locations</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shop</TableHead>
                      <TableHead>Points</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dropEvents.slice(0, 20).map((event: any) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.shopName}</TableCell>
                        <TableCell>+{event.pointsAwarded}</TableCell>
                        <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {dropEvents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500">No activity yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages">
            <Card>
              <CardHeader>
                <CardTitle>Contact Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.email}</TableCell>
                        <TableCell className="max-w-xs truncate">{c.message}</TableCell>
                        <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {contacts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-gray-500">No messages yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
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
                        <TableCell colSpan={4} className="text-center text-gray-500">No volunteers yet</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
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

function CreateDeviceDialog({ shops }: { shops: any[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [shopId, setShopId] = useState('');
  const [deviceKey, setDeviceKey] = useState('');
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
      setDeviceKey(data.deviceKey);
      setName('');
      setShopId('');
    },
  });

  const verifiedShops = shops.filter((s: any) => s.status === 'VERIFIED');

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setDeviceKey(''); }}>
      <DialogTrigger asChild>
        <Button size="sm">Add Device</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add ESP32 Device</DialogTitle>
        </DialogHeader>
        {deviceKey ? (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 mb-2">Save this device key now!</p>
              <p className="text-xs text-yellow-700 mb-3">It will not be shown again.</p>
              <code className="block p-3 bg-black text-green-400 rounded text-xs break-all font-mono">
                {deviceKey}
              </code>
            </div>
            <Button onClick={() => { setOpen(false); setDeviceKey(''); }} className="w-full">Done</Button>
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
                <p className="text-xs text-gray-500 mt-1">No verified shops. Verify a shop first.</p>
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
