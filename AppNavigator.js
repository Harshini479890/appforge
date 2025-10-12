// AppNavigator.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import LoginScreen from './LoginScreen';
import SignupScreen from './SignupScreen';
import HomeScreen from './HomeScreen';
import Rotameter from './Rotameter';
import Venturimeter from './Venturimeter';

const Stack = createStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="Signup">
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Calibaration of Rotameter" component={Rotameter} />
      <Stack.Screen name="Calibaration of Venturimeter" component={Venturimeter} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;