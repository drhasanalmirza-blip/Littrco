import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";

export default function StaffDashboard() {
  const { role, logout } = useStore();
  const [, setLocation] = useLocation();

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/contacts');
      if (!res.ok) throw new Error('Failed to fetch contacts');
      return res.json();
    },
  });

  const { data: binRequests = [] } = useQuery({
    queryKey: ['binRequests'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/bin-requests');
      if (!res.ok) throw new Error('Failed to fetch bin requests');
      return res.json();
    },
  });

  const { data: volunteers = [] } = useQuery({
    queryKey: ['volunteers'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/volunteers');
      if (!res.ok) throw new Error('Failed to fetch volunteers');
      return res.json();
    },
  });

  if (role !== 'staff' && role !== 'admin') {
     return <div className="p-8">Access Denied. <Button variant="link" onClick={() => setLocation('/staff/login')}>Login</Button></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black text-white p-4 flex justify-between items-center">
        <h1 className="font-bold">Staff Dashboard</h1>
        <Button variant="outline" size="sm" onClick={() => { logout(); setLocation('/'); }}>Logout</Button>
      </div>
      
      <div className="container mx-auto px-4 py-8 space-y-8">
         {/* Bin Requests */}
        <Card>
          <CardHeader><CardTitle>Bin Requests</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {binRequests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.businessName}</TableCell>
                    <TableCell>{r.contactPerson}<br/><span className="text-xs text-gray-500">{r.phone}</span></TableCell>
                    <TableCell>{r.address}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Contacts */}
            <Card>
            <CardHeader><CardTitle>Messages</CardTitle></CardHeader>
            <CardContent>
                <Table>
                <TableBody>
                    {contacts.map((c) => (
                    <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="truncate max-w-[150px]">{c.message}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
            </Card>

            {/* Volunteers */}
            <Card>
            <CardHeader><CardTitle>Volunteers</CardTitle></CardHeader>
            <CardContent>
                <Table>
                <TableBody>
                    {volunteers.map((v) => (
                    <TableRow key={v.id}>
                        <TableCell>{v.name}</TableCell>
                        <TableCell>{v.availability}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
