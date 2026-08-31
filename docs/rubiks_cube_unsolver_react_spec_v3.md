# Rubik's Cube Unsolver — PC / React アプリケーション要件定義書 v3

## 1. 概要

ルービックキューブを自動で操作する装置のPC側Webアプリケーションを実装する。

本システムは実際のルービックキューブ状態を解析・解決しない。

PC側は主に以下を担当する。

1. 派手なFake Analyzer演出
2. ランダムな高レベル操作生成
3. Arduinoへの操作キック
4. Arduinoの操作完了待ち
5. 困惑・失敗演出
6. 音声再生

Arduino内部のサーボ操作・把持状態遷移はPC側では管理しない。

---

## 2. 技術スタック

- React
- TypeScript
- Vite
- CSS
- Web Serial API

Electronは使用しない。

---

## 3. システム構成

```text
React UI
   |
   v
ShowController
   |
   +---- FakeAnalyzer
   |
   +---- OperationGenerator
   |
   +---- AudioManager
   |
   +---- CubeController
             |
             +---- WebSerialCubeController
             |
             +---- MockCubeController
```

---

## 4. 実装しないもの

- カメラ
- Webカメラ制御
- OpenCV
- 画像解析
- 色認識
- CubeState
- Rubik's Cube Solver
- 最短手数計算
- 完成判定
- Arduino内部のサーボ角度管理
- ENGAGE / RETRACT制御
- PCA9685制御
- 全体回転時の同期補間

---

## 5. PC / Arduino 責務境界


PCが扱うのは高レベル操作のみ。

```text
DEMO_START

MOVE R
MOVE L
MOVE F
MOVE B
MOVE <FACE> HESITATE
THINK

ROTATE RL
ROTATE FB

DEMO_END
```

Arduinoは各コマンドを機構トランザクションとして内部で完結させる。

### `DEMO_START`

```text
Arduino初期状態:
全4面RETRACT / キューブを把持しない
        ↓
DEMO_START
        ↓
Arduinoが4面を把持
        ↓
HOLD_ALL / READY
```

### `MOVE` / `ROTATE`

```text
HOLD_ALL / READY
↓
必要な把持状態遷移
↓
キューブ操作
↓
必要なサーボリセット
↓
4面再把持
↓
全回転サーボ0°
↓
DONE
```

### `DEMO_END`

```text
HOLD_ALL / READY
↓
DEMO_END
↓
4面すべてRETRACT
↓
キューブを下へ落とす
↓
IDLE_RELEASED
```

PCはこれらの途中工程を知らない。

---

## 6. ArduinoのDONE契約


PC側にとって重要な状態契約を以下とする。

### `DEMO_START_DONE`

Arduinoは必ず、

```text
HOLD_ALL
全4面 = ENGAGED
全回転サーボ = 0°
MOVE / ROTATEを受け付け可能
```

である。

### `MOVE_DONE` / `ROTATE_DONE`

Arduinoは必ず、

```text
HOLD_ALL
全4面 = ENGAGED
全回転サーボ = 0°
次の操作を受け付け可能
```

である。

### `DEMO_END_DONE`

Arduinoは必ず、

```text
IDLE_RELEASED
全4面 = RETRACTED
全回転サーボ = 0°
キューブを把持していない
```

である。

PCはこれらの契約を前提として次の状態へ遷移する。

---

## 7. アプリケーション状態


```ts
type ShowState =
  | "preDemo"
  | "startingDemo"
  | "standby"
  | "analyzing"
  | "analysisComplete"
  | "executing"
  | "confused"
  | "desperate"
  | "giveUp"
  | "endingDemo"
  | "error";
```

### `preDemo`

Arduinoは `IDLE_RELEASED`。

キューブを1面も把持していない。

ユーザーによる明示的な `START DEMO` 操作を待つ。

### `standby`

`DEMO_START_DONE` 後。

Arduinoは `HOLD_ALL / READY` で、ANALYZEを開始できる。

---

## 8. 基本フロー


