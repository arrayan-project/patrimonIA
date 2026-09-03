import { StatusBar } from 'expo-status-bar';
import { Platform, SafeAreaView, StatusBar as RNStatusBar, StyleSheet } from 'react-native';
import { AppFlow } from './src/AppFlow';
import { AuthFlow } from './src/AuthFlow';
import { AuthProvider, useAuth } from './src/auth/AuthContext';

function Root() {
  const { session } = useAuth();
  return session ? <AppFlow /> : <AuthFlow />;
}

/**
 * Fase 1 — Flujo 2 (Alta de hogar). Registro → Bienvenida → Crear Hogar /
 * Invitaciones → Dashboard. Ver Docs/UX_FLOWS.docx "Desglose — Flujo 2".
 */
export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <AuthProvider>
        <Root />
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
});
