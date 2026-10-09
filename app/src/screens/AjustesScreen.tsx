import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { api, type HogarDTO, type InvitacionDTO, type UsuarioDTO } from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { MONEDAS_FRECUENTES } from '../labels';
import { useNav } from '../navigation/navigator';
import { usePreferencias } from '../preferencias';
import { confirmar } from '../ui/confirmar';
import { Text } from '../ui/Text';
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
  radio,
  useC,
  useGuardarAlInstante,
  useTema,
  type Paleta,
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
  ['OBJETIVO_COMPLETADO', 'Meta completada', 'Cuando una meta llega al 100%', '🎉'],
  ['RESERVA_CONSUMIDA', 'Plata de una meta que se usó', 'Cuando un gasto sale de una meta', '🐷'],
  ['INVITACION_RECIBIDA', 'Invitación a un hogar', 'Cuando alguien te invita', '✉️'],
] as const;

const avisosDe = (u: UsuarioDTO | null): Record<string, boolean> =>
  (u?.preferencias as { notificaciones?: Record<string, boolean> } | null)?.notificaciones ?? {};

/**
 * Ajustes (plantilla Ajustes, R5): grupos con nombre, todo se guarda al
 * tocarlo y se revierte con aviso si falla. Sin botón Guardar.
 */
export function AjustesScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const nav = useNav();
  const { token, usuario } = useSession();
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
      {/* G35: quién eres, arriba. Abre Mi perfil. */}
      <Pressable
        onPress={() => nav.go('Perfil')}
        accessibilityRole="button"
        accessibilityLabel={`${usuario.nombre}. ${usuario.email}. Ver mi perfil`}
        style={({ pressed }) => [styles.perfil, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.inicial}>
          <Text style={styles.inicialTxt}>{usuario.nombre.trim().charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.nombre} numberOfLines={1}>
            {usuario.nombre}
          </Text>
          <Text style={styles.dato} numberOfLines={1}>
            {usuario.email}
          </Text>
          {hogar ? (
            <Text style={styles.dato} numberOfLines={1}>
              🏠 {hogar.nombre}
              {personas ? ` · ${personas} ${personas === 1 ? 'persona' : 'personas'}` : ''}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chev}>›</Text>
      </Pressable>

      <Section title="Hogar">
        <MenuList
          items={[
            ...(hogar
              ? [
                  {
                    title: 'Personas del hogar',
                    subtitle: 'Quiénes están, nombre y moneda',
                    emoji: '👥',
                    onPress: () => nav.go('GestionHogar', { hogarId: hogar.id }),
                  },
                ]
              : []),
            {
              title: 'Invitaciones',
              subtitle: pendientes > 0 ? `${pendientes} pendiente${pendientes === 1 ? '' : 's'}` : 'Ninguna pendiente',
              badge: pendientes || undefined,
              emoji: '✉️',
              onPress: () => nav.go('Invitaciones'),
            },
          ]}
        />
      </Section>

      <Section title="Cómo se ve">
        <Segmented label="🎨 Tema" options={OPC_TEMA} value={modo} onChange={setModo} formatearOpcion={(v) => ETIQUETA_TEMA[v]} />
        <Segmented
          label="📅 Fechas"
          options={OPC_FECHA}
          value={preferencias.formatoFecha}
          onChange={(formatoFecha) => cambiarPreferencias({ ...preferencias, formatoFecha })}
          formatearOpcion={(v) => ETIQUETA_FECHA[v]}
        />
        <Elegir
          label="💱 Moneda principal en el Inicio"
          value={preferencias.monedaPreferida ?? SIN_PREFERENCIA}
          options={OPC_MONEDA}
          onChange={(v) => cambiarPreferencias({ ...preferencias, monedaPreferida: v || null })}
        />
        <MenuList
          items={[
            {
              title: 'Secciones del Inicio',
              subtitle: 'Qué se muestra en el Inicio',
              emoji: '🧩',
              onPress: () => nav.go('AjustesVisualizacion'),
            },
          ]}
        />
      </Section>

      <Section title="Avisos">
        <ListCard>
          {AVISOS.map(([k, titulo, sub, emoji]) => (
            <Interruptor key={k} titulo={titulo} sub={sub} emoji={emoji} value={avisos[k] !== false} onChange={(v) => cambiarAviso(k, v)} />
          ))}
        </ListCard>
      </Section>

      {/* G35: por uso, y cada uno dice para qué sirve. */}
      <Section title="Para ordenar tu plata">
        <MenuList
          items={[
            { title: 'Frecuentes', subtitle: 'Lo que anotas seguido, a un toque', emoji: '⚡', onPress: () => nav.go('Plantillas') },
            { title: 'Categorías', subtitle: 'Mercado, luz, sueldo… con su emoji', emoji: '🏷️', onPress: () => nav.go('Categorias') },
            { title: 'Tipos de cuenta', subtitle: 'Corriente, tarjeta, fondo mutuo…', emoji: '💼', onPress: () => nav.go('TiposElemento') },
            { title: 'Etiquetas', subtitle: "Marcas libres, como 'vacaciones 2026'", emoji: '🔖', onPress: () => nav.go('Etiquetas') },
            { title: 'Mis grupos', subtitle: "Junta cuentas, como 'Jubilación'", emoji: '🗂️', onPress: () => nav.go('Agrupaciones') },
            { title: 'Tipos de cambio', subtitle: 'Cuánto vale el dólar o la UF', emoji: '💵', onPress: () => nav.go('TiposCambio') },
          ]}
        />
      </Section>

      <Nota>Los cambios se guardan solos.</Nota>
      <AccionDestructiva title="Cerrar sesión" onPress={salir} />
    </Screen>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    perfil: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: radio.tarjeta,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
    },
    inicial: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inicialTxt: { fontSize: 24, fontWeight: '800', color: c.primaryText },
    nombre: { fontSize: 18, fontWeight: '800', color: c.text },
    dato: { fontSize: 13, color: c.muted, marginTop: 2 },
    chev: { fontSize: 22, color: c.mutedDim },
  });
