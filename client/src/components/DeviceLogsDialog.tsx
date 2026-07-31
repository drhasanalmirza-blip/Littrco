import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiJson } from "@/lib/apiJson";
import { apiRequest } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollText, Copy, Check, Trash2, Loader2 } from "lucide-react";

// Per-bin diagnostic log viewer. The sensor ships its boot/wifi/temp/session
// diagnostics to the cloud (POST /api/device/logs); this reads them back so the
// operator — who has no serial/USB access to the bin — can see what the firmware
// is doing and paste it to support with one click.
//
// Works for both dashboards via `basePath`:
//   staff   → "/api/staff/devices"
//   partner → "/api/partner/devices"
export interface DeviceLog {
  id: number;
  seq: number;
  bootId: number;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  tag: string;
  msg: string;
  createdAt: string;
}

type Filter = "all" | "warn" | "error";

const LEVEL_TONE: Record<DeviceLog["level"], string> = {
  DEBUG: "text-muted-foreground",
  INFO: "text-foreground",
  WARN: "text-amber-600 dark:text-amber-400",
  ERROR: "text-red-600 dark:text-red-400",
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString([], { hour12: false });
}

function passesFilter(level: DeviceLog["level"], f: Filter): boolean {
  if (f === "all") return true;
  if (f === "warn") return level === "WARN" || level === "ERROR";
  return level === "ERROR";
}

export default function DeviceLogsDialog({
  deviceId,
  deviceName,
  basePath,
}: {
  deviceId: number;
  deviceName: string;
  basePath: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const url = `${basePath}/${deviceId}/logs?limit=400`;

  const { data: logs = [], isLoading, error, refetch } = useQuery<DeviceLog[]>({
    queryKey: [url],
    queryFn: () => apiJson<DeviceLog[]>(url),
    enabled: open,
    refetchInterval: open ? 4000 : false,
  });

  // Clears the SERVER's copy. The bin keeps its own ring buffer and keeps
  // shipping, so the console refills with genuinely new lines within seconds —
  // which is the point: a clean slate to reproduce a fault against, rather than
  // hunting for the moment it started somewhere in 400 lines of history.
  const clearLogs = useMutation({
    mutationFn: async () => {
      const r = await apiRequest(`${basePath}/${deviceId}/logs`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({} as any))).error || `HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: (res: any) => {
      toast({ title: `Cleared ${res.deleted ?? 0} log lines`, description: "New lines will appear as the bin reports them." });
      refetch();
    },
    onError: (e: any) => toast({ title: "Couldn't clear logs", description: e.message, variant: "destructive" }),
  });

  const shown = useMemo(() => logs.filter((l) => passesFilter(l.level, filter)), [logs, filter]);
  const newestId = shown.length ? shown[shown.length - 1].id : 0;

  // Auto-scroll to the newest line as logs stream in. Keyed on the newest id (not
  // just count) so it keeps following even after the buffer hits its cap.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newestId, open]);

  const copyAll = async () => {
    const text = shown
      .map((l) => `${fmtTime(l.createdAt)} [${l.level}] ${l.tag ? l.tag + ": " : ""}${l.msg}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text || "(no logs)");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Select the text manually.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" data-testid={`button-logs-${deviceId}`}>
          <ScrollText className="mr-1 h-4 w-4" /> Logs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bin logs — {deviceName}</DialogTitle>
          <DialogDescription>
            Live diagnostics streamed from the bin. Use <span className="font-medium">Copy</span> to
            paste them to support.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {(["all", "warn", "error"] as Filter[]).map((f) => (
              <Button
                key={f}
                size="sm"
                variant={filter === f ? "default" : "outline"}
                onClick={() => setFilter(f)}
                data-testid={`button-log-filter-${f}`}
              >
                {f === "all" ? "All" : f === "warn" ? "Warn+" : "Errors"}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{shown.length} lines</span>
            <Button size="sm" variant="outline" onClick={copyAll} data-testid={`button-log-copy-${deviceId}`}>
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={clearLogs.isPending || logs.length === 0}
                  data-testid={`button-log-clear-${deviceId}`}
                >
                  {clearLogs.isPending
                    ? <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    : <Trash2 className="mr-1 h-4 w-4" />}
                  Clear
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear stored logs for {deviceName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deletes all {logs.length} stored lines for this bin. The bin keeps logging —
                    new lines start arriving again within seconds. Copy anything you still need first;
                    this can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => clearLogs.mutate()}
                    data-testid={`button-log-clear-confirm-${deviceId}`}
                  >
                    Clear logs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="h-[55vh] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed"
          data-testid={`log-console-${deviceId}`}
        >
          {error ? (
            <div className="text-red-600 dark:text-red-400">Could not load logs: {(error as Error).message}</div>
          ) : isLoading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="text-muted-foreground">
              No logs yet — the bin sends diagnostics once it's online and paired.
            </div>
          ) : (
            shown.map((l) => (
              <div key={l.id} className="flex gap-2 whitespace-pre-wrap break-words">
                <span className="flex-none text-muted-foreground">{fmtTime(l.createdAt)}</span>
                <span className={`flex-none font-semibold ${LEVEL_TONE[l.level]}`}>{l.level}</span>
                {l.tag && <Badge variant="outline" className="h-4 flex-none px-1 py-0 text-[10px]">{l.tag}</Badge>}
                <span className={`min-w-0 ${LEVEL_TONE[l.level]}`}>{l.msg}</span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
