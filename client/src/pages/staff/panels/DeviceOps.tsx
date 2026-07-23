import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { UploadCloud, Save } from "lucide-react";

interface Device {
  id: number;
  serial: string;
  status: string;
  firmwareVersion: string | null;
  targetFirmwareVersion: string | null;
  hmiVersion: string | null;
  assetsVersion: string | null;
  pointsPerVapeOverride: number | null;
}

interface Firmware {
  id: number;
  board: "sensor" | "hmi";
  version: string;
  channel: "stable" | "beta";
  active: boolean;
}

export default function DeviceOps({ enabled }: { enabled: boolean }) {
  const { data: devices = [], isLoading } = useQuery<Device[]>({
    queryKey: ["/api/staff/devices"],
    queryFn: () => apiJson<Device[]>("/api/staff/devices"),
    enabled,
    refetchInterval: 10000,
  });

  const { data: firmwares = [] } = useQuery<Firmware[]>({
    queryKey: ["/api/staff/firmware"],
    queryFn: () => apiJson<Firmware[]>("/api/staff/firmware"),
    enabled,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Operations</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-gray-500">No devices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>FW version</TableHead>
                  <TableHead>Points / vape override</TableHead>
                  <TableHead>OTA target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((d) => (
                  <DeviceOpsRow key={d.id} device={d} firmwares={firmwares} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceOpsRow({
  device,
  firmwares,
}: {
  device: Device;
  firmwares: Firmware[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [override, setOverride] = useState<string>(
    device.pointsPerVapeOverride != null ? String(device.pointsPerVapeOverride) : "",
  );
  const [otaBoard, setOtaBoard] = useState<"sensor" | "hmi">("sensor");
  const [otaVersion, setOtaVersion] = useState<string>(device.targetFirmwareVersion ?? "");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/staff/devices"] });

  const savePoints = useMutation({
    mutationFn: (value: number | null) =>
      apiSend(`/api/staff/devices/${device.id}/points-modifier`, "POST", {
        pointsPerVapeOverride: value,
      }),
    onSuccess: () => {
      toast({ title: "Points override saved" });
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const setOta = useMutation({
    mutationFn: ({ version, board }: { version: string | null; board: "sensor" | "hmi" }) =>
      apiSend(`/api/staff/devices/${device.id}/ota`, "POST", { version, board }),
    onSuccess: () => {
      toast({ title: "OTA target updated" });
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const updateAssets = useMutation({
    mutationFn: () =>
      apiSend(`/api/staff/devices/${device.id}/update-assets`, "POST", {}),
    onSuccess: () => {
      toast({ title: "Assets update queued" });
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  // Only offer firmware versions matching the selected OTA board.
  const boardFirmwares = firmwares.filter((f) => f.board === otaBoard);

  const onSavePoints = () => {
    const trimmed = override.trim();
    if (trimmed === "") {
      savePoints.mutate(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      toast({
        title: "Enter a value between 0 and 1000 (or blank for shop default)",
        variant: "destructive",
      });
      return;
    }
    savePoints.mutate(Math.round(n));
  };

  const targetMismatch =
    !!device.targetFirmwareVersion &&
    device.targetFirmwareVersion !== device.firmwareVersion;

  return (
    <TableRow data-testid={`row-deviceops-${device.id}`}>
      {/* Device */}
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-mono font-semibold">{device.serial}</span>
          <Badge variant={device.status === "LIVE" ? "default" : "secondary"}>
            {device.status}
          </Badge>
        </div>
      </TableCell>

      {/* Firmware current vs target, plus HMI / assets versions */}
      <TableCell className="whitespace-nowrap text-sm">
        <div>Current FW: {device.firmwareVersion || "—"}</div>
        <div className={targetMismatch ? "text-yellow-600 dark:text-yellow-400" : "text-gray-500"}>
          Target FW: {device.targetFirmwareVersion || "—"}
        </div>
        <div className="text-gray-500" data-testid={`text-hmi-version-${device.id}`}>
          HMI: {device.hmiVersion || "—"}
        </div>
        <div className="text-gray-500" data-testid={`text-assets-version-${device.id}`}>
          Assets: {device.assetsVersion || "—"}
        </div>
      </TableCell>

      {/* Points override */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={1000}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="shop default"
            className="w-32"
            data-testid={`input-points-${device.id}`}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={onSavePoints}
            disabled={savePoints.isPending}
            data-testid={`button-save-points-${device.id}`}
          >
            <Save className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-500">Blank = use shop default.</p>
      </TableCell>

      {/* OTA target */}
      <TableCell>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-1 text-sm bg-transparent"
            value={otaBoard}
            onChange={(e) => {
              setOtaBoard(e.target.value as "sensor" | "hmi");
              setOtaVersion("");
            }}
            data-testid={`select-ota-board-${device.id}`}
          >
            <option value="sensor">sensor</option>
            <option value="hmi">hmi</option>
          </select>
          <select
            className="border rounded px-2 py-1 text-sm bg-transparent"
            value={otaVersion}
            onChange={(e) => setOtaVersion(e.target.value)}
            data-testid={`select-ota-${device.id}`}
          >
            <option value="">None (clear pin)</option>
            {boardFirmwares.map((f) => (
              <option key={f.id} value={f.version}>
                {f.version} · {f.channel}
                {f.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setOta.mutate({ version: otaVersion === "" ? null : otaVersion, board: otaBoard })}
            disabled={setOta.isPending}
            data-testid={`button-set-ota-${device.id}`}
          >
            <UploadCloud className="h-4 w-4 mr-1" />
            Set
          </Button>
        </div>
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateAssets.mutate()}
            disabled={updateAssets.isPending}
            data-testid={`button-update-assets-${device.id}`}
          >
            <UploadCloud className="h-4 w-4 mr-1" />
            Update assets
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
