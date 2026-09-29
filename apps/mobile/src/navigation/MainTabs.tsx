import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MapScreen } from '../screens/main/MapScreen';
import { DenunciasListScreen } from '../screens/main/DenunciasListScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

// Icono que cambia a versión "rellena" cuando la pestaña está activa
const tabIcon =
  (base: string) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) =>
    <Ionicons name={(focused ? base : `${base}-outline`) as any} size={size} color={color} />;

export const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#999',
        headerTitleAlign: 'center',
      }}
    >
      <Tab.Screen
        name="Mapa"
        component={MapScreen}
        options={{ tabBarIcon: tabIcon('map'), title: 'Denuncias cercanas' }}
      />
      <Tab.Screen
        name="Denuncias"
        component={DenunciasListScreen}
        options={{ tabBarIcon: tabIcon('list'), title: 'Lista de denuncias' }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{ tabBarIcon: tabIcon('person') }}
      />
    </Tab.Navigator>
  );
};
