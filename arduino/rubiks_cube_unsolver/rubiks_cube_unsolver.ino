#include "Config.h"
#include "MachineController.h"
#include "SerialProtocol.h"
#include "ServoController.h"

ServoController servoController;
MachineController machineController(servoController, Serial);
SerialProtocol serialProtocol(machineController);

void setup() {
  Serial.begin(Config::SERIAL_BAUD);
  servoController.begin();
  machineController.begin(millis());
}

void loop() {
  serialProtocol.poll(Serial);
  machineController.update(millis());
}

