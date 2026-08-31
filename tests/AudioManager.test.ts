import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioManager } from "../src/audio/AudioManager";
import {
  audioFilesByPhase,
  audioPhaseForOperation,
  type AudioPhase,
} from "../src/audio/audioConfig";
import { showConfig } from "../src/config/showConfig";

class FakeAudio {
  static instances: FakeAudio[] = [];

  readonly src: string;
  ended = false;
  currentTime = 0;
  readonly play = vi.fn(async () => undefined);
  readonly pause = vi.fn();
  private listeners = new Map<string, Array<() => void>>();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  finish() {
    this.ended = true;
    this.listeners.get("ended")?.forEach((listener) => listener());
  }
}

async function playAndFinish(manager: AudioManager, phase: AudioPhase) {
  const playback = manager.playPhase(phase);
  const audio = FakeAudio.instances.at(-1)!;
  audio.finish();
  await playback;
  return audio.src;
}

describe("AudioManager", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("groups every configured phase and uses the planned operation boundaries", () => {
    expect(audioFilesByPhase[1].length).toBeGreaterThan(0);
    expect(audioFilesByPhase[2].length).toBeGreaterThan(0);
    expect(audioFilesByPhase[3].length).toBeGreaterThan(0);
    expect(audioFilesByPhase[4].length).toBeGreaterThan(0);

    expect(audioPhaseForOperation(1, 18)).toBe(1);
    expect(audioPhaseForOperation(5, 18)).toBe(1);
    expect(audioPhaseForOperation(6, 18)).toBe(2);
    expect(audioPhaseForOperation(18, 18)).toBe(2);
    expect(audioPhaseForOperation(19, 18)).toBe(3);
  });

  it("starts each operation phase at its independently configured 50% probability", () => {
    expect(showConfig.audioProbability).toEqual({ phase1: 0.5, phase2: 0.5, phase3: 0.5 });

    const manager = new AudioManager();
    vi.spyOn(Math, "random").mockReturnValue(0);

    manager.maybePlay(1, 18);
    FakeAudio.instances[0].finish();
    manager.maybePlay(6, 18);
    FakeAudio.instances[1].finish();
    manager.maybePlay(19, 18);

    expect(audioFilesByPhase[1]).toContain(FakeAudio.instances[0].src);
    expect(audioFilesByPhase[2]).toContain(FakeAudio.instances[1].src);
    expect(audioFilesByPhase[3]).toContain(FakeAudio.instances[2].src);
    manager.stop();
  });

  it("does not play at or above the 50% boundary", () => {
    const manager = new AudioManager();
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    manager.maybePlay(1, 18);

    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("does not overlap audio that is already playing", async () => {
    const manager = new AudioManager();
    const firstPlayback = manager.playPhase(1);

    await manager.playPhase(2);
    expect(FakeAudio.instances).toHaveLength(1);

    FakeAudio.instances[0].finish();
    await firstPlayback;
  });

  it("plays every file in a phase once before refilling its shuffled bag", async () => {
    const manager = new AudioManager();
    vi.spyOn(Math, "random").mockReturnValue(0);

    const played: string[] = [];
    for (let index = 0; index < audioFilesByPhase[1].length; index += 1) {
      played.push(await playAndFinish(manager, 1));
    }

    expect(new Set(played).size).toBe(audioFilesByPhase[1].length);
    expect(new Set(played)).toEqual(new Set(audioFilesByPhase[1]));
  });

  it("does not repeat the previous file across a bag refill", async () => {
    const manager = new AudioManager();
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999).mockReturnValueOnce(0.999)
      .mockReturnValueOnce(0).mockReturnValueOnce(0.999)
      .mockReturnValueOnce(0);

    const played: string[] = [];
    for (let index = 0; index < audioFilesByPhase[1].length; index += 1) {
      played.push(await playAndFinish(manager, 1));
    }
    const firstAfterRefill = await playAndFinish(manager, 1);

    expect(firstAfterRefill).not.toBe(played.at(-1));
  });

  it("restores every phase bag for a new demo", async () => {
    const manager = new AudioManager();
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const beforeReset = await playAndFinish(manager, 1);

    manager.resetPlaylist();
    const afterReset: string[] = [];
    for (let index = 0; index < audioFilesByPhase[1].length; index += 1) {
      afterReset.push(await playAndFinish(manager, 1));
    }

    expect(afterReset[0]).toBe(beforeReset);
    expect(new Set(afterReset)).toEqual(new Set(audioFilesByPhase[1]));
  });
});
