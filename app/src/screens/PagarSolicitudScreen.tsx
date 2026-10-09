import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useNav, useTitulo } from '../navigation/navigator';
import { opcionesDeElementos } from '../opciones';
import { usePreferencias } from '../preferencias';
import { emojiElemento } from '../emojis';
import { comoVa, diaCorto, type SolicitudDTO } from '../solicitudes';
import { useToast } from '../ui/Toast';
import { Text } from '../ui/Text';
import {
  aISO,
  BandaDetalle,
  Button,
  colorAnotar,
  Cuando,
  Dato,
  Datos,
  Elegir,
  ErrorText,
  MenuList,
  Nota,
  Screen,
  Skeleton,
  useC,
  type Paleta,
} from '../ui';

/**
 * G33 bloque 9 — "Pagarle a [miembro]" (plantilla Formulario). Responde una
 * solicitud recibida: su parte de un gasto compartido (D-7) o una transferencia
 * que no anotó. "Transferir" registra la TRANSFERENCIA desde una cuenta propia a
 * la que eligió quien la pidió; "No me corresponde" la rechaza.
 */
export function PagarSolicitudScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const { preferencias } = usePreferencias();
  const { key } = useIdempotencyKey();
  const solicitudId = nav.route.params?.solicitudId as string;

  const [s, setS] = useState<SolicitudDTO | null | undefined>(undefined);
  const [cuentas, setCuentas] = useState<ElementoPatrimonialDTO[]>([]);
  const [origenId, setOrigenId] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pagar' | 'rechazar' | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [lista, mios] = await Promise.all([
        api.get<SolicitudDTO[]>('/usuarios/me/solicitudes', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      ]);
      const sol = lista.find((x) => x.id === solicitudId) ?? null;
      setS(sol);
      const validas = sol
        ? mios.filter(
            (e) =>
              (e.categoriaFuncional === 'LIQUIDEZ' || e.categoriaFuncional === 'RESERVA') &&
              e.naturaleza !== 'CUSTODIA_INFORMAL' &&
              e.moneda === sol.moneda,
          )
        : [];
      setCuentas(validas);
      setOrigenId((o) => o ?? (validas.length === 1 ? validas[0].id : null));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, solicitudId]);
  useCargaAlEnfocar(cargar);

  const nombre = s?.solicitante.nombre ?? '';
  const sinAnotar = s?.motivo === 'SIN_ANOTAR';
  useTitulo(
    !s || s.direccion === 'ENVIADA' ? 'Solicitud' : sinAnotar ? `Anotar transferencia a ${nombre}` : `Pagarle a ${nombre}`,
  );

  if (s === undefined) {
    return (
      <Screen>
        <Skeleton filas={2} />
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }
  if (s === null) {
    return (
      <Screen>
        <Nota>No encontramos esta solicitud.</Nota>
      </Screen>
    );
  }

  const m = money(s.monto, s.moneda);
  const origen = cuentas.find((e) => e.id === origenId);
  // Una transferencia sin anotar lleva el día en que llegó la plata; un pago, el de hoy.
  const fechaPago = fecha ?? (sinAnotar ? s.fecha : aISO(new Date()));
  const otro = s.direccion === 'ENVIADA' ? s.destinatario.nombre : nombre;

  // Qué es y cuánto, en una banda: tu parte de un gasto o plata que llegó sin anotar.
  const banda = (sub: string) => (
    <BandaDetalle
      color={colorAnotar(c, 'TRANSFERENCIA')}
      titulo={
        s.motivo === 'GASTO_COMPARTIDO'
          ? `🧾 ${s.direccion === 'ENVIADA' ? `Parte de ${otro}` : 'Tu parte'}${s.glosa ? ` de ${s.glosa}` : ''}`
          : `🔁 ${s.direccion === 'ENVIADA' ? `Te llegaron de ${otro}` : `Le llegaron a ${nombre}`}`
      }
      monto={m}
      sub={sub}
    />
  );

  // La que pediste, o una ya resuelta (p. ej. desde una notificación vieja): solo se informa.
  if (s.direccion === 'ENVIADA' || s.estado !== 'PENDIENTE') {
    return (
      <Screen>
        {banda(`${comoVa(s)} · ${diaCorto(s.fecha)}`)}
        <Datos>
          <Dato etiqueta="🏦 Llega a" valor={s.cuentaDestino.nombre} />
        </Datos>
        {s.eventoPagoId ? (
          <MenuList
            items={[
              {
                title: 'Ver la transferencia',
                emoji: '🧾',
                onPress: () => nav.go('MovimientoDetalle', { eventoId: s.eventoPagoId }),
              },
            ]}
          />
        ) : null}
      </Screen>
    );
  }

  const pagar = async () => {
    if (!origenId) return;
    setBusy('pagar');
    setError('');
    try {
      await api.comando('/comandos/PagarSolicitud', { solicitudId: s.id, elementoOrigenId: origenId, fecha: fechaPago }, token, key);
      toast.mostrar(`${nombre} ya ve que le transferiste ${m}`);
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(null);
    }
  };

  const rechazar = async () => {
    setBusy('rechazar');
    setError('');
    try {
      await api.comando('/comandos/RechazarSolicitud', { solicitudId: s.id }, token, `${key}-rechazar`);
      toast.mostrar(`Le avisamos a ${nombre}`);
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      pie={
        <>
          <Button
            title={sinAnotar ? `✅ Anotar ${m}` : `✅ Transferir ${m}`}
            onPress={pagar}
            loading={busy === 'pagar'}
            disabled={!origenId || !s.cuentaDisponible || busy !== null}
          />
          <Pressable
            onPress={rechazar}
            disabled={busy !== null}
            accessibilityRole="button"
            style={({ pressed }) => [styles.noMe, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.noMeTxt}>{busy === 'rechazar' ? 'Avisando…' : '🙅 No me corresponde'}</Text>
          </Pressable>
        </>
      }
    >
      {banda(
        s.motivo === 'GASTO_COMPARTIDO'
          ? `${nombre} pagó${s.totalGasto != null ? ` ${money(s.totalGasto, s.moneda)}` : ''} · ${diaCorto(s.fecha)}`
          : `Tuyos, sin anotar · ${diaCorto(s.fecha)}`,
      )}
      {/* La cuenta solo se pregunta si hay más de una. */}
      {cuentas.length !== 1 && (
        <Elegir
          label={sinAnotar ? '¿Desde qué cuenta salió?' : '¿Desde qué cuenta le transfieres?'}
          placeholder={cuentas.length ? 'Elegir cuenta' : `No tienes cuentas en ${s.moneda}`}
          value={origenId}
          options={opcionesDeElementos(cuentas, { emojis: preferencias.emojis.elementos })}
          onChange={setOrigenId}
        />
      )}
      {sinAnotar && <Cuando value={fechaPago} onChange={setFecha} />}
      <Datos>
        <Dato
          etiqueta={`${origen ? emojiElemento(origen, preferencias.emojis.elementos) : '🏦'} Sale de`}
          valor={origen?.nombre ?? '—'}
        />
        <Dato etiqueta="👤 Llega a" valor={`${s.cuentaDestino.nombre} de ${nombre}`} />
      </Datos>
      <Nota>🔁 Es una transferencia: no cuenta como gasto.</Nota>
      {!s.cuentaDisponible && (
        <ErrorText>{`${nombre} dejó de compartir esta cuenta. Pídele que la comparta con "Que puedan transferirte".`}</ErrorText>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    noMe: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    noMeTxt: { fontSize: 15, fontWeight: '700', color: c.muted },
  });
