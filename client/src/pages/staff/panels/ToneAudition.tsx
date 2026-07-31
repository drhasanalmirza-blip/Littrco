import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { playRewardTone, playAlarmTone } from "@/lib/toneBank";
import { Play, Check, Volume2, Siren, Headphones } from "lucide-react";

/**
 * Audition the bin's reward chirp and fire siren.
 *
 * Two ways to hear each one, because they answer different questions:
 *
 *   Headphones — plays a transcription of the same score here in the browser
 *     (see lib/toneBank.ts). Instant, and lets you narrow five candidates down
 *     to two without walking anywhere.
 *   Play       — queues it on the bin's actual speaker. This is the one that
 *     decides it. A small bridged PAM8403 into a cheap speaker has no low end,
 *     and what reads as "cheerful" through headphones gets grating when a queue
 *     of people triggers it back to back in a shop.
 *
 * Neither changes what the bin uses; only "Use this" saves (to NVS, so it
 * survives a re-flash of the app partition).
 */

const REWARD_TONES = [
  { name: "Classic chirp", desc: "Two quick rising notes. The current sound — neutral and easy to ignore." },
  { name: "Coin", desc: "Arcade pickup: two fast notes a fifth apart. Reads as 'you earned something'." },
  { name: "Arpeggio", desc: "A major triad walked up. Warmer and more musical — the friendly option." },
  { name: "Swoop", desc: "One upward glide, no note steps. Never gets repetitive however often it fires." },
  { name: "Ding-dong", desc: "Two-note doorbell, high then settled. The calmest, most retail option." },
];

const ALARM_TONES = [
  { name: "Two-tone", desc: "880/660 alternation. The current siren — European emergency style." },
  { name: "Wail", desc: "Slow continuous sweep up and down. Carries furthest; never leaves a silent gap." },
  { name: "Whoop", desc: "Fast rising sweeps. The most urgent — hard to mistake for anything else." },
  { name: "Fast beep", desc: "3 kHz pips in threes. The pattern people already recognise as fire." },
  { name: "Klaxon", desc: "Harsh gapless alternation. The most aggressive — for a bin far from staff." },
];

function ToneRow({
  kind, index, name, desc, selected, onPreview, onPlay, onUse, busy,
}: {
  kind: "reward" | "alarm";
  index: number;
  name: string;
  desc: string;
  selected: boolean;
  onPreview: () => void;
  onPlay: () => void;
  onUse: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{index + 1}. {name}</span>
          {selected && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:bg-green-950 dark:text-green-400">In use</span>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="flex flex-none gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="ghost" onClick={onPreview} data-testid={`button-preview-${kind}-${index}`}>
              <Headphones className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Play it here, in this browser. Nothing is sent to the bin.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline" onClick={onPlay} disabled={busy} data-testid={`button-play-${kind}-${index}`}>
              <Play className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Queue it on the bin's own speaker. Plays within ~10 s, when the bin next polls.
            Does not change the saved tone.
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" variant="secondary" onClick={onUse} disabled={busy} data-testid={`button-use-${kind}-${index}`}>
              <Check className="mr-1 h-3.5 w-3.5" /> Use this
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Save it to the bin as its {kind === "reward" ? "drop chirp" : "fire siren"}, and
            play it once to confirm. Stored in NVS — survives a re-flash.
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default function ToneAudition({ deviceId, enabled }: { deviceId: number | null; enabled: boolean }) {
  const { toast } = useToast();
  // Local only — the bin owns the saved value in NVS. This just marks what you
  // last chose from this screen so the list is not a row of identical buttons.
  const [chosen, setChosen] = useState<{ reward?: number; alarm?: number }>({});

  const play = useMutation({
    mutationFn: async (v: { kind: "reward" | "alarm"; index: number; save: boolean }) => {
      const r = await apiRequest(`/api/staff/devices/${deviceId}/commands`, {
        method: "POST",
        body: JSON.stringify({ type: "PLAY_TONE", payload: v }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed");
      return v;
    },
    onSuccess: (v) => {
      if (v.save) setChosen((c) => ({ ...c, [v.kind]: v.index }));
      toast({
        title: v.save ? "Saved to the bin" : "Queued — listen to the bin",
        description: v.save
          ? "The bin will use this from now on."
          : "It plays within about ten seconds, when the bin next polls for commands.",
      });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!deviceId) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Pick a bin above to audition its sounds.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium">Headphones</span> plays it here in the browser, instantly.{" "}
        <span className="font-medium">Play</span> sends it to the bin's own speaker — it plays on the
        next command poll, within about ten seconds. Neither changes anything until you press{" "}
        <span className="font-medium">Use this</span>. The browser preview is a transcription of the
        same score, not a recording: use it to narrow the list, and the bin to decide.
      </p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Volume2 className="h-4 w-4" /> Reward sound
          </CardTitle>
          <p className="text-xs text-muted-foreground">Plays on every accepted drop.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {REWARD_TONES.map((t, i) => (
            <ToneRow
              key={t.name} kind="reward" index={i} name={t.name} desc={t.desc}
              selected={chosen.reward === i} busy={play.isPending || !enabled}
              onPreview={() => void playRewardTone(i)}
              onPlay={() => play.mutate({ kind: "reward", index: i, save: false })}
              onUse={() => play.mutate({ kind: "reward", index: i, save: true })}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Siren className="h-4 w-4" /> Fire alarm sound
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Each runs 3–4 seconds at full volume. Warn anyone nearby before playing one.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {ALARM_TONES.map((t, i) => (
            <ToneRow
              key={t.name} kind="alarm" index={i} name={t.name} desc={t.desc}
              selected={chosen.alarm === i} busy={play.isPending || !enabled}
              onPreview={() => void playAlarmTone(i)}
              onPlay={() => play.mutate({ kind: "alarm", index: i, save: false })}
              onUse={() => play.mutate({ kind: "alarm", index: i, save: true })}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
