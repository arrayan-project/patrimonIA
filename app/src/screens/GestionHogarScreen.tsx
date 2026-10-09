import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO, type MiembroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { irAAccion } from './AccionFormScreen';
import {
  Button,
  CampoAlSalir,
  Elegir,
  ErrorText,
  HojaAcciones,
  ListCard,
  Pastilla,
  Screen,
  Section,
  Segmented,
  Skeleton,
  TxRow,
  useC,
  useGuardarAlInstante,
} from '../ui';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({
  value: m,
  label: `${m} — ${NOMBRE_MONEDA[m] ?? m}`,
}));
// G35: las monedas de siempre a un toque; "Otra" abre la lista completa (como en Nueva meta).
const MONEDAS_RAPIDAS = ['CLP', 'USD', 'Otra'] as const;

/**
 * Personas del hogar (antes "Gestionar hogar", plantilla Ajustes, R5): nombre
 * y moneda se guardan al tocarlos; tocar a un miembro abre una hoja para
 * cambiar su rol o sacarlo; invitar, salir y eliminar piden lo suyo en un
 * Formulario. Sin botón Guardar.
 */
export function GestionHogarScreen() {
  const c = useC();
  const { token, usuario } = useSession();
  const nav = useNav();
  const guardar = useGuardarAlInstante();
  const hogarId = nav.route.params?.hogarId as string;

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [miembroSel, setMiembroSel] = useState<MiembroDTO | null>(null);
  const [otraMoneda, setOtraMoneda] = useState(false);
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
  useTitulo('Personas del hogar');

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

  const cambiarMoneda = (m: string | null) =>
    m &&
    m !== hogar.monedaConsolidacion &&
    cambiar({ ...hogar, monedaConsolidacion: m }, () =>
      api.post('/comandos/CambiarMonedaConsolidacion', { hogarId, moneda: m }, token),
    );

  const cambiarRol = (m: MiembroDTO, rol: string) =>
    cambiar(
      { ...hogar, miembros: hogar.miembros?.map((x) => (x.usuarioId === m.usuarioId ? { ...x, rol } : x)) },
      () => api.post('/comandos/AsignarRol', { hogarId, usuarioId: m.usuarioId, rol }, token),
    );

  const sacar = (m: MiembroDTO) =>
    irAAccion(nav, {
      titulo: `Sacar a ${m.nombre}`,
      explicacion: 'Deja de ver el hogar. Sus cuentas siguen siendo suyas.',
      pregunta: '¿Por qué?',
      boton: `Sacar a ${m.nombre}`,
      comando: 'RemoverMiembro',
      body: { hogarId, usuarioId: m.usuarioId },
      aviso: `${m.nombre} ya no está en el hogar`,
      peligro: true,
    });

  const invitar = () =>
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
    });

  const salir = async () => {
    if (!(await confirmar('Salir del hogar', 'Dejarás de ver la plata y las metas del hogar. Tus cuentas siguen siendo tuyas.', 'Salir')))
      return;
    try {
      await api.post('/comandos/SalirDeHogar', { hogarId }, token);
      nav.reset('Tabs');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  };

  const moneda = hogar.monedaConsolidacion;
  const rapida = otraMoneda ? 'Otra' : moneda === 'CLP' || moneda === 'USD' ? moneda : 'Otra';

  return (
    <Screen onRefresh={cargar}>
      {soyAdmin && (
        <CampoAlSalir
          label="🏠 ¿Cómo se llama el hogar?"
          value={hogar.nombre}
          autoCapitalize="sentences"
          onGuardar={async (nombre) => {
            await api.post('/comandos/ActualizarDatosHogar', { hogarId, nombre }, token);
            setHogar({ ...hogar, nombre });
          }}
        />
      )}

      <Section title="👥 Quiénes están">
        <ListCard>
          {hogar.miembros?.map((m) => {
            const yo = m.usuarioId === usuario.id;
            return (
              <TxRow
                key={m.usuarioId}
                title={yo ? `${m.nombre} (tú)` : m.nombre}
                subtitle={m.rol === 'ADMINISTRADOR' ? '👑 Administra' : '🙋 Miembro'}
                amount=""
                logo={{ text: m.nombre, color: c.primary }}
                onPress={soyAdmin && !yo ? () => setMiembroSel(m) : undefined}
              />
            );
          })}
        </ListCard>
        {soyAdmin && (
          <View style={styles.pastillas}>
            <Pastilla label="➕ Invitar a alguien" onPress={invitar} />
          </View>
        )}
      </Section>

      {soyAdmin && (
        <Section title="💱 ¿En qué moneda ven el total?">
          <Segmented
            options={MONEDAS_RAPIDAS}
            value={rapida}
            onChange={(v) => {
              setOtraMoneda(v === 'Otra');
              if (v !== 'Otra') cambiarMoneda(v);
            }}
            formatearOpcion={(v) => (v === 'Otra' ? '🌍 Otra' : v === 'USD' ? '💵 USD' : '🇨🇱 CLP')}
          />
          {rapida === 'Otra' && (
            <Elegir label="¿Cuál?" value={moneda} options={OPC_MONEDA} onChange={cambiarMoneda} />
          )}
        </Section>
      )}

      <ErrorText>{error}</ErrorText>
      <Button title="🚪 Salir del hogar" variant="secondary" onPress={salir} />
      {soyAdmin && (
        <Button
          title="🗑️ Eliminar hogar"
          variant="danger"
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

      <HojaAcciones
        visible={miembroSel !== null}
        onClose={() => setMiembroSel(null)}
        titulo={miembroSel?.nombre}
        actions={
          miembroSel
            ? [
                miembroSel.rol === 'ADMINISTRADOR'
                  ? {
                      icon: 'person-outline',
                      emoji: '🙋',
                      label: 'Dejar como miembro',
                      subtitle: 'Ve el hogar, pero no cambia sus datos ni quiénes están',
                      onPress: () => cambiarRol(miembroSel, 'MIEMBRO'),
                    }
                  : {
                      icon: 'star-outline',
                      emoji: '👑',
                      label: 'Hacer administrador',
                      subtitle: 'Puede cambiar el hogar, invitar y sacar personas',
                      onPress: () => cambiarRol(miembroSel, 'ADMINISTRADOR'),
                    },
                {
                  icon: 'exit-outline',
                  emoji: '🚪',
                  label: 'Sacar del hogar',
                  subtitle: 'Sus cuentas siguen siendo suyas',
                  onPress: () => sacar(miembroSel),
                },
              ]
            : []
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pastillas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
