import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function PartnerDashboard() {
  const { role, binRequests, logout } = useStore();
  const [, setLocation] = useLocation();

  if (role !== 'partner' && role !== 'admin') {
     return <div className="p-8">Access Denied. <Button variant="link" onClick={() => setLocation('/partner/login')}>Login</Button></div>;
  }

  // Partner sees only bin requests (simulating seeing their own, but for this mock seeing all is fine or filtered)
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black text-white p-4 flex justify-between items-center">
        <h1 className="font-bold">Partner Portal</h1>
        <Button variant="outline" size="sm" onClick={() => { logout(); setLocation('/'); }}>Logout</Button>
      </div>
      
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader><CardTitle>My Bin Requests</CardTitle></CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {binRequests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.id}</TableCell>
                    <TableCell><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Pending</span></TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {binRequests.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No active requests</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
