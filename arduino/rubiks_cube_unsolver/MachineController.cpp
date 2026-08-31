#include "MachineController.h"

#include "Config.h"

MachineController::MachineController(ServoController& servos, Print& output)
    : servos_(servos),
      output_(output),
      state_(MachineState::BOOTING),
      transaction_(Transaction::NONE),
      facePhase_(FacePhase::TURNING),
      hesitatePhase_(HesitatePhase::OUTWARD),
      wholePhase_(WholePhase::PRELOAD_RETRACT_WAIT),
      stopPhase_(StopPhase::FIND_RETRACTED_ROTATION),
      motion_{false, 0, {Face::R, Face::L}, {0, 0}, {0, 0}, 0, 0, 0},
      deadline_(0),
      stopRequested_(false),
      suppressDone_(false),
      targetFace_(Face::R),
      targetAxis_(Axis::RL),
      activeFace_(Face::R),
      preloadFace_(Face::L),
      nonAxis1_(Face::F),
      nonAxis2_(Face::B),
      recoveryFace_(Face::COUNT) {}

void MachineController::begin(uint32_t now) {
  state_ = MachineState::BOOTING;
  transaction_ = Transaction::NONE;
  stopRequested_ = false;
  suppressDone_ = false;
  cancelMotion();

  // These four writes are deliberately issued in the same control cycle.
  servos_.setAllGrips(GripState::RETRACTED);
  servos_.setAllRotationsZero();
  setDeadline(now, Config::SLIDE_SETTLE_MS);
}

void MachineController::update(uint32_t now) {
  if (stopRequested_ && state_ != MachineState::STOPPING) {
    if (transaction_ == Transaction::FACE_TURN ||
        transaction_ == Transaction::FACE_HESITATION ||
        transaction_ == Transaction::WHOLE_ROTATION) {
      beginStopRecovery(now);
    } else if (transaction_ == Transaction::THINK) {
      stopRequested_ = false;
      finishStoppedReady();
    } else if (transaction_ == Transaction::DEMO_START ||
               transaction_ == Transaction::DEMO_END) {
      // Lifecycle transitions cannot be left half-complete. Finish them but
      // suppress their normal DONE notification because STOP cancelled it.
      stopRequested_ = false;
      suppressDone_ = true;
    } else {
      stopRequested_ = false;
    }
  }

  switch (state_) {
    case MachineState::BOOTING:
      updateBoot(now);
      break;
    case MachineState::STARTING_DEMO:
      updateDemoStart(now);
      break;
    case MachineState::FACE_TURNING:
    case MachineState::FACE_RESETTING:
      updateFaceTurn(now);
      break;
    case MachineState::FACE_HESITATING:
      updateFaceHesitation(now);
      break;
    case MachineState::THINKING:
      updateThinking(now);
      break;
    case MachineState::PREPARING_WHOLE_ROTATION:
    case MachineState::HOLD_AXIS_RL:
    case MachineState::HOLD_AXIS_FB:
    case MachineState::WHOLE_ROTATING:
    case MachineState::RESTORING_HOLD:
      updateWholeRotation(now);
      break;
    case MachineState::ENDING_DEMO:
      updateDemoEnd(now);
      break;
    case MachineState::STOPPING:
      updateStopRecovery(now);
      break;
    case MachineState::IDLE_RELEASED:
    case MachineState::HOLD_ALL:
    case MachineState::ERROR_HOLD:
      break;
  }
}

void MachineController::ping() {
  output_.println(F("PONG"));
}

void MachineController::status() {
  switch (state_) {
    case MachineState::IDLE_RELEASED:
      sendIdle();
      break;
    case MachineState::HOLD_ALL:
      sendReady();
      break;
    case MachineState::ERROR_HOLD:
      sendError(ErrorCode::INTERNAL_STATE);
      break;
    default:
      output_.println(F("BUSY"));
      break;
  }
}

void MachineController::stop() {
  if (state_ == MachineState::IDLE_RELEASED) {
    sendIdle();
    return;
  }
  if (state_ == MachineState::HOLD_ALL) {
    sendReady();
    return;
  }
  if (state_ == MachineState::ERROR_HOLD) {
    sendError(ErrorCode::INTERNAL_STATE);
    return;
  }
  if (state_ != MachineState::STOPPING) {
    stopRequested_ = true;
  }
}

