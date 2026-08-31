# Rubik's Cube Unsolver Arduino firmware

Arduino UnoとPCA9685で8台のMG996Rを制御する、Arduino要件定義書v3準拠のスケッチです。

## 必要なもの

- Arduino Uno
- Adafruit PCA9685 16-Channel Servo Driver
- Adafruit PWM Servo Driver Library
- サーボ用外部5V/10A電源（Arduinoの5Vピンからサーボへ給電しないこと）

Arduino IDEで `rubiks_cube_unsolver.ino` を開き、ボードをArduino Unoに設定して書き込みます。シリアル通信は115200 baud、改行区切りです。

## チャンネルと校正値

| 面 | 回転 | スライド |
|---|---:|---:|
| R | CH0 | CH1 |
| L | CH2 | CH3 |
| F | CH4 | CH5 |
| B | CH6 | CH7 |

現在は全サーボ共通で次の値を使用します。

- 回転0°: 1800us
- 回転90°: 2200us
- RETRACT: 1800us
- ENGAGE: 1900us

値、動作時間、PCA9685アドレスは `Config.h` に集約しています。最初の試運転はキューブを把持させず、各サーボが機構へ干渉しないことを確認してから行ってください。

## コマンド

```text
PING
STATUS
DEMO_START
MOVE R
MOVE L
MOVE F
MOVE B
MOVE R HESITATE
MOVE L HESITATE
MOVE F HESITATE
MOVE B HESITATE
THINK
ROTATE RL
ROTATE FB
DEMO_END
STOP
```

`MOVE <FACE> HESITATE`は、対象面を把持したまま0°から45°へ500msで動かし、500ms待機してから500msで0°へ戻す迷い演出です。45°のパルス幅は各面の0°と90°の校正値から補間されます。正常終了時の応答は通常MOVEと同じ`MOVE_START <FACE>` / `MOVE_DONE <FACE>`です。

`THINK`は、4面把持・全回転0°を維持したまま1秒間静止する思考演出です。待機中はサーボへ新しい指令を送らず、正常終了時に`THINK_START` / `THINK_DONE`を返します。

`MOVE R CW`のような方向付き旧形式や、未知のMOVE修飾子は受け付けません。起動完了時とデモ終了後は`IDLE`、デモ開始および各操作の安全復帰後は`READY`を返します。

`DEMO_START`の4面ENGAGEと`DEMO_END`の4面RETRACTは、それぞれ同じ制御周期内に4チャンネルへ連続して指令します。MOVE/ROTATEでは把持面数の安全条件を守るため、仕様どおり段階的に切り替えます。

## 安全上の制約

この構成には位置、把持、電流を検出するセンサーがありません。ファームウェアが確認できるのは、各サーボへ最後に指令した論理状態だけです。物理的な到達やキューブの脱落は検出できません。

STOPは全解除ではありません。MOVE/ROTATE中は途中状態に応じて4面把持・全回転0°へ復帰し、THINK中は待機を即時終了します。全4面の解除は、正常な`DEMO_END`処理でのみ実行します。
