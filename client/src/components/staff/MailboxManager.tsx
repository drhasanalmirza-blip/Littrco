import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Mail, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/store";
import type { QueryClient } from "@tanstack/react-query";

interface Mailbox {
  id: number;
  userId: string;
  emailAddress: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
  user?: { id: string; email: string; role: string } | null;
}

interface MailboxManagerProps {
  mailboxes: Mailbox[];
  queryClient: QueryClient;
}

export function MailboxManager({ mailboxes, queryClient }: MailboxManagerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [displayName, setDisplayName] = useState('');

  const createMailbox = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/staff/mailboxes', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          emailAddress: `${emailPrefix}@littr.co`,
          displayName,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create mailbox');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
      setCreateOpen(false);
      setUserId('');
      setEmailPrefix('');
      setDisplayName('');
    },
  });

  const deleteMailbox = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest(`/api/staff/mailboxes/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete mailbox');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-500">{mailboxes.length} accounts</div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-create-mailbox">
              <Plus className="h-4 w-4 mr-2" />
              New Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Staff Email Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="mailbox-user-id">Staff User ID</Label>
                <Input 
                  id="mailbox-user-id"
                  placeholder="Enter user ID (from staff table)" 
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  data-testid="input-mailbox-userid"
                />
                <p className="text-xs text-gray-500 mt-1">The user must have STAFF role</p>
              </div>
              <div>
                <Label htmlFor="mailbox-email">Email Address</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    id="mailbox-email"
                    placeholder="username" 
                    value={emailPrefix}
                    onChange={(e) => setEmailPrefix(e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, ''))}
                    data-testid="input-mailbox-email"
                  />
                  <span className="text-gray-500 text-nowrap">@littr.co</span>
                </div>
              </div>
              <div>
                <Label htmlFor="mailbox-display-name">Display Name</Label>
                <Input 
                  id="mailbox-display-name"
                  placeholder="e.g., John Smith" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  data-testid="input-mailbox-display-name"
                />
              </div>
              <Button 
                onClick={() => createMailbox.mutate()}
                disabled={!userId || !emailPrefix || !displayName || createMailbox.isPending}
                className="w-full"
                data-testid="button-submit-mailbox"
              >
                {createMailbox.isPending ? 'Creating...' : 'Create Account'}
              </Button>
              {createMailbox.isError && (
                <p className="text-red-500 text-sm">{(createMailbox.error as Error).message}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {mailboxes.length === 0 ? (
        <div className="text-center py-8">
          <Mail className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No email accounts yet</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {mailboxes.map((m) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-700 hover:border-gray-500">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{m.displayName}</span>
                  {m.isActive ? (
                    <Badge variant="outline" className="text-green-400 border-green-400 text-xs">
                      <CheckCircle className="h-3 w-3 mr-1" /> Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-400 text-xs">Inactive</Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500">{m.emailAddress}</p>
                {m.user && <p className="text-xs text-gray-600">Login: {m.user.email}</p>}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                onClick={() => deleteMailbox.mutate(m.id)}
                disabled={deleteMailbox.isPending}
                data-testid={`button-delete-mailbox-${m.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
