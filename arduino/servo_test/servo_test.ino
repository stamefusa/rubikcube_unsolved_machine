#include <Adafruit_PWMServoDriver.h>

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(0x40);

// 接続するPCA9685のチャンネル
constexpr uint8_t SERVO_CHANNEL = 0;

// まずは安全寄りの範囲から開始
constexpr int SERVO_MIN_US = 1000;
constexpr int SERVO_MAX_US = 2000;

// 現在角度
int currentAngle = 90;

void writeServoAngle(uint8_t channel, int angle) {
  // 0〜180度に制限
  angle = constrain(angle, 0, 180);

  // 角度をパルス幅に変換
  int pulseUs = map(
    angle,
    0, 180,
    SERVO_MIN_US, SERVO_MAX_US
  );

  pwm.writeMicroseconds(channel, pulseUs);
}

void setup() {
  Serial.begin(115200);

  pwm.begin();
  pwm.setPWMFreq(50);  // 一般的なRCサーボは50Hz

  delay(10);

  // 初期位置90度
  writeServoAngle(SERVO_CHANNEL, currentAngle);

  Serial.println("Servo test ready.");
  Serial.println("a: +10 degrees");
  Serial.println("b: -10 degrees");
  Serial.print("Current angle: ");
  Serial.println(currentAngle);
}

void loop() {
  if (Serial.available() <= 0) {
    return;
  }

  char command = Serial.read();

  if (command == 'a') {
    currentAngle += 10;
    currentAngle = constrain(currentAngle, 0, 180);

    writeServoAngle(SERVO_CHANNEL, currentAngle);

    Serial.print("Angle: ");
    Serial.println(currentAngle);
  }
  else if (command == 'b') {
    currentAngle -= 10;
    currentAngle = constrain(currentAngle, 0, 180);

    writeServoAngle(SERVO_CHANNEL, currentAngle);

    Serial.print("Angle: ");
    Serial.println(currentAngle);
  }
}