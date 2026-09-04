import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { Button, GroupLabel, MenuLink, Screen, Segmented, Title, useTema, type ModoTema } from '../ui';

const OPC_TEMA: ModoTema[] = ['sistema', 'claro', 'oscuro'];
const ETIQUETA_TEMA: Record<ModoTema, string> = {
  sistema: 'Automático',
  claro: 'Claro',
  oscuro: 'Oscuro',
};

export function AjustesScreen() {
  const nav = useNav();
  const { cerrarSesion } = useAuth();
  const { modo, setModo } = useTema();

  const salir = async () => {
    if (await confirmar('Cerrar sesión', 'Tendrás que volver a iniciar sesión.', 'Cerrar sesión')) {
      cerrarSesion();
    }
  };

  return (
    <Screen>
      <Title>Ajustes</Title>

      <GroupLabel>Apariencia</GroupLabel>
      <Segmented
        label="Tema"
        options={OPC_TEMA}
        value={modo}
        onChange={setModo}
        formatearOpcion={(v) => ETIQUETA_TEMA[v]}
      />

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

      <GroupLabel>Sesión</GroupLabel>
      <Button title="Cerrar sesión" variant="danger" onPress={salir} />
    </Screen>
  );
}
