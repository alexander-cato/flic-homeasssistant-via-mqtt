/* Copyright (c) 2023 Alexander Cato
------------------------------------------------------------------------------
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
-----------------------------------------------------------------------------
*/

// Variables to configure
var server = "";
var homeAssistantTopic = "homeassistant";
var flicTopic = "flic";
var mqttCredentials = { username: "", password: "" };

// Begin code -- no need to edit below this line
var mqtt = require("./mqtt").create(server, mqttCredentials);
var buttonManager = require("buttons");
var buttons = {}; // Store Button objects
var buttonHoldStatus = {}; // Track if a button was held
var buttonConnectedStatus = {}; // Track if a button is connected

// Generic event handler for button actions
function handleButtonEvent(eventType, obj) {
  var button = buttonManager.getButton(obj.bdaddr);

  if (!button.serialNumber || !button.name) {
    return;
  }

  console.log(
    "\nNew button " + eventType + "! " + button.serialNumber + " " + button.name
  );
  console.log("\nRAW obj info: " + JSON.stringify(obj, null, 4) + "\n");
  console.log("\nRAW button info: " + JSON.stringify(button, null, 4) + "\n");

  registerButton(button);
}

// Consolidated event handlers for button lifecycle
["buttonAdded", "buttonConnected", "buttonReady"].forEach(function (event) {
  buttonManager.on(event, function (obj) {
    handleButtonEvent(event, obj);
  });
});

// Event handler for button connection
buttonManager.on("buttonConnected", function (obj) {
  var button = buttonManager.getButton(obj.bdaddr);
  buttonConnectedStatus[button.bdaddr] = true;
  var buttonTopic = flicTopic + "/" + button.serialNumber;
  mqtt.publish(buttonTopic + "/connected", "ON", { retain: true });
});

// Event handler for button disconnection
buttonManager.on("buttonDisconnected", function (obj) {
  var button = buttonManager.getButton(obj.bdaddr);
  buttonConnectedStatus[button.bdaddr] = false;
  var buttonTopic = flicTopic + "/" + button.serialNumber;
  mqtt.publish(buttonTopic + "/connected", "OFF", { retain: true });
});

// Event handler for button deletion
buttonManager.on("buttonDeleted", function (obj) {
  console.log("\nDeleting button " + obj.bdaddr);
  var configTopic =
    homeAssistantTopic + "/sensor/" + buttons[obj.bdaddr].serialNumber;
  mqtt.publish(configTopic + "/click_event/config", null, { retain: true });

  if (buttons[obj.bdaddr]) {
    delete buttons[obj.bdaddr];
    delete buttonHoldStatus[obj.bdaddr];
    delete buttonConnectedStatus[obj.bdaddr];
  }
});

// Event handler for button click actions
buttonManager.on("buttonSingleOrDoubleClickOrHold", function (obj) {
  var button = buttonManager.getButton(obj.bdaddr);
  var clickType = obj.isSingleClick
    ? "click"
    : obj.isDoubleClick
      ? "double_click"
      : "hold";
  buttonHoldStatus[button.bdaddr] = clickType === "hold";

  // Log for debugging
  console.log(
    "Button " +
    button.serialNumber +
    " hold status: " +
    buttonHoldStatus[button.bdaddr]
  );

  var buttonTopic = flicTopic + "/" + button.serialNumber;
  var eventPayload = { event_type: clickType };
  mqtt.publish(buttonTopic + "/click_event", JSON.stringify(eventPayload), {
    retain: false,
  });

  if (!buttons[button.bdaddr] || buttons[button.bdaddr].name !== button.name) {
    registerButton(button);
  }

  mqtt.publish(buttonTopic + "/battery", button.batteryStatus.toString(), {
    retain: true,
  });
});

// Event handler for button release
buttonManager.on("buttonUp", function (obj) {
  var button = buttonManager.getButton(obj.bdaddr);
  var buttonTopic = flicTopic + "/" + button.serialNumber;

  if (buttonHoldStatus[button.bdaddr]) {
    var eventPayload = { event_type: "hold_released" };
    mqtt.publish(buttonTopic + "/click_event", JSON.stringify(eventPayload), {
      retain: false,
    });
    console.log(buttonTopic + "/click_event   \thold_released");
    buttonHoldStatus[button.bdaddr] = false;
  }

  var binaryStateTopic =
    flicTopic + "/" + button.serialNumber + "/binary_state";
  mqtt.publish(binaryStateTopic, "OFF", { retain: true });
  console.log(binaryStateTopic + ":   \tOFF");
});

// Event handlers for button press and release
buttonManager.on("buttonDown", function (obj) {
  publishButtonState(obj, "ON");
});

function publishButtonState(obj, state) {
  var button = buttonManager.getButton(obj.bdaddr);
  var stateTopic = flicTopic + "/" + button.serialNumber + "/binary_state";
  mqtt.publish(stateTopic, state, { retain: state === "OFF" });
}

