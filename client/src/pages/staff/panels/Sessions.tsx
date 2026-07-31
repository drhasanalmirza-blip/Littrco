import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiJson";
import { apiRequest } from "@/lib/store";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Download, ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";

const LIMIT = 50;

type SessionStatus = "OPEN" | "FINALIZED" | "CLAIMED" | "EXPIRED" | "all";
type ClaimedFilter = "any" | "true" | "false";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: "bg-blue-600 hover:bg-blue-600 text-white",
    FINALIZED: "bg-green-600 hover:bg-green-600 text-white",
    CLAIMED: "bg-purple-600 hover:bg-purple-600 text-white",
  };
  if (status === "EXPIRED") return <Badge variant="secondary">EXPIRED</Badge>;
  if (map[status]) return <Badge className={map[status]}>{status}</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function Sessions({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();

  const [status, setStatus] = useState<SessionStatus>("all");
  const [claimed, setClaimed] = useState<ClaimedFilter>("any");
  const [shopId, setShopId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);

  const resetPage = () => setOffset(0);

  const params = new URLSearchParams();
  params.set("status", status);
  if (claimed !== "any") params.set("claimed", claimed);
  if (shopId.trim()) params.set("shopId", shopId.trim());
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("limit", String(LIMIT));
  params.set("offset", String(offset));
  const sessionsUrl = `/api/staff/sessions?${params.toString()}`;

  const { data: rows = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: [sessionsUrl],
    queryFn: () => apiJson<any[]>(sessionsUrl),
    enabled,
  });

  // Deleting a session takes its drops and self-reports with it (FK cascade)
  // AND the battery / shop-point rows it created, so the customer's balance
  // moves. The toast reports those counts rather than a bare "deleted" — a
  // silent balance change is the kind of thing nobody notices until it is a
  // support ticket.
  const describe = (res: any) =>
    `${res.sessions ?? 0} session${res.sessions === 1 ? "" : "s"}` +
    (res.batteryTx ? `, ${res.batteryTx} battery entr${res.batteryTx === 1 ? "y" : "ies"} reversed` : "") +
    (res.shopPointTx ? `, ${res.shopPointTx} shop-point entr${res.shopPointTx === 1 ? "y" : "ies"} reversed` : "");

  const deleteOne = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest(`/api/staff/sessions/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({} as any))).error || `HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: (res: any) => { toast({ title: "Session deleted", description: describe(res) }); refetch(); },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  // Bulk delete sends the SAME filters the table is showing, so "delete all"
  // always means "everything matching what is on screen" — including rows on
  // later pages, which is why the confirmation says so explicitly.
  const deleteAll = useMutation({
    mutationFn: async () => {
      const p = new URLSearchParams();
      p.set("status", status);
      if (claimed !== "any") p.set("claimed", claimed);
      if (shopId.trim()) p.set("shopId", shopId.trim());
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      p.set("confirm", "DELETE");
      const r = await apiRequest(`/api/staff/sessions?${p.toString()}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({} as any))).error || `HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: (res: any) => {
      toast({ title: "Sessions deleted", description: describe(res) });
      setOffset(0);
      refetch();
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  const filtered = status !== "all" || claimed !== "any" || !!shopId.trim() || !!from || !!to;

  const exportTraining = async () => {
    setExporting(true);
    try {
      // export/training only honours from / to / status
      const ep = new URLSearchParams();
      if (status !== "all") ep.set("status", status);
      if (from) ep.set("from", from);
      if (to) ep.set("to", to);
      const qs = ep.toString();
      const r = await apiRequest(`/api/staff/export/training${qs ? `?${qs}` : ""}`);
      if (!r.ok) {
        const msg = await r.json().catch(() => ({} as any));
        throw new Error(msg.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "littr-training.jsonl";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Training data exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Filter bar + export */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v as SessionStatus); resetPage(); }}>
              <SelectTrigger className="w-36" data-testid="select-session-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="FINALIZED">Finalized</SelectItem>
                <SelectItem value="CLAIMED">Claimed</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Claimed</Label>
            <Select value={claimed} onValueChange={(v) => { setClaimed(v as ClaimedFilter); resetPage(); }}>
              <SelectTrigger className="w-28" data-testid="select-session-claimed">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="true">Claimed</SelectItem>
                <SelectItem value="false">Unclaimed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Shop ID</Label>
            <Input
              className="w-28"
              inputMode="numeric"
              placeholder="any"
              value={shopId}
              onChange={(e) => { setShopId(e.target.value); resetPage(); }}
              data-testid="input-session-shop-id"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              className="w-40"
              value={from}
              onChange={(e) => { setFrom(e.target.value); resetPage(); }}
              data-testid="input-session-from"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              className="w-40"
              value={to}
              onChange={(e) => { setTo(e.target.value); resetPage(); }}
              data-testid="input-session-to"
            />
          </div>
          <div className="ml-auto flex gap-2">
            <Button onClick={exportTraining} disabled={exporting} data-testid="button-export-training">
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Export training data
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={deleteAll.isPending || rows.length === 0}
                  data-testid="button-delete-all-sessions"
                >
                  {deleteAll.isPending
                    ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    : <Trash2 className="h-4 w-4 mr-1" />}
                  Delete {filtered ? "filtered" : "all"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {filtered ? "every session matching these filters" : "EVERY session in the fleet"}?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2">
                      <p>
                        This is not limited to the {rows.length} rows on this page — it deletes
                        everything the current filters match, on every page.
                      </p>
                      <p>
                        Each session takes its drops (and their review-queue entries), self-reports,
                        and the battery / shop-point entries it awarded. <strong>Customer balances
                        will go down.</strong> Photo records survive but lose their session link.
                      </p>
                      <p>There is no undo.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAll.mutate()}
                    data-testid="button-delete-all-sessions-confirm"
                  >
                    Delete them
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Sessions table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Shop</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Det / Acc</TableHead>
                <TableHead>Batteries</TableHead>
                <TableHead>Claim</TableHead>
                <TableHead>Finalized</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-gray-500 py-8">No sessions match these filters.</TableCell></TableRow>
              ) : (
                rows.map((s) => (
                  <TableRow key={s.id} data-testid={`row-session-${s.id}`}>
                    <TableCell className="font-mono">{s.id}</TableCell>
                    <TableCell className="font-mono">{s.device?.serial ?? "—"}</TableCell>
                    <TableCell>{s.shop ? `${s.shop.name}${s.shop.city ? ` · ${s.shop.city}` : ""}` : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={s.status} />
                        {s.offline && (
                          <Badge
                            className="bg-amber-500 hover:bg-amber-500 text-white"
                            data-testid={`badge-session-offline-${s.id}`}
                          >
                            Offline
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{s.detectedDropCount ?? 0} / {s.acceptedDropCount ?? 0}</TableCell>
                    <TableCell>
                      {s.batteriesConfirmed ?? s.batteriesEstimated ?? 0}
                      {s.batteriesConfirmed == null && s.batteriesEstimated != null ? " (est)" : ""}
                    </TableCell>
                    <TableCell>
                      {s.claimed ? (
                        <Badge variant="secondary">claimed</Badge>
                      ) : (
                        <Badge variant="outline">unclaimed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {s.finalizedAt ? new Date(s.finalizedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            disabled={deleteOne.isPending}
                            data-testid={`button-delete-session-${s.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete session #{s.id}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Removes its {s.detectedDropCount ?? 0} drop
                              {(s.detectedDropCount ?? 0) === 1 ? "" : "s"} and review entries, and
                              reverses the {s.batteriesConfirmed ?? s.batteriesEstimated ?? 0} batteries
                              it awarded — the customer's balance will drop by that much. No undo.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteOne.mutate(s.id)}
                              data-testid={`button-delete-session-confirm-${s.id}`}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Showing {rows.length ? offset + 1 : 0}–{offset + rows.length}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0 || isLoading}
            onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            data-testid="button-session-prev"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length < LIMIT || isLoading}
            onClick={() => setOffset(offset + LIMIT)}
            data-testid="button-session-next"
          >
            Next<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
