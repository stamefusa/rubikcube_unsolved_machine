import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AudioManager } from "./audio/AudioManager";
import { MoveGenerator } from "./cube/MoveGenerator";
import { MockCubeController } from "./serial/MockCubeController";
import { WebSerialCubeController } from "./serial/WebSerialCubeController";
import { ShowController } from "./show/ShowController";
import { AnalysisCompleteScreen } from "./components/AnalysisCompleteScreen";
import { AnalyzerScreen } from "./components/AnalyzerScreen";
import { ExecuteScreen } from "./components/ExecuteScreen";
import { GiveUpScreen } from "./components/GiveUpScreen";
import { StandbyScreen } from "./components/StandbyScreen";

export default function App() {
  const mockMode = useMemo(() => new URLSearchParams(location.search).get("mock") === "true", []);
  const controller = useMemo(() => new ShowController(
    mockMode ? new MockCubeController() : new WebSerialCubeController(), new MoveGenerator(), new AudioManager(), mockMode,
  ), [mockMode]);
  const show = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => () => controller.dispose(), [controller]);

  if (show.state === "analyzing") return <AnalyzerScreen />;
  if (show.state === "analysisComplete") return <AnalysisCompleteScreen estimatedMoves={show.estimatedMoves} onExecute={() => void controller.execute()} />;
  if (["executing", "confused", "desperate"].includes(show.state)) return <ExecuteScreen state={show.state} moveCount={show.moveCount} estimatedMoves={show.estimatedMoves} currentMove={show.currentMove} />;
  if (show.state === "giveUp") return <GiveUpScreen error={show.error} moveCount={show.moveCount} onReset={() => void controller.reset()} />;
  return <StandbyScreen connected={show.connected} mockMode={mockMode} error={show.error} onConnect={() => void controller.connect()} onAnalyze={() => controller.analyze()} />;
}
