import type { AudioPort, Cue } from "./types";

export class SynthAudio implements AudioPort {
  private context: AudioContext | null = null;
  private muted = false;
  private armed = false;

  arm(): void {
    this.armed = true;
    this.context ??= new AudioContext();
    void this.context.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  play(cue: Cue): void {
    if (this.muted || !this.armed) return;
    this.context ??= new AudioContext();
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const profile = cueProfile(cue);
    oscillator.type = profile.type;
    oscillator.frequency.setValueAtTime(profile.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      profile.endFrequency,
      now + profile.duration,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(profile.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + profile.duration + 0.02);
  }
}

function cueProfile(cue: Cue): {
  frequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  type: OscillatorType;
} {
  if (cue === "paddle-hit") {
    return {
      frequency: 230,
      endFrequency: 360,
      duration: 0.07,
      gain: 0.09,
      type: "square",
    };
  }
  if (cue === "wall-bounce") {
    return {
      frequency: 420,
      endFrequency: 300,
      duration: 0.055,
      gain: 0.055,
      type: "triangle",
    };
  }
  if (cue === "obstacle-bounce") {
    return {
      frequency: 620,
      endFrequency: 780,
      duration: 0.06,
      gain: 0.07,
      type: "sawtooth",
    };
  }
  return {
    frequency: 180,
    endFrequency: 95,
    duration: 0.16,
    gain: 0.11,
    type: "sine",
  };
}
