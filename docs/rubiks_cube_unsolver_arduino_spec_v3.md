# Rubik's Cube Unsolver — Arduino 制御要件定義書 v3

## 1. 目的

本仕様書は、Rubik's Cube Unsolver における Arduino 側の機構制御・サーボ制御・把持制御・シリアル通信を定義する。

PC 側は「どの操作を実行してほしいか」だけを Arduino に指示する。Arduino は、その操作に必要なサーボ制御、安全確認、把持状態遷移、初期状態への復帰までを **1トランザクション** として完結させる。

PC 側は個々のサーボ角度、スライダーの ENGAGE / RETRACT、リセット手順を管理しない。

---

## 2. 基本設計思想


Arduino の責務は次の通りとする。

```text
デモ開始前
IDLE_RELEASED
全アームRETRACT / 全回転サーボ0°
        |
        | DEMO_START
        v
Arduinoが4面を把持
        |
        v
HOLD_ALL / READY
        |
        | MOVE R / ROTATE RL など
        v
Arduino内部で安全な機構制御
        |
        v
HOLD_ALL / READY
        |
        | DEMO_END
        v
4面を意図的にRETRACT
キューブを落下させる
        |
        v
IDLE_RELEASED
```

PC から `MOVE` / `ROTATE` の1コマンドを受信したら、Arduino はその操作に必要なサーボ制御、安全確認、把持状態遷移、リセット、`HOLD_ALL` への復帰までを1つのトランザクションとして完結させる。

PC 側は個々のサーボ角度、スライダーの ENGAGE / RETRACT、リセット手順などを知らない。

デモ開始と終了についても、PC は高レベルコマンドだけを送る。

- `DEMO_START`: キューブの把持を開始し、`HOLD_ALL / READY` へ遷移する
- `DEMO_END`: 4面すべての把持を解除し、キューブを意図的に落下させ、`IDLE_RELEASED` へ遷移する

`MOVE_DONE` / `ROTATE_DONE` は単に「90度回転が終わった」ことを意味しない。

以下まで完了していることを意味する。

- 対象操作が完了
- 必要なリセット操作が完了
- 4面把持状態 `HOLD_ALL` に復帰
- 4台の回転サーボが論理0°に復帰
- 次の操作を安全に受け付け可能

---

## 3. ハードウェア構成

### 3.1 操作面

物理的に操作する面は以下の4面。

- R: Right
- L: Left
- F: Front
- B: Back

U / D 面には直接操作用サーボを配置しない。

### 3.2 サーボ構成

各面に MG996R を2台配置する。

**回転サーボ**

- 凹型把持アームの回転
- 対象面の90度回転
- キューブ全体の90度回転

**スライドサーボ**

- スライダクランク機構の駆動
- `ENGAGE`: キューブへ押し出す
- `RETRACT`: キューブから離す

合計8台の MG996R を使用する。

### 3.3 PWMドライバ

Adafruit I2C接続16ch PWM/サーボシールド（PCA9685）を使用する。

| 面 | 回転サーボ | スライドサーボ |
|---|---:|---:|
| R | CH0 | CH1 |
| L | CH2 | CH3 |
| F | CH4 | CH5 |
| B | CH6 | CH7 |

PWM周波数は50Hzを基本とする。

---

## 4. 電源

サーボ用に外部5V 10A電源を使用する。サーボ電源をArduinoの5Vピンから供給しない。

```text
PC USB
  |
Arduino
  |
  | I2C
  v
PCA9685
  |
  +---- Servo V+ <- 5V / 10A
                    |
                    +-- MG996R x 8
```

---

## 5. 回転サーボの論理角度

各回転サーボは、実機で安全に動作できるパルス幅の範囲内に次の2姿勢を定義する。

```text
論理0°
論理90°
```

180°姿勢は基本制御には使用しない。

論理角度はサーボの絶対的な物理角度ではない。各サーボについてキャリブレーションしたパルス幅へ変換する。

