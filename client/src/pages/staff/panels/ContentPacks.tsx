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

interface ContentFile {
  id: number;
  board: "sensor" | "hmi";
  theme: string;
  path: string;
  version: number;
  url: string;
  sha256: string;
  sizeBytes: number | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
}

const SHA256_RE = /^[0-9a-fA-F]{64}$/;

type BoardFilter = "all" | "sensor" | "hmi";

export default function ContentPacks({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const [boardFilter, setBoardFilter] = useState<BoardFilter>("all");
  const [themeFilter, setThemeFilter] = useState("");

  const params = new URLSearchParams();
  if (boardFilter !== "all") params.set("board", boardFilter);
  if (themeFilter.trim()) params.set("theme", themeFilter.trim());
  const qs = params.toString();
  const contentUrl = `/api/staff/content${qs ? `?${qs}` : ""}`;

  const invalidate = () =>
    qc.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0] as string).startsWith("/api/staff/content"),
    });

  const { data: files = [], isLoading } = useQuery<ContentFile[]>({
    queryKey: [contentUrl],
    queryFn: () => apiJson<ContentFile[]>(contentUrl),
    enabled,
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      apiSend(`/api/staff/content/${id}`, "PATCH", { active }),
    onSuccess: () => {
      toast({ title: "Content file updated" });
      invalidate();
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Content Packs</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} data-testid="button-new-content">
          <Plus className="h-4 w-4 mr-1" />
          New content file
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Board</Label>
            <Select
              value={boardFilter}
              onValueChange={(v) => setBoardFilter(v as BoardFilter)}
            >
              <SelectTrigger className="w-32" data-testid="select-content-board-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="sensor">sensor</SelectItem>
                <SelectItem value="hmi">hmi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Theme</Label>
            <Input
              className="w-40"
              placeholder="any theme"
              value={themeFilter}
              onChange={(e) => setThemeFilter(e.target.value)}
              data-testid="input-content-theme-filter"
            />
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-gray-500">No content files match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Board</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((f) => (
                  <TableRow key={f.id} data-testid={`row-content-${f.id}`}>
                    <TableCell>
                      <Badge variant="outline">{f.board}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{f.theme}</TableCell>
                    <TableCell className="font-mono text-xs break-all">{f.path}</TableCell>
                    <TableCell className="font-mono whitespace-nowrap">v{f.version}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-gray-500">
                      {new Date(f.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={f.active}
                        onCheckedChange={(v) => toggleActive.mutate({ id: f.id, active: v })}
                        disabled={toggleActive.isPending}
                        data-testid={`switch-content-active-${f.id}`}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <NewContentDialog open={open} onOpenChange={setOpen} onCreated={invalidate} />
    </Card>
  );
}

function NewContentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();

  const [board, setBoard] = useState<"sensor" | "hmi">("hmi");
  const [theme, setTheme] = useState("default");
  const [path, setPath] = useState("");
  const [url, setUrl] = useState("");
  const [sha256, setSha256] = useState("");
  const [sizeBytes, setSizeBytes] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setBoard("hmi");
    setTheme("default");
    setPath("");
    setUrl("");
    setSha256("");
    setSizeBytes("");
    setNotes("");
  };

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiSend("/api/staff/content", "POST", body),
    onSuccess: () => {
      toast({ title: "Content file created" });
      onCreated();
      reset();
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const shaValid = SHA256_RE.test(sha256.trim());
  const canSubmit =
    path.trim() !== "" && url.trim() !== "" && shaValid && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    const body: Record<string, unknown> = {
      board,
      theme: theme.trim() || "default",
      path: path.trim(),
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
          <DialogTitle>New content file</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Board</Label>
              <Select value={board} onValueChange={(v) => setBoard(v as "sensor" | "hmi")}>
                <SelectTrigger data-testid="select-content-board">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sensor">sensor</SelectItem>
                  <SelectItem value="hmi">hmi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Theme</Label>
              <Input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="default"
                data-testid="input-content-theme"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Path</Label>
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="e.g. /ui/rules_warning.raw or /config/hmi.json"
              className="font-mono text-xs"
              data-testid="input-content-path"
            />
          </div>

          <div className="space-y-1">
            <Label>Asset URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/asset"
              data-testid="input-content-url"
            />
          </div>

          <div className="space-y-1">
            <Label>SHA-256 (64 hex chars)</Label>
            <Input
              value={sha256}
              onChange={(e) => setSha256(e.target.value)}
              placeholder="64-character hex digest"
              className="font-mono text-xs"
              data-testid="input-content-sha256"
            />
            {sha256.trim() !== "" && !shaValid && (
              <p className="text-xs text-destructive" data-testid="text-content-sha-error">
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
              data-testid="input-content-size"
            />
          </div>

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Rollout notes"
              data-testid="textarea-content-notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit} data-testid="button-save-content">
            Create content file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
