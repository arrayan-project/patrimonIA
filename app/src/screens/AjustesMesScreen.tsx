import { useCallback, useMemo, useState } from 'react';
import { api, type ElementoPatrimonialDTO, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { cicloDe, MESES_LARGO, rotuloCiclo, type NombreMes } from '../cicloMes';
import { emojiElemento } from '../emojis';
import { cuentasDelDia, elegiblesDelDia } from '../fotoMes';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { usePreferencias } from '../preferencias';
import { Elegir, ElegirVarios, Nota, Screen, Section, Segmented, useGuardarAlInstante } from '../ui';

const DIAS = Array.from({ length: 28 }, (_, i) => i + 1);
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * G41–G43 — Tu mes (plantilla Ajustes, R5: cada cambio se guarda al tocarlo):
 * el día en que parte tu mes, cómo se llama, las cuentas del día a día que
 * entran en la foto del mes y, para quien administra el hogar, el día del hogar.
 */
export function AjustesMesScreen() {
  const { token, usuario } = useSession();
  const { preferencias, guardarPreferencias } = usePreferencias();
  const guardar = useGuardarAlInstante();
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [hogar, setHogar] = useState<HogarDTO | null>(null);

  const cargar = useCallback(async () => {
    const [els, hs] = await Promise.all([
      api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token).catch(() => []),
      api.get<HogarDTO[]>('/usuarios/me/hogares', token).catch(() => []),
    ]);
    setElementos(els);
    setHogar(hs[0] ? await api.get<HogarDTO>(`/hogares/${hs[0].id}`, token).catch(() => hs[0]) : null);
  }, [token]);
  useCargaAlEnfocar(cargar);

  const mes = preferencias.mes;
  const cambiarMes = (m: Partial<typeof mes>) =>
    void guardar(() => guardarPreferencias({ ...preferencias, mes: { ...mes, ...m } }), () => undefined);

  // Ejemplo con el mes de hoy: "Noviembre (23 oct – 24 nov)".
  const hoy = useMemo(() => new Date(), []);
  const ejemplo = (nombre: NombreMes) => {
    const c = { dia: mes.dia, nombre };
    const { anio, mes: m } = cicloDe(hoy, c);
    return `${mayus(MESES_LARGO[m])} (${rotuloCiclo(anio, m, c)})`;
  };

  const elegibles = elegiblesDelDia(elementos);
  const elegidas = cuentasDelDia(elementos, mes.cuentas);
  const soyAdmin = hogar?.miembros?.some((m) => m.usuarioId === usuario.id && m.rol === 'ADMINISTRADOR');
  const cambiarDiaHogar = (dia: number) => {
    if (!hogar) return;
    const antes = hogar;
    setHogar({ ...hogar, diaInicioMes: dia });
    void guardar(
      () => api.post('/comandos/CambiarInicioMesHogar', { hogarId: hogar.id, dia }, token),
      () => setHogar(antes),
    );
  };
  const opcionesDia = DIAS.map((d) => ({ value: String(d), label: d === 1 ? 'El 1 (mes normal)' : `El ${d}` }));

  return (
    <Screen onRefresh={cargar}>
      <Section title="📅 Cuándo parte tu mes">
        <Elegir
          label="¿Qué día parte tu mes?"
          value={String(mes.dia)}
          options={opcionesDia}
          onChange={(v) => cambiarMes({ dia: Number(v ?? 1) })}
        />
        {mes.dia > 1 && (
          <>
            <Segmented
              label="¿Cómo se llama tu mes?"
              options={['termina', 'empieza'] as const}
              value={mes.nombre}
              onChange={(nombre) => cambiarMes({ nombre })}
              formatearOpcion={(v) => (v === 'termina' ? 'El que vives' : 'El del sueldo')}
            />
            <Nota>{`Este mes se llama ${ejemplo(mes.nombre)}. Si el ${mes.dia} cae sábado o domingo, parte el viernes antes.`}</Nota>
          </>
        )}
      </Section>

      <Section title="💳 Cuentas del día a día">
        <ElegirVarios
          label="¿Con cuáles pagas tu día a día?"
          values={elegidas}
          options={elegibles.map((e) => ({
            value: e.id,
            label: `${emojiElemento(e, preferencias.emojis.elementos)} ${e.nombre}`,
          }))}
          onChange={(cuentas) => cambiarMes({ cuentas })}
          placeholder="Ninguna"
        />
        <Nota>Solo estas entran en la foto del mes del Inicio y de Movimientos. Lo que muevas a tus otras cuentas se ve aparte.</Nota>
      </Section>

      {hogar && (
        <Section title="🏠 El mes del hogar">
          {soyAdmin ? (
            <Elegir
              label="¿Qué día parte el mes del hogar?"
              value={String(hogar.diaInicioMes ?? 1)}
              options={opcionesDia}
              onChange={(v) => cambiarDiaHogar(Number(v ?? 1))}
            />
          ) : null}
          <Nota>
            {`${soyAdmin ? 'Lo usan' : `Parte el ${hogar.diaInicioMes ?? 1} y lo cambia quien administra el hogar. Lo usan`} los movimientos del hogar, para que todos vean lo mismo.`}
          </Nota>
        </Section>
      )}
    </Screen>
  );
}
