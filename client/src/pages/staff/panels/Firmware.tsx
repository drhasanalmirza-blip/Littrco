import { useState } from "react";
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

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
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Firmware Releases</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-firmware">
          <Plus className="h-4 w-4 mr-1" />
          New release
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : releases.length === 0 ? (
          <p className="text-sm text-gray-500">No firmware releases yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Board</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {releases.map((r) => (
                  <TableRow key={r.id} data-testid={`row-firmware-${r.id}`}>
                    <TableCell>
                      <Badge variant="outline">{r.board}</Badge>
                    </TableCell>
                    <TableCell className="font-mono whitespace-nowrap">{r.version}</TableCell>
                    <TableCell>
                      <Badge variant={r.channel === "stable" ? "default" : "secondary"}>
                        {r.channel}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs text-sm text-gray-500">
                      {r.notes || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={r.active}
                        onCheckedChange={(v) => toggleActive.mutate({ id: r.id, active: v })}
                        disabled={toggleActive.isPending}
                        data-testid={`switch-firmware-active-${r.id}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <NewReleaseDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function NewReleaseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [board, setBoard] = useState<"sensor" | "hmi">("sensor");
  const [version, setVersion] = useState("");
  const [channel, setChannel] = useState<"stable" | "beta">("stable");
  const [url, setUrl] = useState("");
  const [sha256, setSha256] = useState("");
  const [sizeBytes, setSizeBytes] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const reset = () => {
    setBoard("sensor");
    setVersion("");
    setChannel("stable");
    setUrl("");
    setSha256("");
    setSizeBytes("");
    setNotes("");
  };

  // P3-S0: upload the .bin → server stores it + returns an absolute littr.co URL
  // and the SHA-256, which we drop straight into the form fields.
  const uploadFile = async (file: File) => {
    setUploading(true);
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
      toast({ title: "Uploaded", description: "URL and SHA-256 filled in below." });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiSend("/api/staff/firmware", "POST", body),
    onSuccess: () => {
      toast({ title: "Firmware release created" });
      qc.invalidateQueries({ queryKey: ["/api/staff/firmware"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const shaValid = SHA256_RE.test(sha256.trim());
  const canSubmit =
    version.trim() !== "" && url.trim() !== "" && shaValid && !create.isPending;

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
    if (sizeBytes.trim() !== "" && Number.isFinite(size) && size >= 0) {
      body.sizeBytes = Math.round(size);
    }
    create.mutate(body);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New firmware release</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Board</Label>
              <Select value={board} onValueChange={(v) => setBoard(v as "sensor" | "hmi")}>
                <SelectTrigger data-testid="select-fw-board">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sensor">sensor</SelectItem>
                  <SelectItem value="hmi">hmi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Channel</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as "stable" | "beta")}
              >
                <SelectTrigger data-testid="select-fw-channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">stable</SelectItem>
                  <SelectItem value="beta">beta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Version</Label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 1.4.2"
              data-testid="input-fw-version"
            />
          </div>

          <div className="space-y-1 rounded-md border border-dashed p-3">
            <Label>Upload firmware .bin</Label>
            <Input
              type="file"
              accept=".bin"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
              data-testid="input-fw-file"
            />
            <p className="text-xs text-muted-foreground">
              {uploading ? "Uploading…" : "Fills the URL + SHA-256 automatically. Or paste an external https URL below."}
            </p>
          </div>

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
            <Label>SHA-256 (64 hex chars)</Label>
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
          </div>

          <div className="space-y-1">
            <Label>Size in bytes (optional)</Label>
            <Input
              type="number"
              min={0}
              value={sizeBytes}
              onChange={(e) => setSizeBytes(e.target.value)}
              placeholder="e.g. 1048576"
              data-testid="input-fw-size"
            />
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Changelog / rollout notes"
              data-testid="textarea-fw-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit} data-testid="button-save-firmware">
            Create release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
