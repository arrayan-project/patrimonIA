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

/**
 * Configuración — consolidador único de toda la configuración de la app
 * (G25). Lo que es del hogar se ve también desde la pestaña Hogar.
 */
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
      <Title>Configuración</Title>

      <GroupLabel>Apariencia</GroupLabel>
      <Segmented
        label="Tema"
        options={OPC_TEMA}
        value={modo}
        onChange={setModo}
        formatearOpcion={(v) => ETIQUETA_TEMA[v]}
      />

      <GroupLabel>Mi cuenta</GroupLabel>
      <MenuLink
        icon="person-outline"
        title="Mi perfil"
        subtitle="Nombre, notificaciones y datos de la cuenta"
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
      <MenuLink
        icon="copy-outline"
        title="Plantillas de movimiento"
        subtitle="Moldes para registrar tus movimientos habituales en dos toques"
        onPress={() => nav.go('Plantillas')}
      />

      <GroupLabel>Configuración del hogar</GroupLabel>
      <MenuLink
        icon="list-outline"
        title="Categorías de movimiento"
        subtitle="Rubros para clasificar ingresos y gastos (los ven todos)"
        onPress={() => nav.go('Categorias')}
      />
      <MenuLink
        icon="pricetag-outline"
        title="Tipos de elemento patrimonial"
        subtitle="Cuenta corriente, APV, propiedad… — vocabulario del hogar"
        onPress={() => nav.go('TiposElemento')}
      />
      <MenuLink
        icon="swap-horizontal-outline"
        title="Tipos de cambio"
        subtitle="Tasas para convertir entre monedas"
        onPress={() => nav.go('TiposCambio')}
      />
      <MenuLink
        icon="people-outline"
        title="Gestionar hogar"
        subtitle="Miembros, roles, moneda de consolidación e invitaciones"
        onPress={() => nav.go('Hogar')}
      />

      <GroupLabel>Sesión</GroupLabel>
      <Button title="Cerrar sesión" variant="danger" onPress={salir} />
    </Screen>
  );
}
