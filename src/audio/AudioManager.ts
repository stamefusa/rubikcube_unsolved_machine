import { showConfig } from "../config/showConfig";
import {
  audioFilesByPhase,
  audioPhaseForOperation,
  type AudioPhase,
} from "./audioConfig";

export class AudioManager {
  private current: HTMLAudioElement | null = null;
  private finishCurrent: (() => void) | null = null;
  private remainingByPhase: Record<AudioPhase, string[]> = { 1: [], 2: [], 3: [], 4: [] };
  private lastPlayedByPhase: Partial<Record<AudioPhase, string>> = {};

  resetPlaylist() {
    this.remainingByPhase = { 1: [], 2: [], 3: [], 4: [] };
    this.lastPlayedByPhase = {};
  }

  maybePlay(moveCount: number, estimatedMoves: number) {
    const phase = audioPhaseForOperation(moveCount, estimatedMoves);
    const probability = showConfig.audioProbability[`phase${phase}`];
    if (Math.random() < probability) void this.playPhase(phase);
  }

  async playPhase(phase: AudioPhase) {
    if (this.current && !this.current.ended) return;

    const options = audioFilesByPhase[phase];
    if (!options.length) {
      console.warn(`[AUDIO] no files for phase ${phase}`);
      return;
    }

    const source = this.nextSource(phase, options);
    console.info(`[AUDIO] play phase=${phase} source=${source}`);
    const audio = new Audio(source);
    this.current = audio;
    const completed = new Promise<void>((resolve) => {
      const finish = () => {
        if (this.current === audio) this.current = null;
        if (this.finishCurrent === finish) this.finishCurrent = null;
        resolve();
      };
      this.finishCurrent = finish;
      audio.addEventListener("ended", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
    });
    try {
      await audio.play();
      await completed;
    } catch (error) {
      console.warn(`[AUDIO] unavailable: phase ${phase}`, error);
      this.finishCurrent?.();
    }
  }

  stop() {
    if (!this.current) return;
    this.current.pause();
    this.current.currentTime = 0;
    this.finishCurrent?.();
  }

  private nextSource(phase: AudioPhase, options: string[]) {
    let remaining = this.remainingByPhase[phase];
    if (!remaining.length) {
      remaining = this.shuffle([...options]);
      const lastPlayed = this.lastPlayedByPhase[phase];
      if (remaining.length > 1 && remaining[0] === lastPlayed) {
        const swapIndex = 1 + Math.floor(Math.random() * (remaining.length - 1));
        [remaining[0], remaining[swapIndex]] = [remaining[swapIndex], remaining[0]];
      }
      this.remainingByPhase[phase] = remaining;
    }

    const source = remaining.shift()!;
    this.lastPlayedByPhase[phase] = source;
    return source;
  }

  private shuffle(items: string[]) {
    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
  }
}