void MachineController::invalidCommand() {
  sendError(ErrorCode::INVALID_COMMAND);
}

void MachineController::startDemo() {
  if (!commandCanStart(MachineState::IDLE_RELEASED)) {
    return;
  }
  if (!SafetyGuard::idleInvariant(servos_)) {
    enterError(ErrorCode::INTERNAL_STATE);
    return;
  }

  output_.println(F("DEMO_START_START"));
  transaction_ = Transaction::DEMO_START;
  state_ = MachineState::STARTING_DEMO;
  suppressDone_ = false;

  // All slide targets are written in the same loop cycle by design.
  if (!setAllGripsChecked(GripState::ENGAGED, GripContext::DEMO_START)) {
    return;
  }
  setDeadline(millis(), Config::SLIDE_SETTLE_MS);
}

void MachineController::startFaceTurn(Face face) {
  if (!commandCanStart(MachineState::HOLD_ALL)) {
    return;
  }
  if (!validFace(face) || !SafetyGuard::readyInvariant(servos_)) {
    sendError(validFace(face) ? ErrorCode::INTERNAL_STATE : ErrorCode::INVALID_COMMAND);
    return;
  }

  targetFace_ = face;
  transaction_ = Transaction::FACE_TURN;
  state_ = MachineState::FACE_TURNING;
  facePhase_ = FacePhase::TURNING;
  suppressDone_ = false;
  sendMoveMessage(F("MOVE_START"), face);

  if (!startSingleMotion(face, Config::LOGICAL_90, Config::FACE_TURN_MS, millis())) {
    enterError(ErrorCode::INTERNAL_STATE);
  }
}

void MachineController::startFaceHesitation(Face face) {
  if (!commandCanStart(MachineState::HOLD_ALL)) {
    return;
  }
  if (!validFace(face) || !SafetyGuard::readyInvariant(servos_)) {
    sendError(validFace(face) ? ErrorCode::INTERNAL_STATE : ErrorCode::INVALID_COMMAND);
    return;
  }

  targetFace_ = face;
  transaction_ = Transaction::FACE_HESITATION;
  state_ = MachineState::FACE_HESITATING;
  hesitatePhase_ = HesitatePhase::OUTWARD;
  suppressDone_ = false;
  sendMoveMessage(F("MOVE_START"), face);

  const uint16_t midpoint = Config::LOGICAL_90 / 2;
  if (!startSingleMotion(face, midpoint, Config::HESITATE_MOTION_MS, millis())) {
    enterError(ErrorCode::INTERNAL_STATE);
  }
}

void MachineController::startThinking() {
  if (!commandCanStart(MachineState::HOLD_ALL)) {
    return;
  }
  if (!SafetyGuard::readyInvariant(servos_)) {
    enterError(ErrorCode::INTERNAL_STATE);
    return;
  }

  transaction_ = Transaction::THINK;
  state_ = MachineState::THINKING;
  suppressDone_ = false;
  output_.println(F("THINK_START"));
  setDeadline(millis(), Config::THINK_MS);
}

void MachineController::startWholeRotation(Axis axis) {
  if (!commandCanStart(MachineState::HOLD_ALL)) {
    return;
  }
  if (!SafetyGuard::readyInvariant(servos_)) {
    enterError(ErrorCode::INTERNAL_STATE);
    return;
  }

  targetAxis_ = axis;
  if (axis == Axis::RL) {
    activeFace_ = Face::R;
    preloadFace_ = Face::L;
    nonAxis1_ = Face::F;
    nonAxis2_ = Face::B;
  } else {
    activeFace_ = Face::F;
    preloadFace_ = Face::B;
    nonAxis1_ = Face::R;
    nonAxis2_ = Face::L;
  }

  transaction_ = Transaction::WHOLE_ROTATION;
  state_ = MachineState::PREPARING_WHOLE_ROTATION;
  wholePhase_ = WholePhase::PRELOAD_RETRACT_WAIT;
  suppressDone_ = false;
  sendRotateMessage(F("ROTATE_START"), axis);

  if (!setGripChecked(preloadFace_, GripState::RETRACTED, GripContext::NORMAL)) {
    return;
  }
  setDeadline(millis(), Config::SLIDE_SETTLE_MS);
}

