import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from './src/hooks/useAuth';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen } from './src/screens/auth/RegisterScreen';
import { PersonalDataScreen } from './src/screens/auth/PersonalDataScreen';
import { IDPhotoScreen } from './src/screens/auth/IDPhotoScreen';
import { SelfieScreen } from './src/screens/auth/SelfieScreen';
import { MainTabs } from './src/navigation/MainTabs';
import { ReportarDenunciaScreen } from './src/screens/main/ReportarDenunciaScreen';
import { DenunciaDetailScreen } from './src/screens/main/DenunciaDetailScreen';
import { EditDenunciaScreen } from './src/screens/main/EditDenunciaScreen';
import { MisDenunciasScreen } from './src/screens/main/MisDenunciasScreen';
import { AlertasSobreMiScreen } from './src/screens/main/AlertasSobreMiScreen';
import { TextoLegalScreen } from './src/screens/main/TextoLegalScreen';
import { FirmarDeclaracionScreen } from './src/screens/main/FirmarDeclaracionScreen';
import { ActivityIndicator, View } from 'react-native';
import { storage } from './src/utils/storage';

const Stack = createStackNavigator();

export default function App() {
  const { isAuthenticated, getProfile } = useAuth();
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
          // Stack de autenticación
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
        ) : (
          // App principal: cualquier usuario logueado entra (Visitante o más).
          // La verificación se exige solo al reportar.
          <Stack.Group>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ReportarDenuncia"
              component={ReportarDenunciaScreen}
              options={{ title: 'Reportar', presentation: 'modal' }}
            />
            <Stack.Screen
              name="DenunciaDetail"
              component={DenunciaDetailScreen}
              options={{ title: 'Detalle de la denuncia' }}
            />
            <Stack.Screen
              name="EditDenuncia"
              component={EditDenunciaScreen}
              options={{ title: 'Editar denuncia' }}
            />
            <Stack.Screen
              name="MisDenuncias"
              component={MisDenunciasScreen}
              options={{ title: 'Mis denuncias' }}
            />
            {/* El interruptor de desactivación, del lado de quien es reportado.
                Se llega desde el perfil, desde el registro del documento y
                —cuando exista el push— desde la propia notificación. */}
            <Stack.Screen
              name="AlertasSobreMi"
              component={AlertasSobreMiScreen}
              options={{ title: 'Alertas sobre mí' }}
            />
            {/* Declaración jurada: leer el texto, luego declarar y firmar. */}
            <Stack.Screen
              name="TextoLegal"
              component={TextoLegalScreen}
              options={{ title: 'Declaración jurada' }}
            />
            <Stack.Screen
              name="FirmarDeclaracion"
              component={FirmarDeclaracionScreen}
              options={{ title: 'Firmar declaración' }}
            />
            {/* Flujo de verificación de identidad (on-demand) */}
            <Stack.Screen
              name="PersonalData"
              component={PersonalDataScreen}
              options={{ title: 'Documento: datos' }}
            />
            <Stack.Screen
              name="IDPhoto"
              component={IDPhotoScreen}
              options={{ title: 'Documento: fotos' }}
            />
            <Stack.Screen
              name="Selfie"
              component={SelfieScreen}
              options={{ title: 'Documento: selfie' }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