```cpp
struct RotationServoConfig {
    uint16_t angle0Us;
    uint16_t angle90Us;
};
```

例:

```text
R: 0° = 880us, 90° = 1660us
L: 0° = 2050us, 90° = 1270us
```

取り付け方向によって、論理0°→90°で実パルス幅が増加するサーボと減少するサーボがあってよい。上位ロジックでは常に論理角度で扱う。

---

## 6. 通常待機状態


Arduinoには2種類の待機状態を定義する。

### 6.1 デモ開始前 / 終了後: `IDLE_RELEASED`

```text
R: RETRACTED / rotation = 0°
L: RETRACTED / rotation = 0°
F: RETRACTED / rotation = 0°
B: RETRACTED / rotation = 0°
```

Arduino起動後の初期状態は `IDLE_RELEASED` とする。

この状態ではキューブを1面も把持しない。

`MOVE` / `ROTATE` は受け付けず、`DEMO_START` を待つ。

デモ開始前は、キューブが所定位置に手動または別の物理手段で配置されていることを前提とする。

### 6.2 デモ実行中: `HOLD_ALL`

```text
R: ENGAGED / rotation = 0°
L: ENGAGED / rotation = 0°
F: ENGAGED / rotation = 0°
B: ENGAGED / rotation = 0°
```

`DEMO_START` 完了後の通常待機状態を `HOLD_ALL` とする。

`MOVE` / `ROTATE` を受け付けることができるのは原則として `HOLD_ALL` のときのみ。

不変条件:

```text
デモ実行中の待機状態では4面すべてENGAGED
デモ実行中の待機状態では4台の回転サーボがすべて論理0°
```

---

## 7. キューブ操作の種類


Arduinoが扱う高レベル操作は6種類。

1. デモ開始: `DEMO_START`
2. 一面だけを90度回転: `MOVE <FACE>`
3. 一面を45度まで往復させる迷い演出: `MOVE <FACE> HESITATE`
4. 1秒間静止する思考演出: `THINK`
5. キューブ全体を90度回転: `ROTATE <AXIS>`
6. デモ終了: `DEMO_END`

### 7.1 `DEMO_START`

開始条件:

```text
MachineState = IDLE_RELEASED
全回転サーボ = 0°
```

処理:

1. キューブが所定位置にあることを前提とする
2. 4面を安全な順序でENGAGEする
3. 全回転サーボが論理0°であることを確認する
4. `HOLD_ALL / READY` へ遷移する
5. `DEMO_START_DONE` をPCへ返す

4面の具体的なENGAGE順序は実機調整で確定する。

### 7.2 `DEMO_END`

開始条件:

```text
MachineState = HOLD_ALL / READY
全回転サーボ = 0°
```

処理:

1. 以後の `MOVE` / `ROTATE` を受け付けない
2. 4面の把持を解除する
3. キューブを下方向へ意図的に落下させる
4. 全スライダーがRETRACT状態であることを確認する
5. `IDLE_RELEASED` へ遷移する
6. `DEMO_END_DONE` をPCへ返す

`DEMO_END` は、本仕様において全アーム解除を許可する明示的かつ意図的な例外操作である。

---

## 8. 一面回転

対象面の回転サーボを `0° → 90°` へ動かして対象面を90度回転させる。回転中も残り3面はキューブを把持し続ける。

### R面の例

初期状態:

```text
HOLD_ALL
R=0° L=0° F=0° B=0°
```

1. 4面すべてENGAGEのまま `R: 0° → 90°`
2. `R` のみRETRACT。L/F/Bで保持
3. Rが離れている状態で `R: 90° → 0°`
4. `R` を再ENGAGE
5. `HOLD_ALL` と全回転サーボ0°を確認
6. `MOVE_DONE R` を送信

状態遷移:

