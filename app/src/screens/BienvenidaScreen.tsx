import { View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Button, LinkButton, Paragraph, Screen, Title } from '../ui';

export function BienvenidaScreen() {
  const nav = useNav();
  const { session, cerrarSesion } = useAuth();

  return (
    <Screen>
      <Title>Hola, {session?.usuario.nombre}</Title>
      <Paragraph>
        PatrimonIA organiza tu plata por hogar. Crea el tuyo (aunque vivas solo) o únete a
        uno con una invitación.
      </Paragraph>

      <View style={{ gap: 12 }}>
        <Button title="Crear un hogar nuevo" onPress={() => nav.go('CrearHogar')} />
        <Button
          title="Tengo una invitación pendiente"
          variant="secondary"
          onPress={() => nav.go('Invitaciones')}
        />
      </View>

      <Paragraph>
        También puedes esperar a que un administrador te invite. Vuelve a esta pantalla cuando
        quieras revisar tus invitaciones.
      </Paragraph>

      <LinkButton title="Cerrar sesión" onPress={cerrarSesion} />
    </Screen>
  );
}
