import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { Button, GroupLabel, MenuLink, Screen, Title } from '../ui';

export function AjustesScreen() {
  const nav = useNav();
  const { cerrarSesion } = useAuth();

  const salir = async () => {
    if (await confirmar('Cerrar sesión', 'Tendrás que volver a iniciar sesión.', 'Cerrar sesión')) {
      cerrarSesion();
    }
  };

  return (
    <Screen>
      <Title>Ajustes</Title>

      <GroupLabel>Cuenta</GroupLabel>
      <MenuLink
        icon="person-outline"
        title="Mi perfil"
        subtitle="Nombre y datos de la cuenta"
        onPress={() => nav.go('Perfil')}
      />
      <MenuLink
        icon="pricetags-outline"
        title="Etiquetas"
        subtitle="Marcas personales transversales para tus movimientos"
        onPress={() => nav.go('Etiquetas')}
      />
      <MenuLink
        icon="folder-outline"
        title="Agrupaciones de elementos"
        subtitle="Carpetas para ordenar tus cuentas y activos"
        onPress={() => nav.go('Agrupaciones')}
      />

      <GroupLabel>Hogar</GroupLabel>
      <MenuLink
        icon="list-outline"
        title="Categorías de movimiento"
        subtitle="Rubros para clasificar ingresos y gastos"
        onPress={() => nav.go('Categorias')}
      />
      <MenuLink
        icon="swap-horizontal-outline"
        title="Tipos de cambio"
        subtitle="Tasas para convertir entre monedas"
        onPress={() => nav.go('TiposCambio')}
      />

      <GroupLabel>Sesión</GroupLabel>
      <Button title="Cerrar sesión" variant="danger" onPress={salir} />
    </Screen>
  );
}
