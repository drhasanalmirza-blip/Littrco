import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiJson";
import { apiRequest } from "@/lib/store";
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
import { Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

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

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: [sessionsUrl],
    queryFn: () => apiJson<any[]>(sessionsUrl),
    enabled,
  });

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
          <div className="ml-auto">
            <Button onClick={exportTraining} disabled={exporting} data-testid="button-export-training">
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Export training data
            </Button>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-8">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-500 py-8">No sessions match these filters.</TableCell></TableRow>
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
