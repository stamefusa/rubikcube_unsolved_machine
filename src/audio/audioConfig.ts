export type AudioPhase = 1 | 2 | 3 | 4;

const importedAudioFiles = import.meta.glob<string>("../../voice/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

export const audioFilesByPhase: Record<AudioPhase, string[]> = {
  1: [],
  2: [],
  3: [],
  4: [],
};

for (const [path, url] of Object.entries(importedAudioFiles).sort(([left], [right]) =>
  left.localeCompare(right),
)) {
  const filename = path.split("/").at(-1) ?? "";
  const match = /^([1-4])_\d+\.mp3$/.exec(filename);
  if (!match) continue;
  audioFilesByPhase[Number(match[1]) as AudioPhase].push(url);
}

export function audioPhaseForOperation(moveCount: number, estimatedMoves: number): 1 | 2 | 3 {
  if (moveCount <= 5) return 1;
  if (moveCount <= estimatedMoves) return 2;
  return 3;
}
