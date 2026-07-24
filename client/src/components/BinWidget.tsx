import { useState } from "react";
import { apiSend } from "@/lib/apiJson";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogFooter, AlertDialogTitle, AlertDialogDescription,
  AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Pencil, Check, X, Trash2, HardDrive } from "lucide-react";
import { vocPctFromAnalog, celsiusToFahrenheit } from "@shared/deviceSettings";
import littrOneImage from "@/assets/images/littr-one-official.png";

export interface BinDevice {
  id: number;
  serial: string;
  label?: string | null;
  status: string;
  fillPercent?: number;
  vapesSinceEmpty?: number;
  tempC?: number | null;
  tempDevices?: number | null;
  tempRawC?: number | null;
  vocRaw?: number | null;
  firmwareVersion?: string | null;
  lastHeartbeatAt?: string | null;
}

export interface BinWidgetProps {
  device: BinDevice;
  /** 'C' | 'F' — display unit for temperature. */
  tempUnit: "C" | "F";
  /** When true, show rename + management actions. */
  canManage?: boolean;
  /** Optional shop name shown as a subline (staff view). */
  shopName?: string;
  /** Called after a successful rename so the parent can refetch. */
  onChanged?: () => void;
  /** Extra action buttons rendered on the right (e.g. Mark Empty, View Commands). */
  actions?: React.ReactNode;
  /** Additional stat tiles appended after Fill/Temp/VOC/Vapes (staff diagnostics). */
  extraStats?: { label: string; value: React.ReactNode }[];
}

function tempDisplay(tempC: number | null | undefined, unit: "C" | "F"): string {
  if (tempC == null) return "—";
  return unit === "F" ? `${Math.round(celsiusToFahrenheit(tempC))}°F` : `${Math.round(tempC)}°C`;
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

export default function BinWidget({
  device,
  tempUnit,
  canManage = false,
  shopName,
  onChanged,
  actions,
  extraStats,
}: BinWidgetProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(device.label ?? "");
  const [saving, setSaving] = useState(false);

  const displayName = device.label && device.label.trim() !== "" ? device.label : device.serial;
  const vocPct = device.vocRaw != null ? `${vocPctFromAnalog(device.vocRaw)}%` : "—";

  // Simple temp tone: warn hot bins
  const tempTone =
    device.tempC != null && device.tempC >= 45
      ? "text-red-600 dark:text-red-500"
      : device.tempC != null && device.tempC >= 38
        ? "text-amber-600 dark:text-amber-500"
        : "";

  const saveLabel = async () => {
    setSaving(true);
    try {
      await apiSend(`/api/partner/devices/${device.id}`, "PATCH", { label: draft.trim() || null });
      toast({ title: "Bin renamed" });
      setEditing(false);
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Rename failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid={`card-device-${device.id}`}>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        {/* Bin icon */}
        <img
          src={littrOneImage}
          alt="LITTR One"
          className="mx-auto h-36 w-28 flex-none rounded-lg object-contain sm:mx-0 sm:h-40 sm:w-32"
        />

        {/* Identity + stats */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveLabel();
                    if (e.key === "Escape") { setEditing(false); setDraft(device.label ?? ""); }
                  }}
                  maxLength={60}
                  placeholder={device.serial}
                  className="h-8 w-48"
                  data-testid={`input-rename-${device.id}`}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveLabel} disabled={saving} data-testid={`button-rename-save-${device.id}`}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(false); setDraft(device.label ?? ""); }} data-testid={`button-rename-cancel-${device.id}`}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span className="font-semibold" data-testid={`text-bin-name-${device.id}`}>{displayName}</span>
                {canManage && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => { setDraft(device.label ?? ""); setEditing(true); }}
                    aria-label="Rename bin"
                    data-testid={`button-rename-${device.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Badge variant={device.status === "LIVE" ? "default" : "secondary"}>{device.status}</Badge>
                {device.firmwareVersion && <Badge variant="outline">FW {device.firmwareVersion}</Badge>}
              </>
            )}
          </div>
          {/* serial (when a custom label is shown) + shop */}
          <div className="mt-0.5 text-xs text-muted-foreground">
            {device.label && device.label.trim() !== "" && <span className="font-mono">{device.serial}</span>}
            {shopName && <span>{device.label ? " · " : ""}{shopName}</span>}
            <span>{device.label || shopName ? " · " : ""}Last seen: {device.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).toLocaleString() : "never"}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Fill" value={`${device.fillPercent ?? 0}%`} />
            <Stat label="Temp" value={tempDisplay(device.tempC, tempUnit)} tone={tempTone} />
            <Stat label="VOC" value={vocPct} />
            <Stat label="Vapes" value={device.vapesSinceEmpty ?? 0} />
            {extraStats?.map((s) => <Stat key={s.label} label={s.label} value={s.value} />)}
          </div>
        </div>

        {actions && <div className="flex flex-none flex-wrap items-center gap-2 sm:flex-col sm:items-end">{actions}</div>}
      </CardContent>
    </Card>
  );
}

/**
 * Confirm-guarded "Remove bin" action, rendered as a BinWidget action button.
 * The caller supplies the endpoint semantics via `onConfirm` (partner vs staff
 * delete differ) and toggles `pending` while the mutation runs.
 *
 * Two modes:
 * - Uncontrolled (partner dashboard): renders its own trigger button.
 * - Controlled (`open`/`onOpenChange` provided — staff "⋯" menu): no trigger is
 *   rendered; the caller lifts the open state so the dialog survives the
 *   DropdownMenu unmounting on select.
 */
export function RemoveBinDialog({
  deviceId,
  deviceName,
  onConfirm,
  pending,
  open,
  onOpenChange,
}: {
  deviceId: number;
  deviceName: string;
  onConfirm: () => void;
  pending?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const controlled = open !== undefined;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {!controlled && (
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            disabled={pending}
            data-testid={`button-remove-bin-${deviceId}`}
          >
            <Trash2 className="mr-1 h-4 w-4" /> Remove bin
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {deviceName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the bin and its history from your dashboard.
            This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`button-cancel-remove-bin-${deviceId}`}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 text-white hover:bg-red-700"
            data-testid={`button-confirm-remove-bin-${deviceId}`}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Confirm-guarded "Reset sensor SD data" action (HW_FIXES_R3). Enqueues a
 * FORMAT_SD device command that wipes + reformats the bin's SENSOR SD card only.
 * The confirm copy is explicit that the HMI/display card is NOT affected and the
 * action can't be undone. Staff-only (rendered from the staff dashboard).
 */
export function ResetSdDialog({
  deviceId,
  deviceName,
  onConfirm,
  pending,
  open,
  onOpenChange,
}: {
  deviceId: number;
  deviceName: string;
  onConfirm: () => void;
  pending?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const controlled = open !== undefined;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {!controlled && (
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="text-amber-700 hover:text-amber-800 dark:text-amber-500"
            disabled={pending}
            data-testid={`button-reset-sd-${deviceId}`}
          >
            <HardDrive className="mr-1 h-4 w-4" /> Reset SD data
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset sensor SD data on {deviceName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes all locally stored drop photos on this bin's{" "}
            <span className="font-semibold">sensor</span> SD card and reformats it. The
            display (HMI) card is <span className="font-semibold">not</span> affected.
            This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`button-cancel-reset-sd-${deviceId}`}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 text-white hover:bg-amber-700"
            data-testid={`button-confirm-reset-sd-${deviceId}`}
          >
            Reset SD data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
