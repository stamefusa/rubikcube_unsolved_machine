#include "SerialProtocol.h"

#include <string.h>

SerialProtocol::SerialProtocol(MachineController& machine)
    : machine_(machine), buffer_{0}, length_(0), overflowed_(false) {}

void SerialProtocol::poll(Stream& input) {
  while (input.available() > 0) {
    const char value = static_cast<char>(input.read());
    if (value == '\n') {
      if (overflowed_) {
        machine_.invalidCommand();
      } else {
        buffer_[length_] = '\0';
        processLine();
      }
      length_ = 0;
      overflowed_ = false;
      continue;
    }

    if (value == '\r') {
      continue;
    }
    if (overflowed_) {
      continue;
    }
    if (length_ >= Config::COMMAND_BUFFER_SIZE - 1) {
      overflowed_ = true;
      continue;
    }
    buffer_[length_++] = value;
  }
}

void SerialProtocol::processLine() {
  char* save = nullptr;
  char* command = strtok_r(buffer_, " \t", &save);
  if (command == nullptr) {
    return;
  }
  char* argument = strtok_r(nullptr, " \t", &save);
  char* extra = strtok_r(nullptr, " \t", &save);
  char* trailing = strtok_r(nullptr, " \t", &save);

  if (strcmp(command, "PING") == 0 && argument == nullptr) {
    machine_.ping();
    return;
  }
  if (strcmp(command, "STATUS") == 0 && argument == nullptr) {
    machine_.status();
    return;
  }
  if (strcmp(command, "STOP") == 0 && argument == nullptr) {
    machine_.stop();
    return;
  }
  if (strcmp(command, "DEMO_START") == 0 && argument == nullptr) {
    machine_.startDemo();
    return;
  }
  if (strcmp(command, "DEMO_END") == 0 && argument == nullptr) {
    machine_.endDemo();
    return;
  }
  if (strcmp(command, "THINK") == 0 && argument == nullptr) {
    machine_.startThinking();
    return;
  }

  Face face = Face::COUNT;
  if (strcmp(command, "MOVE") == 0 && argument != nullptr && trailing == nullptr &&
      parseFace(argument, face)) {
    if (extra == nullptr) {
      machine_.startFaceTurn(face);
      return;
    }
    if (strcmp(extra, "HESITATE") == 0) {
      machine_.startFaceHesitation(face);
      return;
    }
  }

  Axis axis = Axis::RL;
  if (strcmp(command, "ROTATE") == 0 && argument != nullptr && extra == nullptr &&
      parseAxis(argument, axis)) {
    machine_.startWholeRotation(axis);
    return;
  }

  machine_.invalidCommand();
}

bool SerialProtocol::parseFace(const char* token, Face& face) const {
  if (token[0] == '\0' || token[1] != '\0') {
    return false;
  }
  switch (token[0]) {
    case 'R': face = Face::R; return true;
    case 'L': face = Face::L; return true;
    case 'F': face = Face::F; return true;
    case 'B': face = Face::B; return true;
    default: return false;
  }
}

bool SerialProtocol::parseAxis(const char* token, Axis& axis) const {
  if (strcmp(token, "RL") == 0) {
    axis = Axis::RL;
    return true;
  }
  if (strcmp(token, "FB") == 0) {
    axis = Axis::FB;
    return true;
  }
  return false;
}
