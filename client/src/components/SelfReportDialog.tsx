import { useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiSend } from "@/lib/apiJson";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ClipboardList } from "lucide-react";

export interface SelfReportDialogProps {
  sessionId: number;
  trigger?: ReactNode;
  onDone?: () => void;
}

/**
 * Optional post-claim self-report form. Renders inside the customer app.
 * All fields are optional — the server does a full replace on re-submit, so we
 * only send fields the customer actually filled in.
 * POST /api/customer/self-report { sessionId, brand?, model?, puffCount?, isThc?, notes? }
 */
export default function SelfReportDialog({ sessionId, trigger, onDone }: SelfReportDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [puffCount, setPuffCount] = useState("");
  const [isThc, setIsThc] = useState(false);
  const [notes, setNotes] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { sessionId };
      if (brand.trim()) body.brand = brand.trim();
      if (model.trim()) body.model = model.trim();
      if (puffCount.trim()) {
        const n = parseInt(puffCount, 10);
        if (!Number.isNaN(n)) body.puffCount = n;
      }
      if (isThc) body.isThc = true;
      if (notes.trim()) body.notes = notes.trim();
      return apiSend("/api/customer/self-report", "POST", body);
    },
    onSuccess: () => {
      toast({ title: "Thanks for the details" });
      setOpen(false);
      onDone?.();
    },
    onError: (e: any) => {
      // 403 = session not claimed by you — surface gracefully, keep the dialog open.
      toast({
        title: "Couldn't save details",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="w-full gap-2" data-testid="button-open-self-report">
            <ClipboardList className="h-4 w-4" />
            Add device details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tell us about your device</DialogTitle>
          <DialogDescription>
            Optional — it helps us recycle better. Every field can be left blank.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="sr-brand">Brand</Label>
            <Input
              id="sr-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Elf Bar"
              data-testid="input-self-report-brand"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sr-model">Model</Label>
            <Input
              id="sr-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. BC5000"
              data-testid="input-self-report-model"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sr-puffs">Puff count</Label>
            <Input
              id="sr-puffs"
              type="number"
              inputMode="numeric"
              min={0}
              value={puffCount}
              onChange={(e) => setPuffCount(e.target.value)}
              placeholder="e.g. 5000"
              data-testid="input-self-report-puffs"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5 pr-3">
              <Label htmlFor="sr-thc">Contained THC / cannabis</Label>
              <p className="text-xs text-muted-foreground">Turn on if this device held THC.</p>
            </div>
            <Switch
              id="sr-thc"
              checked={isThc}
              onCheckedChange={setIsThc}
              data-testid="switch-self-report-thc"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sr-notes">Notes</Label>
            <Textarea
              id="sr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else you'd like to add"
              rows={3}
              data-testid="textarea-self-report-notes"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="ghost" data-testid="button-self-report-skip">
              Skip
            </Button>
          </DialogClose>
          <Button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            data-testid="button-self-report-submit"
          >
            {submit.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