```text
APP START / SERIAL CONNECT
  ↓
PRE-DEMO
Arduino: IDLE_RELEASED
キューブを1面も把持しない
  ↓
ユーザーが [ START DEMO ] を押す
  ↓
PC → DEMO_START
  ↓
DEMO_START_DONE を待つ
  ↓
Arduino: HOLD_ALL / READY
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
操作生成
  ↓
Arduinoへ1操作送信
  ↓
DONE待ち
  ↓
次の操作
  ↓
...
  ↓
最後の操作のDONEを確認
  ↓
GIVE UP
「無理だ……」等の演出
  ↓
PC → DEMO_END
  ↓
Arduinoが4面すべてRETRACT
  ↓
キューブを下へ落とす
  ↓
DEMO_END_DONE
  ↓
Arduino: IDLE_RELEASED
```

デモはユーザーの明示的な `START DEMO` 操作なしに開始してはならない。

アプリ起動・Arduino接続だけではキューブを把持しない。

また、GIVE UP時のキューブ落下は意図的な演出であり、STOPや通信エラー時の安全停止とは区別する。

---

## 9. Fake Analyzer

Fake Analyzerの基本仕様は従来通りとする。

- 実解析はしない
- ハッカー映画 / SF映画風の派手なUI
- 高速ログ
- ダミー数値
- ゲージ
- 波形
- HUD
- `OPTIMAL SOLUTION FOUND`
- `CONFIDENCE 99.97%`
- Estimated Moves 15〜25程度

Fake AnalyzerとOperationGeneratorの間に技術的な関連性を持たせない。

---

## 10. 操作モデル

従来の `CubeMove + Direction` ではなく、Arduinoの高レベルコマンドに合わせて操作を抽象化する。

```ts
type CubeFace = "R" | "L" | "F" | "B";

type CubeAxis = "RL" | "FB";

type CubeOperation =
  | {
      type: "faceTurn";
      face: CubeFace;
    }
  | {
      type: "faceHesitation";
      face: CubeFace;
    }
  | {
      type: "thinking";
    }
  | {
      type: "wholeRotation";
      axis: CubeAxis;
    };
```

---

## 11. 回転方向

初期仕様ではArduinoの物理プリミティブは1方向の90度回転のみとする。

したがってPC→Arduino通信にはCW / CCWを含めない。

逆方向90度相当が必要な場合は、

```text
同じ90度操作 × 3回
```

で表現可能。

Rubik's Cube Unsolverでは実際にキューブを解く必要がないため、初期実装では方向を持たないランダム操作で十分とする。

---

## 12. OperationGenerator

従来の `MoveGenerator` は `OperationGenerator` へ変更する。

現在のキューブ状態を保持しない。Solverではない。

```ts
interface OperationGenerator {
  nextOperation(): CubeOperation;
}
```

基本候補:

```text
MOVE R
MOVE L
MOVE F
MOVE B
```

演出・姿勢変化として、

```text
MOVE <FACE> HESITATE
THINK
ROTATE RL
ROTATE FB
```

も混ぜる。初期確率は通常MOVE 70%、各演出・全体回転を10%ずつとし、各確率はConfigで変更可能にする。

---

## 13. Arduino通信プロトコル


通信はUTF-8テキスト、1行1メッセージ。

### PC → Arduino

```text
PING

DEMO_START

MOVE R
MOVE L
MOVE F
MOVE B
MOVE <FACE> HESITATE
THINK

ROTATE RL
ROTATE FB

DEMO_END

STATUS
STOP
```

### Arduino → PC

```text
IDLE
READY
PONG

DEMO_START_START
DEMO_START_DONE

MOVE_START R
MOVE_DONE R

THINK_START
THINK_DONE

ROTATE_START RL
ROTATE_DONE RL

DEMO_END_START
DEMO_END_DONE

BUSY
ERROR <CODE>
```

`IDLE` はキューブを把持していないデモ開始前 / 終了後の状態。

`READY` は4面把持済みで `MOVE` / `ROTATE` を実行可能な状態。

---

## 14. PC側の通信方針


PCは高レベルコマンドを1つ送信し、対応する完了通知を待つ。

### デモ開始

```text
ユーザー START DEMO
       ↓
DEMO_START
       ↓
DEMO_START_DONE
       ↓
standbyへ
```

### キューブ操作

