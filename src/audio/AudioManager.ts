import { showConfig } from "../config/showConfig";
import { audioFiles, type AudioCue } from "./audioConfig";

export class AudioManager {
  private current: HTMLAudioElement | null = null;
  private finishCurrent: (() => void) | null = null;

  maybePlay(moveCount: number) {
    let probability: number = showConfig.audioProbability.executing;
    let options: AudioCue[] = [];
    if (moveCount >= 31) { probability = showConfig.audioProbability.desperate; options = ["murida"]; }
    else if (moveCount >= 21) { probability = showConfig.audioProbability.desperate; options = ["nandeda", "konnahazudeha"]; }
    else if (moveCount >= 11) { probability = showConfig.audioProbability.troubled; options = ["tokenai", "okashii"]; }
    else if (moveCount >= 6) { probability = showConfig.audioProbability.confused; options = ["are"]; }
    if (options.length && Math.random() < probability) void this.play(options[Math.floor(Math.random() * options.length)]);
  }

  async play(cue: AudioCue) {
    if (this.current && !this.current.ended) return;
    console.info(`[AUDIO] play ${cue}`);
    const audio = new Audio(audioFiles[cue]);
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
      console.warn(`[AUDIO] unavailable: ${cue}`, error);
      this.finishCurrent?.();
    }
  }

  stop() {
    if (!this.current) return;
    this.current.pause();
    this.current.currentTime = 0;
    this.finishCurrent?.();
  }
}
