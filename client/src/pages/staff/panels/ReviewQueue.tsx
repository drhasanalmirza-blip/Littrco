import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, X, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

const LIMIT = 50;

type ReviewStatus = "UNREVIEWED" | "APPROVED" | "REJECTED" | "all";

function ReviewStatusBadge({ status }: { status: string }) {
  if (status === "APPROVED")
    return <Badge className="bg-green-600 hover:bg-green-600 text-white">APPROVED</Badge>;
  if (status === "REJECTED")
    return <Badge variant="destructive">REJECTED</Badge>;
  return <Badge variant="secondary">UNREVIEWED</Badge>;
}

function PhotoPane({ url, label, testid }: { url: string | null; label: string; testid: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {url ? (
        <img
          src={url}
          alt={label}
          className="w-full h-40 object-cover rounded border bg-gray-100 dark:bg-gray-900"
          data-testid={testid}
        />
      ) : (
        <div
          className="w-full h-40 rounded border bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center text-gray-400 text-xs gap-1"
          data-testid={`${testid}-empty`}
        >
          <ImageOff className="h-5 w-5" />
          no photo
        </div>
      )}
    </div>
  );
}

export default function ReviewQueue({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [status, setStatus] = useState<ReviewStatus>("UNREVIEWED");
  const [deviceId, setDeviceId] = useState("");
  const [shopId, setShopId] = useState("");
  const [offset, setOffset] = useState(0);

  const [selectedDropId, setSelectedDropId] = useState<number | null>(null);
  const [rejectDropId, setRejectDropId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const params = new URLSearchParams();
  params.set("status", status);
  params.set("limit", String(LIMIT));
  params.set("offset", String(offset));
  if (deviceId.trim()) params.set("deviceId", deviceId.trim());
  if (shopId.trim()) params.set("shopId", shopId.trim());
  const queueUrl = `/api/staff/review/queue?${params.toString()}`;

  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: [queueUrl],
    queryFn: () => apiJson<any[]>(queueUrl),
    enabled,
    // Live view: global staleTime is Infinity, so poll so newly arrived unreviewed
    // drops surface without a manual filter change or reload.
    refetchInterval: 10000,
  });

  const { data: detail } = useQuery<any>({
    queryKey: [`/api/staff/review/drops/${selectedDropId}`],
    queryFn: () => apiJson(`/api/staff/review/drops/${selectedDropId}`),
    enabled: enabled && selectedDropId != null,
  });

  const invalidate = () => {
    qc.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/staff/review/queue"),
    });
    if (selectedDropId != null)
      qc.invalidateQueries({ queryKey: [`/api/staff/review/drops/${selectedDropId}`] });
  };

  const approve = useMutation({
    mutationFn: (dropId: number) =>
      apiSend(`/api/staff/review/drops/${dropId}/approve`, "POST"),
    onSuccess: () => {
      toast({ title: "Drop approved" });
      invalidate();
      setSelectedDropId(null);
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: ({ dropId, reason }: { dropId: number; reason: string }) =>
      apiSend(`/api/staff/review/drops/${dropId}/reject`, "POST", { reason }),
    onSuccess: () => {
      toast({ title: "Drop rejected" });
      invalidate();
      setRejectDropId(null);
      setRejectReason("");
      setSelectedDropId(null);
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const openReject = (dropId: number) => {
    setRejectReason("");
    setRejectDropId(dropId);
  };
  const busy = approve.isPending || reject.isPending;
  const reasonValid = rejectReason.trim().length >= 1 && rejectReason.trim().length <= 1000;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => { setStatus(v as ReviewStatus); setOffset(0); }}
            >
              <SelectTrigger className="w-40" data-testid="select-review-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNREVIEWED">Unreviewed</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Device ID</Label>
            <Input
              className="w-32"
              inputMode="numeric"
              placeholder="any"
              value={deviceId}
              onChange={(e) => { setDeviceId(e.target.value); setOffset(0); }}
              data-testid="input-review-device-id"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Shop ID</Label>
            <Input
              className="w-32"
              inputMode="numeric"
              placeholder="any"
              value={shopId}
              onChange={(e) => { setShopId(e.target.value); setOffset(0); }}
              data-testid="input-review-shop-id"
            />
          </div>
        </CardContent>
      </Card>

      {/* Queue */}
      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-gray-500">Loading…</CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-gray-500">No drops match these filters.</CardContent></Card>
      ) : (
        rows.map((r) => (
          <Card
            key={r.id}
            className="cursor-pointer hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
            onClick={() => setSelectedDropId(r.id)}
            data-testid={`card-drop-${r.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-semibold">{r.device?.serial ?? "—"}</span>
                    <ReviewStatusBadge status={r.reviewStatus} />
                    <Badge variant={r.accepted ? "default" : "outline"}>
                      {r.accepted ? "Accepted" : "Rejected by device"}
                    </Badge>
                    {r.session?.claimed ? (
                      <Badge variant="secondary">Claimed</Badge>
                    ) : (
                      <Badge variant="outline">Unclaimed</Badge>
                    )}
                    {r.session?.offline && (
                      <Badge
                        className="bg-amber-500 hover:bg-amber-500 text-white"
                        data-testid={`badge-offline-${r.id}`}
                      >
                        Offline
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {r.shop ? `${r.shop.name} · ${r.shop.city ?? "—"}` : "no shop"}
                    {" · drop #"}{r.sequence}
                    {" · taken "}{r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </div>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || r.reviewStatus === "APPROVED"}
                    onClick={() => approve.mutate(r.id)}
                    data-testid={`button-approve-${r.id}`}
                  >
                    <Check className="h-4 w-4 mr-1" />Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || r.reviewStatus === "REJECTED"}
                    onClick={() => openReject(r.id)}
                    data-testid={`button-reject-${r.id}`}
                  >
                    <X className="h-4 w-4 mr-1" />Reject
                  </Button>
                </div>
              </div>
              <div className="flex gap-3">
                <PhotoPane url={r.beforeUrl ?? null} label="Before" testid={`img-before-${r.id}`} />
                <PhotoPane url={r.afterUrl ?? null} label="After" testid={`img-after-${r.id}`} />
              </div>
            </CardContent>
          </Card>
        ))
      )}

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
            data-testid="button-review-prev"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length < LIMIT || isLoading}
            onClick={() => setOffset(offset + LIMIT)}
            data-testid="button-review-next"
          >
            Next<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={selectedDropId != null} onOpenChange={(o) => !o && setSelectedDropId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Drop #{selectedDropId}
              {detail?.drop && <> · <span className="align-middle"><ReviewStatusBadge status={detail.drop.reviewStatus} /></span></>}
            </DialogTitle>
          </DialogHeader>
          {!detail ? (
            <div className="py-8 text-center text-gray-500">Loading…</div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3">
                <PhotoPane url={detail.beforeUrl ?? null} label="Before" testid="img-detail-before" />
                <PhotoPane url={detail.afterUrl ?? null} label="After" testid="img-detail-after" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <Stat label="Device" value={detail.device?.serial ?? "—"} />
                <Stat label="Shop" value={detail.shop ? `${detail.shop.name} (${detail.shop.city ?? "—"})` : "—"} />
                <Stat label="Sequence" value={detail.drop?.sequence ?? "—"} />
                <Stat label="Accepted" value={detail.drop?.accepted ? "Yes" : "No"} />
                <Stat label="Fill" value={detail.drop?.fillPercent != null ? `${detail.drop.fillPercent}%` : "—"} />
                <Stat label="Temp" value={detail.drop?.tempC != null ? `${detail.drop.tempC}°C` : "—"} />
                <Stat label="VOC" value={detail.drop?.vocRaw ?? "—"} />
                <Stat label="Points revoked" value={detail.drop?.pointsRevoked ? "Yes" : "No"} />
                <Stat label="Taken" value={detail.drop?.createdAt ? new Date(detail.drop.createdAt).toLocaleString() : "—"} />
              </div>

              <div className="rounded border p-3 text-xs space-y-1">
                <div className="font-semibold text-sm mb-1 flex items-center gap-2">
                  Session #{detail.session?.id}
                  {detail.session?.offline && (
                    <Badge
                      className="bg-amber-500 hover:bg-amber-500 text-white"
                      data-testid="badge-detail-offline"
                    >
                      Offline
                    </Badge>
                  )}
                </div>
                <div>Status: <span className="font-medium">{detail.session?.status}</span></div>
                <div>Claim: {detail.session?.claimed ? `Claimed by ${detail.session.claimedByCustomerId}` : "Unclaimed"}</div>
                <div>Detected / Accepted: {detail.session?.detectedDropCount} / {detail.session?.acceptedDropCount}</div>
                <div>Batteries est/conf: {detail.session?.batteriesEstimated ?? "—"} / {detail.session?.batteriesConfirmed ?? "—"}</div>
                <div>Finalized: {detail.session?.finalizedAt ? new Date(detail.session.finalizedAt).toLocaleString() : "—"}</div>
              </div>

              {detail.selfReport && (
                <div className="rounded border p-3 text-xs space-y-1">
                  <div className="font-semibold text-sm mb-1">Self report</div>
                  <div>Brand / Model: {detail.selfReport.brand ?? "—"} / {detail.selfReport.model ?? "—"}</div>
                  <div>Puffs: {detail.selfReport.puffCount ?? "—"} · THC: {detail.selfReport.isThc ? "yes" : "no"}</div>
                  {detail.selfReport.notes && <div>Notes: {detail.selfReport.notes}</div>}
                </div>
              )}

              {detail.drop?.reviewNote && (
                <div className="rounded border border-red-300 dark:border-red-900 p-3 text-xs">
                  <span className="font-semibold">Reject reason: </span>{detail.drop.reviewNote}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={busy || detail?.drop?.reviewStatus === "REJECTED"}
              onClick={() => selectedDropId != null && openReject(selectedDropId)}
              data-testid="button-detail-reject"
            >
              <X className="h-4 w-4 mr-1" />Reject
            </Button>
            <Button
              disabled={busy || detail?.drop?.reviewStatus === "APPROVED"}
              onClick={() => selectedDropId != null && approve.mutate(selectedDropId)}
              data-testid="button-detail-approve"
            >
              <Check className="h-4 w-4 mr-1" />Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject reason dialog */}
      <Dialog open={rejectDropId != null} onOpenChange={(o) => { if (!o) { setRejectDropId(null); setRejectReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject drop #{rejectDropId}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason" className="text-xs">Reason (required, 1–1000 chars)</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Why is this drop being rejected? Points will be revoked."
              data-testid="input-reject-reason"
            />
            <div className="text-xs text-gray-500 text-right">{rejectReason.trim().length}/1000</div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setRejectDropId(null); setRejectReason(""); }}
              data-testid="button-reject-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reasonValid || reject.isPending}
              onClick={() => rejectDropId != null && reject.mutate({ dropId: rejectDropId, reason: rejectReason.trim() })}
              data-testid="button-reject-confirm"
            >
              Reject & revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-900 rounded p-2">
      <div className="text-gray-500">{label}</div>
      <div className="font-semibold break-words">{String(value)}</div>
    </div>
  );
}
