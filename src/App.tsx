import { useEffect, useMemo, useSyncExternalStore } from "react";
import { AudioManager } from "./audio/AudioManager";
import { OperationGenerator } from "./operations/OperationGenerator";
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
    mockMode ? new MockCubeController() : new WebSerialCubeController(), new OperationGenerator(), new AudioManager(),
  ), [mockMode]);
  const show = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  useEffect(() => () => controller.dispose(), [controller]);

  if (show.state === "analyzing") return <AnalyzerScreen />;
  if (show.state === "analysisComplete") return <AnalysisCompleteScreen estimatedMoves={show.estimatedMoves} onExecute={() => void controller.execute()} />;
  if (["executing", "confused", "desperate"].includes(show.state)) return <ExecuteScreen state={show.state} moveCount={show.moveCount} estimatedMoves={show.estimatedMoves} />;
  if (["giveUp", "endingDemo", "error"].includes(show.state)) {
    return <GiveUpScreen state={show.state} error={show.error} moveCount={show.moveCount} recovering={show.recovering} onReset={() => void controller.reset()} />;
  }
  return (
    <StandbyScreen
      state={show.state}
      connected={show.connected}
      mockMode={mockMode}
      error={show.error}
      onConnect={() => void controller.connect()}
      onStartDemo={() => void controller.startDemo()}
      onAnalyze={() => controller.analyze()}
    />
  );
}
