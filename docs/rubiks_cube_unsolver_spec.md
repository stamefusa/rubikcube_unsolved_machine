# Rubik's Cube Unsolver — Codex実装仕様書

## プロジェクト概要

ルービックキューブを自動で操作する装置のPC側UIを作成する。

一般的なRubik's Cube Solverは、

1. カメラや手動入力で現在のキューブ状態を取得
2. Solverで解法を計算
3. 解法に従ってモーターを動かす

という構成だが、この装置では**1と2を意図的に丸ごと省略する。**

つまり、

- キューブの状態を取得しない
- カメラを使わない
- 色認識をしない
- CubeStateを持たない
- Solverを実装しない
- 完成判定をしない

という仕様とする。

代わりに、

1. PC画面上で非常に高度な解析をしているような演出を行う
2. 「解析完了」「最適解を発見」などと表示する
3. 実際にはランダムなキューブ操作をArduinoへ送る
4. 当然キューブは解けない
5. 操作途中で「あれ……」「解けない……」「無理だ……」などの音声を再生する

という装置にする。

**大げさな解析演出と、その直後にまったく解けないという落差を笑いの中心とする。**

---

## 技術スタック

以下を使用する。

- React
- TypeScript
- Vite
- CSS
- Web Serial API

Electronは使用しない。

ブラウザ単体で動作させる。

外部UIライブラリは必須ではない。

初期実装ではReact + CSS Animationを中心とする。

必要ならCanvasを使用してよい。

Three.jsなどの大型ライブラリは、初期実装では必須としない。

---

## システム構成

PC側をショー全体の制御役とする。

```text
React UI
   |
   v
ShowController
   |
   +---- FakeAnalyzer
   |
   +---- MoveGenerator
   |
   +---- AudioManager
   |
   +---- CubeController
             |
             +---- WebSerialCubeController
             |
             +---- MockCubeController
```

Arduino側はブラックボックスとする。

PCから、

```text
MOVE R CW
```

のような命令を受け取り、

```text
MOVE_START R CW
MOVE_DONE R CW
```

を返すものとして扱う。

Arduino内部でどのようにモーターを動かすかは今回実装しない。

---

## 実装対象

以下を実装する。

- Arduino接続UI
- Web Serial APIによる通信
- Mock Arduino
- Standby画面
- Fake Analyzer画面
- Analysis Complete画面
- Execute画面
- Give Up画面
- ShowController
- MoveGenerator
- AudioManager
- ランダムなCubeMove生成
- Arduinoへの1操作ずつの送信
- MOVE_DONE待ち
- 操作回数管理
- 音声再生
- Reset処理
- 通信エラー処理

---

## 実装しないもの

以下は実装しない。

- カメラ
- Webカメラ制御
- OpenCV
- 画像解析
- 色認識
- キューブ状態入力UI
- CubeState
- Rubik's Cube Solver
- 最短手数計算
- 完成判定
- 実際の解析処理
- Arduinoの具体的なモーター制御

Fake Analyzerと実際のMoveGeneratorの間にも関連を持たせない。

---

## アプリケーション状態

以下の状態を持つ。

```ts
type ShowState =
  | "standby"
  | "analyzing"
  | "analysisComplete"
  | "executing"
  | "confused"
  | "desperate"
  | "giveUp";
```

状態遷移はShowControllerを中心に管理する。

Reactコンポーネントそれぞれが独自にショー進行を持たないようにする。

---

## 基本フロー

```text
起動
 ↓
STANDBY
 ↓
ANALYZE
 ↓
FAKE ANALYZING
 ↓
ANALYSIS COMPLETE
 ↓
EXECUTE SOLUTION
 ↓
EXECUTING
 ↓
CONFUSED
 ↓
DESPERATE
 ↓
GIVE UP
 ↓
RESET
 ↓
STANDBY
```

---

## Standby画面

例：

```text
RUBIK'S CUBE
ADVANCED SOLVING SYSTEM

SERIAL DEVICE

● DISCONNECTED

[ CONNECT ]
```

接続後：

```text
● CONNECTED

[ ANALYZE ]
```

Mockモードの場合はシリアル接続なしでANALYZE可能にする。

---

## Fake Analyzer

ANALYZE押下後、約5〜10秒程度のFake Analyzer演出を行う。

実際の解析は一切行わない。

以下のような処理が進んでいるように見せる。

```text
INITIALIZING CUBE ANALYZER...

SCANNING CUBE GEOMETRY...

IDENTIFYING CORNERS...
8 / 8

IDENTIFYING EDGES...
12 / 12

BUILDING STATE GRAPH...

SEARCHING SOLUTION SPACE...

OPTIMIZING MOVE SEQUENCE...

VERIFYING SOLUTION...

ANALYSIS COMPLETE
```

