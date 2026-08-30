#include "ServoController.h"

ServoController::ServoController()
    : pwm_(Config::PCA9685_ADDRESS),
      rotations_{Config::LOGICAL_0, Config::LOGICAL_0, Config::LOGICAL_0, Config::LOGICAL_0},
      grips_{GripState::RETRACTED, GripState::RETRACTED, GripState::RETRACTED,
             GripState::RETRACTED} {}

void ServoController::begin() {
  pwm_.begin();
  pwm_.setPWMFreq(Config::PWM_FREQUENCY_HZ);
}

bool ServoController::setRotation(Face face, uint16_t logicalAngle) {
  if (logicalAngle > Config::LOGICAL_90) {
    return false;
  }

  const uint16_t pulseUs = rotationPulseUs(face, logicalAngle);
  if (!pulseInRange(pulseUs)) {
    return false;
  }

  const uint8_t index = faceIndex(face);
  pwm_.writeMicroseconds(Config::ROTATION_CHANNELS[index], pulseUs);
  rotations_[index] = logicalAngle;
  return true;
}

bool ServoController::setGrip(Face face, GripState state) {
  const uint8_t index = faceIndex(face);
  const uint16_t pulseUs = state == GripState::ENGAGED
                               ? Config::SLIDE_ENGAGE_US[index]
                               : Config::SLIDE_RETRACT_US[index];
  if (!pulseInRange(pulseUs)) {
    return false;
  }

  pwm_.writeMicroseconds(Config::SLIDE_CHANNELS[index], pulseUs);
  grips_[index] = state;
  return true;
}

void ServoController::setAllRotationsZero() {
  for (uint8_t i = 0; i < Config::FACE_COUNT; ++i) {
    setRotation(static_cast<Face>(i), Config::LOGICAL_0);
  }
}

void ServoController::setAllGrips(GripState state) {
  for (uint8_t i = 0; i < Config::FACE_COUNT; ++i) {
    setGrip(static_cast<Face>(i), state);
  }
}

uint16_t ServoController::rotation(Face face) const {
  return rotations_[faceIndex(face)];
}

GripState ServoController::grip(Face face) const {
  return grips_[faceIndex(face)];
}

uint8_t ServoController::engagedCount() const {
  uint8_t count = 0;
  for (uint8_t i = 0; i < Config::FACE_COUNT; ++i) {
    if (grips_[i] == GripState::ENGAGED) {
      ++count;
    }
  }
  return count;
}

bool ServoController::allRotationsZero() const {
  for (uint8_t i = 0; i < Config::FACE_COUNT; ++i) {
    if (rotations_[i] != Config::LOGICAL_0) {
      return false;
    }
  }
  return true;
}

bool ServoController::allGrips(GripState expected) const {
  for (uint8_t i = 0; i < Config::FACE_COUNT; ++i) {
    if (grips_[i] != expected) {
      return false;
    }
  }
  return true;
}

uint16_t ServoController::rotationPulseUs(Face face, uint16_t logicalAngle) const {
  const uint8_t index = faceIndex(face);
  const int32_t start = Config::ROTATION_0_US[index];
  const int32_t difference = static_cast<int32_t>(Config::ROTATION_90_US[index]) - start;
  return static_cast<uint16_t>(start + (difference * logicalAngle) / Config::LOGICAL_90);
}

bool ServoController::pulseInRange(uint16_t pulseUs) const {
  return pulseUs >= Config::SERVO_MIN_US && pulseUs <= Config::SERVO_MAX_US;
}

