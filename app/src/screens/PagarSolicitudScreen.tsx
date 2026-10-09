import { useCallback, useState } from 'react';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { money } from '../format';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useNav, useTitulo } from '../navigation/navigator';
import { opcionesDeElementos } from '../opciones';
import { ESTADO_TEXTO, explicacionPago, tituloSolicitud, type SolicitudDTO } from '../solicitudes';
import { useToast } from '../ui/Toast';
import {
  aISO,
  Button,
  contadorPasos,
  Cuando,
  Elegir,
  ErrorText,
  ListCard,
  Nota,
  Paragraph,
  Screen,
  Section,
  Skeleton,
  TxRow,
} from '../ui';

/**
 * G33 bloque 9 — "Pagarle a [miembro]" (plantilla Formulario). Responde una
 * solicitud recibida: su parte de un gasto compartido (D-7) o una transferencia
 * que no anotó. "Transferir" registra la TRANSFERENCIA desde una cuenta propia a
 * la que eligió quien la pidió; "No me corresponde" la rechaza.
 */
export function PagarSolicitudScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
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

  // La que pediste, o una ya resuelta (p. ej. desde una notificación vieja): solo se informa.
  if (s.direccion === 'ENVIADA' || s.estado !== 'PENDIENTE') {
    return (
      <Screen pie={<Button title="Listo" onPress={() => nav.back()} />}>
        <Paragraph>{s.direccion === 'ENVIADA' ? tituloSolicitud(s) : explicacionPago(s, money)}</Paragraph>
        <Nota>{`${m} a ${s.cuentaDestino.nombre} · ${ESTADO_TEXTO[s.estado]}`}</Nota>
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

  const paso = contadorPasos();
  const pDesde = paso({ hecho: !!origenId });
  const pFecha = sinAnotar ? paso({ hecho: true }) : undefined;

  return (
    <Screen
      pie={
        <>
          {origen && s.cuentaDisponible ? (
            <Nota>{`Pasas ${m} de ${origen.nombre} a ${s.cuentaDestino.nombre}. No cuenta como gasto.`}</Nota>
          ) : null}
          <Button
            title={sinAnotar ? `Anotar ${m}` : `Transferir ${m}`}
            onPress={pagar}
            loading={busy === 'pagar'}
            disabled={!origenId || !s.cuentaDisponible || busy !== null}
          />
          <Button title="No me corresponde" variant="secondary" onPress={rechazar} loading={busy === 'rechazar'} disabled={busy !== null} />
        </>
      }
    >
      <Paragraph>{explicacionPago(s, money)}</Paragraph>
      <Elegir
        label={sinAnotar ? '¿Desde qué cuenta salió?' : '¿Desde qué cuenta le transfieres?'}
        paso={pDesde}
        placeholder={cuentas.length ? 'Elegir cuenta' : `No tienes cuentas en ${s.moneda}`}
        value={origenId}
        options={opcionesDeElementos(cuentas)}
        onChange={setOrigenId}
      />
      {pFecha && <Cuando value={fechaPago} onChange={setFecha} paso={pFecha} />}
      <Section title="Va a">
        <ListCard>
          <TxRow title={s.cuentaDestino.nombre} subtitle={`Cuenta de ${nombre}`} amount="" logo={{ icon: 'person-outline' }} />
        </ListCard>
        {!s.cuentaDisponible && (
          <ErrorText>{`${nombre} dejó de compartir esta cuenta. Pídele que la comparta con "Que puedan transferirte".`}</ErrorText>
        )}
      </Section>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
