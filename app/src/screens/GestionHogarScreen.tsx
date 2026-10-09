import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { irAAccion } from './AccionFormScreen';
import {
  AccionDestructiva,
  CampoAlSalir,
  Elegir,
  ErrorText,
  etiqueta,
  LinkButton,
  ListCard,
  MenuList,
  Nota,
  Screen,
  Section,
  Segmented,
  Skeleton,
  useC,
  useGuardarAlInstante,
} from '../ui';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({
  value: m,
  label: `${m} — ${NOMBRE_MONEDA[m] ?? m}`,
}));
const ROLES = ['MIEMBRO', 'ADMINISTRADOR'] as const;

/**
 * Gestionar hogar (plantilla Ajustes, R5): nombre y moneda se guardan al
 * tocarlos; el rol de cada miembro se cambia en su fila; remover, invitar y
 * eliminar piden lo suyo en un Formulario. Sin botón Guardar.
 */
export function GestionHogarScreen() {
  const c = useC();
  const { token, usuario } = useSession();
  const nav = useNav();
  const guardar = useGuardarAlInstante();
  const hogarId = nav.route.params?.hogarId as string;

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      setHogar(await api.get<HogarDTO>(`/hogares/${hogarId}`, token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [hogarId, token]);

  useCargaAlEnfocar(cargar);
  useTitulo(hogar?.nombre);

  if (!hogar) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const soyAdmin = hogar.miembros?.some((m) => m.usuarioId === usuario.id && m.rol === 'ADMINISTRADOR');

  /** Muestra el cambio al instante y, si falla, vuelve a lo que había. */
  const cambiar = (optimista: HogarDTO, fn: () => Promise<unknown>) => {
    const antes = hogar;
    setHogar(optimista);
    void guardar(fn, () => setHogar(antes)).then((ok) => {
      if (ok) void cargar();
    });
  };

  const salir = async () => {
    if (!(await confirmar('Salir del hogar', 'Dejarás de ver la consolidación y las metas del hogar. Tus cuentas siguen siendo tuyas.', 'Salir')))
      return;
    try {
      await api.post('/comandos/SalirDeHogar', { hogarId }, token);
      nav.reset('Tabs');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  };

  return (
    <Screen onRefresh={cargar}>
      {soyAdmin && (
        <Section title="El hogar">
          <CampoAlSalir
            label="Nombre"
            value={hogar.nombre}
            autoCapitalize="sentences"
            onGuardar={async (nombre) => {
              await api.post('/comandos/ActualizarDatosHogar', { hogarId, nombre }, token);
              setHogar({ ...hogar, nombre });
            }}
          />
          <Elegir
            label="¿En qué moneda ven el total del hogar?"
            value={hogar.monedaConsolidacion}
            options={OPC_MONEDA}
            onChange={(m) =>
              m &&
              m !== hogar.monedaConsolidacion &&
              cambiar({ ...hogar, monedaConsolidacion: m }, () =>
                api.post('/comandos/CambiarMonedaConsolidacion', { hogarId, moneda: m }, token),
              )
            }
          />
          <Nota>Cambiarla no recalcula lo ya mostrado con la moneda anterior.</Nota>
        </Section>
      )}

      <Section title="Miembros">
        <ListCard>
          {hogar.miembros?.map((m) => {
            const yo = m.usuarioId === usuario.id;
            const editable = soyAdmin && !yo;
            return (
              <View key={m.usuarioId} style={[styles.miembro, { borderBottomColor: c.border }]}>
                <View style={styles.fila}>
                  <Text style={[styles.nombre, { color: c.text }]} numberOfLines={1}>
                    {yo ? `${m.nombre} (tú)` : m.nombre}
                  </Text>
                  {!editable && <Text style={{ color: c.muted }}>{etiqueta(m.rol)}</Text>}
                </View>
                {editable && (
                  <View style={styles.fila}>
                    <Segmented
                      options={ROLES}
                      value={m.rol as (typeof ROLES)[number]}
                      formatearOpcion={(v) => (v === 'ADMINISTRADOR' ? 'Admin' : 'Miembro')}
                      onChange={(rol) =>
                        cambiar(
                          { ...hogar, miembros: hogar.miembros?.map((x) => (x.usuarioId === m.usuarioId ? { ...x, rol } : x)) },
                          () => api.post('/comandos/AsignarRol', { hogarId, usuarioId: m.usuarioId, rol }, token),
                        )
                      }
                    />
                    <LinkButton
                      title="Remover"
                      onPress={() =>
                        irAAccion(nav, {
                          titulo: `Remover a ${m.nombre}`,
                          explicacion: 'Deja de ver el hogar. Sus cuentas siguen siendo suyas.',
                          pregunta: '¿Por qué?',
                          boton: `Remover a ${m.nombre}`,
                          comando: 'RemoverMiembro',
                          body: { hogarId, usuarioId: m.usuarioId },
                          aviso: 'Miembro removido',
                          peligro: true,
                        })
                      }
                    />
                  </View>
                )}
              </View>
            );
          })}
        </ListCard>
        {soyAdmin && (
          <MenuList
            items={[
              {
                title: 'Invitar a alguien',
                subtitle: 'Le llega un correo para unirse',
                icon: 'person-add-outline',
                onPress: () =>
                  irAAccion(nav, {
                    titulo: 'Invitar a alguien',
                    explicacion: 'Le llega una invitación para unirse al hogar.',
                    pregunta: '¿Cuál es su correo?',
                    placeholder: 'persona@email.cl',
                    teclado: 'email',
                    boton: 'Enviar invitación',
                    comando: 'InvitarMiembro',
                    body: { hogarId },
                    campo: 'emailInvitado',
                    minimo: 5,
                    aviso: 'Invitación enviada',
                  }),
              },
            ]}
          />
        )}
      </Section>

      {soyAdmin && <Nota>Los cambios se guardan solos.</Nota>}
      <ErrorText>{error}</ErrorText>
      <AccionDestructiva title="Salir del hogar" onPress={salir} />
      {soyAdmin && (
        <AccionDestructiva
          title="Eliminar hogar"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Eliminar hogar',
              explicacion: 'Se elimina el hogar y todas sus membresías. Las cuentas de cada miembro siguen siendo suyas.',
              pregunta: '¿Por qué lo eliminas?',
              boton: 'Eliminar hogar',
              comando: 'EliminarHogar',
              body: { hogarId },
              aviso: 'Hogar eliminado',
              peligro: true,
              aInicio: true,
            })
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  miembro: { gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  nombre: { flex: 1, fontSize: 15, fontWeight: '600' },
});
