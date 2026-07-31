// Browser-side copy of the bin's tone bank, so a tone can be auditioned at the
// desk instead of only next to the hardware.
//
// It is a copy, not a recording, and the scores below are transcribed from
// sensor/src/audio.cpp — same frequencies, same durations, same gaps. Keep them
// in sync: a preview that does not match what the bin plays is worse than no
// preview, because the choice gets made against the wrong sound.
//
// It will not sound IDENTICAL, and should not be trusted to. The bin drives a
// hard square wave into a PAM8403 and a small bridged speaker with no low end;
// this is a square wave through whatever the listener has. Use it to choose
// between candidates and to confirm a tone is the one you meant — not to judge
// how loud or how harsh it will be in the room.

type Step =
  | { kind: "note"; hz: number; ms: number }
  | { kind: "glide"; from: number; to: number; ms: number }
  | { kind: "rest"; ms: number };

const note = (hz: number, ms: number): Step => ({ kind: "note", hz, ms });
const glide = (from: number, to: number, ms: number): Step => ({ kind: "glide", from, to, ms });
const rest = (ms: number): Step => ({ kind: "rest", ms });

/** Repeat a phrase n times — mirrors the firmware's `for` loops. */
const times = (n: number, phrase: Step[]): Step[] =>
  Array.from({ length: n }, () => phrase).flat();

export const REWARD_SCORES: Step[][] = [
  [note(1200, 60), rest(40), note(1400, 60)],                                  // Classic chirp
  [note(1319, 70), rest(20), note(1976, 160)],                                 // Coin
  [note(1047, 70), rest(25), note(1319, 70), rest(25), note(1568, 130)],       // Arpeggio
  [glide(880, 2093, 220)],                                                     // Swoop
  [note(1760, 90), rest(30), note(1319, 200)],                                 // Ding-dong
];

export const ALARM_SCORES: Step[][] = [
  times(6, [note(880, 200), rest(100), note(660, 200), rest(100)]),            // Two-tone
  times(3, [glide(700, 1800, 500), glide(1800, 700, 500)]),                    // Wail
  times(12, [glide(900, 2400, 240), rest(10)]),                                // Whoop
  times(4, [...times(3, [note(3000, 110), rest(90)]), rest(320)]),             // Fast beep
  times(10, [note(1500, 180), note(1000, 180)]),                               // Klaxon
];

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
 * Play a transcribed score. Returns a promise that resolves when it finishes (or
 * is cut short by another play / stopTone).
 *
 * Square wave to match the PWM the bin actually emits, at a deliberately low
 * gain: a full-scale square is unpleasant on headphones and these get pressed
 * repeatedly while choosing.
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
    } else if (step.kind === "note") {
      osc.frequency.setValueAtTime(step.hz, t);
      // 3 ms ramps at each edge. The bin just slams the duty cycle and its
      // speaker has no top end to click with; a browser's does, and without
      // these every note boundary pops.
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(gainValue, t + 0.003);
      gain.gain.setValueAtTime(gainValue, t + Math.max(0.004, dur - 0.003));
      gain.gain.linearRampToValueAtTime(0, t + dur);
    } else {
      osc.frequency.setValueAtTime(step.from, t);
      osc.frequency.linearRampToValueAtTime(step.to, t + dur);
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

export const playRewardTone = (index: number) =>
  playScore(REWARD_SCORES[index] ?? REWARD_SCORES[0]);
export const playAlarmTone = (index: number) =>
  playScore(ALARM_SCORES[index] ?? ALARM_SCORES[0]);

/** The bench test tone — one sustained note, matching PLAY_TONE {"hz","ms"}. */
export const playTestTone = (hz: number, ms: number) =>
  playScore([note(hz, ms)]);
