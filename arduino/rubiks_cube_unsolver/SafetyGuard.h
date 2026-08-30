#pragma once

#include "ServoController.h"
#include "Types.h"

enum class GripContext : uint8_t {
  NORMAL,
  WHOLE_ROTATION,
  DEMO_START,
  DEMO_END,
};

class SafetyGuard {
 public:
  static bool canSetGrip(const ServoController& servos, Face face, GripState target,
                         GripContext context);
  static bool readyInvariant(const ServoController& servos);
  static bool idleInvariant(const ServoController& servos);

 private:
  static bool isOppositePair(bool r, bool l, bool f, bool b);
};

