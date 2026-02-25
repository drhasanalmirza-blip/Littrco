import { useState } from "react";
import { useStore, apiRequest } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Recycle, ArrowLeft, AlertTriangle, CheckCircle, Clock, XCircle,
  ChevronRight, Battery, Send, X, Tag
} from "lucide-react";

type DropStatus = "awaiting_ai" | "approved" | "denied" | "appealed" | "corrected";

interface DropItem {
  id: number;
  binId: number | null;
  shopId: number | null;
  userId: string | null;
  status: DropStatus;
  category: string;
  brand: string | null;
  subtype: string | null;
  flavor: string | null;
  weightGrams: number | null;
  pointsAwarded: number;
  aiConfidence: number | null;
  createdAt: string;
  images?: { id: number; imageRole: string; storageUrl: string }[];
  appeals?: { id: number; type: string; payloadJson: any; resolution: string | null; createdAt: string }[];
}

const STATUS_CONFIG: Record<DropStatus, { label: string; icon: typeof CheckCircle; badgeClass: string; color: string }> = {
  approved: { label: "Approved", icon: CheckCircle, badgeClass: "littr-badge-green", color: "text-green-600" },
  denied: { label: "Denied", icon: XCircle, badgeClass: "littr-badge-red", color: "text-red-600" },
  appealed: { label: "Appealed", icon: AlertTriangle, badgeClass: "littr-badge-yellow", color: "text-yellow-600" },
  awaiting_ai: { label: "Processing", icon: Clock, badgeClass: "littr-badge-yellow", color: "text-yellow-600" },
  corrected: { label: "Corrected", icon: CheckCircle, badgeClass: "littr-badge-green", color: "text-green-600" },
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "appealed", label: "Appealed" },
  { value: "awaiting_ai", label: "Processing" },
  { value: "corrected", label: "Corrected" },
];

