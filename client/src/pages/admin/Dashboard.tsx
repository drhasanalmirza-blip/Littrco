import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminDashboard() {
  const { role, contacts, binRequests, volunteers, logout } = useStore();
  const [, setLocation] = useLocation();

  if (role !== 'admin') {
    return <div className="p-8">Access Denied. <Button variant="link" onClick={() => setLocation('/admin/login')}>Login</Button></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-black text-white p-4 flex justify-between items-center">
        <h1 className="font-bold">Admin Dashboard</h1>
        <Button variant="outline" size="sm" onClick={() => { logout(); setLocation('/'); }}>Logout</Button>
      </div>
      
      <div className="container mx-auto px-4 py-8 space-y-8">
        
        {/* Bin Requests */}
        <Card>
          <CardHeader><CardTitle>Bin Requests ({binRequests.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {binRequests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.businessName}</TableCell>
                    <TableCell>{r.contactPerson}<br/><span className="text-xs text-gray-500">{r.email}</span></TableCell>
                    <TableCell>{r.volume}</TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {binRequests.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No requests yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader><CardTitle>Messages ({contacts.length})</CardTitle></CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}<br/><span className="text-xs text-gray-500">{c.email}</span></TableCell>
                    <TableCell className="truncate max-w-md">{c.message}</TableCell>
                    <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                 {contacts.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No messages yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Volunteers */}
        <Card>
          <CardHeader><CardTitle>Volunteers ({volunteers.length})</CardTitle></CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead>Availability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volunteers.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.name}<br/><span className="text-xs text-gray-500">{v.email}</span></TableCell>
                    <TableCell>{v.interest}</TableCell>
                    <TableCell>{v.availability}</TableCell>
                  </TableRow>
                ))}
                {volunteers.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No volunteers yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
