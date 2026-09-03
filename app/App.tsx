import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Fase 0: pantalla en blanco. Sin lógica de negocio todavía.
// Las pantallas del Flujo 2 (Registro, Bienvenida, Crear Hogar, Invitaciones)
// se incorporan en Fase 1 — ver Docs/UX_FLOWS.docx.
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PatrimonIA</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111',
  },
});
