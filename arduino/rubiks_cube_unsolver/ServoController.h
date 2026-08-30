#pragma once

#include <Adafruit_PWMServoDriver.h>
#include <Arduino.h>

#include "Config.h"
#include "Types.h"

class ServoController {
 public:
  ServoController();

  void begin();
  bool setRotation(Face face, uint16_t logicalAngle);
  bool setGrip(Face face, GripState state);
  void setAllRotationsZero();
  void setAllGrips(GripState state);

  uint16_t rotation(Face face) const;
  GripState grip(Face face) const;
  uint8_t engagedCount() const;
  bool allRotationsZero() const;
  bool allGrips(GripState expected) const;

 private:
  uint16_t rotationPulseUs(Face face, uint16_t logicalAngle) const;
  bool pulseInRange(uint16_t pulseUs) const;

  Adafruit_PWMServoDriver pwm_;
  uint16_t rotations_[Config::FACE_COUNT];
  GripState grips_[Config::FACE_COUNT];
};