```text
HOLD_ALL
    ↓
FACE_TURN: target 0°→90°
    ↓
TARGET_RETRACT: 残り3面HOLD
    ↓
TARGET_RESET: target 90°→0°
    ↓
TARGET_ENGAGE
    ↓
HOLD_ALL
    ↓
MOVE_DONE
```

この全工程を1つのArduinoトランザクションとして扱う。

---

## 9. 演出用の迷い往復

`MOVE <FACE> HESITATE`はキューブの論理状態を変更しない演出専用操作とする。対象面を含む4面を把持したまま、次の順序で動作する。

```text
0° → 45°: 500ms
45°で待機: 500ms
45° → 0°: 500ms
```

45°の指令値は論理90°の半分とし、実際のパルス幅は各面の0°と90°の校正値を線形補間して求める。45°専用のパルス校正値は持たない。

正常終了時の通信は通常MOVEと同じ形式とする。

```text
MOVE_START <FACE>
MOVE_DONE <FACE>
READY
```

STOPされた場合は対象面を0°へ復帰し、`MOVE_DONE`を送らず`READY`へ戻る。

### 9.1 静止思考演出

`THINK`はキューブの論理状態を変更せず、`HOLD_ALL`・全回転0°を保ったまま1秒間静止する演出とする。待機中は回転・スライドサーボへ新しい指令を送らない。

```text
THINK_START
1秒間静止
THINK_DONE
READY
```

待機は非ブロッキングで実装し、STATUSには`BUSY`を返す。STOPされた場合は待機を即時終了し、`THINK_DONE`を送らず`READY`へ戻る。

---

## 10. キューブ全体回転

全体回転では対面する2面を使用する。

使用可能な軸:

```text
RL
FB
```

通常待機時はペア両方とも0°。全体回転の直前だけ、ペアの片側を一時的に90°へ移動し、仮初期状態を作る。

その後、対面ペアを同期して、

```text
片側: 0° → 90°
反対側: 90° → 0°
```

と動かす。

---

## 11. R/L軸による全体回転

以下では例として、

```text
R = active side
L = preload side
```

とする。実機の取り付けに応じてどちらをpreload側にするかは設定可能にする。

### Step 1: 初期状態

```text
HOLD_ALL
R=0° L=0° F=0° B=0°
```

### Step 2: Lを仮初期位置90°へ

1. LだけRETRACT
2. R/F/Bでキューブを保持
3. Lを `0° → 90°`
4. Lを再ENGAGE

結果:

```text
R=0°
L=90°
F=0°
B=0°
4面ENGAGED
```

この時点ではキューブの面を回転させない。

### Step 3: 非回転軸面を解除

1. FをRETRACT → R/L/Bで保持
2. BをRETRACT → R/Lのみで保持

この状態を `HOLD_AXIS_RL` とする。

### Step 4: R/L同期回転

```text
開始:
R=0°
L=90°

終了:
R=90°
L=0°
```

同一進捗率で補間する。

```text
progress 0%   : R=0°,    L=90°
progress 25%  : R=22.5°, L=67.5°
progress 50%  : R=45°,   L=45°
progress 75%  : R=67.5°, L=22.5°
progress 100% : R=90°,   L=0°
```

対面配置のため各サーボ自身の回転方向は逆になるが、キューブには同一方向の90度回転を与える。

---

## 12. 全体回転中の同期

禁止:

```text
Rを0°→90°まで先に完了
↓
Lを90°→0°
```

許可:

```text
R/Lを同一progressで補間
```

概念API:

```cpp
setWholeRotationProgress(progress);
```

演出用に少し戻す場合も、必ず同一progressで動かす。

例:

```text
0.00 → 0.30 → 0.20 → 0.55 → 0.45 → 1.00
```

---

## 13. 全体回転後の復帰

回転直後:

```text
R=90°
L=0°
F=RETRACTED
B=RETRACTED
```

1. Fを0°の安全姿勢で再ENGAGE → R/L/Fで保持
2. Bを0°で再ENGAGE → 4面保持
3. 90°になっているRのみRETRACT
4. L/F/Bで保持したまま `R: 90° → 0°`
5. Rを再ENGAGE
6. `HOLD_ALL` / 全回転サーボ0°を確認
7. `ROTATE_DONE RL` を送信

