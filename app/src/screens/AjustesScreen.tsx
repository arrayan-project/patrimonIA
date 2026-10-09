import { useCallback, useState } from 'react';
import { api, type HogarDTO, type InvitacionDTO, type UsuarioDTO } from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { MONEDAS_FRECUENTES } from '../labels';
import { useNav } from '../navigation/navigator';
import { usePreferencias } from '../preferencias';
import { confirmar } from '../ui/confirmar';
import {
  AccionDestructiva,
  Elegir,
  Interruptor,
  ListCard,
  MenuList,
  Nota,
  Screen,
  Section,
  Segmented,
  useGuardarAlInstante,
  useTema,
  type FormatoFecha,
  type ModoTema,
} from '../ui';

const OPC_TEMA: ModoTema[] = ['sistema', 'claro', 'oscuro'];
const ETIQUETA_TEMA: Record<ModoTema, string> = { sistema: 'Automático', claro: 'Claro', oscuro: 'Oscuro' };
const OPC_FECHA: FormatoFecha[] = ['legible', 'numerico'];
const ETIQUETA_FECHA: Record<FormatoFecha, string> = { legible: '15 mar 2026', numerico: '15-03-2026' };
const SIN_PREFERENCIA = '';
const OPC_MONEDA = [
  { value: SIN_PREFERENCIA, label: 'La primera que tenga' },
  ...MONEDAS_FRECUENTES.map((m) => ({ value: m, label: m })),
];
const AVISOS = [
  ['OBJETIVO_COMPLETADO', 'Meta completada', 'Cuando una meta llega al 100%'],
  ['RESERVA_CONSUMIDA', 'Plata de una meta que se usó', 'Cuando un gasto sale de una meta'],
  ['INVITACION_RECIBIDA', 'Invitación a un hogar', 'Cuando alguien te invita'],
] as const;

const avisosDe = (u: UsuarioDTO | null): Record<string, boolean> =>
  (u?.preferencias as { notificaciones?: Record<string, boolean> } | null)?.notificaciones ?? {};

/**
 * Ajustes (plantilla Ajustes, R5): grupos con nombre, todo se guarda al
 * tocarlo y se revierte con aviso si falla. Sin botón Guardar.
 */
export function AjustesScreen() {
  const nav = useNav();
  const { token } = useSession();
  const { cerrarSesion } = useAuth();
  const { modo, setModo } = useTema();
  const { preferencias, guardarPreferencias } = usePreferencias();
  const guardar = useGuardarAlInstante();

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [pendientes, setPendientes] = useState(0);
  const [avisos, setAvisos] = useState<Record<string, boolean>>({});

  const cargar = useCallback(async () => {
    const [hs, invs, me] = await Promise.all([
      api.get<HogarDTO[]>('/usuarios/me/hogares', token).catch(() => []),
      api.get<InvitacionDTO[]>('/usuarios/me/invitaciones?estado=PENDIENTE', token).catch(() => []),
      api.get<UsuarioDTO>('/usuarios/me', token).catch(() => null),
    ]);
    setHogar(hs[0] ? await api.get<HogarDTO>(`/hogares/${hs[0].id}`, token).catch(() => hs[0]) : null);
    setPendientes(invs.length);
    setAvisos(avisosDe(me));
  }, [token]);

  useCargaAlEnfocar(cargar);

  const cambiarAviso = (k: string, v: boolean) => {
    const antes = avisos;
    const nuevos = { ...avisos, [k]: v };
    setAvisos(nuevos);
    void guardar(
      async () => {
        // ActualizarDatosUsuario reemplaza el objeto completo: se parte del vigente.
        const me = await api.get<UsuarioDTO>('/usuarios/me', token);
        const base = (me.preferencias as Record<string, unknown> | null) ?? {};
        await api.post('/comandos/ActualizarDatosUsuario', { preferencias: { ...base, notificaciones: nuevos } }, token);
      },
      () => setAvisos(antes),
    );
  };

  const cambiarPreferencias = (p: typeof preferencias) => void guardar(() => guardarPreferencias(p), () => undefined);

  const salir = async () => {
    if (await confirmar('Cerrar sesión', 'Tendrás que volver a iniciar sesión.', 'Cerrar sesión')) cerrarSesion();
  };

  const personas = hogar?.miembros?.length;

  return (
    <Screen onRefresh={cargar}>
      <Section title="Tu cuenta">
        <MenuList
          items={[{ title: 'Mi perfil', subtitle: 'Nombre y correo', icon: 'person-outline', onPress: () => nav.go('Perfil') }]}
        />
      </Section>

      <Section title="Hogar">
        <MenuList
          items={[
            ...(hogar
              ? [
                  {
                    title: 'Gestionar hogar',
                    subtitle: personas ? `${hogar.nombre} · ${personas} ${personas === 1 ? 'persona' : 'personas'}` : hogar.nombre,
                    icon: 'home-outline' as const,
                    onPress: () => nav.go('GestionHogar', { hogarId: hogar.id }),
                  },
                ]
              : []),
            {
              title: 'Invitaciones',
              subtitle: pendientes > 0 ? `${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : 'Ninguna pendiente',
              badge: pendientes || undefined,
              icon: 'mail-outline' as const,
              onPress: () => nav.go('Invitaciones'),
            },
          ]}
        />
      </Section>

      <Section title="Cómo se ve">
        <Segmented label="Tema" options={OPC_TEMA} value={modo} onChange={setModo} formatearOpcion={(v) => ETIQUETA_TEMA[v]} />
        <Segmented
          label="Fechas"
          options={OPC_FECHA}
          value={preferencias.formatoFecha}
          onChange={(formatoFecha) => cambiarPreferencias({ ...preferencias, formatoFecha })}
          formatearOpcion={(v) => ETIQUETA_FECHA[v]}
        />
        <Elegir
          label="Moneda principal en Inicio"
          value={preferencias.monedaPreferida ?? SIN_PREFERENCIA}
          options={OPC_MONEDA}
          onChange={(v) => cambiarPreferencias({ ...preferencias, monedaPreferida: v || null })}
        />
        <MenuList
          items={[
            {
              title: 'Secciones del Inicio',
              subtitle: 'Qué se muestra en el Inicio',
              icon: 'grid-outline',
              onPress: () => nav.go('AjustesVisualizacion'),
            },
          ]}
        />
      </Section>

      <Section title="Avisos">
        <ListCard>
          {AVISOS.map(([k, titulo, sub]) => (
            <Interruptor key={k} titulo={titulo} sub={sub} value={avisos[k] !== false} onChange={(v) => cambiarAviso(k, v)} />
          ))}
        </ListCard>
      </Section>

      <Section title="Tus datos">
        <MenuList
          items={[
            { title: 'Categorías', icon: 'list-outline', onPress: () => nav.go('Categorias') },
            { title: 'Tipos de cuenta o bien', icon: 'pricetag-outline', onPress: () => nav.go('TiposElemento') },
            { title: 'Etiquetas', icon: 'pricetags-outline', onPress: () => nav.go('Etiquetas') },
            { title: 'Frecuentes', icon: 'copy-outline', onPress: () => nav.go('Plantillas') },
            { title: 'Tipos de cambio', icon: 'swap-horizontal-outline', onPress: () => nav.go('TiposCambio') },
            { title: 'Agrupaciones', icon: 'folder-outline', onPress: () => nav.go('Agrupaciones') },
          ]}
        />
      </Section>

      <Nota>Los cambios se guardan solos.</Nota>
      <AccionDestructiva title="Cerrar sesión" onPress={salir} />
    </Screen>
  );
}
