#pragma once

#include <Arduino.h>

enum class Face : uint8_t {
  R = 0,
  L = 1,
  F = 2,
  B = 3,
  COUNT = 4,
};

enum class Axis : uint8_t {
  RL,
  FB,
};

enum class GripState : uint8_t {
  RETRACTED,
  ENGAGED,
};

enum class MachineState : uint8_t {
  BOOTING,
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
  STOPPING,
  ERROR_HOLD,
};

enum class ErrorCode : uint8_t {
  BUSY,
  INVALID_COMMAND,
  INVALID_STATE,
  UNSAFE_GRIP_STATE,
  INTERNAL_STATE,
};

inline uint8_t faceIndex(Face face) {
  return static_cast<uint8_t>(face);
}

inline char faceName(Face face) {
  static const char NAMES[] = {'R', 'L', 'F', 'B'};
  return NAMES[faceIndex(face)];
}