```text
OperationGenerator
       ↓
CubeOperation
       ↓
CubeController.executeOperation()
       ↓
MOVE / ROTATE
       ↓
Arduino
       ↓
MOVE_DONE / ROTATE_DONE
       ↓
Promise resolve
       ↓
次のOperation
```

### デモ終了

```text
GIVE UP
       ↓
DEMO_END
       ↓
Arduinoが全把持解除
       ↓
キューブ落下
       ↓
DEMO_END_DONE
```

複数の高レベルコマンドをArduinoへ一括送信しない。

---

## 15. CubeController Interface


推奨:

```ts
interface CubeController {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  isConnected(): boolean;
  isBusy(): boolean;

  startDemo(): Promise<void>;

  executeOperation(
    operation: CubeOperation
  ): Promise<void>;

  endDemo(): Promise<void>;

  stop(): Promise<void>;

  getStatus(): Promise<
    "idle" | "ready" | "busy" | "error"
  >;

  onOperationStart?(
    callback: (operation: CubeOperation) => void
  ): void;

  onError?(
    callback: (error: Error) => void
  ): void;
}
```

### `startDemo()`

`DEMO_START` を送信し、`DEMO_START_DONE` まで待つ。

### `executeOperation()`

`MOVE` / `ROTATE` を送信し、対応する `*_DONE` まで待つ。

### `endDemo()`

`DEMO_END` を送信し、`DEMO_END_DONE` まで待つ。

各Promiseはシリアル送信時点ではresolveしない。

---

## 16. WebSerialCubeController

例:

```ts
await controller.executeOperation({
  type: "faceTurn",
  face: "R",
});
```

内部通信:

```text
> MOVE R
< MOVE_START R

... Arduino内部でサーボ・把持・リセット処理 ...

< MOVE_DONE R
```

`MOVE_DONE R` を受信した時点でPromiseをresolveする。

全体回転も同様。

```text
> ROTATE RL
< ROTATE_START RL
...
< ROTATE_DONE RL
```

---

## 17. ShowController


ShowControllerはArduinoの機構途中状態を管理しない。

### デモ開始

ユーザーが `START DEMO` を押したときだけ、

```ts
await cubeController.startDemo();
```

を実行する。

成功後に `standby` へ遷移する。

### 実行ループ

概念:

```ts
while (shouldContinue) {
  const operation = operationGenerator.nextOperation();

  await cubeController.executeOperation(operation);

  moveCount++;

  maybePlayAudio();
  updateShowPhase();
}
```

Arduino側の物理動作時間が変わってもPC側は影響を受けにくい。

### デモ終了

最後のOperationのDONEを確認した後、Give Up演出を行う。

その後、

```ts
await cubeController.endDemo();
```

を実行する。

`DEMO_END_DONE` を受信した時点でキューブは把持されておらず、下へ落下済みであることを前提とする。

---

## 18. タイムアウト

Arduinoの1コマンドには複数の物理工程が含まれるため、従来の5秒では短い可能性がある。

タイムアウト値はConfig化する。

初期値例:

```ts
operationTimeoutMs: 15000
```

実機の所要時間を確認して調整する。

---

## 19. タイムアウト時

`executeOperation()` がタイムアウトした場合、PCは次の操作を送信してはならない。

画面例:

```text
MACHINE RESPONSE TIMEOUT
```

必要に応じて `STATUS` を問い合わせる。

Arduinoが安全状態へ復帰したことを確認できない限り、次のMOVE / ROTATEを開始しない。

---

## 20. BUSY時

ArduinoがBUSYの場合、PCは新しい操作を送信しない。

誤ってBUSY中に送信して `ERROR BUSY` を受信した場合は、現在のショーを停止してエラー表示する。

---

## 21. MockCubeController


MockもArduinoと同じライフサイクル / トランザクション契約を再現する。

初期状態:

```text
IDLE
キューブ未把持
```

### `startDemo()`

```text
DEMO_START
  ↓
DEMO_START_START相当
  ↓
短い待機
  ↓
DEMO_START_DONE相当
  ↓
READY
```

### 面回転

