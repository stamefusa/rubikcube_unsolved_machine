#pragma once

#include <Arduino.h>

namespace Config {

constexpr uint32_t SERIAL_BAUD = 115200;
constexpr uint8_t PCA9685_ADDRESS = 0x40;
constexpr float PWM_FREQUENCY_HZ = 50.0F;

constexpr uint8_t FACE_COUNT = 4;

// Channel order: rotation, slide.
constexpr uint8_t ROTATION_CHANNELS[FACE_COUNT] = { 0, 2, 4, 6 };
constexpr uint8_t SLIDE_CHANNELS[FACE_COUNT] = { 1, 3, 5, 7 };

// Calibrated values supplied for the current mechanism.
constexpr uint16_t ROTATION_0_US[FACE_COUNT] = { 950, 920, 980, 960 };
constexpr uint16_t ROTATION_90_US[FACE_COUNT] = { 1950, 1920, 1980, 1960 };
constexpr uint16_t SLIDE_RETRACT_US[FACE_COUNT] = { 1450, 1400, 1400, 1500 };
constexpr uint16_t SLIDE_ENGAGE_US[FACE_COUNT] = { 1650, 1600, 1600, 1700 };

constexpr uint16_t SERVO_MIN_US = 500;
constexpr uint16_t SERVO_MAX_US = 2500;

constexpr uint16_t MOTION_UPDATE_MS = 20;
constexpr uint16_t FACE_TURN_MS = 1000;
constexpr uint16_t HESITATE_MOTION_MS = 500;
constexpr uint16_t HESITATE_PAUSE_MS = 500;
constexpr uint16_t THINK_MS = 1000;
constexpr uint16_t FREE_ROTATION_MS = 800;
constexpr uint16_t WHOLE_ROTATION_MS = 1200;
constexpr uint16_t SLIDE_SETTLE_MS = 600;
constexpr uint8_t COMMAND_BUFFER_SIZE = 40;

constexpr uint16_t LOGICAL_0 = 0;
constexpr uint16_t LOGICAL_90 = 900;  // Tenths of a degree.

constexpr bool pulseInRange(uint16_t pulseUs) {
  return pulseUs >= SERVO_MIN_US && pulseUs <= SERVO_MAX_US;
}

constexpr bool faceCalibrationInRange(uint8_t index) {
  return pulseInRange(ROTATION_0_US[index]) && pulseInRange(ROTATION_90_US[index]) && pulseInRange(SLIDE_RETRACT_US[index]) && pulseInRange(SLIDE_ENGAGE_US[index]);
}

static_assert(faceCalibrationInRange(0), "R calibration is outside the configured servo range");
static_assert(faceCalibrationInRange(1), "L calibration is outside the configured servo range");
static_assert(faceCalibrationInRange(2), "F calibration is outside the configured servo range");
static_assert(faceCalibrationInRange(3), "B calibration is outside the configured servo range");

}  // namespace Config
