import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiJson, apiSend } from "@/lib/apiJson";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription,
} from "@/components/ui/empty";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { playRewardTone, playAlarmTone, playTestTone } from "@/lib/toneBank";
import { Terminal, X, CornerDownLeft } from "lucide-react";

// Every command type the sensor firmware actually dispatches, with the payload
// it actually reads. Kept in sync by hand with the handler chain in
// sensor/src/main.cpp — a button here for a command the firmware does not know
// is worse than no button, because the bin acks it "unsupported" and the
// operator is left wondering whether it worked.
interface CommandSpec {
  type: string;
  label: string;
  help: string;
  /** Default payload sent when the button is pressed. */
  payload?: Record<string, unknown>;
  /** Shown in the console's help output. */
  args?: string;
  destructive?: boolean;
  /** Extra warning shown in the confirm dialog for destructive commands. */
  warning?: string;
}

const GROUPS: { label: string; commands: CommandSpec[] }[] = [
  {
    label: "Checks",
    commands: [
      { type: "PING", label: "Ping", help: "No-op. Proves the bin is polling and its key is accepted." },
      { type: "REFRESH_SETTINGS", label: "Refresh settings", help: "Pull the bin's settings immediately instead of waiting for the next poll." },
      { type: "TAKE_PHOTO", label: "Take photo", help: "Capture one IR-lit frame and upload it as a live photo." },
    ],
  },
  {
    label: "Maintenance",
    commands: [
      {
        type: "RESET_FILL_AND_COUNT",
        label: "Reset fill + count",
        help: "Zero the drop counter and re-arm the fill/FULL alerts. Use after emptying the bin.",
      },
      {
        type: "CALIBRATE_FILL",
        label: "Calibrate fill (60s)",
        help: "Stream 1 Hz telemetry for a window so the fill curve can be read off.",
        payload: { seconds: 60 },
        args: '{"seconds":60}',
      },
      { type: "UPDATE_ASSETS", label: "Update assets", help: "Pull the newest active content pack and push changed wallpapers to the display.", args: '{"theme":"default"}' },
      {
        type: "UPDATE_FIRMWARE",
        label: "Update sensor fw",
        help: "Check for and apply a newer ACTIVE release for the board.",
        payload: { board: "sensor" },
        args: '{"board":"sensor"|"hmi","channel":"stable"|"beta"}',
      },
      {
        type: "UPDATE_FIRMWARE",
        label: "Update display fw",
        help: "Same, for the HMI board — streamed to it over UART by the sensor.",
        payload: { board: "hmi" },
      },
    ],
  },
  {
    label: "Sound & fire",
    commands: [
      {
        type: "PLAY_TONE",
        label: "Play reward chirp",
        help: "Play the bin's drop sound on its own speaker, and here in the browser.",
        payload: { kind: "reward" },
        args: '{"kind":"reward"|"alarm"} or {"hz":1000,"ms":3000}',
      },
      {
        type: "PLAY_TONE",
        label: "Play fire beep",
        help: "Play the fire siren — about 3 seconds at full volume. Warn anyone nearby first.",
        payload: { kind: "alarm" },
      },
      {
        type: "PLAY_TONE",
        label: "Test tone (1 kHz, 3 s)",
        help: "One sustained note instead of a melody — long enough to meter. Probe the audio GPIO for a few hundred mV AC, then the speaker terminals: signal at the pin but not the speaker is the amplifier or its wiring.",
        payload: { hz: 1000, ms: 3000 },
      },
      { type: "SOUND_ALARM", label: "Sound alarm", help: "Fire the siren once. De-duplicated against a siren the bin just sounded itself." },
      {
        type: "SET_WIFI_SLEEP",
        label: "WiFi sleep off (quieter)",
        help: "Holds the radio up between beacons instead of letting it power down. The DTIM-rate current pulse it removes is the prime suspect for a rapid tick from an idle speaker, since the amplifier shares this board's 5 V. Costs ~80 mA. Send {\"sleep\":true} to put it back.",
        payload: { sleep: false },
        args: '{"sleep":true|false}',
      },
      {
        type: "CLEAR_FIRE",
        label: "Clear fire alarm",
        help: "Un-latch a fire alarm and hush it for 5 minutes. A REBOOT does NOT do this — the gas sensor's heater stays powered across a soft reset, so the bin comes straight back up alarming.",
      },
    ],
  },
  {
    label: "Destructive",
    commands: [
      {
        type: "REBOOT",
        label: "Reboot sensor",
        help: "Restart the sensor board. Any in-flight upload is lost.",
        payload: { board: "sensor" },
        args: '{"board":"sensor"}',
        destructive: true,
        warning: "A drop mid-upload will not be retried until the bin comes back.",
      },
      {
        type: "FORMAT_SD",
        label: "Format sensor SD",
        help: "Wipe and reformat the SENSOR card (stored photos). The display's card is on the other board and cannot be reached by this command.",
        destructive: true,
        warning: "Every photo held locally on the sensor card is erased. Anything already uploaded to the cloud is safe.",
      },
      {
        type: "FACTORY_RESET",
        label: "Factory reset",
        help: "Erase the bin's pairing credentials and reboot it into the setup portal.",
        destructive: true,
        warning: "The bin un-pairs and reboots into its WiFi setup portal. Someone has to be physically present to pair it again.",
      },
    ],
  },
];

