import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type ElementoPatrimonialDTO, type HogarDTO, type MiembroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { aplicarNivel, nivelDe, opcionesNivel, type NivelHogar } from '../compartirHogar';
import { useNav, useTitulo } from '../navigation/navigator';
import { Elegir, ElegirVarios, ErrorText, Nota, Opcional, Screen, Section, Segmented, Skeleton, useGuardarAlInstante } from '../ui';

const VIS = ['PRIVADA', 'FAMILIAR', 'COMPARTIDA'] as const;
type Nivel = (typeof VIS)[number];
const TIPOS_INFO = [
  ['EXISTENCIA', '¿Quién ve que existe?'],
  ['VALOR', '¿Quién ve el monto?'],
  ['MOVIMIENTOS', '¿Quién ve los movimientos?'],
] as const;
const NOMBRE_VIS: Record<Nivel, string> = { PRIVADA: 'Solo tú', FAMILIAR: 'El hogar', COMPARTIDA: 'Algunos' };

/**
 * Ajustes de una cuenta o bien (plantillas de pantalla, R4b, plantilla
 * Ajustes): qué se comparte con el hogar y si se valoriza. Todo se guarda al
 * tocarlo; si falla, se revierte y avisa. Sin botón Guardar.
 */
export function AjustesElementoScreen() {
  const { token, usuario } = useSession();
  const nav = useNav();
  const guardar = useGuardarAlInstante();
  const elementoId = nav.route.params?.elementoId as string;

  const [el, setEl] = useState<ElementoPatrimonialDTO | null>(null);
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      setEl(await api.get<ElementoPatrimonialDTO>(`/elementos-patrimoniales/${elementoId}`, token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [elementoId, token]);

  useEffect(() => {
    void cargar();
    api
      .get<HogarDTO[]>('/usuarios/me/hogares', token)
      .then(async (hs) => (hs[0] ? (await api.get<HogarDTO>(`/hogares/${hs[0].id}`, token)).miembros : []))
      .then((ms) => setMiembros((ms ?? []).filter((m) => m.usuarioId !== usuario.id)))
      .catch(() => setMiembros([]));
  }, [cargar, token, usuario.id]);

  useTitulo(el ? `Ajustes de ${el.nombre}` : undefined);

  /** Aplica en pantalla al instante; si el comando falla, vuelve a lo que había y avisa. */
  const aplicar = async (optimista: ElementoPatrimonialDTO, fn: () => Promise<unknown>) => {
    const antes = el;
    setEl(optimista);
    if (await guardar(fn, () => setEl(antes))) await cargar();
  };

  if (!el) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const pareja = miembros.length === 1 ? miembros[0].nombre : undefined;
  const nivel = nivelDe(el);
  const vpt = (el.visibilidadPorTipo ?? {
    EXISTENCIA: el.visibilidad,
    VALOR: el.visibilidad,
    MOVIMIENTOS: el.visibilidad,
  }) as Record<'EXISTENCIA' | 'VALOR' | 'MOVIMIENTOS', Nivel>;
  const esDeudaOCredito = el.categoriaFuncional === 'DEUDA' || el.categoriaFuncional === 'CREDITO';

  const definirVisibilidad = (niveles: typeof vpt, compartidoCon: string[]) =>
    aplicar({ ...el, visibilidadPorTipo: niveles, compartidoCon }, () =>
      api.post('/comandos/DefinirVisibilidadElementoPatrimonial', { elementoId, niveles, compartidoCon }, token),
    );

  return (
    <Screen>
      <Section title="Con el hogar">
        <Elegir
          label={`¿Qué compartes con ${pareja ?? 'el hogar'}?`}
          value={nivel}
          options={[
            ...opcionesNivel(pareja),
            ...(nivel === 'personalizado'
              ? [{ value: 'personalizado', label: 'Personalizado', sub: 'Una combinación hecha en Avanzado.', deshabilitada: true }]
              : []),
          ]}
          onChange={(v) => {
            if (!v || v === nivel || v === 'personalizado') return;
            void aplicar(el, () => aplicarNivel(token, elementoId, v as NivelHogar, el.participaConsolidacion));
          }}
        />
      </Section>

      {!esDeudaOCredito && (
        <Section title="Valor">
          <Segmented
            label="¿Su valor cambia con el tiempo?"
            options={['No', 'Sí'] as const}
            value={el.admiteValorizacion ? 'Sí' : 'No'}
            formatearOpcion={(v) => v}
            onChange={(v) =>
              aplicar({ ...el, admiteValorizacion: v === 'Sí' }, () =>
                api.post('/comandos/CambiarAdmiteValorizacion', { elementoId, admite: v === 'Sí' }, token),
              )
            }
          />
          <Nota>Para bienes o inversiones con precio de mercado (propiedades, fondos). Habilita registrar su valor.</Nota>
        </Section>
      )}

      <Opcional titulo="Ver opciones avanzadas" abierto={nivel === 'personalizado'}>
        <Section title="Avanzado">
          {TIPOS_INFO.map(([k, pregunta]) => (
            <Segmented
              key={k}
              label={pregunta}
              options={VIS}
              value={vpt[k]}
              formatearOpcion={(v) => NOMBRE_VIS[v]}
              onChange={(v) => definirVisibilidad({ ...vpt, [k]: v }, el.compartidoCon ?? [])}
            />
          ))}
          {miembros.length > 0 && Object.values(vpt).includes('COMPARTIDA') && (
            <ElegirVarios
              label="¿Con quiénes?"
              values={el.compartidoCon ?? []}
              onChange={(ids) => definirVisibilidad(vpt, ids)}
              options={miembros.map((m) => ({ value: m.usuarioId, label: m.nombre }))}
            />
          )}
          <Segmented
            label="¿Suma al patrimonio del hogar?"
            options={['No', 'Sí'] as const}
            value={el.participaConsolidacion ? 'Sí' : 'No'}
            formatearOpcion={(v) => v}
            onChange={(v) =>
              aplicar({ ...el, participaConsolidacion: v === 'Sí' }, () =>
                api.post('/comandos/CambiarParticipacionEnConsolidacion', { elementoId, participa: v === 'Sí' }, token),
              )
            }
          />
        </Section>
      </Opcional>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
