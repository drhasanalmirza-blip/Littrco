import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Camera, AlertTriangle, Loader2 } from "lucide-react";

interface Device {
  id: number;
  serial: string;
  status: string;
  lastHeartbeatAt: string | null;
  latestPhotoUrl: string | null;
}

interface Photo {
  id: number;
  storageUrl: string;
  url?: string;
  reason: string;
  takenAt: string;
}

// A device is considered offline when its last heartbeat is older than this.
const OFFLINE_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 15; // ~30s total

const photoSrc = (p: Photo) => p.url || p.storageUrl;

export default function LiveCamera({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const [deviceId, setDeviceId] = useState<number | null>(null);
  const [ir, setIr] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [livePhotos, setLivePhotos] = useState<Photo[]>([]);
  const cancelRef = useRef(false);

  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: ["/api/staff/devices"],
    queryFn: () => apiJson<Device[]>("/api/staff/devices"),
    enabled,
    refetchInterval: 10000,
  });

  const device = devices.find((d) => d.id === deviceId) ?? null;

  // Auto-select the first device once the list loads.
  useEffect(() => {
    if (deviceId == null && devices.length > 0) setDeviceId(devices[0].id);
  }, [devices, deviceId]);

  // Cancel any in-flight poll loop on unmount / device change. We deliberately do
  // NOT reset cancelRef in the effect body — capture() resets it when a new capture
  // starts (see below). Resetting here would un-cancel a loop we just cancelled on a
  // device switch, letting the previous device's poll finish and render its photo
  // under the newly selected device.
  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, [deviceId]);

  const isOffline =
    !device?.lastHeartbeatAt ||
    Date.now() - new Date(device.lastHeartbeatAt).getTime() > OFFLINE_MS;

  async function capture() {
    if (!device) return;
    cancelRef.current = false;
    setCapturing(true);
    setLivePhotos([]);
    setStatusMsg("Sending capture command to the bin…");
    try {
      // Record the newest existing live photo so we only surface the fresh one.
      const existing = await apiJson<Photo[]>(
        `/api/staff/devices/${device.id}/photos?reason=live&limit=1`,
      );
      const lastId = existing[0]?.id ?? 0;

      await apiSend(`/api/staff/devices/${device.id}/snapshot`, "POST", { ir });
      setStatusMsg("Waiting for the bin to answer — this takes a few seconds…");

      let found = false;
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        if (cancelRef.current) return;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (cancelRef.current) return;
        const rows = await apiJson<Photo[]>(
          `/api/staff/devices/${device.id}/photos?reason=live&afterId=${lastId}`,
        );
        if (rows.length > 0) {
          setLivePhotos(rows);
          found = true;
          break;
        }
      }
      setStatusMsg(
        found
          ? ""
          : "No photo came back in time. The bin may be offline or busy — try again.",
      );
    } catch (e: any) {
      setStatusMsg(e?.message || "Capture failed");
      toast({ title: "Capture failed", description: e?.message, variant: "destructive" });
    } finally {
      setCapturing(false);
    }
  }

  const latest = livePhotos[0] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Camera</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500">Device</Label>
            <Select
              value={deviceId != null ? String(deviceId) : undefined}
              onValueChange={(v) => setDeviceId(Number(v))}
              disabled={capturing}
            >
              <SelectTrigger className="w-56" data-testid="select-live-device">
                <SelectValue placeholder="Pick a device…" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.serial}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <Switch checked={ir} onCheckedChange={setIr} data-testid="switch-ir" />
            <Label className="text-sm">IR / night mode</Label>
          </div>

          <Button
            onClick={capture}
            disabled={!device || capturing}
            data-testid="button-capture"
          >
            {capturing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-1" />
            )}
            Capture
          </Button>
        </div>

        {device && isOffline && (
          <div
            className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-300"
            data-testid="warning-offline"
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            This device looks offline (last heartbeat{" "}
            {device.lastHeartbeatAt
              ? new Date(device.lastHeartbeatAt).toLocaleString()
              : "never"}
            ). A capture may not be answered.
          </div>
        )}

        <p className="text-xs text-gray-500">
          The bin polls for commands, snaps a photo, and uploads it — expect a few
          seconds before the live image appears.
        </p>

        {statusMsg && (
          <p className="text-sm text-gray-600 dark:text-gray-400" data-testid="text-live-status">
            {statusMsg}
          </p>
        )}

        {/* Main preview: newest live photo, else the device's last known photo. */}
        <div className="rounded-lg border bg-gray-100 dark:bg-gray-900 overflow-hidden">
          {latest ? (
            <img
              src={photoSrc(latest)}
              alt="Live capture"
              className="w-full max-h-[480px] object-contain"
              data-testid="img-live-latest"
            />
          ) : device?.latestPhotoUrl ? (
            <div className="relative">
              <img
                src={device.latestPhotoUrl}
                alt="Last known photo"
                className="w-full max-h-[480px] object-contain"
                data-testid="img-live-preview"
              />
              <Badge variant="secondary" className="absolute top-2 left-2">
                Last known
              </Badge>
            </div>
          ) : (
            <div className="p-12 text-center text-sm text-gray-500">
              No photo yet. Pick a device and press Capture.
            </div>
          )}
        </div>

        {/* Strip of recent live photos */}
        {livePhotos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {livePhotos.map((p) => (
              <img
                key={p.id}
                src={photoSrc(p)}
                alt={`Live ${p.id}`}
                className="h-20 w-20 shrink-0 rounded border object-cover"
                data-testid={`img-live-strip-${p.id}`}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
