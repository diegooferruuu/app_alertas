import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from './src/hooks/useAuth';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { PersonalDataScreen } from './src/screens/auth/PersonalDataScreen';
import { IDPhotoScreen } from './src/screens/auth/IDPhotoScreen';
import { SelfieScreen } from './src/screens/auth/SelfieScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ActivityIndicator, View } from 'react-native';
import { storage } from './src/utils/storage';

const Stack = createStackNavigator();

export default function App() {
  const { isAuthenticated, identityVerified, getProfile } = useAuth();
  const [isLoading, setIsLoading] = React.useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await storage.getItem('accessToken');
        if (token) {
          await getProfile();
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          cardStyle: { backgroundColor: 'white' },
        }}
      >
        {!isAuthenticated ? (
          <Stack.Group>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: 'Crear cuenta' }}
            />
          </Stack.Group>
        ) : !identityVerified ? (
          // Flujo de verificación de identidad (3 pasos)
          <Stack.Group>
            <Stack.Screen
              name="PersonalData"
              component={PersonalDataScreen}
              options={{
                title: 'Paso 1: Datos personales',
                headerBackVisible: false,
              }}
            />
            <Stack.Screen
              name="IDPhoto"
              component={IDPhotoScreen}
              options={{ title: 'Paso 2: Foto del carnet' }}
            />
            <Stack.Screen
              name="Selfie"
              component={SelfieScreen}
              options={{ title: 'Paso 3: Selfie' }}
            />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Alerta de Emergencia' }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