void MachineController::endDemo() {
  if (!commandCanStart(MachineState::HOLD_ALL)) {
    return;
  }
  if (!SafetyGuard::readyInvariant(servos_)) {
    enterError(ErrorCode::INTERNAL_STATE);
    return;
  }

  output_.println(F("DEMO_END_START"));
  transaction_ = Transaction::DEMO_END;
  state_ = MachineState::ENDING_DEMO;
  suppressDone_ = false;

  // Intentional, explicit exception: all four faces release together.
  if (!setAllGripsChecked(GripState::RETRACTED, GripContext::DEMO_END)) {
    return;
  }
  setDeadline(millis(), Config::SLIDE_SETTLE_MS);
}

MachineState MachineController::state() const {
  return state_;
}

void MachineController::updateBoot(uint32_t now) {
  if (!deadlineReached(now)) {
    return;
  }
  if (!SafetyGuard::idleInvariant(servos_)) {
    enterError(ErrorCode::INTERNAL_STATE);
    return;
  }
  state_ = MachineState::IDLE_RELEASED;
  sendIdle();
}

void MachineController::updateDemoStart(uint32_t now) {
  if (!deadlineReached(now)) {
    return;
  }
  finishReady();
}

void MachineController::updateFaceTurn(uint32_t now) {
  switch (facePhase_) {
    case FacePhase::TURNING:
      if (!updateMotion(now)) {
        return;
      }
      if (!setGripChecked(targetFace_, GripState::RETRACTED, GripContext::NORMAL)) {
        return;
      }
      state_ = MachineState::FACE_RESETTING;
      facePhase_ = FacePhase::RETRACT_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case FacePhase::RETRACT_WAIT:
      if (!deadlineReached(now)) {
        return;
      }
      if (!startSingleMotion(targetFace_, Config::LOGICAL_0, Config::FREE_ROTATION_MS, now)) {
        enterError(ErrorCode::INTERNAL_STATE);
        return;
      }
      facePhase_ = FacePhase::RESETTING;
      break;

    case FacePhase::RESETTING:
      if (!updateMotion(now)) {
        return;
      }
      if (!setGripChecked(targetFace_, GripState::ENGAGED, GripContext::NORMAL)) {
        return;
      }
      facePhase_ = FacePhase::ENGAGE_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case FacePhase::ENGAGE_WAIT:
      if (!deadlineReached(now)) {
        return;
      }
      finishReady();
      break;
  }
}

void MachineController::updateFaceHesitation(uint32_t now) {
  switch (hesitatePhase_) {
    case HesitatePhase::OUTWARD:
      if (!updateMotion(now)) {
        return;
      }
      hesitatePhase_ = HesitatePhase::PAUSE;
      setDeadline(now, Config::HESITATE_PAUSE_MS);
      break;

    case HesitatePhase::PAUSE:
      if (!deadlineReached(now)) {
        return;
      }
      if (!startSingleMotion(targetFace_, Config::LOGICAL_0,
                             Config::HESITATE_MOTION_MS, now)) {
        enterError(ErrorCode::INTERNAL_STATE);
        return;
      }
      hesitatePhase_ = HesitatePhase::RETURNING;
      break;

    case HesitatePhase::RETURNING:
      if (!updateMotion(now)) {
        return;
      }
      finishReady();
      break;
  }
}

void MachineController::updateThinking(uint32_t now) {
  if (!deadlineReached(now)) {
    return;
  }
  finishReady();
}

