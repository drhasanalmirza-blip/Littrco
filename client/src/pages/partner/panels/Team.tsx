import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, Copy, Check } from "lucide-react";

type ShopRole = "OWNER" | "MANAGER" | "VIEWER";

interface Member {
  userId: string;
  email: string;
  role: ShopRole;
  createdAt: string;
}
interface Invite {
  id: number;
  email: string;
  role: ShopRole;
  token?: string;
  expiresAt: string;
  createdAt?: string;
  acceptUrl?: string;
}

const ROLE_HELP: Record<ShopRole, string> = {
  OWNER: "Full access — manage bins, rewards, team, and billing.",
  MANAGER: "Manage bins and rewards. Cannot manage the team.",
  VIEWER: "Read-only. Can view bins, activity, and alerts.",
};

function roleBadgeVariant(role: ShopRole): "default" | "secondary" | "outline" {
  if (role === "OWNER") return "default";
  if (role === "MANAGER") return "secondary";
  return "outline";
}

export default function Team({ shopId, enabled }: { shopId: number; enabled: boolean }) {
  const { user, role } = useStore();
  const { toast } = useToast();
  const qc = useQueryClient();
  const gated = enabled && shopId > 0;

  const membersUrl = `/api/partner/shops/${shopId}/members`;
  const invitesUrl = `/api/partner/shops/${shopId}/invites`;

  const { data: members = [], isLoading: membersLoading } = useQuery<Member[]>({
    queryKey: [membersUrl],
    queryFn: () => apiJson<Member[]>(membersUrl),
    enabled: gated,
  });

  const isStaff = role === "staff";
  const myRole = members.find((m) => m.email === user?.email)?.role;
  const isOwner = isStaff || myRole === "OWNER";

  const { data: invites = [] } = useQuery<Invite[]>({
    queryKey: [invitesUrl],
    queryFn: () => apiJson<Invite[]>(invitesUrl),
    enabled: gated && isOwner,
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ShopRole>("MANAGER");
  const [lastInvite, setLastInvite] = useState<{ email: string; acceptUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const inviteMut = useMutation({
    mutationFn: (vars: { email: string; role: ShopRole }) =>
      apiSend<Invite>(invitesUrl, "POST", vars),
    onSuccess: (data) => {
      toast({ title: "Invite created", description: `Sent to ${data.email}.` });
      if (data.acceptUrl) setLastInvite({ email: data.email, acceptUrl: data.acceptUrl });
      setInviteEmail("");
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: [invitesUrl] });
    },
    onError: (e: any) =>
      toast({ title: "Failed to invite", description: e?.message, variant: "destructive" }),
  });

  const deleteInviteMut = useMutation({
    mutationFn: (inviteId: number) => apiSend(`${invitesUrl}/${inviteId}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Invite revoked" });
      qc.invalidateQueries({ queryKey: [invitesUrl] });
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const changeRoleMut = useMutation({
    mutationFn: (vars: { userId: string; role: ShopRole }) =>
      apiSend(`${membersUrl}/${vars.userId}`, "PATCH", { role: vars.role }),
    onSuccess: () => {
      toast({ title: "Role updated" });
      qc.invalidateQueries({ queryKey: [membersUrl] });
    },
    onError: (e: any) =>
      toast({ title: "Failed to update role", description: e?.message, variant: "destructive" }),
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) => apiSend(`${membersUrl}/${userId}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Member removed" });
      qc.invalidateQueries({ queryKey: [membersUrl] });
    },
    onError: (e: any) =>
      toast({ title: "Failed to remove", description: e?.message, variant: "destructive" }),
  });

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Copy the link manually.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Team Members</CardTitle>
          {isOwner && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-green-500 text-white hover:bg-green-600" data-testid="button-add-member">
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Add member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a team member</DialogTitle>
                  <DialogDescription>
                    Enter your employee's email and pick their access level. If they already have a
                    LITTR account, accepting the invite converts it to this role; otherwise they can
                    create one with the same email first.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label htmlFor="invite-email" className="text-sm">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="teammate@example.com"
                      data-testid="input-invite-email"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as ShopRole)}>
                      <SelectTrigger className="w-full" data-testid="select-invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OWNER">Owner</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="VIEWER">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1.5 text-xs text-muted-foreground">{ROLE_HELP[inviteRole]}</p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => inviteMut.mutate({ email: inviteEmail.trim(), role: inviteRole })}
                    disabled={inviteMut.isPending || inviteEmail.trim() === ""}
                    data-testid="button-send-invite"
                  >
                    <UserPlus className="mr-1 h-4 w-4" />
                    {inviteMut.isPending ? "Sending…" : "Send invite"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500">No members yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  {isOwner && <TableHead className="text-right">Manage</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.userId} data-testid={`row-member-${m.userId}`}>
                    <TableCell className="font-medium">
                      {m.email}
                      {m.email === user?.email && (
                        <span className="ml-2 text-xs text-gray-400">(you)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOwner ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) => changeRoleMut.mutate({ userId: m.userId, role: v as ShopRole })}
                        >
                          <SelectTrigger className="w-32" data-testid={`select-role-${m.userId}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OWNER">Owner</SelectItem>
                            <SelectItem value="MANAGER">Manager</SelectItem>
                            <SelectItem value="VIEWER">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={roleBadgeVariant(m.role)}>{m.role}</Badge>
                      )}
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <RemoveMemberDialog
                          member={m}
                          onConfirm={() => removeMemberMut.mutate(m.userId)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="mt-4 grid gap-1 text-xs text-gray-500 sm:grid-cols-3">
            {(Object.keys(ROLE_HELP) as ShopRole[]).map((r) => (
              <div key={r}>
                <span className="font-semibold text-gray-600 dark:text-gray-300">{r}:</span> {ROLE_HELP[r]}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Owner-only: last invite link + pending invites */}
      {isOwner && (
        <>
          {lastInvite && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <div className="text-sm font-medium">Invite link for {lastInvite.email}</div>
              <div className="mt-2 flex items-center gap-2">
                <Input readOnly value={lastInvite.acceptUrl} className="font-mono text-xs" data-testid="input-accept-url" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyUrl(lastInvite.acceptUrl)}
                  data-testid="button-copy-accept-url"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Share this link with the invitee. They accept it while signed in to their LITTR account.
              </p>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Pending Invites</CardTitle>
            </CardHeader>
            <CardContent>
              {invites.length === 0 ? (
                <p className="text-sm text-gray-500">No pending invites.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((inv) => (
                      <TableRow key={inv.id} data-testid={`row-invite-${inv.id}`}>
                        <TableCell className="font-medium">{inv.email}</TableCell>
                        <TableCell><Badge variant={roleBadgeVariant(inv.role)}>{inv.role}</Badge></TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {inv.expiresAt ? new Date(inv.expiresAt).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => deleteInviteMut.mutate(inv.id)}
                            disabled={deleteInviteMut.isPending}
                            data-testid={`button-delete-invite-${inv.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function RemoveMemberDialog({
  member,
  onConfirm,
}: {
  member: Member;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-600 hover:text-red-700"
          data-testid={`button-remove-member-${member.userId}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {member.email}?</AlertDialogTitle>
          <AlertDialogDescription>
            They will immediately lose access to this shop. You can re-invite them later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-remove">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 text-white hover:bg-red-700"
            data-testid="button-confirm-remove"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