高速で流れるダミーログも表示する。

例：

```text
[16:42:01.312] Initializing solver core
[16:42:01.531] Edge topology loaded
[16:42:01.882] Corner topology loaded
[16:42:02.103] Searching state 18293
[16:42:02.104] Searching state 18294
[16:42:02.105] Searching state 18295
[16:42:02.421] Candidate solution found
[16:42:02.532] Optimizing sequence
```

以下のようなダミー数値も使用してよい。

- Search nodes
- Search depth
- Confidence
- Entropy
- Optimization score
- Estimated moves
- State count
- Matrix
- Cube coordinates

値に意味は必要ない。

---

## UIデザイン

UIは**ハッカー映画・SF映画に出てくる高度な解析システム風に大きく寄せる。**

リアルな業務システムや研究装置としての正確さよりも、

**「技術が分からない人が見ても、ものすごい解析をしていると一瞬で理解できること」**

を優先する。

積極的に以下を使用する。

- 黒背景
- ネオンカラー
- 発光
- HUD
- グリッド
- スキャンライン
- 高速で流れるログ
- 高速で変化する数字
- グラフ
- 波形
- 円形ゲージ
- Progress bar
- レーダー風表示
- 点滅するステータス
- 複数の解析パネル
- COMPLETE / SUCCESS表示
- 大きなステータステキスト

解析中は画面の複数箇所が同時に動いている状態にする。

可能なら中央付近に、

- ダミーのルービックキューブ
- ワイヤーフレームCube
- Cube周囲を走るスキャン表現
- Cubeから伸びる解析ライン
- Cube周辺に浮かぶ数値

などを表示する。

実際のキューブ状態とは一切連動しなくてよい。

### UI演出上の重要事項

最初からコミカルな画面にはしない。

Fake Analyzer中は完全に真面目で、

```text
本当に高度なシステム
本当に解析している
本当に解法を発見した
```

ように見せる。

その後、実行が始まってから徐々におかしくなっていく構成にする。

---

## Analysis Complete

Fake Analyzer終了後、

```text
ANALYSIS COMPLETE

OPTIMAL SOLUTION FOUND

18 MOVES

CONFIDENCE
100%

[ EXECUTE SOLUTION ]
```

のように表示する。

解析成功を非常に強調する。

必要なら、

- 画面フラッシュ
- COMPLETE演出
- 100%ゲージ
- SUCCESS表示

などを入れてよい。

ここではArduinoをまだ動かさない。

EXECUTE SOLUTIONボタン押下後に開始する。

---

## Estimated Moves

Fake Analyzer終了時に、

```ts
estimatedMoves
```

をランダムで生成する。

範囲：

```text
15〜25
```

程度。

これは完全なダミー値である。

---

## CubeMove

以下の型を使用する。

```ts
type CubeFace =
  | "R"
  | "L"
  | "U"
  | "D"
  | "F"
  | "B";

type MoveDirection =
  | "CW"
  | "CCW";

interface CubeMove {
  face: CubeFace;
  direction: MoveDirection;
}
```

---

## MoveGenerator

SolverではなくMoveGeneratorを実装する。

現在のキューブ状態を持たない。

以下12種類から基本的にランダムで選択する。

```text
R
R'
L
L'
U
U'
D
D'
F
F'
B
B'
```

ただし、完全な一様ランダムより「迷っている」ように見せる。

一定確率で直前の操作を即座に打ち消す。

例：

```text
R
R'
```

```text
U'
U
```

確率は10〜20%程度でよい。

また、同じ面を何度か操作するようなパターンが発生してもよい。

```text
R
R
R'
R
```

---

## 操作回数

最大操作回数をConfigで定義する。

初期値：

```ts
maxMoves = 35;
```

Fake Analyzerが、

```text
18 MOVES
```

と表示していても35手まで動き続ける。

---

## Execute画面

実行開始直後：

```text
EXECUTING OPTIMAL SOLUTION

MOVE 4 / 18

SOLUTION PROGRESS
████████░░░░░░░░░░
```

のように表示する。

画面は以下の2モジュールを上下に配置する。

1. 上段：`SEQUENCE MONITOR`
   - 現在の操作回数
   - 予定手数
   - 直近の操作列
   - モーター診断情報
2. 下段：`SOLUTION PROGRESS`
   - 実際の進捗率
   - Progress bar
   - パス整合性などのダミー診断情報

中央に現在のCubeMoveを大きく表示する専用モジュールは設けない。

---

## 予定手数を超えた場合

重要な演出。

18手で解けると言っていた場合でも、

