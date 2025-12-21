import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, ShoppingBag, CheckCircle } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
        <div className="text-center">
          <p className="text-white mb-4">Please log in to view the store</p>
          <Button 
            onClick={() => setLocation('/app/login')}
            className="bg-white text-black"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const wallet = walletData?.wallet;

  // Success screen after redemption
  if (successItem) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black p-4">
        <Card className="w-full max-w-md bg-gray-800 border-gray-700">
          <CardContent className="pt-8 text-center">
            <div className="bg-green-900/30 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Redemption Requested!</h2>
            <p className="text-gray-400 mb-6">
              You've redeemed <span className="text-white font-semibold">{successItem.name}</span> for {successItem.pointsCost} points
            </p>
            
            <div className="bg-gray-900 rounded-lg p-4 mb-6 text-left">
              <p className="text-gray-400 text-sm">
                Our team will process your redemption and contact you at your registered email. 
                You can track the status in your wallet.
              </p>
            </div>

            <Button 
              onClick={() => {
                setSuccessItem(null);
                setLocation('/app');
              }}
              className="w-full bg-white text-black hover:bg-gray-100"
            >
              Back to Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      {/* Header */}
      <div className="bg-black text-white p-4 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation('/app')}
            className="text-white hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-bold text-lg">Rewards Store</h1>
        </div>
        <div className="flex items-center gap-2 bg-gray-800 px-3 py-1.5 rounded-full">
          <Sparkles className="h-4 w-4 text-yellow-400" />
          <span className="font-bold">{wallet?.pointsBalance || 0}</span>
          <span className="text-gray-400 text-sm">pts</span>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <p className="text-gray-400 mb-6 text-center">
          Redeem your recycling points for eco-friendly rewards
        </p>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading rewards...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {storeItems.map((item: any) => (
              <Card key={item.id} className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-white text-lg">{item.name}</CardTitle>
                      {item.description && (
                        <CardDescription className="text-gray-400 mt-1">
                          {item.description}
                        </CardDescription>
                      )}
                    </div>
                    <ShoppingBag className="h-8 w-8 text-gray-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-yellow-400" />
                      <span className="font-bold text-white text-lg">{item.pointsCost}</span>
                      <span className="text-gray-500">pts</span>
                    </div>
                    <Button 
                      size="sm"
                      disabled={(wallet?.pointsBalance || 0) < item.pointsCost || redeemingId !== null}
                      onClick={() => redeemItem.mutate(item.id)}
                      className={
                        (wallet?.pointsBalance || 0) >= item.pointsCost 
                          ? "bg-white text-black hover:bg-gray-100" 
                          : "bg-gray-700 text-gray-500 cursor-not-allowed"
                      }
                      data-testid={`button-redeem-${item.id}`}
                    >
                      {redeemingId === item.id ? 'Redeeming...' : 'Redeem'}
                    </Button>
                  </div>
                  {(wallet?.pointsBalance || 0) < item.pointsCost && (
                    <p className="text-xs text-gray-500 mt-2">
                      Need {item.pointsCost - (wallet?.pointsBalance || 0)} more points
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {storeItems.length === 0 && !isLoading && (
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No rewards available yet. Check back soon!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
