import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ElementoPatrimonialDTO,
  type ObjetivoFinancieroDTO,
  type ReservaDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useAccionHeader, useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { irAAccion } from './AccionFormScreen';
import {
  AccionDestructiva,
  Ayuda,
  Button,
  Dato,
  Datos,
  ErrorText,
  etiqueta,
  Hero,
  ListCard,
  MenuList,
  Nota,
  ProgressBar,
  Screen,
  Section,
  Skeleton,
  TxRow,
} from '../ui';

export function ObjetivoDetalleScreen() {
  const { token } = useSession();
  const nav = useNav();
  const objetivoId = nav.route.params?.objetivoId as string;

  const [obj, setObj] = useState<ObjetivoFinancieroDTO | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionDTO[]>([]);
  const [cuentas, setCuentas] = useState<ElementoPatrimonialDTO[]>([]);
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const o = await api.get<ObjetivoFinancieroDTO>(`/objetivos-financieros/${objetivoId}`, token);
      setObj(o);
      const asgs = await api.get<AsignacionDTO[]>(`/asignaciones?objetivo=${objetivoId}`, token);
      setAsignaciones(asgs);
      if (o.puedoModificar) {
        const els = await api
          .get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token)
          .catch(() => []);
        setCuentas(els.filter((e) => e.categoriaFuncional !== 'DEUDA' && e.categoriaFuncional !== 'CREDITO'));
        const rs = await Promise.all(
          asgs.map((a) => api.get<ReservaDTO[]>(`/asignaciones/${a.id}/reservas`, token).catch(() => [])),
        );
        setReservas(rs.flat());
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [objetivoId, token]);

  useCargaAlEnfocar(cargar);

  useTitulo(obj?.nombre);
  useAccionHeader(
    'Editar',
    obj && (obj.puedoModificar || obj.esMio) ? () => nav.go('MetaForm', { objetivoId }) : undefined,
  );

  if (!obj) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  // HZ-13: las cuentas propias donde la meta tiene plata; si es una sola, el
  // gasto llega con ella elegida.
  const cuentasConPlata = [
    ...new Set(
      reservas
        .filter((r) => r.estado === 'ACTIVA' && cuentas.some((c) => c.id === r.elementoOrigenId))
        .map((r) => r.elementoOrigenId),
    ),
  ];
  const nombresCuentas = cuentasConPlata.map((id) => cuentas.find((c) => c.id === id)?.nombre).filter(Boolean);
  const puedeAhorrar = obj.puedoModificar && obj.estado === 'EN_PROGRESO';
  const puedeUsar = obj.puedoModificar && cuentasConPlata.length > 0;
  const faltan = Math.max(obj.montoObjetivo - obj.progreso, 0);

  return (
    <Screen
      onRefresh={cargar}
      pie={
        puedeAhorrar || puedeUsar ? (
          <>
            {/* D-1: ahorrar es una pantalla propia (varias cuentas, la cuenta de la meta). */}
            {puedeAhorrar && <Button title="Aportar a esta meta" onPress={() => nav.go('Ahorrar', { objetivoId })} />}
            {puedeUsar && (
              <Button
                title="Usar plata de la meta"
                variant={puedeAhorrar ? 'secondary' : undefined}
                onPress={() =>
                  nav.go('RegistrarMovimiento', {
                    tipo: 'GASTO',
                    objetivoId,
                    ...(cuentasConPlata.length === 1 ? { origenId: cuentasConPlata[0] } : {}),
                  })
                }
              />
            )}
          </>
        ) : undefined
      }
    >
      <Hero
        label="Llevas"
        value={money(obj.progreso, obj.moneda)}
        substats={[
          { label: `${obj.progresoPorcentaje}% de`, value: money(obj.montoObjetivo, obj.moneda) },
          { label: 'Faltan', value: money(faltan, obj.moneda) },
        ]}
      >
        <ProgressBar pct={obj.progresoPorcentaje} />
      </Hero>
      {obj.hogarId && !obj.puedoModificar && (
        <Ayuda>Meta del hogar. Puedes verla, pero no modificarla.</Ayuda>
      )}

      <Datos>
        <Dato etiqueta="Estado" valor={etiqueta(obj.estado)} />
        <Dato etiqueta="Compartida" valor={obj.hogarId ? 'Con el hogar' : 'Solo tú'} />
        {nombresCuentas.length > 0 && <Dato etiqueta="Dónde está la plata" valor={nombresCuentas.join(', ')} />}
      </Datos>

      {(asignaciones.length > 0 || obj.puedoModificar) && (
        <Section
          title="En la meta"
          accion="Agregar parte"
          onAccion={
            obj.puedoModificar
              ? () =>
                  irAAccion(nav, {
                    titulo: 'Agregar parte',
                    explicacion: 'Divide la meta en partes (p. ej. "Pie" y "Gastos notariales") para seguir cada una por separado.',
                    pregunta: '¿Cómo se llama la parte?',
                    boton: 'Agregar parte',
                    comando: 'CrearAsignacion',
                    body: { objetivoId },
                    campo: 'nombre',
                    minimo: 1,
                    aviso: 'Parte agregada',
                  })
              : undefined
          }
        >
          {asignaciones.length === 0 ? (
            <Nota>Aún no ahorras para esta meta.</Nota>
          ) : (
            <ListCard>
              {asignaciones.map((a) => (
                <TxRow
                  key={a.id}
                  title={a.nombre}
                  amount={money(a.totalReservado, a.moneda)}
                  logo={{ icon: 'flag-outline' }}
                  onPress={() => nav.go('AsignacionDetalle', { asignacionId: a.id, contexto: obj.nombre })}
                />
              ))}
            </ListCard>
          )}
        </Section>
      )}

      <MenuList
        items={[
          {
            title: 'Historial de cambios',
            icon: 'time-outline',
            onPress: () =>
              nav.go('Historial', { entidadTipo: 'OBJETIVO_FINANCIERO', entidadId: objetivoId, contexto: obj.nombre }),
          },
        ]}
      />

      <ErrorText>{error}</ErrorText>
      {obj.esMio && (
        <AccionDestructiva
          title="Eliminar meta"
          onPress={() =>
            irAAccion(nav, {
              titulo: 'Eliminar meta',
              explicacion: 'Lo ahorrado no se pierde: queda como ahorro sin meta (Planificar › Ahorro sin meta), y desde ahí lo puedes sacar.',
              pregunta: '¿Por qué la eliminas?',
              boton: 'Eliminar meta',
              comando: 'EliminarObjetivoFinanciero',
              body: { objetivoId },
              aviso: 'Meta eliminada',
              peligro: true,
              volver: 2,
            })
          }
        />
      )}
    </Screen>
  );
}