```text
MOVE 19 / 18
MOVE 20 / 18
MOVE 21 / 18
```

とそのまま続ける。

これはエラーではない。

むしろ積極的に表示する。

`SOLUTION PROGRESS` の進捗率は、予定手数に対する実際の操作回数から計算し、100%を超えても制限しない。

Progress barは100%で通常の表示領域全幅に到達し、それ以降はモジュール境界を越えて画面右方向へ伸び続ける。画面外へ伸びた部分はビューポート端で切り、横スクロールは発生させない。

100%超過分のバーの伸びは演出上の倍率を適用する。初期値は1.5倍とする。

例：

```text
実際の進捗率 100% → 表示幅 100%
実際の進捗率 120% → 表示幅 130%
実際の進捗率 150% → 表示幅 175%
```

画面に表示する数値は増幅後の値ではなく、実際の進捗率を使用する。

予定手数を超えたときは画面上部に警告を表示する。警告用の領域は実行開始時から固定高で確保し、警告の表示前後で下のモジュールが移動しないようにする。

その付近から、

```text
RECALCULATING...
```

```text
SOLUTION DEVIATION DETECTED
```

```text
RECALCULATING OPTIMAL PATH...
```

などを表示する。

もちろん実際には再計算しない。

---

## 状態悪化演出

序盤：

```text
EXECUTING OPTIMAL SOLUTION
```

中盤：

```text
RECALCULATING...
```

さらに進む：

```text
SOLUTION DEVIATION DETECTED
```

終盤：

```text
RECOVERY ATTEMPT
```

など、徐々にシステムが苦しくなっているようにする。

---

## 音声

音声ファイルは以下のような構成を想定する。

```text
public/audio/

are.mp3
okashii.mp3
tokenai.mp3
nandeda.mp3
konnahazudeha.mp3
murida.mp3
```

現時点で実ファイルがなくても動作するようにする。

ファイルが存在しない場合はエラーでアプリ全体を止めず、console warning程度にする。

---

## 音声タイミング

序盤は基本的に無言。

### Move 0〜5

無言。

### Move 6〜10

低確率で、

```text
「あれ……」
```

### Move 11〜20

```text
「解けない……」
「おかしいな……」
```

### Move 21〜30

```text
「なんでだ……」
「こんなはずでは……」
```

### Move 31〜

```text
「無理だ……」
```

毎Move必ず音声を出すのではなく、一定確率で再生する。

例：

```ts
executing: 0
confused: 0.15
troubled: 0.25
desperate: 0.4
```

音声が再生中の場合は別音声を重ねない。

---

## Give Up

maxMovesまで到達したら操作を終了する。

最後に可能であれば、

```text
「無理だ……」
```

を再生する。

画面：

```text
SOLVING STATUS

FAILED

[ RESET ]
```

RESETでStandbyへ戻す。

物理的なルービックキューブを元に戻す処理は不要。

---

## シリアル通信仕様

UTF-8テキスト。

1メッセージ1行。

改行は `\n` 。

### PC → Arduino

```text
PING
```

```text
MOVE <FACE> <DIRECTION>
```

例：

```text
MOVE R CW
MOVE U CCW
MOVE F CW
```

停止：

```text
STOP
```

### Arduino → PC

```text
READY
```

```text
PONG
```

```text
MOVE_START <FACE> <DIRECTION>
```

```text
MOVE_DONE <FACE> <DIRECTION>
```

エラー：

```text
ERROR <MESSAGE>
```

---

## Move送信方式

全操作をArduinoへまとめて送らない。

必ず1操作ずつ送信する。

```text
PC
 ↓
MOVE R CW
 ↓
Arduino
 ↓
MOVE_START R CW
 ↓
実際のモーター動作
 ↓
MOVE_DONE R CW
 ↓
PC
 ↓
次のMOVE
```

PCは `MOVE_DONE` を受信するまで次のMoveを送信しない。

---

## タイムアウト

MOVE送信後、一定時間 `MOVE_DONE` が返ってこない場合は停止する。

初期値：

```ts
moveTimeoutMs = 5000;
```

画面：

```text
MOTOR RESPONSE TIMEOUT
```

---

## MockCubeController

Arduino実機なしでPC側を開発できるようにする。

以下のInterfaceを想定する。

```ts
interface CubeController {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  sendMove(move: CubeMove): Promise<void>;
  stop(): Promise<void>;

  onMoveStart(
    callback: (move: CubeMove) => void
  ): void;

  onMoveDone(
    callback: (move: CubeMove) => void
  ): void;

  onError(
    callback: (error: Error) => void
  ): void;
}
```

実装：

```text
WebSerialCubeController
MockCubeController
```

