import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { PreferenciasProvider } from './src/preferencias';
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
  // G35: la letra de la app (ui/Text). Hasta que carga no se pinta nada, para
  // no mostrar un instante la letra del sistema; si falla, sigue con la del sistema.
  const [fuentesListas, errorFuentes] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });
  if (!fuentesListas && !errorFuentes) return null;
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <ToastProvider>
          <AuthProvider>
            <PreferenciasProvider>
              <AlcanceProvider>
                <RootNavigator />
                <BannerConexion />
              </AlcanceProvider>
            </PreferenciasProvider>
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