const ALL_SPECS = GROUPS.flatMap((g) => g.commands);
const KNOWN_TYPES = Array.from(new Set(ALL_SPECS.map((c) => c.type))).sort();

interface ConsoleLine {
  kind: "in" | "ok" | "err" | "info";
  text: string;
}

export default function Commands({
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
}: {
  devices: { id: number; serial: string }[];
  selectedDeviceId: number | null;
  setSelectedDeviceId: (id: number | null) => void;
}) {
  const { toast } = useToast();
  const [lines, setLines] = useState<ConsoleLine[]>([
    { kind: "info", text: "Type a command and press Enter. `help` lists them." },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const consoleRef = useRef<HTMLDivElement>(null);

  const cmdUrl = `/api/staff/devices/${selectedDeviceId}/commands`;
  const { data: commands = [], refetch } = useQuery<any[]>({
    queryKey: [cmdUrl],
    queryFn: () => apiJson<any[]>(cmdUrl),
    enabled: !!selectedDeviceId,
    refetchInterval: selectedDeviceId ? 5000 : false,
  });

  const say = (kind: ConsoleLine["kind"], text: string) =>
    setLines((l) => [...l.slice(-200), { kind, text }]);

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Play a queued PLAY_TONE here as well as on the bin. The bin is up to ten
  // seconds away and often in another room, so without this the only feedback
  // for "did that do anything" is silence — which is indistinguishable from the
  // silence you are trying to debug. The browser copy is a transcription of the
  // same score (lib/toneBank.ts), not a recording.
  const echoLocally = (payload?: Record<string, unknown>) => {
    if (payload && typeof payload.hz === "number") {
      void playTestTone(payload.hz as number, Math.min(Number(payload.ms) || 3000, 5000));
      return;
    }
    if (payload?.kind === "alarm") void playAlarmTone();
    else void playRewardTone();
  };

  const enqueue = useMutation({
    mutationFn: ({ type, payload }: { type: string; payload?: Record<string, unknown> }) =>
      apiSend(cmdUrl, "POST", payload ? { type, payload } : { type }),
    onSuccess: (res: any, vars) => {
      say("ok", `#${res.id} ${vars.type} queued — the bin picks it up on its next poll`);
      if (vars.type === "PLAY_TONE") {
        echoLocally(vars.payload);
        say("info", "  (playing the same tone here — the bin's own speaker follows in ~10 s)");
      }
      refetch();
    },
    onError: (e: any, vars) => {
      say("err", `${vars.type} failed: ${e.message}`);
      toast({ title: "Command failed", description: e.message, variant: "destructive" });
    },
  });

  const cancel = useMutation({
    mutationFn: (commandId: number) => apiSend(`${cmdUrl}/${commandId}`, "DELETE"),
    onSuccess: () => { toast({ title: "Command cancelled" }); refetch(); },
    onError: (e: any) =>
      toast({ title: "Couldn't cancel", description: e.message, variant: "destructive" }),
  });

  // ---- Console ----
  // Grammar is deliberately tiny: TYPE, optionally followed by a JSON object.
  // Anything else is a typo, and saying so beats guessing.
  const run = (raw: string) => {
    const line = raw.trim();
    if (!line) return;
    say("in", `> ${line}`);
    setHistory((h) => [...h, line]);
    setHistIdx(-1);

    const lower = line.toLowerCase();
    if (lower === "help" || lower === "?") {
      say("info", "Commands (payload is optional JSON after the name):");
      for (const spec of ALL_SPECS) {
        if (ALL_SPECS.findIndex((s) => s.type === spec.type) !== ALL_SPECS.indexOf(spec)) continue;
        say("info", `  ${spec.type}${spec.args ? " " + spec.args : ""}`);
      }
      say("info", "Also: clear (wipe this console), queue (list queued commands).");
      return;
    }
    if (lower === "clear") { setLines([]); return; }
    if (lower === "queue") {
      if (!commands.length) say("info", "Queue is empty.");
      else for (const c of commands.slice(0, 20)) say("info", `  #${c.id} ${c.type} — ${c.status}`);
      return;
    }

    if (!selectedDeviceId) { say("err", "No bin selected."); return; }

    const sp = line.indexOf(" ");
    const type = (sp === -1 ? line : line.slice(0, sp)).toUpperCase();
    const rest = sp === -1 ? "" : line.slice(sp + 1).trim();

    if (!KNOWN_TYPES.includes(type) && type !== "DISARM_FIRE") {
      // Not a hard block — the firmware may know a command this build of the
      // dashboard does not — but it is almost always a typo, so name the
      // alternatives instead of silently queueing something the bin will
      // ack "unsupported".
      say("err", `Unknown command "${type}". Known: ${KNOWN_TYPES.join(", ")}`);
      return;
    }

    let payload: Record<string, unknown> | undefined;
    if (rest) {
      try {
        const parsed = JSON.parse(rest);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("payload must be a JSON object");
        payload = parsed as Record<string, unknown>;
      } catch (e: any) {
        say("err", `Bad payload: ${e.message}`);
        return;
      }
    }
    enqueue.mutate({ type, payload });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      run(input);
      setInput("");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!history.length) return;
      const next = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(history[next]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === -1) return;
      const next = histIdx + 1;
      if (next >= history.length) { setHistIdx(-1); setInput(""); return; }
      setHistIdx(next);
      setInput(history[next]);
    }
  };

  const fire = (spec: CommandSpec) => enqueue.mutate({ type: spec.type, payload: spec.payload });

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Command Queue</CardTitle>
          <select
            className="border rounded px-2 py-1 text-sm mt-2 w-fit"
            value={selectedDeviceId ?? ""}
            onChange={(e) => setSelectedDeviceId(e.target.value ? Number(e.target.value) : null)}
            data-testid="select-cmd-device"
          >
            <option value="">Pick a device…</option>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.serial}</option>)}
          </select>
        </CardHeader>
        <CardContent>
          {!selectedDeviceId ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Terminal /></EmptyMedia>
                <EmptyTitle>No device selected</EmptyTitle>
                <EmptyDescription>Pick a device above to view and queue its commands.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-4">
              {GROUPS.map((g) => (
                <div key={g.label}>
                  <div className="text-xs font-medium text-muted-foreground mb-1.5">{g.label}</div>
                  <div className="flex gap-2 flex-wrap">
                    {g.commands.map((spec) =>
                      spec.destructive ? (
                        <AlertDialog key={spec.label}>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:text-destructive"
                              title={spec.help}
                              data-testid={`button-cmd-${spec.type}`}
                            >
                              {spec.label}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{spec.label}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {spec.help}
                                {spec.warning ? ` ${spec.warning}` : ""}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => fire(spec)}
                                data-testid={`button-cmd-confirm-${spec.type}`}
                              >
                                Queue it
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <Button
                          key={spec.label}
                          size="sm"
                          variant="outline"
                          title={spec.help}
                          onClick={() => fire(spec)}
                          data-testid={`button-cmd-${spec.type}`}
                        >
                          {spec.label}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              ))}

              {/* Console */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Console</div>
                <div
                  ref={consoleRef}
                  className="h-48 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed"
                  data-testid="cmd-console-output"
                >
                  {lines.map((l, i) => (
                    <div
                      key={i}
                      className={
                        l.kind === "err" ? "text-red-600 dark:text-red-400"
                        : l.kind === "ok" ? "text-green-600 dark:text-green-400"
                        : l.kind === "in" ? "text-foreground font-semibold"
                        : "text-muted-foreground"
                      }
                    >
                      {l.text}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">&gt;</span>
                  <Input
                    className="font-mono text-sm"
                    placeholder='PLAY_TONE {"kind":"alarm","index":2}'
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    spellCheck={false}
                    autoComplete="off"
                    data-testid="input-cmd-console"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { run(input); setInput(""); }}
                    disabled={!input.trim()}
                    data-testid="button-cmd-console-send"
                  >
                    <CornerDownLeft className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <code>help</code> lists every command. ↑/↓ walks your history. Commands are queued —
                  the bin runs them on its next poll, not instantly.
                </p>
              </div>

              {/* Queue */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Queued</div>
                {commands.length === 0 ? (
                  <p className="text-sm text-gray-500">No commands.</p>
                ) : (
                  <div className="space-y-1">
                    {commands.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 border rounded p-2 text-sm"
                        data-testid={`row-cmd-${c.id}`}
                      >
                        <span className="font-mono">
                          #{c.id} {c.type}
                          {c.payload && Object.keys(c.payload).length > 0 && (
                            <span className="text-muted-foreground"> {JSON.stringify(c.payload)}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant={c.status === "ACKED" ? "default" : c.status === "FAILED" ? "destructive" : "secondary"}>
                            {c.status}
                          </Badge>
                          {c.status === "PENDING" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-destructive hover:text-destructive"
                              onClick={() => cancel.mutate(c.id)}
                              disabled={cancel.isPending}
                              data-testid={`button-cancel-cmd-${c.id}`}
                            >
                              <X className="mr-1 h-3.5 w-3.5" /> Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Only PENDING commands can be cancelled — once the bin picks one up it can't be recalled.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