void MachineController::updateWholeRotation(uint32_t now) {
  switch (wholePhase_) {
    case WholePhase::PRELOAD_RETRACT_WAIT:
      if (!deadlineReached(now)) return;
      if (!startSingleMotion(preloadFace_, Config::LOGICAL_90, Config::FREE_ROTATION_MS, now)) {
        enterError(ErrorCode::INTERNAL_STATE);
        return;
      }
      wholePhase_ = WholePhase::PRELOAD_ROTATING;
      break;

    case WholePhase::PRELOAD_ROTATING:
      if (!updateMotion(now)) return;
      if (!setGripChecked(preloadFace_, GripState::ENGAGED, GripContext::NORMAL)) return;
      wholePhase_ = WholePhase::PRELOAD_ENGAGE_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case WholePhase::PRELOAD_ENGAGE_WAIT:
      if (!deadlineReached(now)) return;
      if (!setGripChecked(nonAxis1_, GripState::RETRACTED, GripContext::WHOLE_ROTATION)) return;
      wholePhase_ = WholePhase::NON_AXIS_1_RETRACT_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case WholePhase::NON_AXIS_1_RETRACT_WAIT:
      if (!deadlineReached(now)) return;
      if (!setGripChecked(nonAxis2_, GripState::RETRACTED, GripContext::WHOLE_ROTATION)) return;
      state_ = targetAxis_ == Axis::RL ? MachineState::HOLD_AXIS_RL : MachineState::HOLD_AXIS_FB;
      wholePhase_ = WholePhase::NON_AXIS_2_RETRACT_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case WholePhase::NON_AXIS_2_RETRACT_WAIT:
      if (!deadlineReached(now)) return;
      if (!startPairMotion(activeFace_, Config::LOGICAL_90, preloadFace_, Config::LOGICAL_0,
                           Config::WHOLE_ROTATION_MS, now)) {
        enterError(ErrorCode::INTERNAL_STATE);
        return;
      }
      state_ = MachineState::WHOLE_ROTATING;
      wholePhase_ = WholePhase::PAIR_ROTATING;
      break;

    case WholePhase::PAIR_ROTATING:
      if (!updateMotion(now)) return;
      if (!setGripChecked(nonAxis1_, GripState::ENGAGED, GripContext::WHOLE_ROTATION)) return;
      state_ = MachineState::RESTORING_HOLD;
      wholePhase_ = WholePhase::NON_AXIS_1_ENGAGE_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case WholePhase::NON_AXIS_1_ENGAGE_WAIT:
      if (!deadlineReached(now)) return;
      if (!setGripChecked(nonAxis2_, GripState::ENGAGED, GripContext::NORMAL)) return;
      wholePhase_ = WholePhase::NON_AXIS_2_ENGAGE_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case WholePhase::NON_AXIS_2_ENGAGE_WAIT:
      if (!deadlineReached(now)) return;
      if (!setGripChecked(activeFace_, GripState::RETRACTED, GripContext::NORMAL)) return;
      wholePhase_ = WholePhase::ACTIVE_RETRACT_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case WholePhase::ACTIVE_RETRACT_WAIT:
      if (!deadlineReached(now)) return;
      if (!startSingleMotion(activeFace_, Config::LOGICAL_0, Config::FREE_ROTATION_MS, now)) {
        enterError(ErrorCode::INTERNAL_STATE);
        return;
      }
      wholePhase_ = WholePhase::ACTIVE_RESETTING;
      break;

    case WholePhase::ACTIVE_RESETTING:
      if (!updateMotion(now)) return;
      if (!setGripChecked(activeFace_, GripState::ENGAGED, GripContext::NORMAL)) return;
      wholePhase_ = WholePhase::ACTIVE_ENGAGE_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case WholePhase::ACTIVE_ENGAGE_WAIT:
      if (!deadlineReached(now)) return;
      finishReady();
      break;
  }
}

void MachineController::updateDemoEnd(uint32_t now) {
  if (!deadlineReached(now)) {
    return;
  }
  if (!SafetyGuard::idleInvariant(servos_)) {
    enterError(ErrorCode::INTERNAL_STATE);
    return;
  }

  if (!suppressDone_) {
    output_.println(F("DEMO_END_DONE"));
  }
  suppressDone_ = false;
  transaction_ = Transaction::NONE;
  state_ = MachineState::IDLE_RELEASED;
  sendIdle();
}

