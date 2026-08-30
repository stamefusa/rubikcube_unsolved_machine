#include "SafetyGuard.h"

bool SafetyGuard::canSetGrip(const ServoController& servos, Face face, GripState target,
                             GripContext context) {
  if (context == GripContext::DEMO_START || context == GripContext::DEMO_END) {
    return true;
  }

  bool engaged[4] = {
      servos.grip(Face::R) == GripState::ENGAGED,
      servos.grip(Face::L) == GripState::ENGAGED,
      servos.grip(Face::F) == GripState::ENGAGED,
      servos.grip(Face::B) == GripState::ENGAGED,
  };
  engaged[faceIndex(face)] = target == GripState::ENGAGED;

  uint8_t count = 0;
  for (uint8_t i = 0; i < 4; ++i) {
    if (engaged[i]) {
      ++count;
    }
  }

  if (count >= 3) {
    return true;
  }
  return context == GripContext::WHOLE_ROTATION && count == 2 &&
         isOppositePair(engaged[0], engaged[1], engaged[2], engaged[3]);
}

bool SafetyGuard::readyInvariant(const ServoController& servos) {
  return servos.allGrips(GripState::ENGAGED) && servos.allRotationsZero();
}

bool SafetyGuard::idleInvariant(const ServoController& servos) {
  return servos.allGrips(GripState::RETRACTED) && servos.allRotationsZero();
}

bool SafetyGuard::isOppositePair(bool r, bool l, bool f, bool b) {
  return (r && l && !f && !b) || (!r && !l && f && b);
}

