import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Gift, QrCode, ShoppingBag, Settings, MapPin, Recycle, LogOut, Star, Battery } from "lucide-react";

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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Recycle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-black mb-1 tracking-tight">LITTR</h1>
          <p className="text-gray-400 mb-8 text-sm">Recycling Made Rewarding</p>
          <Button 
            onClick={() => setLocation('/app/login')}
            className="littr-btn littr-btn-primary w-full text-base"
            data-testid="button-login"
          >
            Sign In
          </Button>
          <Button 
            variant="ghost"
            onClick={() => setLocation('/app/register')}
            className="w-full mt-3 text-gray-500 hover:text-black hover:bg-gray-50"
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
    <div className="littr-dashboard pb-24">
      <div className="littr-nav px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Recycle className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-black text-sm tracking-tight">LITTR</h1>
              <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation('/app/change-password')}
            className="text-gray-400 hover:text-black hover:bg-gray-100"
            data-testid="button-settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">
        <div className="bg-black rounded-2xl p-5 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">Your Batteries</p>
              <p className="text-4xl font-bold tracking-tight" data-testid="text-points-balance">
                {wallet?.pointsBalance || 0}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <Battery className="h-3 w-3" />
                <span>Lifetime: {wallet?.lifetimeEarned || 0}</span>
              </div>
              {customer && (
                <p className="text-gray-600 text-[10px] font-mono mt-1">
                  {customer.publicId}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button 
            onClick={() => setLocation('/app/scan')}
            className="littr-card-solid p-4 text-center active:scale-[0.97] transition-all"
            data-testid="button-scan-qr"
          >
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <QrCode className="h-5 w-5 text-green-600" />
            </div>
            <p className="font-semibold text-xs text-black">Scan</p>
          </button>
          <button 
            onClick={() => setLocation('/app/store')}
            className="littr-card-solid p-4 text-center active:scale-[0.97] transition-all"
            data-testid="button-store"
          >
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <ShoppingBag className="h-5 w-5 text-green-600" />
            </div>
            <p className="font-semibold text-xs text-black">Store</p>
          </button>
          <button 
            onClick={() => setLocation('/app/bonus')}
            className="littr-card-solid p-4 text-center active:scale-[0.97] transition-all"
            data-testid="button-bonus"
          >
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Star className="h-5 w-5 text-green-600" />
            </div>
            <p className="font-semibold text-xs text-black">Bonus</p>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setLocation('/app/scan')}
            className="littr-card-solid p-3 flex items-center gap-3 active:scale-[0.97] transition-all"
            data-testid="button-manual-claim"
          >
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
              <Gift className="h-4 w-4 text-gray-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-xs text-black">Enter Code</p>
              <p className="text-[10px] text-gray-400">Manual claim</p>
            </div>
          </button>
          <button 
            onClick={() => setLocation('/dropoff')}
            className="littr-card-solid p-3 flex items-center gap-3 active:scale-[0.97] transition-all"
            data-testid="button-find-bin"
          >
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
              <MapPin className="h-4 w-4 text-gray-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-xs text-black">Find Bin</p>
              <p className="text-[10px] text-gray-400">Near you</p>
            </div>
          </button>
        </div>

        <div>
          <h2 className="text-black font-semibold text-sm mb-3">Recent Activity</h2>
          <div className="littr-list">
            {transactions.slice(0, 5).map((tx: any) => (
              <div 
                key={tx.id} 
                className="littr-list-item"
                data-testid={`transaction-${tx.id}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-50' : 'bg-gray-100'}`}>
                  {tx.amount > 0 ? (
                    <Battery className="h-4 w-4 text-green-600" />
                  ) : (
                    <ShoppingBag className="h-4 w-4 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-black truncate">{tx.description || tx.type}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`font-bold text-sm ${tx.amount > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </span>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="p-8 text-center">
                <Battery className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No activity yet</p>
                <p className="text-gray-400 text-xs mt-1">Recycle to earn batteries!</p>
              </div>
            )}
          </div>
        </div>

        {redemptions.length > 0 && (
          <div>
            <h2 className="text-black font-semibold text-sm mb-3">My Rewards</h2>
            <div className="littr-list">
              {redemptions.slice(0, 3).map((r: any) => (
                <div 
                  key={r.id} 
                  className="littr-list-item"
                  data-testid={`redemption-${r.id}`}
                >
                  <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center">
                    <Gift className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-black">Redemption #{r.id}</p>
                    <p className="text-xs text-gray-400">{r.pointsSpent} batteries</p>
                  </div>
                  <span className={`littr-badge ${
                    r.status === 'FULFILLED' ? 'littr-badge-green' : 
                    r.status === 'PENDING' ? 'littr-badge-yellow' : 
                    'littr-badge-red'
                  }`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="littr-tab-bar">
        <button className="littr-tab-item active" onClick={() => setLocation('/app')} data-testid="tab-wallet">
          <Wallet className="h-5 w-5" />
          <span>Wallet</span>
        </button>
        <button className="littr-tab-item" onClick={() => setLocation('/app/scan')} data-testid="tab-scan">
          <QrCode className="h-5 w-5" />
          <span>Scan</span>
        </button>
        <button className="littr-tab-item" onClick={() => setLocation('/app/store')} data-testid="tab-store">
          <ShoppingBag className="h-5 w-5" />
          <span>Store</span>
        </button>
        <button className="littr-tab-item" onClick={() => setLocation('/app/bonus')} data-testid="tab-bonus">
          <Star className="h-5 w-5" />
          <span>Bonus</span>
        </button>
        <button className="littr-tab-item" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