```text
executeOperation(MOVE R)
        ↓
MOVE_START相当
        ↓
約1〜2秒
        ↓
MOVE_DONE相当
        ↓
Promise resolve
```

### 全体回転

```text
executeOperation(ROTATE RL)
        ↓
ROTATE_START相当
        ↓
面回転より長めの待機
        ↓
ROTATE_DONE相当
        ↓
Promise resolve
```

### 迷い・思考演出

`MOVE <FACE> HESITATE`は約1.5秒、`THINK`は約1秒のトランザクションとして再現し、それぞれ対応するSTART/DONE後にPromiseをresolveする。

### `endDemo()`

```text
DEMO_END
  ↓
DEMO_END_START相当
  ↓
短い待機
  ↓
DEMO_END_DONE相当
  ↓
IDLE
```

Mockの内部工程をUI側へ公開する必要はない。

---

## 22. Mockモード

```text
?mock=true
```

の場合:

```text
MockCubeController
```

通常:

```text
WebSerialCubeController
```

---

## 23. 実行画面のカウント

PC側のカウントはArduino内部サーボ工程数ではなく、高レベル操作単位とする。

```text
MOVE R     → 1 operation
MOVE R HESITATE → 1 operation
THINK      → 1 operation
ROTATE RL  → 1 operation
```

Fake Analyzer上のEstimated Movesと実操作数は意図的に一致させる必要はない。

予定値を超えても、

```text
MOVE 19 / 18
```

などとして続行可能。

---

## 24. 音声・困惑演出

音声仕様は従来通り。

操作完了後に確率的に再生する。

例:

```text
序盤: 無言
↓
「あれ……」
↓
「解けない……」
↓
「なんでだ……」
↓
「無理だ……」
```

Arduino内部の細かなサーボ工程と音声を同期する必要はない。

PC側が必要とする同期点は基本的に、

```text
operation start
operation done
```

のみ。

---

## 25. Arduino内部の迷い演出

Arduinoは任意指定の迷い演出として、次のコマンドを受け付ける。

```text
MOVE R HESITATE
```

対象面を把持したまま、Arduino内部で次の動作を完結させる。

```text
0° → 45°: 500ms
45°で待機: 500ms
45° → 0°: 500ms
```

完了応答は通常MOVEと同じ形式とする。

```text
MOVE_START R
MOVE_DONE R
READY
```

Reactは`faceHesitation`操作を`MOVE <FACE> HESITATE`として送信する。Arduinoからの応答は通常MOVEと同形のため、送信中の期待操作と面を照合して完了させる。

### 25.1 Arduino内部の静止思考演出

Arduinoは任意指定の静止演出として`THINK`を受け付け、4面把持・全回転0°を維持したまま1秒間サーボへ新しい指令を送らない。

```text
THINK
THINK_START
THINK_DONE
READY
```

Reactは`thinking`操作を`THINK`として送信し、`THINK_START` / `THINK_DONE`を解析する。THINKはMOVE数と最大操作数へ1操作として加算する。

---

## 26. Give Up


最大操作数へ到達したら、PCは新しい `MOVE` / `THINK` / `ROTATE` を送信しない。

最後のArduino操作の `*_DONE` を必ず確認する。

その時点ではArduinoは、

```text
HOLD_ALL
全回転サーボ = 0°
READY
```

である。

その後、Give Up演出を行う。

例:

```text
「無理だ……」
SOLVING STATUS: FAILED
```

Give Up演出の締めとして、

```text
DEMO_END
```

をArduinoへ送信する。

Arduinoは4面すべての把持を解除し、ルービックキューブを下へ落下させる。

PCは、

```text
DEMO_END_DONE
```

を待つ。

`DEMO_END_DONE` 後は、

```text
IDLE_RELEASED
キューブ未把持
```

である。

キューブを落とす動作自体を、失敗演出の最終的なオチとして扱う。

---

## 27. STOP


PC側のSTOPは安全停止要求であり、`DEMO_END` とは別物。

STOP送信後に追加のMOVE / ROTATEを送らない。

Arduino側が安全なHOLD状態へ移行する責任を持つ。

STOPによってキューブを落下させてはならない。

キューブを意図的に落とすのは正常なGive Upフローから送信される `DEMO_END` のみ。

