import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Gift, History, QrCode, ShoppingBag, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function CustomerDashboard() {
  const { user, role, clearAuth } = useStore();
  const [, setLocation] = useLocation();

  const { data: walletData, isLoading } = useQuery({
    queryKey: ['customer-wallet'],
    queryFn: async () => {
      const res = await apiRequest('/api/customer/wallet');
      if (!res.ok) throw new Error('Failed to fetch wallet');
      return res.json();
    },
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['customer-transactions'],
    queryFn: async () => {
      const res = await apiRequest('/api/customer/transactions');
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    },
    enabled: !!user,
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ['customer-redemptions'],
    queryFn: async () => {
      const res = await apiRequest('/api/customer/redemptions');
      if (!res.ok) throw new Error('Failed to fetch redemptions');
      return res.json();
    },
    enabled: !!user,
  });

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    clearAuth();
    setLocation('/');
  };

  if (!user || role !== 'customer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
        <div className="text-center">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white mb-2">LITTR</h1>
            <p className="text-gray-400">Recycling Made Rewarding</p>
          </div>
          <p className="text-gray-300 mb-6">Sign in to view your wallet</p>
          <Button 
            onClick={() => setLocation('/app/login')}
            className="bg-white text-black hover:bg-gray-100"
            data-testid="button-login"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const wallet = walletData?.wallet;
  const customer = walletData?.customer;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      {/* Header */}
      <div className="bg-black text-white p-4 flex justify-between items-center border-b border-gray-800">
        <div>
          <h1 className="font-bold text-lg">LITTR</h1>
          <p className="text-sm text-gray-400">{user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation('/app/change-password')}
            className="text-gray-400 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleLogout} 
            className="border-gray-600 text-white hover:bg-gray-800"
            data-testid="button-logout"
          >
            Logout
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Wallet Balance Card */}
        <Card className="mb-6 bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Available Points</p>
                <p className="text-5xl font-bold">{wallet?.pointsBalance || 0}</p>
                <p className="text-xs text-gray-500 mt-2">Lifetime earned: {wallet?.lifetimeEarned || 0}</p>
              </div>
              <Wallet className="h-16 w-16 text-gray-600" />
            </div>
            {customer && (
              <p className="text-xs text-gray-500 mt-4">Member ID: {customer.publicId}</p>
            )}
          </CardContent>
        </Card>

        {/* Primary Action - Scan QR */}
        <Button 
          onClick={() => setLocation('/app/scan')}
          className="w-full bg-white text-black hover:bg-gray-100 h-16 text-lg font-semibold mb-6 flex items-center justify-center gap-3"
          data-testid="button-scan-qr"
        >
          <QrCode className="h-6 w-6" />
          Scan QR to Claim Points
        </Button>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button 
            variant="outline"
            onClick={() => setLocation('/app/store')}
            className="h-14 border-gray-700 bg-gray-800 text-white hover:bg-gray-700 flex items-center justify-center gap-2"
            data-testid="button-store"
          >
            <ShoppingBag className="h-5 w-5" />
            Rewards Store
          </Button>
          <Button 
            variant="outline"
            onClick={() => setLocation('/app/claim')}
            className="h-14 border-gray-700 bg-gray-800 text-white hover:bg-gray-700 flex items-center justify-center gap-2"
            data-testid="button-manual-claim"
          >
            <Gift className="h-5 w-5" />
            Enter Code
          </Button>
        </div>

        {/* Tabs for History */}
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="w-full bg-gray-800 border-gray-700">
            <TabsTrigger value="transactions" className="flex-1 data-[state=active]:bg-gray-700">
              <History className="h-4 w-4 mr-2" /> Recent
            </TabsTrigger>
            <TabsTrigger value="redemptions" className="flex-1 data-[state=active]:bg-gray-700">
              <Gift className="h-4 w-4 mr-2" /> Redemptions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {transactions.slice(0, 10).map((tx: any) => (
                  <div key={tx.id} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm text-white">{tx.description || tx.type}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No transactions yet. Recycle to earn points!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="redemptions">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">My Redemptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {redemptions.map((r: any) => (
                  <div key={r.id} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm text-white">Redemption #{r.id}</p>
                      <p className="text-xs text-gray-500">{r.pointsSpent} pts</p>
                    </div>
                    <Badge variant={
                      r.status === 'FULFILLED' ? 'default' : 
                      r.status === 'PENDING' ? 'secondary' : 
                      'destructive'
                    }>
                      {r.status}
                    </Badge>
                  </div>
                ))}
                {redemptions.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    No redemptions yet. Visit the store to redeem points!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
