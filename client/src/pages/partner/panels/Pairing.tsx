import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, RefreshCcw, Radio, CheckCircle2, Clock, Globe, Wifi, KeyRound, Power } from "lucide-react";
import littrOneImage from "@/assets/images/littr-one-official.png";

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

const STEPS: { icon: ComponentType<{ className?: string }>; text: ReactNode }[] = [
  { icon: Power, text: "Power on your LITTR One and wait for its screen to show the setup network." },
  { icon: Wifi, text: "On your phone, join the WiFi network shown on the bin's screen." },
  {
    icon: Globe,
    text: (
      <>
        Open the bin's setup page:{" "}
        <Button
          asChild
          size="sm"
          variant="outline"
          className="ml-1 h-7 border-green-500 font-mono text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
        >
          <a href="http://littr.bin" target="_blank" rel="noopener noreferrer" data-testid="link-littr-bin">
            <Globe className="mr-1 h-3.5 w-3.5" />
            littr.bin
          </a>
        </Button>
        <span className="mt-1 block text-xs text-muted-foreground">
          (only opens while your phone is on the bin's WiFi — from anywhere else it won't resolve)
        </span>
      </>
    ),
  },
  { icon: KeyRound, text: "Enter your shop's WiFi name + password, and the pair code above." },
  { icon: CheckCircle2, text: "The bin connects to WiFi and appears below as LIVE." },
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
            <div className="flex flex-col items-center gap-6 py-4 sm:flex-row sm:justify-center sm:gap-10">
              <img
                src={littrOneImage}
                alt="The LITTR One smart recycling bin"
                className="h-56 w-auto rounded-xl object-contain sm:h-64"
                data-testid="img-littr-one"
              />
              <div className="flex max-w-md flex-col items-center gap-4 text-center sm:items-start sm:text-left">
                <div>
                  <h3 className="text-lg font-semibold">
                    Set up your <span className="text-green-600 dark:text-green-500">LITTR One</span>
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Generate a one-time pair code, then follow the guided steps to connect the bin
                    to your shop's WiFi. The whole setup takes about two minutes.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="bg-green-500 font-semibold text-white hover:bg-green-600"
                  onClick={() => genCode.mutate()}
                  disabled={!gated || genCode.isPending}
                  data-testid="button-generate-pair-code"
                >
                  {genCode.isPending ? "Generating…" : "Generate pair code"}
                </Button>
              </div>
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
                  <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                    <img
                      src={littrOneImage}
                      alt="The LITTR One smart recycling bin"
                      className="mx-auto h-44 w-auto flex-none rounded-xl object-contain sm:mx-0"
                    />
                    <ol className="flex-1 space-y-3">
                      {STEPS.map((step, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-500">
                            <step.icon className="h-4 w-4" />
                          </span>
                          <span className="pt-0.5 text-sm">{step.text}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

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
