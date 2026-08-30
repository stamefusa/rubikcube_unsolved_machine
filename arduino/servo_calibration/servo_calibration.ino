#include <Adafruit_PWMServoDriver.h>

#include <stdlib.h>
#include <string.h>

namespace {

constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint8_t PCA9685_ADDRESS = 0x40;
constexpr float PWM_FREQUENCY_HZ = 50.0F;

constexpr uint8_t SERVO_CHANNEL_MIN = 0;
constexpr uint8_t SERVO_CHANNEL_MAX = 7;
constexpr uint16_t SERVO_PULSE_MIN_US = 900;
constexpr uint16_t SERVO_PULSE_MAX_US = 2200;

constexpr size_t COMMAND_BUFFER_SIZE = 40;

Adafruit_PWMServoDriver pwm(PCA9685_ADDRESS);

char commandBuffer[COMMAND_BUFFER_SIZE] = {0};
size_t commandLength = 0;
bool commandOverflowed = false;

void printUsage() {
  Serial.println(F("Format: <channel 0-7> <pulse 1000-2000 us>"));
  Serial.println(F("Example: 0 1500"));
}

void printInvalidCommand() {
  Serial.println(F("ERROR: Invalid command."));
  printUsage();
}

bool parseInteger(const char* token, long& value) {
  if (token == nullptr || token[0] == '\0') {
    return false;
  }

  char* end = nullptr;
  value = strtol(token, &end, 10);
  return end != token && end[0] == '\0';
}

void processCommand() {
  char* save = nullptr;
  char* channelToken = strtok_r(commandBuffer, " \t", &save);
  char* pulseToken = strtok_r(nullptr, " \t", &save);
  char* extraToken = strtok_r(nullptr, " \t", &save);

  long channel = 0;
  long pulseUs = 0;
  if (extraToken != nullptr || !parseInteger(channelToken, channel) ||
      !parseInteger(pulseToken, pulseUs) ||
      channel < SERVO_CHANNEL_MIN || channel > SERVO_CHANNEL_MAX ||
      pulseUs < SERVO_PULSE_MIN_US || pulseUs > SERVO_PULSE_MAX_US) {
    printInvalidCommand();
    return;
  }

  pwm.writeMicroseconds(static_cast<uint8_t>(channel),
                        static_cast<uint16_t>(pulseUs));

  Serial.print(F("OK: CH"));
  Serial.print(channel);
  Serial.print(F(" = "));
  Serial.print(pulseUs);
  Serial.println(F(" us"));
}

void pollSerial() {
  while (Serial.available() > 0) {
    const char value = static_cast<char>(Serial.read());

    if (value == '\n') {
      if (commandOverflowed) {
        printInvalidCommand();
      } else {
        commandBuffer[commandLength] = '\0';
        processCommand();
      }

      commandLength = 0;
      commandOverflowed = false;
      continue;
    }

    if (value == '\r') {
      continue;
    }

    if (commandOverflowed) {
      continue;
    }

    if (commandLength >= COMMAND_BUFFER_SIZE - 1) {
      commandOverflowed = true;
      continue;
    }

    commandBuffer[commandLength++] = value;
  }
}

}  // namespace

void setup() {
  Serial.begin(SERIAL_BAUD);

  pwm.begin();
  pwm.setPWMFreq(PWM_FREQUENCY_HZ);

  Serial.println(F("Servo calibration ready."));
  printUsage();
}

void loop() {
  pollSerial();
}