---

## 14. 全体回転トランザクション

```text
HOLD_ALL
  ↓
PRELOAD_ONE_SIDE
片側だけRETRACT
0°→90°
再ENGAGE
  ↓
4面把持 / 仮初期状態 0°・90°
  ↓
非軸面1をRETRACT
  ↓
非軸面2をRETRACT
  ↓
HOLD_AXIS
  ↓
WHOLE_ROTATION
0°→90° / 90°→0° 同期
  ↓
非軸面1を再ENGAGE
  ↓
非軸面2を再ENGAGE
  ↓
4面把持
  ↓
90°側だけRETRACT
90°→0°
再ENGAGE
  ↓
HOLD_ALL
  ↓
ROTATE_DONE
```

---

## 15. F/B軸での全体回転

R/L軸と同じアルゴリズムを使用する。

例:

```text
F = active side
B = preload side
```

仮初期状態:

```text
F=0°
B=90°
```

同期回転:

```text
F: 0°→90°
B: 90°→0°
```

終了後はR/Lを再ENGAGEして4面把持へ戻した後、90°側のFだけをRETRACTし、`90°→0°` へリセットして再ENGAGEする。

---

## 16. 回転方向

初期仕様では各操作について1方向の90度回転だけを基本プリミティブとする。

逆方向90度が必要な場合は、

```text
同方向90度 × 3回
```

で実現可能。

初期シリアルプロトコルではCW / CCWを持たない。将来必要になった場合のみ拡張する。

---

## 17. 安全条件


### 17.1 デモ実行中の0面 / 1面把持は禁止

`DEMO_START_DONE` から `DEMO_END` 開始までのデモ実行中は、

```text
ENGAGED = 0
ENGAGED = 1
```

を作らない。

ただし、以下は明示的な例外とする。

- デモ開始前の `IDLE_RELEASED`
- `DEMO_END` による意図的な全解除
- デモ終了後の `IDLE_RELEASED`

### 17.2 通常遷移では3面以上

一面のリセット、全体回転前のpreloadなどでは常に `ENGAGED >= 3` を維持する。

### 17.3 2面把持は全体回転時の対面ペアだけ

許可:

```text
R + L
F + B
```

隣接2面だけの把持は禁止。

### 17.4 全アーム解除は `DEMO_END` のみ許可

通常の `MOVE` / `ROTATE`、STOP、エラー処理では全アームを解除しない。

```cpp
retractAll();
```

相当の操作は、`DEMO_END` トランザクション内でキューブを落下させる目的に限り許可する。

エラーやSTOPを理由に `DEMO_END` 相当の全解除を行ってはならない。

---

## 18. Arduino内部状態


例:

```cpp
enum class MachineState {
    IDLE_RELEASED,
    STARTING_DEMO,

    HOLD_ALL,

    FACE_TURNING,
    FACE_RESETTING,

    PREPARING_WHOLE_ROTATION,
    HOLD_AXIS_RL,
    HOLD_AXIS_FB,
    WHOLE_ROTATING,
    RESTORING_HOLD,

    ENDING_DEMO,

    ERROR_HOLD
};
```

意味:

- `IDLE_RELEASED`: 4面すべてRETRACT。デモ未開始または終了済み
- `STARTING_DEMO`: `DEMO_START` により4面把持へ移行中
- `HOLD_ALL`: デモ実行中のREADY状態
- `ENDING_DEMO`: `DEMO_END` により意図的な全解除を実行中
- `ERROR_HOLD`: 安全な把持を維持したエラー状態

---

## 19. PCとの責務境界


PCは以下を知らない。