void MachineController::beginStopRecovery(uint32_t now) {
  const MachineState interruptedState = state_;
  stopRequested_ = false;
  suppressDone_ = true;
  cancelMotion();
  state_ = MachineState::STOPPING;

  if ((transaction_ == Transaction::FACE_TURN ||
       transaction_ == Transaction::FACE_HESITATION) &&
      servos_.grip(targetFace_) == GripState::ENGAGED &&
      servos_.rotation(targetFace_) != Config::LOGICAL_0) {
    if (!startSingleMotion(targetFace_, Config::LOGICAL_0, Config::FREE_ROTATION_MS, now)) {
      enterError(ErrorCode::INTERNAL_STATE);
      return;
    }
    stopPhase_ = StopPhase::FACE_REVERSE;
    return;
  }

  if (transaction_ == Transaction::WHOLE_ROTATION &&
      (interruptedState == MachineState::HOLD_AXIS_RL ||
       interruptedState == MachineState::HOLD_AXIS_FB ||
       interruptedState == MachineState::WHOLE_ROTATING)) {
    if (!startPairMotion(activeFace_, Config::LOGICAL_0, preloadFace_, Config::LOGICAL_90,
                         Config::WHOLE_ROTATION_MS, now)) {
      enterError(ErrorCode::INTERNAL_STATE);
      return;
    }
    stopPhase_ = StopPhase::AXIS_REVERSE;
    return;
  }

  stopPhase_ = StopPhase::FIND_RETRACTED_ROTATION;
  updateStopRecovery(now);
}

void MachineController::updateStopRecovery(uint32_t now) {
  switch (stopPhase_) {
    case StopPhase::FACE_REVERSE:
    case StopPhase::AXIS_REVERSE:
      if (!updateMotion(now)) return;
      stopPhase_ = StopPhase::FIND_RETRACTED_ROTATION;
      break;

    case StopPhase::FIND_RETRACTED_ROTATION:
      recoveryFace_ = findRetractedNonZero();
      if (!validFace(recoveryFace_)) {
        stopPhase_ = StopPhase::FIND_MISSING_GRIP;
        return;
      }
      if (!startSingleMotion(recoveryFace_, Config::LOGICAL_0, Config::FREE_ROTATION_MS, now)) {
        enterError(ErrorCode::INTERNAL_STATE);
        return;
      }
      stopPhase_ = StopPhase::RESET_RETRACTED_ROTATION;
      break;

    case StopPhase::RESET_RETRACTED_ROTATION:
      if (!updateMotion(now)) return;
      stopPhase_ = StopPhase::FIND_RETRACTED_ROTATION;
      break;

    case StopPhase::FIND_MISSING_GRIP: {
      recoveryFace_ = findRetractedFace();
      if (!validFace(recoveryFace_)) {
        stopPhase_ = StopPhase::FIND_ENGAGED_ROTATION;
        return;
      }
      const GripContext context = servos_.engagedCount() == 2
                                      ? GripContext::WHOLE_ROTATION
                                      : GripContext::NORMAL;
      if (!setGripChecked(recoveryFace_, GripState::ENGAGED, context)) return;
      stopPhase_ = StopPhase::MISSING_GRIP_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;
    }

    case StopPhase::MISSING_GRIP_WAIT:
      if (!deadlineReached(now)) return;
      stopPhase_ = StopPhase::FIND_MISSING_GRIP;
      break;

    case StopPhase::FIND_ENGAGED_ROTATION:
      recoveryFace_ = findEngagedNonZero();
      if (!validFace(recoveryFace_)) {
        finishStoppedReady();
        return;
      }
      if (!setGripChecked(recoveryFace_, GripState::RETRACTED, GripContext::NORMAL)) return;
      stopPhase_ = StopPhase::ENGAGED_RETRACT_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case StopPhase::ENGAGED_RETRACT_WAIT:
      if (!deadlineReached(now)) return;
      if (!startSingleMotion(recoveryFace_, Config::LOGICAL_0, Config::FREE_ROTATION_MS, now)) {
        enterError(ErrorCode::INTERNAL_STATE);
        return;
      }
      stopPhase_ = StopPhase::RESET_ENGAGED_ROTATION;
      break;

    case StopPhase::RESET_ENGAGED_ROTATION:
      if (!updateMotion(now)) return;
      if (!setGripChecked(recoveryFace_, GripState::ENGAGED, GripContext::NORMAL)) return;
      stopPhase_ = StopPhase::ENGAGED_GRIP_WAIT;
      setDeadline(now, Config::SLIDE_SETTLE_MS);
      break;

    case StopPhase::ENGAGED_GRIP_WAIT:
      if (!deadlineReached(now)) return;
      stopPhase_ = StopPhase::FIND_ENGAGED_ROTATION;
      break;
  }
}

