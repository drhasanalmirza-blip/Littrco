import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ShoppingBag, CheckCircle, Battery } from "lucide-react";
import { useState } from "react";

export default function StorePage() {
  const { user, role } = useStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [successItem, setSuccessItem] = useState<any>(null);

  const { data: walletData } = useQuery({
    queryKey: ['customer-wallet'],
    queryFn: async () => {
      const res = await apiRequest('/api/customer/wallet');
      if (!res.ok) throw new Error('Failed to fetch wallet');
      return res.json();
    },
    enabled: !!user,
  });

  const { data: storeItems = [], isLoading } = useQuery({
    queryKey: ['store-items'],
    queryFn: async () => {
      const res = await apiRequest('/api/customer/store');
      if (!res.ok) throw new Error('Failed to fetch store items');
      return res.json();
    },
    enabled: !!user,
  });

  const redeemItem = useMutation({
    mutationFn: async (storeItemId: number) => {
      setRedeemingId(storeItemId);
      const res = await apiRequest('/api/customer/redeem', {
        method: 'POST',
        body: JSON.stringify({ storeItemId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to redeem');
      }
      return res.json();
    },
    onSuccess: (data, storeItemId) => {
      queryClient.invalidateQueries({ queryKey: ['customer-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['customer-redemptions'] });
      const item = storeItems.find((i: any) => i.id === storeItemId);
      setSuccessItem(item);
      setRedeemingId(null);
    },
    onError: (error: any) => {
      alert(error.message);
      setRedeemingId(null);
    },
  });

  if (!user || role !== 'customer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please log in to view the store</p>
          <Button onClick={() => setLocation('/app/login')} className="bg-black text-white hover:bg-gray-800">Sign In</Button>
        </div>
      </div>
    );
  }

  const wallet = walletData?.wallet;

  if (successItem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">Redemption Requested!</h2>
          <p className="text-gray-500 mb-6">
            You've redeemed <span className="text-black font-semibold">{successItem.name}</span> for {successItem.pointsCost} batteries
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left border border-gray-100">
            <p className="text-gray-500 text-sm">
              Your reward will be delivered to your email within 24-48 hours. You can track the status in your wallet.
            </p>
          </div>
          <Button 
            onClick={() => { setSuccessItem(null); setLocation('/app'); }}
            className="w-full bg-black text-white hover:bg-gray-800 h-12 rounded-xl"
          >
            Back to Wallet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setLocation('/app')} className="text-gray-500 hover:text-black hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg text-black">Rewards Store</h1>
        </div>
        <div className="flex items-center gap-1.5 bg-black text-white px-3 py-1.5 rounded-full text-sm">
          <Battery className="h-3.5 w-3.5" />
          <span className="font-bold">{wallet?.pointsBalance || 0}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-gray-400 mb-6 text-center text-sm">
          Redeem your batteries for gift cards and rewards
        </p>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading rewards...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {storeItems.map((item: any) => (
              <div key={item.id} className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-black">{item.name}</h3>
                    {item.description && <p className="text-gray-400 text-sm mt-0.5">{item.description}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Battery className="h-4 w-4 text-green-600" />
                    <span className="font-bold text-black">{item.pointsCost}</span>
                    <span className="text-gray-400 text-sm">batteries</span>
                  </div>
                  <Button 
                    size="sm"
                    disabled={(wallet?.pointsBalance || 0) < item.pointsCost || redeemingId !== null}
                    onClick={() => redeemItem.mutate(item.id)}
                    className={(wallet?.pointsBalance || 0) >= item.pointsCost 
                      ? "bg-black text-white hover:bg-gray-800 rounded-lg" 
                      : "bg-gray-100 text-gray-400 cursor-not-allowed rounded-lg"
                    }
                    data-testid={`button-redeem-${item.id}`}
                  >
                    {redeemingId === item.id ? 'Redeeming...' : 'Redeem'}
                  </Button>
                </div>
                {(wallet?.pointsBalance || 0) < item.pointsCost && (
                  <p className="text-xs text-gray-400 mt-2">
                    Need {item.pointsCost - (wallet?.pointsBalance || 0)} more batteries
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {storeItems.length === 0 && !isLoading && (
          <div className="border border-gray-200 rounded-xl p-12 text-center">
            <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No rewards available yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
