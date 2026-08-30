#pragma once

#include <Arduino.h>

#include "Config.h"
#include "MachineController.h"

class SerialProtocol {
 public:
  explicit SerialProtocol(MachineController& machine);
  void poll(Stream& input);

 private:
  void processLine();
  bool parseFace(const char* token, Face& face) const;
  bool parseAxis(const char* token, Axis& axis) const;

  MachineController& machine_;
  char buffer_[Config::COMMAND_BUFFER_SIZE];
  uint8_t length_;
  bool overflowed_;
};