bool MachineController::startSingleMotion(Face face, uint16_t target, uint16_t durationMs,
                                          uint32_t now) {
  if (!validFace(face) || target > Config::LOGICAL_90) {
    return false;
  }
  motion_.active = true;
  motion_.count = 1;
  motion_.faces[0] = face;
  motion_.starts[0] = servos_.rotation(face);
  motion_.targets[0] = target;
  motion_.startedAt = now;
  motion_.durationMs = durationMs;
  motion_.lastWriteAt = now;
  return true;
}

bool MachineController::startPairMotion(Face first, uint16_t firstTarget, Face second,
                                        uint16_t secondTarget, uint16_t durationMs,
                                        uint32_t now) {
  if (!validFace(first) || !validFace(second) || first == second ||
      firstTarget > Config::LOGICAL_90 || secondTarget > Config::LOGICAL_90) {
    return false;
  }
  motion_.active = true;
  motion_.count = 2;
  motion_.faces[0] = first;
  motion_.faces[1] = second;
  motion_.starts[0] = servos_.rotation(first);
  motion_.starts[1] = servos_.rotation(second);
  motion_.targets[0] = firstTarget;
  motion_.targets[1] = secondTarget;
  motion_.startedAt = now;
  motion_.durationMs = durationMs;
  motion_.lastWriteAt = now;
  return true;
}

bool MachineController::updateMotion(uint32_t now) {
  if (!motion_.active) {
    return true;
  }

  const uint32_t elapsed = now - motion_.startedAt;
  if (elapsed < motion_.durationMs && now - motion_.lastWriteAt < Config::MOTION_UPDATE_MS) {
    return false;
  }

  const uint16_t progress = elapsed >= motion_.durationMs
                                ? 1000
                                : static_cast<uint16_t>((elapsed * 1000UL) / motion_.durationMs);

  for (uint8_t i = 0; i < motion_.count; ++i) {
    const int32_t start = motion_.starts[i];
    const int32_t difference = static_cast<int32_t>(motion_.targets[i]) - start;
    const uint16_t angle = static_cast<uint16_t>(start + (difference * progress) / 1000);
    if (!servos_.setRotation(motion_.faces[i], angle)) {
      cancelMotion();
      enterError(ErrorCode::INTERNAL_STATE);
      return false;
    }
  }
  motion_.lastWriteAt = now;

  if (progress == 1000) {
    motion_.active = false;
    return true;
  }
  return false;
}

void MachineController::cancelMotion() {
  motion_.active = false;
  motion_.count = 0;
}

bool MachineController::setGripChecked(Face face, GripState target, GripContext context) {
  if (!validFace(face) || !SafetyGuard::canSetGrip(servos_, face, target, context)) {
    enterError(ErrorCode::UNSAFE_GRIP_STATE);
    return false;
  }
  if (!servos_.setGrip(face, target)) {
    enterError(ErrorCode::INTERNAL_STATE);
    return false;
  }
  return true;
}

bool MachineController::setAllGripsChecked(GripState target, GripContext context) {
  if (context != GripContext::DEMO_START && context != GripContext::DEMO_END) {
    enterError(ErrorCode::UNSAFE_GRIP_STATE);
    return false;
  }
  for (uint8_t i = 0; i < Config::FACE_COUNT; ++i) {
    const Face face = static_cast<Face>(i);
    if (!SafetyGuard::canSetGrip(servos_, face, target, context) ||
        !servos_.setGrip(face, target)) {
      enterError(ErrorCode::INTERNAL_STATE);
      return false;
    }
  }
  return true;
}

bool MachineController::deadlineReached(uint32_t now) const {
  return static_cast<int32_t>(now - deadline_) >= 0;
}

void MachineController::setDeadline(uint32_t now, uint16_t delayMs) {
  deadline_ = now + delayMs;
}