// Function to register a button
function registerButton(button) {
  console.log("\nRAW device info: " + JSON.stringify(button, null, 4) + "\n");
  if (button.serialNumber == null) {
    console.log("**Error registering button, still no serialNumber");
    return;
  }
  var sensorTopic = homeAssistantTopic + "/sensor/" + button.serialNumber;
  var binarySensorTopic =
    homeAssistantTopic + "/binary_sensor/" + button.serialNumber;
  var eventTopic = homeAssistantTopic + "/event/" + button.serialNumber;
  var buttonTopic = flicTopic + "/" + button.serialNumber;

  var obj = {
    device: {
      name: button.name.toLowerCase().replace(/[^a-zA-Z0-9]/g, ""),
      identifiers: [button.serialNumber, button.uuid],
      manufacturer: "Flic",
      model: button.serialNumber,
      hw_version: "Flic " + button.flicVersion + " " + button.color,
      sw_version: "v" + button.firmwareVersion,
      connections: [["bluetooth", button.bdaddr]],
      configuration_url: "https://hubsdk.flic.io/",
    },
    name: "State",
    friendly_name: "State",
    state_topic: buttonTopic + "/binary_state",
    unique_id: "Flic_" + button.serialNumber + "_binary_state",
    payload_on: "ON",
    payload_off: "OFF",
  };

  var payload = JSON.stringify(obj, null, 4);
  mqtt.publish(binarySensorTopic + "/config", payload, { retain: true });

  // Additional properties for battery level report
  var objBattery = {
    device: obj.device, // Reuse the device configuration
    name: "Battery",
    friendly_name: "Battery",
    state_topic: buttonTopic + "/battery",
    unique_id: "Flic_" + button.serialNumber + "_battery",
    device_class: "battery",
    unit_of_measurement: "%",
    entity_category: "diagnostic",
  };

  var payloadBattery = JSON.stringify(objBattery, null, 4);
  mqtt.publish(sensorTopic + "/battery/config", payloadBattery, {
    retain: true,
  });

  // Additional properties for button connection
  var objConnected = {
    device: obj.device, // Reuse the device configuration
    name: "Connected",
    friendly_name: "Connected",
    state_topic: buttonTopic + "/connected",
    unique_id: "Flic_" + button.serialNumber + "_connected",
    device_class: "connectivity",
    entity_category: "diagnostic",
    payload_on: "ON",
    payload_off: "OFF",
  };

  var payloadConnected = JSON.stringify(objConnected, null, 4);
  mqtt.publish(binarySensorTopic + "/connected/config", payloadConnected, {
    retain: true,
  });

  var currentStatus = button.connected ? "ON" : "OFF";
  mqtt.publish(buttonTopic + "/connected", currentStatus, { retain: true });

  // Additional properties for passive mode status
  var objConnectivityMode = {
    device: obj.device, // Reuse the device configuration
    name: "Connectivity Mode",
    friendly_name: "Connectivity Mode",
    state_topic: buttonTopic + "/connectivity_mode",
    unique_id: "Flic_" + button.serialNumber + "_connectivitymode",
    entity_category: "diagnostic",
  };

  var payloadMode = JSON.stringify(objConnectivityMode, null, 4);
  mqtt.publish(sensorTopic + "/connectivity_mode/config", payloadMode, {
    retain: true,
  });

  // Publish the current mode status
  var currentModeStatus = button.passiveMode ? "Passive" : "Active";
  mqtt.publish(buttonTopic + "/connectivity_mode", currentModeStatus, {
    retain: true,
  });

  // Additional properties for button action
  var objClickEvent = {
    device: obj.device, // Reuse the device configuration
    name: "Click Event",
    friendly_name: "Click Event",
    state_topic: buttonTopic + "/click_event",
    unique_id: "Flic_" + button.serialNumber + "_clickevent",
    device_class: "button",
    event_types: ["click", "double_click", "hold", "hold_released"],
  };

  var payloadEvent = JSON.stringify(objClickEvent, null, 4);
  mqtt.publish(eventTopic + "/click_event/config", payloadEvent, {
    retain: false,
  });

  buttons[button.bdaddr] = {
    name: button.name.toLowerCase().replace(/ /g, ""),
    serialNumber: button.serialNumber,
  };

  console.log("\nmyButtons: " + JSON.stringify(buttons, null, 4) + "\n");
}

// Function to register all buttons
function registerAllButtons() {
  var allButtons = buttonManager.getButtons();
  allButtons.forEach(registerButton);
}

// MQTT event handlers
mqtt.on("connected", registerAllButtons);
mqtt.on("disconnected", function () {
  mqtt.connect();
});
mqtt.on("error", function () {
  setTimeout(function () {
    throw new Error("Crashed");
  }, 1000);
});

// Connect to MQTT server
mqtt.connect();