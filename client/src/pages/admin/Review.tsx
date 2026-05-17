import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

type ReviewDrop = {
  id: number;
  eventId: string | null;
  binId: number | null;
  shopId: number | null;
  verdictReason: string | null;
  verdictAccepted: boolean | null;
  verdictDecidedAt: string | null;
  aiConfidence: number | null;
  aiModelVersion: string | null;
  category: string;
  images: Array<{
    id: number;
    storageUrl: string;
    imageRole: string;
    classifierLabel: string | null;
    classifierConfidence: number | null;
    classifierVersion: string | null;
  }>;
};

const LABELS: Array<{ value: string; label: string; accept: boolean }> = [
  { value: "vape", label: "Vape (accept)", accept: true },
  { value: "thc_vape", label: "THC Vape", accept: false },
  { value: "not_a_vape", label: "Not a vape", accept: false },
  { value: "uncertain", label: "Uncertain (accept)", accept: true },
];

export default function AdminReview() {
  const { role } = useStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [notesById, setNotesById] = useState<Record<number, string>>({});
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data: queueResp, isLoading } = useQuery({
    queryKey: ["admin-review-queue", page],
    queryFn: async () => {
      const res = await apiRequest(`/api/admin/review?page=${page}&limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch queue");
      return res.json();
    },
    refetchInterval: 30000,
  });
  const pagination = queueResp?.pagination as { page: number; limit: number; total: number; totalPages: number } | undefined;

  const { data: budgetResp } = useQuery({
    queryKey: ["admin-review-budget"],
    queryFn: async () => {
      const res = await apiRequest("/api/admin/review/budget");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 60000,
  });

  const submit = useMutation({
    mutationFn: async (vars: { dropId: number; imageId: number | null; humanLabel: string; notes: string; acceptOverride: boolean }) => {
      const res = await apiRequest(`/api/admin/review/${vars.dropId}/correct`, {
        method: "POST",
        body: JSON.stringify({
          imageId: vars.imageId,
          correctedLabel: vars.humanLabel,
          notes: vars.notes,
          acceptOverride: vars.acceptOverride,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-review-queue"] });
    },
  });

  if (role !== "staff" && role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center mb-4">Staff access required</p>
            <Button onClick={() => setLocation("/staff/login")} data-testid="button-login">Staff Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const queue: ReviewDrop[] = queueResp?.data || [];
  const budget = budgetResp?.data;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/staff/dashboard")} data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Classifier Review Queue</h1>
          </div>
          {budget && (
            <Card className="w-auto">
              <CardContent className="py-3 px-4 flex gap-4 text-sm">
                <span data-testid="text-provider">Provider: <b>{budget.provider}</b></span>
                <span data-testid="text-budget">Today: <b>${budget.spentUsd.toFixed(4)}</b> / ${budget.capUsd.toFixed(2)}</span>
                <span>API key: <b>{budget.hasApiKey ? "yes" : "no"}</b></span>
              </CardContent>
            </Card>
          )}
        </div>

        {isLoading && <p data-testid="text-loading">Loading…</p>}
        {!isLoading && queue.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500" data-testid="text-empty">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
              Nothing needs review.
            </CardContent>
          </Card>
        )}

        {pagination && pagination.total > 0 && (
          <div className="flex items-center justify-between text-sm" data-testid="pagination-controls">
            <span data-testid="text-pagination-info">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded border disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="button-prev-page"
              >
                Previous
              </button>
              <button
                className="px-3 py-1 rounded border disabled:opacity-50"
                disabled={page >= (pagination.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
                data-testid="button-next-page"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {queue.map((drop) => {
          const primary = drop.images.find(i => i.imageRole === "after" || i.imageRole === "crop") || drop.images[0];
          return (
            <Card key={drop.id} data-testid={`card-review-${drop.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">
                      Drop #{drop.id}
                      {drop.eventId && <span className="ml-2 text-xs text-gray-500 font-normal">event {drop.eventId}</span>}
                    </CardTitle>
                    <CardDescription>
                      Bin {drop.binId ?? "?"} · Shop {drop.shopId ?? "?"} · {drop.verdictDecidedAt ? new Date(drop.verdictDecidedAt).toLocaleString() : ""}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" data-testid={`badge-reason-${drop.id}`}>{drop.verdictReason || "review"}</Badge>
                    {drop.verdictAccepted === false && (
                      <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />rejected</Badge>
                    )}
                    {drop.verdictAccepted === true && (
                      <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />accepted</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
                  {primary ? (
                    <img
                      src={primary.storageUrl}
                      alt="capture"
                      className="w-full max-w-[200px] rounded-lg border bg-black object-contain"
                      data-testid={`img-capture-${drop.id}`}
                    />
                  ) : (
                    <div className="w-full max-w-[200px] aspect-square rounded-lg border bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                  )}
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Model:</span>{" "}
                      <code data-testid={`text-model-${drop.id}`}>{primary?.classifierVersion || drop.aiModelVersion || "n/a"}</code>
                    </div>
                    <div>
                      <span className="text-gray-500">Label:</span>{" "}
                      <b data-testid={`text-label-${drop.id}`}>{primary?.classifierLabel || drop.category}</b>{" "}
                      <span className="text-gray-500">
                        ({primary?.classifierConfidence != null ? primary.classifierConfidence.toFixed(2) : drop.aiConfidence?.toFixed(2) ?? "?"})
                      </span>
                    </div>
                    <Textarea
                      placeholder="Notes (optional)"
                      value={notesById[drop.id] ?? ""}
                      onChange={(e) => setNotesById((s) => ({ ...s, [drop.id]: e.target.value }))}
                      className="text-sm"
                      rows={2}
                      data-testid={`textarea-notes-${drop.id}`}
                    />
                    <div className="flex flex-wrap gap-2 pt-2">
                      {LABELS.map((l) => (
                        <Button
                          key={l.value}
                          size="sm"
                          variant={l.accept ? "default" : "destructive"}
                          disabled={submit.isPending}
                          onClick={() =>
                            submit.mutate({
                              dropId: drop.id,
                              imageId: primary?.id ?? null,
                              humanLabel: l.value,
                              notes: notesById[drop.id] ?? "",
                              acceptOverride: l.accept,
                            })
                          }
                          data-testid={`button-label-${l.value}-${drop.id}`}
                        >
                          {l.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
