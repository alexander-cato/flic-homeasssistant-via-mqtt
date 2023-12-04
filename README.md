# Flic --> MQTT --> Home Assistant

A Flic SDK app that publishes all of a Flic Hub's connected buttons to Home Assistant via MQTT

## Prerequisites:
* A Flic Hub LR ([The Flic Hub Mini does not support the Flic SDK](https://flic.io/flic-hubs#comparison-table) and therefore will not work with this app)
* At least one Flic Button connected to the Hub
* A functioning Home Assistant installation
* A functioning MQTT server (I use the EMQX Home Assistant add-on but Mosquitto will too.) In case you are setting up the EMQX add-on for the first time, I reccomend [this guide](https://smarthomescene.com/guides/setting-up-emqx-mqtt-broker-in-home-assistant/) to get started. Furthermore, it would be ideal to set up two users in EMQX, one for Home Assistant and one for the Flic Hub.
* The MQTT Integration setup and enabled in Home Assistant


## Installation:
**1. Enable the Flic SDK:**
1. Using the Flic mobile app, connect to the Hub, go to settings, and enable SDK access (If you do not see this option you may need to update your Hubs firmware first).
2.  Go to: <https://hubsdk.flic.io/> and login, your hub should be discovered automatically.

**2. Create the module:**
1. Once logged into the web IDE, click "Create Module" and give it a name. (You can name it whatever you want, but I named mine "HASS-MQTT")

**3. Add the files `main.js` and `mqtt.js`:**
1. Copy content from `main.js` in this repo to main.js in the flic IDE. (the IDE will automatically create the file for you upon creation of the module. Do not change the name of the main.js file.)
2. Right click the folder in the left pane and then click "New File".
3. Name the file `mqtt.js` (do not change the name of the file)
4. Copy content from `mqtt.js` in this repo to `mqtt.js` in the flic IDE.

**4. Update `main.js` variables:**
1. Open `main.js` in the IDE.
2. Update the `server` variable with your MQTT server address.
3. Update the `homeAssistantTopic` variable with your Home Assistant topic.
4. Update the `flicTopic` variable with your Flic topic.
5. Update the `mqttCredentials` object with your MQTT username and password.

**5. Run the Module**
1. Start the module in the IDE by clicking the green play button and monitor the Console output to verify it is running as expected without any errors.

2. Once you have verified the module is running as expected, enable the "restart after crash" checkbox to ensure the module is always running upon Hub reboot, MQTT server restart, or crash.