Face MachineController::findRetractedNonZero() const {
  for (uint8_t i = 0; i < Config::FACE_COUNT; ++i) {
    const Face face = static_cast<Face>(i);
    if (servos_.grip(face) == GripState::RETRACTED &&
        servos_.rotation(face) != Config::LOGICAL_0) {
      return face;
    }
  }
  return Face::COUNT;
}

Face MachineController::findRetractedFace() const {
  for (uint8_t i = 0; i < Config::FACE_COUNT; ++i) {
    const Face face = static_cast<Face>(i);
    if (servos_.grip(face) == GripState::RETRACTED) {
      return face;
    }
  }
  return Face::COUNT;
}

Face MachineController::findEngagedNonZero() const {
  for (uint8_t i = 0; i < Config::FACE_COUNT; ++i) {
    const Face face = static_cast<Face>(i);
    if (servos_.grip(face) == GripState::ENGAGED &&
        servos_.rotation(face) != Config::LOGICAL_0) {
      return face;
    }
  }
  return Face::COUNT;
}

bool MachineController::validFace(Face face) const {
  return faceIndex(face) < Config::FACE_COUNT;
}

void MachineController::finishReady() {
  if (!SafetyGuard::readyInvariant(servos_)) {
    enterError(ErrorCode::INTERNAL_STATE);
    return;
  }

  if (!suppressDone_) {
    switch (transaction_) {
      case Transaction::DEMO_START:
        output_.println(F("DEMO_START_DONE"));
        break;
      case Transaction::FACE_TURN:
      case Transaction::FACE_HESITATION:
        sendMoveMessage(F("MOVE_DONE"), targetFace_);
        break;
      case Transaction::THINK:
        output_.println(F("THINK_DONE"));
        break;
      case Transaction::WHOLE_ROTATION:
        sendRotateMessage(F("ROTATE_DONE"), targetAxis_);
        break;
      case Transaction::NONE:
      case Transaction::DEMO_END:
        enterError(ErrorCode::INTERNAL_STATE);
        return;
    }
  }

  suppressDone_ = false;
  transaction_ = Transaction::NONE;
  state_ = MachineState::HOLD_ALL;
  sendReady();
}

void MachineController::finishStoppedReady() {
  if (!SafetyGuard::readyInvariant(servos_)) {
    enterError(ErrorCode::INTERNAL_STATE);
    return;
  }
  suppressDone_ = false;
  transaction_ = Transaction::NONE;
  state_ = MachineState::HOLD_ALL;
  sendReady();
}

void MachineController::enterError(ErrorCode code) {
  cancelMotion();
  stopRequested_ = false;
  suppressDone_ = false;
  transaction_ = Transaction::NONE;
  state_ = MachineState::ERROR_HOLD;
  sendError(code);
}

void MachineController::sendError(ErrorCode code) {
  output_.print(F("ERROR "));
  switch (code) {
    case ErrorCode::BUSY: output_.println(F("BUSY")); break;
    case ErrorCode::INVALID_COMMAND: output_.println(F("INVALID_COMMAND")); break;
    case ErrorCode::INVALID_STATE: output_.println(F("INVALID_STATE")); break;
    case ErrorCode::UNSAFE_GRIP_STATE: output_.println(F("UNSAFE_GRIP_STATE")); break;
    case ErrorCode::INTERNAL_STATE: output_.println(F("INTERNAL_STATE")); break;
  }
}

void MachineController::sendReady() {
  output_.println(F("READY"));
}

void MachineController::sendIdle() {
  output_.println(F("IDLE"));
}

void MachineController::sendMoveMessage(const __FlashStringHelper* prefix, Face face) {
  output_.print(prefix);
  output_.print(' ');
  output_.println(faceName(face));
}

void MachineController::sendRotateMessage(const __FlashStringHelper* prefix, Axis axis) {
  output_.print(prefix);
  output_.print(' ');
  output_.println(axis == Axis::RL ? F("RL") : F("FB"));
}

bool MachineController::commandCanStart(MachineState requiredState) {
  if (state_ == requiredState) {
    return true;
  }
  if (state_ == MachineState::IDLE_RELEASED || state_ == MachineState::HOLD_ALL ||
      state_ == MachineState::ERROR_HOLD) {
    sendError(ErrorCode::INVALID_STATE);
  } else {
    sendError(ErrorCode::BUSY);
  }
  return false;
}
