import { showConfig } from "../config/showConfig";
import { audioFiles, type AudioCue } from "./audioConfig";

export class AudioManager {
  private current: HTMLAudioElement | null = null;

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
    audio.addEventListener("ended", () => { if (this.current === audio) this.current = null; }, { once: true });
    try { await audio.play(); } catch (error) { console.warn(`[AUDIO] unavailable: ${cue}`, error); this.current = null; }
  }

  stop() { if (this.current) { this.current.pause(); this.current.currentTime = 0; this.current = null; } }
}
