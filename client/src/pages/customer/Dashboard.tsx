import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, Gift, History, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function CustomerDashboard() {
  const { user, role, clearAuth } = useStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: walletData } = useQuery({
    queryKey: ['customer-wallet'],
    queryFn: async () => {
      const res = await apiRequest('/api/customer/wallet');
      if (!res.ok) throw new Error('Failed to fetch wallet');
      return res.json();
    },
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['customer-transactions'],
    queryFn: async () => {
      const res = await apiRequest('/api/customer/transactions');
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    },
  });

  const { data: storeItems = [] } = useQuery({
    queryKey: ['store-items'],
    queryFn: async () => {
      const res = await apiRequest('/api/customer/store');
      if (!res.ok) throw new Error('Failed to fetch store items');
      return res.json();
    },
  });

  const { data: redemptions = [] } = useQuery({
    queryKey: ['customer-redemptions'],
    queryFn: async () => {
      const res = await apiRequest('/api/customer/redemptions');
      if (!res.ok) throw new Error('Failed to fetch redemptions');
      return res.json();
    },
  });

  const redeemItem = useMutation({
    mutationFn: async (storeItemId: number) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['customer-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['customer-redemptions'] });
    },
    onError: (error: any) => {
      alert(error.message);
    },
  });

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    clearAuth();
    setLocation('/');
  };

  if (role !== 'customer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <p className="text-xl mb-4">Please log in to view your wallet</p>
          <Button onClick={() => setLocation('/app/login')}>Login</Button>
        </div>
      </div>
    );
  }

  const wallet = walletData?.wallet;
  const customer = walletData?.customer;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black text-white p-4 flex justify-between items-center">
        <div>
          <h1 className="font-bold text-lg">My Wallet</h1>
          <p className="text-sm text-gray-400">{user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
          Logout
        </Button>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="mb-8 bg-gradient-to-br from-black to-gray-800 text-white">
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
              <p className="text-xs text-gray-500 mt-4">ID: {customer.publicId}</p>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="store" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="store" className="flex-1">
              <Gift className="h-4 w-4 mr-2" /> Rewards
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              <History className="h-4 w-4 mr-2" /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="store">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeItems.map((item: any) => (
                <Card key={item.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    {item.description && (
                      <CardDescription>{item.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        <span className="font-bold">{item.pointsCost}</span>
                        <span className="text-sm text-gray-500">points</span>
                      </div>
                      <Button 
                        size="sm"
                        disabled={(wallet?.pointsBalance || 0) < item.pointsCost || redeemItem.isPending}
                        onClick={() => redeemItem.mutate(item.id)}
                      >
                        {redeemItem.isPending ? 'Redeeming...' : 'Redeem'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {storeItems.length === 0 && (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center text-gray-500">
                    No rewards available yet. Check back soon!
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  {transactions.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <span className={tx.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </span>
                      </TableCell>
                      <TableCell>{tx.description || tx.type}</TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">
                        No transactions yet. Recycle at a LITTR location to earn points!
                      </TableCell>
                    </TableRow>
                  )}
                </Table>
              </CardContent>
            </Card>

            {redemptions.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>My Redemptions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    {redemptions.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>Redemption #{r.id}</TableCell>
                        <TableCell>{r.pointsSpent} pts</TableCell>
                        <TableCell>
                          <Badge variant={
                            r.status === 'FULFILLED' ? 'default' : 
                            r.status === 'PENDING' ? 'secondary' : 
                            'destructive'
                          }>
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
