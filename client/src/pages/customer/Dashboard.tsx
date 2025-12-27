import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Gift, History, QrCode, ShoppingBag, Settings, MapPin, Recycle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CustomerDashboard() {
  const { user, role, clearAuth } = useStore();
  const [, setLocation] = useLocation();

  const { data: walletData } = useQuery({
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6 safe-top safe-bottom">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Recycle className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">LITTR</h1>
          <p className="text-gray-400 mb-8">Recycling Made Rewarding</p>
          <Button 
            onClick={() => setLocation('/app/login')}
            className="ios-button w-full bg-green-500 text-white hover:bg-green-600"
            data-testid="button-login"
          >
            Sign In
          </Button>
          <Button 
            variant="ghost"
            onClick={() => setLocation('/app/register')}
            className="w-full mt-3 text-gray-400"
            data-testid="button-register"
          >
            Create Account
          </Button>
        </div>
      </div>
    );
  }

  const wallet = walletData?.wallet;
  const customer = walletData?.customer;

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* iOS-style Nav Bar */}
      <div className="ios-nav-bar bg-black/90 border-gray-800">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-bold text-white">LITTR</h1>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation('/app/settings')}
            className="text-gray-400 hover:text-white"
            data-testid="button-settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Points Balance - Hero Card */}
        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-8 -mb-8" />
          <div className="relative z-10">
            <p className="text-green-100 text-sm mb-1">Your Points</p>
            <p className="text-5xl font-bold mb-1" data-testid="text-points-balance">
              {wallet?.pointsBalance || 0}
            </p>
            <p className="text-green-200 text-xs">
              Lifetime: {wallet?.lifetimeEarned || 0} pts earned
            </p>
            {customer && (
              <p className="text-green-300/60 text-xs mt-3">
                ID: {customer.publicId}
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setLocation('/app/scan')}
            className="ios-card p-4 text-center active:scale-[0.98] transition-transform"
            data-testid="button-scan-qr"
          >
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <QrCode className="h-6 w-6 text-green-600" />
            </div>
            <p className="font-semibold text-sm">Scan QR</p>
            <p className="text-xs text-gray-500">Claim points</p>
          </button>
          <button 
            onClick={() => setLocation('/app/store')}
            className="ios-card p-4 text-center active:scale-[0.98] transition-transform"
            data-testid="button-store"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <ShoppingBag className="h-6 w-6 text-purple-600" />
            </div>
            <p className="font-semibold text-sm">Store</p>
            <p className="text-xs text-gray-500">Get rewards</p>
          </button>
          <button 
            onClick={() => setLocation('/app/claim')}
            className="ios-card p-4 text-center active:scale-[0.98] transition-transform"
            data-testid="button-manual-claim"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <Gift className="h-6 w-6 text-blue-600" />
            </div>
            <p className="font-semibold text-sm">Enter Code</p>
            <p className="text-xs text-gray-500">Manual claim</p>
          </button>
          <button 
            onClick={() => setLocation('/dropoff')}
            className="ios-card p-4 text-center active:scale-[0.98] transition-transform"
            data-testid="button-find-bin"
          >
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-2">
              <MapPin className="h-6 w-6 text-orange-600" />
            </div>
            <p className="font-semibold text-sm">Find Bin</p>
            <p className="text-xs text-gray-500">Near you</p>
          </button>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white font-semibold">Recent Activity</h2>
            <button 
              className="text-green-500 text-sm flex items-center"
              onClick={() => setLocation('/app/history')}
            >
              See all <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="ios-card overflow-hidden">
            {transactions.slice(0, 5).map((tx: any, idx: number) => (
              <div 
                key={tx.id} 
                className={`ios-list-item ${idx === transactions.slice(0, 5).length - 1 ? 'border-b-0' : ''}`}
                data-testid={`transaction-${tx.id}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {tx.amount > 0 ? (
                    <Recycle className="h-5 w-5 text-green-600" />
                  ) : (
                    <ShoppingBag className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{tx.description || tx.type}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="p-6 text-center">
                <Recycle className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">No activity yet</p>
                <p className="text-gray-400 text-xs">Recycle to earn points!</p>
              </div>
            )}
          </div>
        </div>

        {/* Redemptions */}
        {redemptions.length > 0 && (
          <div>
            <h2 className="text-white font-semibold mb-3">My Rewards</h2>
            <div className="ios-card overflow-hidden">
              {redemptions.slice(0, 3).map((r: any, idx: number) => (
                <div 
                  key={r.id} 
                  className={`ios-list-item ${idx === redemptions.slice(0, 3).length - 1 ? 'border-b-0' : ''}`}
                  data-testid={`redemption-${r.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Gift className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Redemption #{r.id}</p>
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
            </div>
          </div>
        )}
      </div>

      {/* iOS-style Tab Bar */}
      <div className="ios-tab-bar border-gray-800 bg-black/90">
        <button className="ios-tab-item active" onClick={() => setLocation('/app/dashboard')}>
          <Wallet className="h-5 w-5" />
          <span>Wallet</span>
        </button>
        <button className="ios-tab-item" onClick={() => setLocation('/app/scan')}>
          <QrCode className="h-5 w-5" />
          <span>Scan</span>
        </button>
        <button className="ios-tab-item" onClick={() => setLocation('/app/store')}>
          <ShoppingBag className="h-5 w-5" />
          <span>Store</span>
        </button>
        <button className="ios-tab-item" onClick={() => setLocation('/app/history')}>
          <History className="h-5 w-5" />
          <span>History</span>
        </button>
        <button className="ios-tab-item" onClick={handleLogout} data-testid="button-logout">
          <Settings className="h-5 w-5" />
          <span>More</span>
        </button>
      </div>
    </div>
  );
}
