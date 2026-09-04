import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { BannerConexion } from './src/ui/BannerConexion';
import { ToastProvider } from './src/ui/Toast';

/**
 * PatrimonIA — gestión de patrimonio familiar.
 * Navegación con @react-navigation; sesión persistida (expo-secure-store).
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <RootNavigator />
          <BannerConexion />
        </AuthProvider>
      </ToastProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
