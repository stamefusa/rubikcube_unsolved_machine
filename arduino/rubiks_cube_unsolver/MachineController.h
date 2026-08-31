#pragma once

#include <Arduino.h>

#include "SafetyGuard.h"
#include "ServoController.h"
#include "Types.h"

class MachineController {
 public:
  MachineController(ServoController& servos, Print& output);

  void begin(uint32_t now);
  void update(uint32_t now);

  void ping();
  void status();
  void stop();
  void invalidCommand();
  void startDemo();
  void startFaceTurn(Face face);
  void startFaceHesitation(Face face);
  void startThinking();
  void startWholeRotation(Axis axis);
  void endDemo();

  MachineState state() const;

 private:
  enum class Transaction : uint8_t {
    NONE,
    DEMO_START,
    FACE_TURN,
    FACE_HESITATION,
    THINK,
    WHOLE_ROTATION,
    DEMO_END,
  };

  enum class FacePhase : uint8_t {
    TURNING,
    RETRACT_WAIT,
    RESETTING,
    ENGAGE_WAIT,
  };

  enum class HesitatePhase : uint8_t {
    OUTWARD,
    PAUSE,
    RETURNING,
  };

  enum class WholePhase : uint8_t {
    PRELOAD_RETRACT_WAIT,
    PRELOAD_ROTATING,
    PRELOAD_ENGAGE_WAIT,
    NON_AXIS_1_RETRACT_WAIT,
    NON_AXIS_2_RETRACT_WAIT,
    PAIR_ROTATING,
    NON_AXIS_1_ENGAGE_WAIT,
    NON_AXIS_2_ENGAGE_WAIT,
    ACTIVE_RETRACT_WAIT,
    ACTIVE_RESETTING,
    ACTIVE_ENGAGE_WAIT,
  };

  enum class StopPhase : uint8_t {
    FACE_REVERSE,
    AXIS_REVERSE,
    FIND_RETRACTED_ROTATION,
    RESET_RETRACTED_ROTATION,
    FIND_MISSING_GRIP,
    MISSING_GRIP_WAIT,
    FIND_ENGAGED_ROTATION,
    ENGAGED_RETRACT_WAIT,
    RESET_ENGAGED_ROTATION,
    ENGAGED_GRIP_WAIT,
  };

  struct Motion {
    bool active;
    uint8_t count;
    Face faces[2];
    uint16_t starts[2];
    uint16_t targets[2];
    uint32_t startedAt;
    uint16_t durationMs;
    uint32_t lastWriteAt;
  };

  void updateBoot(uint32_t now);
  void updateDemoStart(uint32_t now);
  void updateFaceTurn(uint32_t now);
  void updateFaceHesitation(uint32_t now);
  void updateThinking(uint32_t now);
  void updateWholeRotation(uint32_t now);
  void updateDemoEnd(uint32_t now);
  void beginStopRecovery(uint32_t now);
  void updateStopRecovery(uint32_t now);

  bool startSingleMotion(Face face, uint16_t target, uint16_t durationMs, uint32_t now);
  bool startPairMotion(Face first, uint16_t firstTarget, Face second, uint16_t secondTarget,
                       uint16_t durationMs, uint32_t now);
  bool updateMotion(uint32_t now);
  void cancelMotion();

  bool setGripChecked(Face face, GripState target, GripContext context);
  bool setAllGripsChecked(GripState target, GripContext context);
  bool deadlineReached(uint32_t now) const;
  void setDeadline(uint32_t now, uint16_t delayMs);
  Face findRetractedNonZero() const;
  Face findRetractedFace() const;
  Face findEngagedNonZero() const;
  bool validFace(Face face) const;

  void finishReady();
  void finishStoppedReady();
  void enterError(ErrorCode code);
  void sendError(ErrorCode code);
  void sendReady();
  void sendIdle();
  void sendMoveMessage(const __FlashStringHelper* prefix, Face face);
  void sendRotateMessage(const __FlashStringHelper* prefix, Axis axis);
  bool commandCanStart(MachineState requiredState);

  ServoController& servos_;
  Print& output_;
  MachineState state_;
  Transaction transaction_;
  FacePhase facePhase_;
  HesitatePhase hesitatePhase_;
  WholePhase wholePhase_;
  StopPhase stopPhase_;
  Motion motion_;
  uint32_t deadline_;
  bool stopRequested_;
  bool suppressDone_;

  Face targetFace_;
  Axis targetAxis_;
  Face activeFace_;
  Face preloadFace_;
  Face nonAxis1_;
  Face nonAxis2_;
  Face recoveryFace_;
};
