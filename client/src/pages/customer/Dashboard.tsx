import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Wallet, Gift, History, QrCode, ShoppingBag, Settings, MapPin, Recycle, ChevronRight, LogOut } from "lucide-react";

import pixelBinImage from "@assets/generated_images/pixel_art_littr_bin_interior.png";

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
      <div className="littr-dashboard flex flex-col items-center justify-center p-6 safe-top safe-bottom">
        {/* Background Image */}
        <div className="absolute inset-0 opacity-20">
          <img 
            src={pixelBinImage} 
            alt="" 
            className="w-full h-full object-cover pixel-image"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--littr-midnight)]/80 to-[var(--littr-midnight)]" />
        
        <div className="relative z-10 text-center max-w-sm">
          <div className="w-20 h-20 littr-gradient-green rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse-glow">
            <Recycle className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">LITTR</h1>
          <p className="text-gray-400 mb-8">Recycling Made Rewarding</p>
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
            className="w-full mt-3 text-gray-400 hover:text-white hover:bg-white/5"
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
      {/* Nav Bar */}
      <div className="littr-nav px-4 py-3 safe-top">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 littr-gradient-green rounded-lg flex items-center justify-center">
              <Recycle className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">LITTR</h1>
              <p className="text-[10px] text-gray-500 truncate max-w-[120px]">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation('/app/change-password')}
            className="text-gray-400 hover:text-white hover:bg-white/5"
            data-testid="button-settings"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Points Balance - Hero Card */}
        <div className="littr-gradient-green rounded-2xl p-6 text-white relative overflow-hidden shadow-lg">
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
              <p className="text-green-300/60 text-xs mt-3 font-mono">
                ID: {customer.publicId}
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setLocation('/app/scan')}
            className="littr-card-solid p-4 text-center active:scale-[0.98] transition-transform"
            data-testid="button-scan-qr"
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <QrCode className="h-6 w-6 text-green-400" />
            </div>
            <p className="font-semibold text-sm text-white">Scan QR</p>
            <p className="text-xs text-gray-500">Claim points</p>
          </button>
          <button 
            onClick={() => setLocation('/app/store')}
            className="littr-card-solid p-4 text-center active:scale-[0.98] transition-transform"
            data-testid="button-store"
          >
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <ShoppingBag className="h-6 w-6 text-purple-400" />
            </div>
            <p className="font-semibold text-sm text-white">Store</p>
            <p className="text-xs text-gray-500">Get rewards</p>
          </button>
          <button 
            onClick={() => setLocation('/app/claim')}
            className="littr-card-solid p-4 text-center active:scale-[0.98] transition-transform"
            data-testid="button-manual-claim"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Gift className="h-6 w-6 text-blue-400" />
            </div>
            <p className="font-semibold text-sm text-white">Enter Code</p>
            <p className="text-xs text-gray-500">Manual claim</p>
          </button>
          <button 
            onClick={() => setLocation('/dropoff')}
            className="littr-card-solid p-4 text-center active:scale-[0.98] transition-transform"
            data-testid="button-find-bin"
          >
            <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <MapPin className="h-6 w-6 text-orange-400" />
            </div>
            <p className="font-semibold text-sm text-white">Find Bin</p>
            <p className="text-xs text-gray-500">Near you</p>
          </button>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-white font-semibold">Recent Activity</h2>
          </div>
          <div className="littr-list">
            {transactions.slice(0, 5).map((tx: any) => (
              <div 
                key={tx.id} 
                className="littr-list-item"
                data-testid={`transaction-${tx.id}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  {tx.amount > 0 ? (
                    <Recycle className="h-5 w-5 text-green-400" />
                  ) : (
                    <ShoppingBag className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{tx.description || tx.type}</p>
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
              <div className="p-8 text-center">
                <Recycle className="h-12 w-12 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm">No activity yet</p>
                <p className="text-gray-500 text-xs mt-1">Recycle to earn points!</p>
              </div>
            )}
          </div>
        </div>

        {/* Redemptions */}
        {redemptions.length > 0 && (
          <div>
            <h2 className="text-white font-semibold mb-3">My Rewards</h2>
            <div className="littr-list">
              {redemptions.slice(0, 3).map((r: any) => (
                <div 
                  key={r.id} 
                  className="littr-list-item"
                  data-testid={`redemption-${r.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Gift className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Redemption #{r.id}</p>
                    <p className="text-xs text-gray-500">{r.pointsSpent} pts</p>
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

      {/* Tab Bar */}
      <div className="littr-tab-bar">
        <button className="littr-tab-item active" onClick={() => setLocation('/app')}>
          <Wallet className="h-5 w-5" />
          <span>Wallet</span>
        </button>
        <button className="littr-tab-item" onClick={() => setLocation('/app/scan')}>
          <QrCode className="h-5 w-5" />
          <span>Scan</span>
        </button>
        <button className="littr-tab-item" onClick={() => setLocation('/app/store')}>
          <ShoppingBag className="h-5 w-5" />
          <span>Store</span>
        </button>
        <button className="littr-tab-item" onClick={() => setLocation('/dropoff')}>
          <MapPin className="h-5 w-5" />
          <span>Locations</span>
        </button>
        <button className="littr-tab-item" onClick={handleLogout} data-testid="button-logout">
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}