export default function DropsPage() {
  const { user, role } = useStore();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDrop, setSelectedDrop] = useState<DropItem | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [showSelfReport, setShowSelfReport] = useState(false);
  const [selfReport, setSelfReport] = useState({ brand: "", subtype: "", flavor: "" });

  const { data: dropsData, isLoading } = useQuery({
    queryKey: ["customer-drops", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "100" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await apiRequest(`/api/app/drops?${params}`);
      if (!res.ok) throw new Error("Failed to fetch drops");
      return res.json();
    },
    enabled: !!user,
  });

  const { data: dropDetail } = useQuery({
    queryKey: ["customer-drop-detail", selectedDrop?.id],
    queryFn: async () => {
      const res = await apiRequest(`/api/app/drops/${selectedDrop!.id}`);
      if (!res.ok) throw new Error("Failed to fetch drop detail");
      return res.json();
    },
    enabled: !!selectedDrop,
  });

  const appealMutation = useMutation({
    mutationFn: async ({ dropId, reason }: { dropId: number; reason: string }) => {
      const res = await apiRequest(`/api/app/drops/${dropId}/appeal`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error("Failed to submit appeal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-drops"] });
      queryClient.invalidateQueries({ queryKey: ["customer-drop-detail"] });
      setShowAppealForm(false);
      setAppealReason("");
    },
  });

  const selfReportMutation = useMutation({
    mutationFn: async ({ dropId, brand, subtype, flavor }: { dropId: number; brand: string; subtype: string; flavor: string }) => {
      const res = await apiRequest(`/api/app/drops/${dropId}/self-report`, {
        method: "POST",
        body: JSON.stringify({ brand, subtype, flavor }),
      });
      if (!res.ok) throw new Error("Failed to submit self-report");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-drops"] });
      queryClient.invalidateQueries({ queryKey: ["customer-drop-detail"] });
      setShowSelfReport(false);
      setSelfReport({ brand: "", subtype: "", flavor: "" });
    },
  });

  if (!user || role !== "customer") {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Recycle className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-black dark:text-white mb-1 tracking-tight">LITTR</h1>
          <p className="text-gray-400 mb-8 text-sm">Sign in to view your drops</p>
          <Button
            onClick={() => setLocation("/app/login")}
            className="littr-btn littr-btn-primary w-full text-base"
            data-testid="button-login"
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const drops: DropItem[] = dropsData?.data || [];
  const detail: DropItem | null = dropDetail?.data || null;

  if (selectedDrop) {
    const drop = detail || selectedDrop;
    const config = STATUS_CONFIG[drop.status];
    const StatusIcon = config.icon;
    const hasAppeals = drop.appeals && drop.appeals.length > 0;
    const canAppeal = drop.status === "denied" && !hasAppeals;
    const canSelfReport = drop.status === "approved" && !hasAppeals;

    return (
      <div className="littr-dashboard pb-24">
        <div className="littr-nav px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedDrop(null); setShowAppealForm(false); setShowSelfReport(false); }}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
            </button>
            <h1 className="font-bold text-black dark:text-white text-sm tracking-tight">Drop #{drop.id}</h1>
          </div>
        </div>

        <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">
          <div className="littr-card-solid p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 ${config.color}`} />
                <span className={`littr-badge ${config.badgeClass}`} data-testid="text-drop-status">
                  {config.label}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(drop.createdAt).toLocaleDateString()}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Category</span>
                <span className="text-sm font-medium text-black dark:text-white" data-testid="text-drop-category">{drop.category}</span>
              </div>
              {drop.brand && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Brand</span>
                  <span className="text-sm font-medium text-black dark:text-white" data-testid="text-drop-brand">{drop.brand}</span>
                </div>
              )}
              {drop.subtype && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Subtype</span>
                  <span className="text-sm font-medium text-black dark:text-white" data-testid="text-drop-subtype">{drop.subtype}</span>
                </div>
              )}
              {drop.flavor && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Flavor</span>
                  <span className="text-sm font-medium text-black dark:text-white" data-testid="text-drop-flavor">{drop.flavor}</span>
                </div>
              )}
              {drop.weightGrams != null && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Weight</span>
                  <span className="text-sm font-medium text-black dark:text-white">{drop.weightGrams}g</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">Points</span>
                <span className="text-sm font-bold text-green-600" data-testid="text-drop-points">+{drop.pointsAwarded}</span>
              </div>
              {drop.aiConfidence != null && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">AI Confidence</span>
                  <span className="text-sm font-medium text-black dark:text-white">{(drop.aiConfidence * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          </div>

          {drop.images && drop.images.length > 0 && (
            <div className="littr-card-solid p-4">
              <h3 className="text-sm font-semibold text-black dark:text-white mb-3">Images</h3>
              <div className="grid grid-cols-2 gap-2">
                {drop.images.map((img: any) => (
                  <div key={img.id} className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 aspect-square">
                    <img src={img.storageUrl} alt={img.imageRole} className="w-full h-full object-cover" data-testid={`img-drop-${img.imageRole}-${img.id}`} />
                    <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                      {img.imageRole}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasAppeals && (
            <div className="littr-card-solid p-4">
              <h3 className="text-sm font-semibold text-black dark:text-white mb-3">Appeals & Reports</h3>
              <div className="space-y-2">
                {drop.appeals!.map((appeal: any) => (
                  <div key={appeal.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3" data-testid={`appeal-${appeal.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-black dark:text-white capitalize">
                        {appeal.type === "self_report" ? "Self Report" : "Appeal"}
                      </span>
                      <span className={`littr-badge ${appeal.resolution ? "littr-badge-green" : "littr-badge-yellow"}`}>
                        {appeal.resolution || "Pending"}
                      </span>
                    </div>
                    {appeal.payloadJson?.reason && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{appeal.payloadJson.reason}</p>
                    )}
                    {appeal.payloadJson?.brand && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Reported: {appeal.payloadJson.brand} {appeal.payloadJson.subtype && `/ ${appeal.payloadJson.subtype}`} {appeal.payloadJson.flavor && `/ ${appeal.payloadJson.flavor}`}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(appeal.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canAppeal && !showAppealForm && (
            <Button
              onClick={() => setShowAppealForm(true)}
              className="w-full bg-red-50 dark:bg-red-950 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 border border-red-200 dark:border-red-800"
              data-testid="button-start-appeal"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Appeal This Decision
            </Button>
          )}

          {showAppealForm && (
            <div className="littr-card-solid p-4 border-2 border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-black dark:text-white">Submit Appeal</h3>
                <button onClick={() => setShowAppealForm(false)} data-testid="button-cancel-appeal">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <textarea
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Explain why this drop was incorrectly classified..."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-black dark:text-white p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-green-500"
                data-testid="input-appeal-reason"
              />
              <Button
                onClick={() => appealMutation.mutate({ dropId: drop.id, reason: appealReason })}
                disabled={!appealReason.trim() || appealMutation.isPending}
                className="littr-btn littr-btn-primary w-full mt-3"
                data-testid="button-submit-appeal"
              >
                <Send className="h-4 w-4 mr-2" />
                {appealMutation.isPending ? "Submitting..." : "Submit Appeal"}
              </Button>
            </div>
          )}

          {canSelfReport && !showSelfReport && (
            <Button
              onClick={() => setShowSelfReport(true)}
              className="w-full bg-green-50 dark:bg-green-950 text-green-600 hover:bg-green-100 dark:hover:bg-green-900 border border-green-200 dark:border-green-800"
              data-testid="button-start-self-report"
            >
              <Tag className="h-4 w-4 mr-2" />
              Confirm Brand for Bonus Batteries
            </Button>
          )}

          {showSelfReport && (
            <div className="littr-card-solid p-4 border-2 border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-black dark:text-white">Self-Report Classification</h3>
                <button onClick={() => setShowSelfReport(false)} data-testid="button-cancel-self-report">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={selfReport.brand}
                  onChange={(e) => setSelfReport({ ...selfReport, brand: e.target.value })}
                  placeholder="Brand (e.g., Geek Bar)"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-black dark:text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  data-testid="input-self-report-brand"
                />
                <input
                  type="text"
                  value={selfReport.subtype}
                  onChange={(e) => setSelfReport({ ...selfReport, subtype: e.target.value })}
                  placeholder="Subtype (e.g., Pulse X)"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-black dark:text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  data-testid="input-self-report-subtype"
                />
                <input
                  type="text"
                  value={selfReport.flavor}
                  onChange={(e) => setSelfReport({ ...selfReport, flavor: e.target.value })}
                  placeholder="Flavor (e.g., Watermelon Ice)"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-black dark:text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  data-testid="input-self-report-flavor"
                />
              </div>
              <Button
                onClick={() => selfReportMutation.mutate({ dropId: drop.id, ...selfReport })}
                disabled={!selfReport.brand.trim() || selfReportMutation.isPending}
                className="littr-btn littr-btn-green w-full mt-3"
                data-testid="button-submit-self-report"
              >
                <Battery className="h-4 w-4 mr-2" />
                {selfReportMutation.isPending ? "Submitting..." : "Submit for Bonus"}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="littr-dashboard pb-24">
      <div className="littr-nav px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/app")}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </button>
          <div>
            <h1 className="font-bold text-black dark:text-white text-sm tracking-tight">My Drops</h1>
            <p className="text-[10px] text-gray-400">{drops.length} total drops</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === opt.value
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
              data-testid={`filter-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-2 max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto">
        {isLoading ? (
          <div className="p-8 text-center">
            <Clock className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3 animate-spin" />
            <p className="text-gray-500 text-sm">Loading drops...</p>
          </div>
        ) : drops.length === 0 ? (
          <div className="p-8 text-center">
            <Recycle className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 text-sm">No drops found</p>
            <p className="text-gray-400 text-xs mt-1">
              {statusFilter !== "all" ? "Try a different filter" : "Drop off vapes to see them here!"}
            </p>
          </div>
        ) : (
          <div className="littr-list">
            {drops.map((drop: DropItem) => {
              const config = STATUS_CONFIG[drop.status];
              const StatusIcon = config.icon;
              return (
                <button
                  key={drop.id}
                  onClick={() => setSelectedDrop(drop)}
                  className="littr-list-item w-full text-left"
                  data-testid={`drop-item-${drop.id}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    drop.status === "approved" || drop.status === "corrected"
                      ? "bg-green-50 dark:bg-green-950"
                      : drop.status === "denied"
                      ? "bg-red-50 dark:bg-red-950"
                      : "bg-yellow-50 dark:bg-yellow-950"
                  }`}>
                    <StatusIcon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-black dark:text-white truncate">
                        {drop.brand || drop.category}
                      </p>
                      <span className={`littr-badge ${config.badgeClass}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(drop.createdAt).toLocaleDateString()}
                      {drop.subtype && ` · ${drop.subtype}`}
                      {drop.flavor && ` · ${drop.flavor}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {drop.pointsAwarded > 0 && (
                      <span className="font-bold text-sm text-green-600">+{drop.pointsAwarded}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
