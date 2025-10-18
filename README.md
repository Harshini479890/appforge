# appforge
Created an app using react native (mobile app) with venturimeter and rotameter experiments calculations.


Why do I have a folder named ".expo" in my project?

The ".expo" folder is created when an Expo project is started using "expo start" command.

What do the files contain?

"devices.json": contains information about devices that have recently opened this project. This is used to populate the "Development sessions" list in your development builds.
"packager-info.json": contains port numbers and process PIDs that are used to serve the application to the mobile device/simulator.
"settings.json": contains the server configuration that is used to serve the application manifest.
Should I commit the ".expo" folder?

No, you should not share the ".expo" folder. It does not contain any information that is relevant for other developers working on the project, it is specific to your machine.

Upon project creation, the ".expo" folder is already added to your ".gitignore" file.

Procedure:

1.Install expo go app in your mobile
2.Create a folder reactnative in fire explorer(New volume D/E/F).
3.create a folder appforge.
4.Execute the commands
npx create-expo-app --template
npm install firebase
npx expo install expo-file-system expo-sharing
npm install react-native-chart-kit
npx expo install react-native-svg
npx expo install @react-native-async-storage/async-storage
npx expo install react-native-screens react-native-safe-area-context react-native-gesture-handler react-native-reanimated react-native-vector-icons
npx expo install @react-navigation
npx expo install @react-stack
5.Open the folder in vscode and create App.js,AppNavigator.js,Home screen.js, SignupScreen.js, Rotameter.js, Venturimeter.js, Login screen.js,firebase.js.
6.Navigate to appforge by command (cd appforge) and type npx expo start.
7.Scan the qr form expo go app

Note:
Ensure both laptop and mobile with same network/wifi.
