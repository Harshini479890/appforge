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

Firebase setup:
1.Go to firebase.com

2.Go down and click get started in console

3.Click create a new firebase project

4.Enter your project name 

5.Click create

6.Your firebase project is ready

7.Left side bar go to build

8.In build go to authentication

9.Get started

10.Native providers

     Email/Password
     
11.Email/Password - Enable and then click save

12.Go to project overview over top left corner click add app 

13.select a platform click web(</>)

14.Give an app nickname and don't enable also set up firebase hosting and click register app

15.In Add Firebase SDK then u will get a code that is unique to everyone copy only from const (Firebase configuration) to firebase.js 

16.Then copy this code // firestore.js


import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
const firebaseConfig = {
  
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with persistence (using AsyncStorage)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),  // Set persistence
});

// Initialize Firestore
const db = getFirestore(app);

// Export auth and db instances
export { auth, db };
In this firebase configuration paste the code u got from firebase.com