Mockでは例えば、

```text
MOVE
↓
300ms
↓
MOVE_START
↓
800ms
↓
MOVE_DONE
```

程度でよい。

---

## Mockモード

URLパラメータでMockを切り替えられるようにする。

例：

```text
?mock=true
```

の場合、

```text
MockCubeController
```

を使用する。

通常は、

```text
WebSerialCubeController
```

を使用する。

---

## 推奨ディレクトリ構成

```text
src/

  App.tsx
  main.tsx

  components/
    StandbyScreen.tsx
    AnalyzerScreen.tsx
    AnalysisCompleteScreen.tsx
    ExecuteScreen.tsx
    GiveUpScreen.tsx
    ConnectionStatus.tsx
    FakeTerminal.tsx
    ProgressBar.tsx

  show/
    ShowController.ts
    showState.ts

  cube/
    CubeMove.ts
    MoveGenerator.ts

  serial/
    CubeController.ts
    WebSerialCubeController.ts
    MockCubeController.ts
    serialParser.ts

  audio/
    AudioManager.ts
    audioConfig.ts

  analyzer/
    fakeAnalyzer.ts
    fakeAnalyzerConfig.ts

  config/
    showConfig.ts

  styles/
    global.css
    analyzer.css
    execute.css
```

必要なら変更してよいが、

- UI
- Show logic
- Serial
- Move generation
- Audio
- Fake Analyzer

の責務は分離する。

---

## Config

演出用の値はマジックナンバーとして各コンポーネントへ散らさず、Configへまとめる。

例：

```ts
export const showConfig = {
  analyzerDurationMs: 7000,

  estimatedMoves: {
    min: 15,
    max: 25,
  },

  maxMoves: 35,

  phases: {
    confusedStart: 7,
    troubledStart: 15,
    desperateStart: 25,
  },

  moveTimeoutMs: 5000,

  progressOverflowMultiplier: 1.5,

  audioProbability: {
    executing: 0,
    confused: 0.15,
    troubled: 0.25,
    desperate: 0.4,
  },
};
```

必要に応じて値を増やしてよい。

---

## Debug log

consoleへ以下のようなログを出す。

```text
[SHOW] state=executing
[SERIAL] > MOVE R CW
[SERIAL] < MOVE_START R CW
[SERIAL] < MOVE_DONE R CW
[MOVE] count=12
[AUDIO] play tokenai
```

---

## エラー処理

最低限以下を扱う。

### Serial切断

```text
SERIAL CONNECTION LOST
```

操作停止。

### Move timeout

```text
MOTOR RESPONSE TIMEOUT
```

操作停止。

### Audioエラー

console warningのみ。

アプリ全体は停止させない。

---

## 初期実装の優先順位

まずArduino実機なしで完成させる。

以下の順番で進める。

1. React + TypeScript + Vite
2. 状態遷移
3. Standby / Analyzer / Analysis Complete / Execute / Give Up画面
4. Fake Analyzer
5. MockCubeController
6. MoveGenerator
7. ShowController
8. AudioManager
9. Web Serial API

まずはMockモードで一連のショーが最後まで動くことを優先する。

---

## 初期版の完成条件

以下が動作すれば初期版完成。

1. アプリを開く
2. `?mock=true` でMockモードになる
3. ANALYZEを押す
4. 派手なFake Analyzerが数秒動く
5. `ANALYSIS COMPLETE`
6. `18 MOVES` などのダミー解法が表示される
7. EXECUTE SOLUTIONを押す
8. ランダムなCubeMoveが開始される
9. `Move 1 / 18` などが表示される
10. MockCubeControllerからMOVE_DONEが返る
11. 次のMoveへ進む
12. `Move 19 / 18` のように予定数を超える
13. 進捗バーが100%を超えて画面右方向へ伸び続ける
14. 警告表示時に実行モジュールの位置がずれない
15. RE-CALCULATING系演出が出る
16. 途中から困った音声が再生される
17. maxMovesまで続く
18. 最後に `FAILED`
19. RESETでStandbyへ戻る

---

## 重要な設計方針

このシステムの本質は、

```text
Fake Analyzer
    ↓
Random MoveGenerator
    ↓
Arduino
```

である。

Fake Analyzerは、

```text
OPTIMAL SOLUTION FOUND
18 MOVES
99.97% CONFIDENCE
```

と表示するが、その結果をMoveGeneratorへ渡してはいけない。

両者には技術的な関連性を持たせない。

解析処理とCube操作が完全に無関係であることが、この作品の重要な仕様。

また、過度に正しいRubik's Cube Solverを作ろうとしない。

**この装置は「解けないこと」が正しい動作である。**