- サーボチャンネル
- パルス幅
- ENGAGE / RETRACTの具体的手順
- 一面回転後のリセット
- 全体回転前のpreload
- 全体回転後のリセット
- 現在何面で把持しているか
- 同期補間の実装
- `DEMO_START` 時の具体的な把持順序
- `DEMO_END` 時の具体的なRETRACTタイミング

PCが指示する高レベルコマンドは以下。

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

役割分担:

```text
PC:
デモ開始・操作・デモ終了をキックする

Arduino:
各コマンドを安全な機構トランザクションとして完結させる
```

`MOVE` / `THINK` / `ROTATE` は `HOLD_ALL` から開始して `HOLD_ALL` へ戻る。

`DEMO_START` は `IDLE_RELEASED` から `HOLD_ALL` へ遷移する。

`DEMO_END` は `HOLD_ALL` から `IDLE_RELEASED` へ遷移し、キューブを意図的に落下させる。

---

## 20. シリアル通信仕様


- UTF-8
- 1行1メッセージ
- 改行 `\n`

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

エラー例:

```text
ERROR BUSY
ERROR INVALID_COMMAND
ERROR INVALID_STATE
ERROR UNSAFE_GRIP_STATE
ERROR INTERNAL_STATE
```

---

## 21. READY / BUSY / DONE の意味


### IDLE

```text
MachineState = IDLE_RELEASED
全4面 = RETRACTED
全回転サーボ = 0°
```

デモ開始前またはデモ終了後の状態。

`DEMO_START` を受け付けられる。

### READY

```text
MachineState = HOLD_ALL
全4面 = ENGAGED
全回転サーボ = 0°
```

デモ実行中で、新しい `MOVE` / `THINK` / `ROTATE` / `DEMO_END` を受け付けられる。

### BUSY

1つのトランザクションを実行中。

BUSY中に新しい高レベル操作を開始しない。

### MOVE_DONE / THINK_DONE / ROTATE_DONE

対象操作が終了し、`READY` 条件へ復帰したことを意味する。

### DEMO_START_DONE

`IDLE_RELEASED` から `HOLD_ALL / READY` への遷移が完了したことを意味する。

### DEMO_END_DONE

4面の把持解除とキューブの落下処理が完了し、`IDLE_RELEASED / IDLE` へ遷移したことを意味する。

---

## 22. PC側から見た通信フロー


### デモ開始

```text
PC                    Arduino

DEMO_START
 -------------------->

             DEMO_START_START
 <--------------------

        4面を把持

             DEMO_START_DONE
 <--------------------

        READY
```

### 一面回転

```text
PC                    Arduino

MOVE R
 -------------------->

                MOVE_START R
 <--------------------

        Arduino内部で全工程

                MOVE_DONE R
 <--------------------

        READY
```

### 迷い演出

```text
PC                    Arduino

MOVE R HESITATE
 -------------------->

                MOVE_START R
 <--------------------

        R: 0° → 45° → 0°

                MOVE_DONE R
 <--------------------

        READY
```

### 静止思考演出

```text
PC                    Arduino

THINK
 -------------------->

                THINK_START
 <--------------------

        1秒間サーボ指令なし

                THINK_DONE
 <--------------------

        READY
```

### デモ終了

```text
PC                    Arduino

DEMO_END
 -------------------->

             DEMO_END_START
 <--------------------

        4面をRETRACT
        キューブを落下

             DEMO_END_DONE
 <--------------------

        IDLE
```

PCは各 `*_DONE` を受信するまで次の高レベル操作を送信しない。

---

## 23. STOP


STOPは全アーム解除を意味しない。

STOP受信時:

- 新しい操作を開始しない
- `DEMO_END` に勝手に置き換えない
- キューブを意図せず落下させない
- デモ実行中であれば、可能なら現在のトランザクションを安全な `HOLD_ALL` まで復帰させる
- 安全な復帰を保証できない場合は現在の把持状態を維持して `ERROR_HOLD` とする
- `IDLE_RELEASED` 中であればその状態を維持する

---

## 24. エラー時


デモ実行中の原則:

```text
安全にHOLD_ALLへ戻せる
    → HOLD_ALLへ復帰

安全な復帰を保証できない
    → 現在の把持を維持
      ERROR_HOLD
```

エラーを理由に全アームを解除しない。

キューブを落下させる全解除は、正常な `DEMO_END` コマンドによる場合だけ許可する。

デモ開始前 / 終了後の `IDLE_RELEASED` でエラーが発生した場合は、全アームRETRACT状態を維持する。

---

## 25. サーボ制御API案

```cpp
setRotationAngle(Face face, float logicalAngle);
engage(Face face);
retract(Face face);

executeFaceTurn(Face face);
executeWholeRotation(Axis axis);
```

上位ロジックではパルス幅を直接扱わず、論理角度を各サーボのキャリブレーション値へ変換する。

---

## 26. 実装優先順位


1. PCA9685で1台のMG996Rを論理0° / 90°制御
2. 8台のサーボ個別制御
3. 各サーボのキャリブレーション値
4. 全面RETRACTの `IDLE_RELEASED`
5. `DEMO_START` と4面把持
6. HOLD_ALL
7. 一面回転トランザクション
8. HOLD_ALLへの自動復帰
9. R/L全体回転のpreload処理
10. R/L同期回転
11. R/L全体回転後の自動復帰
12. F/B全体回転
13. `DEMO_END` と意図的な全解除
14. SerialProtocol
15. SafetyGuard
16. STOP / ERROR_HOLD
17. 演出用迷い往復
18. 1秒間の静止思考演出

---

## 27. 初期完成条件


1. Arduino起動後に `IDLE_RELEASED` となり、4面ともキューブを把持しない
2. `DEMO_START` 1コマンドで4面把持し、`HOLD_ALL / READY` へ遷移できる
3. `DEMO_START_DONE` の時点で全回転サーボが論理0°である
4. `MOVE R` 1コマンドでR面回転からリセット・再把持まで完了する
5. `MOVE_DONE R` の時点でHOLD_ALLへ戻っている
6. `MOVE R HESITATE`でR面が0°から45°へ動き、待機後に0°へ戻る
7. HESITATE完了時に全回転0° / HOLD_ALLへ戻っている
8. `THINK`でサーボ状態を変えず1秒間静止し、`THINK_DONE`後にREADYへ戻る
9. THINK中のSTOPでDONEを送らず即座にREADYへ戻る
10. R/L全体回転前に片側のみ90°へpreloadできる
11. R/Lを `0→90 / 90→0` で同期回転できる
12. 全体回転後に4面把持へ復帰できる
13. 90°側を0°へリセットできる
14. `ROTATE_DONE RL` の時点で全回転サーボ0° / HOLD_ALLである
15. F/B軸でも同様に動作する
16. BUSY中に別操作を開始しない
17. STOP / エラー時に意図せずキューブを落とさない
18. `DEMO_END` で4面すべての把持を解除し、キューブを意図的に落下させられる
19. `DEMO_END_DONE` の時点で `IDLE_RELEASED` に戻っている

---

## 28. 最終原則


Arduinoの通常操作コマンドは、機械操作の1トランザクションである。

```text
HOLD_ALL / READY
    ↓
必要な物理操作
    ↓
必要なリセット
    ↓
HOLD_ALL / READY
```

デモライフサイクルは別の高レベル遷移として扱う。

```text
IDLE_RELEASED
    ↓ DEMO_START
HOLD_ALL / READY
    ↓ デモ実行
HOLD_ALL / READY
    ↓ DEMO_END
IDLE_RELEASED
```

`DEMO_END` だけは、演出上キューブを落とすために全アーム解除を明示的に許可する。

STOPやエラーではこの全解除を行わない。

PCはサーボ操作の途中状態を管理しない。

**PCは「デモを始める・何を動かす・デモを終える」を指示し、Arduinoは「それをどう安全かつ意図通りに実行するか」に責任を持つ。**

---
