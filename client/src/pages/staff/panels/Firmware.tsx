import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Cpu, Monitor, Trash2, Copy, Check, AlertTriangle, ArrowRight, Loader2,
} from "lucide-react";

interface Firmware {
  id: number;
  board: "sensor" | "hmi";
  version: string;
  channel: "stable" | "beta";
  url: string;
  sha256: string;
  sizeBytes: number | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

const SHA256_RE = /^[0-9a-fA-F]{64}$/;
const BOARDS = ["sensor", "hmi"] as const;
const CHANNELS = ["stable", "beta"] as const;
type Board = (typeof BOARDS)[number];
type Channel = (typeof CHANNELS)[number];

const BOARD_META: Record<Board, { title: string; sub: string; Icon: typeof Cpu }> = {
  sensor: { title: "Sensor", sub: "The brain — WiFi, camera, beams, cloud", Icon: Cpu },
  hmi: { title: "Display", sub: "The 800×480 screen and LED ring", Icon: Monitor },
};

function fmtSize(n: number | null): string {
  if (!n) return "—";
  return `${(n / 1024).toFixed(0)} KB`;
}

/**
 * Which release a bin on this board+channel will actually be offered.
 *
 * This mirrors GET /api/device/firmware exactly: the NEWEST-CREATED active row,
 * with no version ordering at all — it only checks the version string differs
 * from what the bin reports. That is surprising enough (create a release with an
 * older version number and every bin "updates" down to it) that the page has to
 * show the answer rather than leave it to be inferred from a sorted table.
 */
function servedRelease(list: Firmware[], board: Board, channel: Channel): Firmware | undefined {
  return list
    .filter((r) => r.board === board && r.channel === channel && r.active)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
}

function ShaChip({ sha }: { sha: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(sha);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            } catch { /* clipboard blocked — the tooltip still shows the digest */ }
          }}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {sha.slice(0, 12)}…
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-all font-mono text-[11px]">
        {sha}
        <div className="mt-1 font-sans text-xs">
          Click to copy. Compare against <code>sha256sum</code> of the .bin you built —
          a mismatch aborts the flash on the bin rather than bricking it.
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function ReleaseRow({
  r, isServed, onToggle, onDelete, busy,
}: {
  r: Firmware;
  isServed: boolean;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-md border p-3 ${
        isServed ? "border-green-600/40 bg-green-50/40 dark:bg-green-950/20" : ""
      }`}
      data-testid={`row-firmware-${r.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold">{r.version}</span>
          <Badge variant={r.channel === "stable" ? "default" : "secondary"}>{r.channel}</Badge>
          {isServed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-green-600 hover:bg-green-600 text-white cursor-default">
                  Serving
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                This is what a bin on this channel gets when it checks. It wins because it is
                the newest-created active release — not because its version is highest.
              </TooltipContent>
            </Tooltip>
          )}
          {!r.active && <Badge variant="outline">inactive</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{fmtSize(r.sizeBytes)}</span>
          <span>{new Date(r.createdAt).toLocaleString()}</span>
          <ShaChip sha={r.sha256} />
        </div>
        {r.notes && <p className="mt-1.5 text-xs">{r.notes}</p>}
      </div>

      <div className="flex flex-none items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Switch
                checked={r.active}
                onCheckedChange={onToggle}
                disabled={busy}
                data-testid={`switch-firmware-active-${r.id}`}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {r.active
              ? "Active — eligible to be served. Turn off to stop offering it without deleting it."
              : "Inactive — bins are never offered this, even if you pin it."}
          </TooltipContent>
        </Tooltip>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              disabled={busy}
              data-testid={`button-delete-firmware-${r.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {r.board} {r.version} ({r.channel})?</AlertDialogTitle>
              <AlertDialogDescription>
                Removes the release record. The uploaded .bin is left in place so a bin
                mid-download can finish. Any bin pinned to this exact version keeps its pin and
                is simply offered nothing until you decide what it should run.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} data-testid={`button-delete-firmware-confirm-${r.id}`}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function BoardCard({
  board, releases, onToggle, onDelete, busy,
}: {
  board: Board;
  releases: Firmware[];
  onToggle: (id: number, active: boolean) => void;
  onDelete: (id: number) => void;
  busy: boolean;
}) {
  const { title, sub, Icon } = BOARD_META[board];
  const mine = releases.filter((r) => r.board === board);
  const served: Record<Channel, Firmware | undefined> = {
    stable: servedRelease(releases, board, "stable"),
    beta: servedRelease(releases, board, "beta"),
  };
  // More than one active release in a channel is legal but only ever serves one
  // of them. Silent ambiguity here is how "I marked it active and nothing
  // happened" reports start.
  const shadowed = CHANNELS.flatMap((ch) => {
    const active = mine.filter((r) => r.channel === ch && r.active);
    return active.length > 1 ? [{ ch, count: active.length }] : [];
  });

  const sorted = [...mine].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" /> {title}
          <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
            board={board}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* What a bin actually gets, per channel. */}
        <div className="grid grid-cols-2 gap-2">
          {CHANNELS.map((ch) => (
            <div key={ch} className="rounded-md border bg-muted/30 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {ch} serves
              </div>
              <div className="mt-0.5 font-mono text-sm">
                {served[ch]?.version ?? <span className="text-muted-foreground">nothing</span>}
              </div>
            </div>
          ))}
        </div>

        {shadowed.map(({ ch, count }) => (
          <div
            key={ch}
            className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50/60 px-3 py-2 text-xs dark:bg-amber-950/20"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-600" />
            <span>
              {count} active <strong>{ch}</strong> releases. Only the newest-created one
              ({served[ch]?.version}) is ever served — deactivate the others so this page
              means what it says.
            </span>
          </div>
        ))}

        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No releases for this board yet.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((r) => (
              <ReleaseRow
                key={r.id}
                r={r}
                isServed={served[r.channel]?.id === r.id}
                onToggle={(active) => onToggle(r.id, active)}
                onDelete={() => onDelete(r.id)}
                busy={busy}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Firmware({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: releases = [], isLoading } = useQuery<Firmware[]>({
    queryKey: ["/api/staff/firmware"],
    queryFn: () => apiJson<Firmware[]>("/api/staff/firmware"),
    enabled,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiSend(`/api/staff/firmware/${id}`, "PATCH", { active }),
    onSuccess: () => {
      toast({ title: "Release updated" });
      qc.invalidateQueries({ queryKey: ["/api/staff/firmware"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => apiSend(`/api/staff/firmware/${id}`, "DELETE"),
    onSuccess: (res: any) => {
      const pinned: string[] = res?.stillPinned ?? [];
      toast({
        title: "Release deleted",
        description: pinned.length
          ? `Still pinned on ${pinned.join(", ")} — those bins will be offered nothing until re-pointed.`
          : undefined,
      });
      qc.invalidateQueries({ queryKey: ["/api/staff/firmware"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const busy = toggleActive.isPending || remove.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          A bin asks for the newest <strong>active</strong> release on its board and channel, and
          takes it if the version string differs from what it is running. There is no version
          ordering — a release created later always wins, even if its number is lower. Push one to
          a specific bin from <span className="font-medium">Device Ops</span>.
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-firmware">
              <Plus className="h-4 w-4 mr-1" /> New release
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Upload a .bin and register it. Creating a release does not push anything — bins pick it
            up on their next check, or immediately when you trigger one from Device Ops.
          </TooltipContent>
        </Tooltip>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {BOARDS.map((b) => (
            <BoardCard
              key={b}
              board={b}
              releases={releases}
              onToggle={(id, active) => toggleActive.mutate({ id, active })}
              onDelete={(id) => remove.mutate(id)}
              busy={busy}
            />
          ))}
        </div>
      )}

      <NewReleaseDialog open={open} onOpenChange={setOpen} existing={releases} />
    </div>
  );
}

function NewReleaseDialog({
  open, onOpenChange, existing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: Firmware[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [board, setBoard] = useState<Board>("sensor");
  const [version, setVersion] = useState("");
  const [channel, setChannel] = useState<Channel>("stable");
  const [url, setUrl] = useState("");
  const [sha256, setSha256] = useState("");
  const [sizeBytes, setSizeBytes] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setBoard("sensor"); setVersion(""); setChannel("stable");
    setUrl(""); setSha256(""); setSizeBytes(""); setNotes(""); setFileName("");
  };

  // The single most dangerous mistake this form allows: leaving Board on its
  // "sensor" default while uploading a display image. GET /api/device/firmware
  // serves the newest active row for a board with no sanity check on the image
  // itself, so the sensor would download the HMI binary and flash it — a brick
  // that needs someone physically present with a cable. The filename is the only
  // signal available here, so use it.
  const boardMismatch = useMemo(() => {
    const f = fileName.toLowerCase();
    if (!f) return null;
    const looksHmi = f.includes("hmi") || f.includes("display");
    const looksSensor = f.includes("sensor");
    if (looksHmi && board === "sensor") return "hmi";
    if (looksSensor && board === "hmi") return "sensor";
    return null;
  }, [fileName, board]);

  const duplicate = existing.some(
    (r) => r.board === board && r.channel === channel && r.version === version.trim(),
  );

  const uploadFile = async (file: File) => {
    setUploading(true);
    setFileName(file.name);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("Could not read file"));
        r.readAsDataURL(file);
      });
      const res = await apiSend<{ url: string; sha256: string; sizeBytes: number }>(
        "/api/staff/upload", "POST", { kind: "firmware", filename: file.name, dataBase64 },
      );
      setUrl(res.url);
      setSha256(res.sha256);
      setSizeBytes(String(res.sizeBytes));
      // Filenames are `sensor-1.6.2.bin` / `hmi-1.1.8.bin`, so the version is
      // sitting right there. Typing it again by hand is just an opportunity to
      // get it wrong, and a version string that does not match the firmware
      // exactly means the bin re-downloads the same image forever.
      const m = file.name.match(/(\d+\.\d+\.\d+)/);
      if (m && !version.trim()) setVersion(m[1]);
      toast({ title: "Uploaded", description: "URL, SHA-256 and size filled in below." });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSend("/api/staff/firmware", "POST", body),
    onSuccess: () => {
      toast({ title: "Firmware release created" });
      qc.invalidateQueries({ queryKey: ["/api/staff/firmware"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const shaValid = SHA256_RE.test(sha256.trim());
  const canSubmit =
    version.trim() !== "" && url.trim() !== "" && shaValid && !duplicate && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    const body: Record<string, unknown> = {
      board,
      version: version.trim(),
      channel,
      url: url.trim(),
      sha256: sha256.trim(),
      notes: notes.trim() || undefined,
    };
    const size = Number(sizeBytes);
    if (sizeBytes.trim() !== "" && Number.isFinite(size) && size >= 0) body.sizeBytes = Math.round(size);
    create.mutate(body);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New firmware release</DialogTitle>
          <DialogDescription>
            Upload the .bin, then tell the fleet what it is. Nothing is pushed until a bin checks
            or you trigger an update.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1 — the file */}
          <div className="space-y-1.5 rounded-md border border-dashed p-3">
            <Label>1 · Firmware image</Label>
            <Input
              type="file"
              accept=".bin"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
              data-testid="input-fw-file"
            />
            <p className="text-xs text-muted-foreground">
              {uploading
                ? "Uploading…"
                : "Fills in the URL, SHA-256, size and version below. Or paste an external https URL."}
            </p>
          </div>

          {/* 2 — where it goes */}
          <div className="space-y-1.5">
            <Label>2 · Which board, which channel</Label>
            <div className="grid grid-cols-2 gap-3">
              <Select value={board} onValueChange={(v) => setBoard(v as Board)}>
                <SelectTrigger data-testid="select-fw-board"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sensor">sensor — the brain</SelectItem>
                  <SelectItem value="hmi">hmi — the display</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channel} onValueChange={(v) => setChannel(v as Channel)}>
                <SelectTrigger data-testid="select-fw-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">stable</SelectItem>
                  <SelectItem value="beta">beta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {boardMismatch && (
              <div
                className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs"
                data-testid="warn-fw-board-mismatch"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-destructive" />
                <span>
                  <strong>{fileName}</strong> looks like a <strong>{boardMismatch}</strong> image but
                  Board says <strong>{board}</strong>. Filing it under the wrong board makes the
                  other board download and flash it — that is a brick needing a cable and a person
                  on site.
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 h-6"
                    onClick={() => setBoard(boardMismatch as Board)}
                  >
                    Set to {boardMismatch} <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              A bin only sees the channel it is following. Move a bin onto beta from Device Ops —
              the choice sticks until you move it back.
            </p>
          </div>

          {/* 3 — identity */}
          <div className="space-y-1.5">
            <Label>3 · Version</Label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 1.6.2"
              className="font-mono"
              data-testid="input-fw-version"
            />
            <p className="text-xs text-muted-foreground">
              Must match <code>LITTR_FW_VERSION</code> (sensor) or <code>HMI_FW_VERSION</code>{" "}
              (display) in the build <em>exactly</em>. If it does not, the bin flashes the image,
              reports a different version, and is offered the same update again forever.
            </p>
            {duplicate && (
              <p className="text-xs text-destructive">
                A {channel} release already exists for {board} {version.trim()}.
              </p>
            )}
          </div>

          <details className="rounded-md border px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium">
              URL, checksum, size, notes
            </summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label>Binary URL</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://…/firmware.bin"
                  data-testid="input-fw-url"
                />
              </div>
              <div className="space-y-1">
                <Label>SHA-256</Label>
                <Input
                  value={sha256}
                  onChange={(e) => setSha256(e.target.value)}
                  placeholder="64-character hex digest"
                  className="font-mono text-xs"
                  data-testid="input-fw-sha256"
                />
                {sha256.trim() !== "" && !shaValid && (
                  <p className="text-xs text-destructive" data-testid="text-fw-sha-error">
                    Must be exactly 64 hexadecimal characters.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Verified on the bin before anything is written to flash — a corrupted download
                  aborts instead of bricking.
                </p>
              </div>
              <div className="space-y-1">
                <Label>Size in bytes (optional)</Label>
                <Input
                  type="number" min={0} value={sizeBytes}
                  onChange={(e) => setSizeBytes(e.target.value)}
                  placeholder="e.g. 1188432"
                  data-testid="input-fw-size"
                />
              </div>
              <div className="space-y-1">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What changed, and anything to watch after rollout"
                  data-testid="textarea-fw-notes"
                />
              </div>
            </div>
          </details>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit} data-testid="button-save-firmware">
            {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Create release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
