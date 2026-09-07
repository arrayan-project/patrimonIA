import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { BannerConexion } from './src/ui/BannerConexion';
import { AlcanceProvider } from './src/ui/alcance';
import { TemaProvider, useTema } from './src/ui/tema';
import { ToastProvider } from './src/ui/Toast';

/**
 * PatrimonIA — gestión de patrimonio familiar.
 * Navegación con @react-navigation; sesión persistida (expo-secure-store).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <ToastProvider>
          <AuthProvider>
            <AlcanceProvider>
              <RootNavigator />
              <BannerConexion />
            </AlcanceProvider>
          </AuthProvider>
        </ToastProvider>
        <BarraEstado />
      </TemaProvider>
    </SafeAreaProvider>
  );
}

function BarraEstado() {
  const { oscuro } = useTema();
  return <StatusBar style={oscuro ? 'light' : 'dark'} />;
}
