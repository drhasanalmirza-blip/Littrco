import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, RefreshCcw, Radio, CheckCircle2, Clock } from "lucide-react";

interface Device {
  id: number;
  serial: string;
  status: string;
}
interface PairCode {
  deviceId: number;
  serial: string;
  code: string;
  expiresAt: string;
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

const STEPS = [
  "Power on the bin and wait for its screen to show the setup network.",
  "On your phone, join the WiFi network shown on the bin's screen.",
  "Open http://littr.bin in your phone's browser.",
  "Enter your shop's WiFi name + password, and the pair code above.",
  "The bin connects to WiFi and appears below as LIVE.",
];

export default function Pairing({ shopId, enabled }: { shopId: number; enabled: boolean }) {
  const { toast } = useToast();
  const gated = enabled && shopId > 0;

  const [pairing, setPairing] = useState<PairCode | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const devicesUrl = `/api/partner/shops/${shopId}/devices`;

  const genCode = useMutation({
    mutationFn: () => apiSend<PairCode>(`/api/partner/shops/${shopId}/pair-code`, "POST"),
    onSuccess: (data) => {
      setPairing(data);
      setNow(Date.now());
    },
    onError: (e: any) =>
      toast({ title: "Could not create pair code", description: e?.message, variant: "destructive" }),
  });

  const { data: devices = [] } = useQuery<Device[]>({
    queryKey: [devicesUrl],
    queryFn: () => apiJson<Device[]>(devicesUrl),
    enabled: gated && !!pairing,
    refetchInterval: 3000,
  });

  const paired = pairing ? devices.find((d) => d.id === pairing.deviceId) : undefined;
  const isLive = paired?.status === "LIVE";

  // Tick the countdown while a code is active and not yet live.
  useEffect(() => {
    if (!pairing || isLive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pairing, isLive]);

  const remaining = pairing ? new Date(pairing.expiresAt).getTime() - now : 0;
  const expired = !!pairing && !isLive && remaining <= 0;

  const copyCode = async () => {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Type the code manually.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pair a New Bin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!pairing ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <Radio className="h-10 w-10 text-gray-400" />
              <p className="max-w-md text-sm text-gray-500">
                Generate a one-time pair code, then follow the on-screen steps to connect a
                LITTR bin to this shop's WiFi.
              </p>
              <Button
                onClick={() => genCode.mutate()}
                disabled={!gated || genCode.isPending}
                data-testid="button-generate-pair-code"
              >
                {genCode.isPending ? "Generating…" : "Pair a new bin"}
              </Button>
            </div>
          ) : (
            <>
              {isLive ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-green-200 bg-green-50 py-8 text-center dark:border-green-900 dark:bg-green-950">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <div className="text-lg font-semibold">
                    {pairing.serial} is now LIVE
                  </div>
                  <p className="text-sm text-gray-500">The bin connected successfully and is reporting to this shop.</p>
                  <Button
                    variant="outline"
                    onClick={() => genCode.mutate()}
                    disabled={genCode.isPending}
                    data-testid="button-pair-another"
                  >
                    <RefreshCcw className="mr-1 h-4 w-4" /> Pair another bin
                  </Button>
                </div>
              ) : (
                <>
                  {/* Big copyable code */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Pair code</div>
                    <div className="flex items-center gap-3">
                      <span
                        className="select-all font-mono text-5xl font-bold tracking-[0.3em] md:text-6xl"
                        data-testid="text-pair-code"
                      >
                        {pairing.code}
                      </span>
                      <Button size="sm" variant="outline" onClick={copyCode} data-testid="button-copy-pair-code">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500" data-testid="text-pair-countdown">
                      {expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <>
                          <Clock className="h-4 w-4" />
                          Expires in {fmtRemaining(remaining)}
                        </>
                      )}
                    </div>
                    {expired && (
                      <Button
                        onClick={() => genCode.mutate()}
                        disabled={genCode.isPending}
                        data-testid="button-regenerate-pair-code"
                      >
                        <RefreshCcw className="mr-1 h-4 w-4" /> Generate a fresh code
                      </Button>
                    )}
                  </div>

                  <Separator />

                  {/* Steps */}
                  <ol className="space-y-3">
                    {STEPS.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-gray-200 text-xs font-semibold dark:bg-gray-800">
                          {i + 1}
                        </span>
                        <span className="text-sm">{step}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="flex items-center gap-2 rounded-lg border bg-gray-50 p-3 text-sm dark:bg-gray-900">
                    <Radio className="h-4 w-4 flex-none animate-pulse text-blue-500" />
                    <span className="text-gray-500">
                      Waiting for bin <span className="font-mono font-semibold">{pairing.serial}</span> to come
                      online…
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
