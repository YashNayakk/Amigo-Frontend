import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'react-native';
import Ionicons from "react-native-vector-icons/Ionicons";

import Home from './component/home';
import Profile from './component/profile';
import Performance from './component/performance';
import Metrics from './component/metric';
import login from './component/login';
import flipPhone from './component/flipPhone';
import impengo from './component/impengo';
import Showcase from './component/showcase';
import Notification from './component/notifications';
import CardSharing from './component/CardSharing';
import CommitmentPod from './component/CommitmentPod';
import podDetail from './component/podDetail';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Impengo':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Performance':
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'home-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor:"#ffffff", //'rgb(73, 68, 68)',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle:{
          backgroundColor:"#080808",
          borderTopWidth:0,
          elevation:0,
          shadowOpacity:0,
        }
      })}
    >
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Impengo" component={impengo} />
      <Tab.Screen name="Performance" component={Performance} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  )

}

function AppContent() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen
          name="Tabs"
          component={Tabs}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Login"
          component={login}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Metrics"
          component={Metrics}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="FlipPhone"
          component={flipPhone}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Showcase"
          component={Showcase}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="Notification"
          component={Notification}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="CardSharing"
          component={CardSharing}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="CommitmentPod"
          component={CommitmentPod}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="podDetail"
          component={podDetail}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

export default function App() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <AppContent />
    </>
  )
}