---

## 28. 推奨ディレクトリ構成

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

  show/
    ShowController.ts
    showState.ts

  operations/
    CubeOperation.ts
    OperationGenerator.ts

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
```

---

## 29. Config例

```ts
export const showConfig = {
  analyzerDurationMs: 7000,

  estimatedMoves: {
    min: 15,
    max: 25,
  },

  maxOperations: 35,

  operationTimeoutMs: 15000,

  wholeRotationProbability: 0.1,
  faceHesitationProbability: 0.1,
  thinkingProbability: 0.1,

  phases: {
    confusedStart: 7,
    troubledStart: 15,
    desperateStart: 25,
  },

  audioProbability: {
    executing: 0,
    confused: 0.15,
    troubled: 0.25,
    desperate: 0.4,
  },
};
```

---

## 30. Debug log


デモ開始:

```text
[SHOW] state=preDemo
[SERIAL] > DEMO_START
[SERIAL] < DEMO_START_START
[SERIAL] < DEMO_START_DONE
[SHOW] state=standby
```

面回転:

```text
[SHOW] state=executing
[OPERATION] faceTurn R
[SERIAL] > MOVE R
[SERIAL] < MOVE_START R
[SERIAL] < MOVE_DONE R
[OPERATION] completed
[SHOW] count=12
```

全体回転:

```text
[OPERATION] wholeRotation RL
[SERIAL] > ROTATE RL
[SERIAL] < ROTATE_START RL
[SERIAL] < ROTATE_DONE RL
```

デモ終了:

```text
[SHOW] state=giveUp
[SERIAL] > DEMO_END
[SERIAL] < DEMO_END_START
[SERIAL] < DEMO_END_DONE
[SHOW] cube released
```

---

## 31. 初期完成条件


1. Mockモードの初期状態が `IDLE` / キューブ未把持相当になる
2. ユーザーが明示的に `START DEMO` を押すまで `DEMO_START` を送信しない
3. `startDemo()` が `DEMO_START_DONE` まで待つ
4. `DEMO_START_DONE` 後に初めてANALYZE可能になる
5. OperationGeneratorが高レベル操作を生成する
6. `executeOperation()` がDONEまで待つ
7. DONE前に次のコマンドを送信しない
8. `MOVE R` / `MOVE_DONE R` が処理できる
9. `MOVE R HESITATE`を送信し、同面の`MOVE_DONE R`で完了できる
10. `THINK` / `THINK_DONE`が処理できる
11. `ROTATE RL` / `ROTATE_DONE RL` が処理できる
12. タイムアウト時に次操作を停止する
13. BUSY / ERRORを処理できる
14. Give Up時には最後の操作DONEを待つ
15. Give Up演出後に `DEMO_END` を送信する
16. `endDemo()` が `DEMO_END_DONE` まで待つ
17. `DEMO_END_DONE` 後はキューブ未把持相当の `IDLE` となる
16. STOPでは `DEMO_END` を送信せず、キューブを落下させない
17. Arduino内部のサーボ工程をReact側が管理していない

---

## 32. 最終設計原則


PCとArduinoの境界は、

```text
PC:
デモを始める
何をしてほしいかを指定する
デモを終える

Arduino:
それぞれをどう機構的に実行するか
```

とする。

デモライフサイクル:

```text
アプリ起動
    ↓
IDLE / キューブ未把持
    ↓ ユーザー START DEMO
DEMO_START
    ↓
READY / HOLD_ALL
    ↓
MOVE / ROTATE を繰り返す
    ↓
GIVE UP
    ↓
DEMO_END
    ↓
IDLE / キューブ未把持・落下済み
```

通常操作では、

```text
MOVE R
```

を送信し、

```text
MOVE_DONE R
```

を待つだけでよい。

全体回転も、

```text
ROTATE RL
```

を送り、

```text
ROTATE_DONE RL
```

を待つ。

デモ開始・終了も同様に、PCは高レベルコマンドだけを扱う。

**シリアル通信の単位を「サーボ操作」ではなく、「デモライフサイクルまたは安全に完結する機械操作トランザクション」とする。**

---
