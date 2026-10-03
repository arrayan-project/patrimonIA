import { useAuth } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { Button, GroupLabel, MenuList, Screen, Segmented, useTema, type ModoTema } from '../ui';

const OPC_TEMA: ModoTema[] = ['sistema', 'claro', 'oscuro'];
const ETIQUETA_TEMA: Record<ModoTema, string> = {
  sistema: 'Automático',
  claro: 'Claro',
  oscuro: 'Oscuro',
};

/**
 * Consolidador único de configuración. Todo lo que se ajusta una vez y se
 * olvida: cuenta, cómo se clasifican las cosas, datos de referencia.
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
      <GroupLabel>Cuenta</GroupLabel>
      <MenuList
        items={[
          {
            title: 'Mi perfil',
            subtitle: 'Nombre y datos de la cuenta',
            icon: 'person-outline',
            onPress: () => nav.go('Perfil'),
          },
          {
            title: 'Notificaciones',
            subtitle: 'Qué avisos recibir, en la app y como push',
            icon: 'notifications-outline',
            onPress: () => nav.go('AjustesNotificaciones'),
          },
        ]}
      />

      <GroupLabel>Apariencia</GroupLabel>
      <Segmented
        label="Tema"
        options={OPC_TEMA}
        value={modo}
        onChange={setModo}
        formatearOpcion={(v) => ETIQUETA_TEMA[v]}
      />
      <MenuList
        items={[
          {
            title: 'Visualización',
            subtitle: 'Formato de fecha, moneda principal y secciones del Inicio',
            icon: 'options-outline',
            onPress: () => nav.go('AjustesVisualizacion'),
          },
        ]}
      />

      <GroupLabel>Clasificación</GroupLabel>
      <MenuList
        items={[
          {
            title: 'Categorías de movimiento',
            subtitle: 'Rubros para clasificar ingresos y gastos — los ven todos en el hogar',
            icon: 'list-outline',
            onPress: () => nav.go('Categorias'),
          },
          {
            title: 'Tipos de elemento patrimonial',
            subtitle: 'Cuenta corriente, APV, propiedad… — vocabulario del hogar',
            icon: 'pricetag-outline',
            onPress: () => nav.go('TiposElemento'),
          },
          {
            title: 'Etiquetas',
            subtitle: 'Marcas personales transversales para tus movimientos',
            icon: 'pricetags-outline',
            onPress: () => nav.go('Etiquetas'),
          },
        ]}
      />

      <GroupLabel>Datos de referencia</GroupLabel>
      <MenuList
        items={[
          {
            title: 'Tipos de cambio',
            subtitle: 'Tasas para convertir entre monedas',
            icon: 'swap-horizontal-outline',
            onPress: () => nav.go('TiposCambio'),
          },
        ]}
      />

      <GroupLabel>Organización</GroupLabel>
      <MenuList
        items={[
          {
            title: 'Agrupaciones de elementos',
            subtitle: 'Carpetas para ordenar tus cuentas y activos',
            icon: 'folder-outline',
            onPress: () => nav.go('Agrupaciones'),
          },
        ]}
      />

      <GroupLabel>Sesión</GroupLabel>
      <Button title="Cerrar sesión" variant="danger" onPress={salir} />
    </Screen>
  );
}
