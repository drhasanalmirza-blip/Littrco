// Browser-side copy of the two sounds the bin makes, so a queued PLAY_TONE has
// audible feedback at the desk instead of only next to the hardware — the bin is
// up to ten seconds away and usually in another room.
//
// It is a copy, not a recording. The scores are transcribed from
// sensor/src/audio.cpp — same frequencies, same durations, same gaps. Keep them
// in sync.
//
// It will not sound IDENTICAL and should not be trusted to. The bin drives a
// hard square wave into a PAM8403 and a small speaker with no low end; this is a
// square wave through whatever the listener has. Use it to confirm a command
// fired and which sound it was, not to judge how it lands in the room.
//
// The bin used to carry five candidates for each sound with a dashboard
// audition. The owner chose "Classic chirp" and "Fast beep"; the rest are gone
// from the firmware, so they are gone from here.

type Step =
  | { kind: "note"; hz: number; ms: number }
  | { kind: "rest"; ms: number };

const note = (hz: number, ms: number): Step => ({ kind: "note", hz, ms });
const rest = (ms: number): Step => ({ kind: "rest", ms });

/** Classic chirp — two quick rising notes, on every accepted drop. */
export const REWARD_SCORE: Step[] = [note(1200, 60), rest(40), note(1400, 60)];

/** Fast beep — 3 kHz pips in threes, four bursts. The fire siren. */
export const ALARM_SCORE: Step[] = Array.from({ length: 4 }, () => [
  note(3000, 110), rest(90), note(3000, 110), rest(90), note(3000, 110), rest(90),
  rest(320),
]).flat();

let ctx: AudioContext | null = null;
let stopCurrent: (() => void) | null = null;

function audioCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx;
}

export function stopTone() {
  stopCurrent?.();
  stopCurrent = null;
}

/**
 * Play a transcribed score. Resolves when it finishes, or when another play or
 * stopTone() cuts it short.
 *
 * Square wave to match the PWM the bin actually emits, at a deliberately low
 * gain — a full-scale square is unpleasant on headphones and these get pressed
 * repeatedly while testing.
 */
export async function playScore(score: Step[], gainValue = 0.08): Promise<void> {
  stopTone();
  const ac = audioCtx();
  // Browsers start the context suspended until a user gesture; every caller here
  // is a click, so this resolves immediately in practice.
  if (ac.state === "suspended") await ac.resume();

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "square";
  gain.gain.setValueAtTime(0, ac.currentTime);
  osc.connect(gain).connect(ac.destination);

  let t = ac.currentTime + 0.02;
  const start = t;
  for (const step of score) {
    const dur = step.ms / 1000;
    if (step.kind === "rest") {
      gain.gain.setValueAtTime(0, t);
    } else {
      osc.frequency.setValueAtTime(step.hz, t);
      // 3 ms ramps at each edge, mirroring the firmware's own anti-click ramp.
      // The bin's speaker has no top end to click with; a browser's does.
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(gainValue, t + 0.003);
      gain.gain.setValueAtTime(gainValue, t + Math.max(0.004, dur - 0.003));
      gain.gain.linearRampToValueAtTime(0, t + dur);
    }
    t += dur;
  }

  osc.start(start);
  osc.stop(t + 0.02);

  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { osc.disconnect(); gain.disconnect(); } catch { /* already torn down */ }
      resolve();
    };
    stopCurrent = () => { try { osc.stop(); } catch { /* not started */ } finish(); };
    osc.onended = finish;
  });
}

export const playRewardTone = () => playScore(REWARD_SCORE);
export const playAlarmTone = () => playScore(ALARM_SCORE);

/** The bench test tone — one sustained note, matching PLAY_TONE {"hz","ms"}. */
export const playTestTone = (hz: number, ms: number) =>
  playScore([note(hz, ms)]);
