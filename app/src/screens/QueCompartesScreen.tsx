import { useCallback, useState } from 'react';
import { api, ApiError, type ElementoPatrimonialDTO, type HogarDTO, type MiembroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { emojiElemento } from '../emojis';
import { usePreferencias } from '../preferencias';
import { aplicarNivel, nivelDe, opcionesNivel, type NivelHogar } from '../compartirHogar';
import { Elegir, ErrorText, ListCard, Nota, Screen, Section, Skeleton, TxRow, useGuardarAlInstante } from '../ui';

/**
 * G39 (H4): todas tus cuentas en una lista, ordenadas en lo que suma al hogar
 * y lo que no, con lo que ve el hogar de cada una. Tocar una abre la hoja con
 * los 4 niveles de Ajustes de la cuenta y se guarda al instante.
 */
export function QueCompartesScreen() {
  const { token, usuario } = useSession();
  const guardar = useGuardarAlInstante();
  const { preferencias } = usePreferencias();
  const [cuentas, setCuentas] = useState<ElementoPatrimonialDTO[] | null>(null);
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const propias = await api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token);
      setCuentas(propias.filter((e) => e.estado === 'ACTIVO' && e.naturaleza !== 'CUSTODIA_INFORMAL'));
      const hs = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      const h = hs[0] ? await api.get<HogarDTO>(`/hogares/${hs[0].id}`, token) : null;
      setMiembros((h?.miembros ?? []).filter((m) => m.usuarioId !== usuario.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, usuario.id]);
  useCargaAlEnfocar(cargar);

  const pareja = miembros.length === 1 ? miembros[0].nombre : undefined;
  useTitulo(`Qué compartes con ${pareja ?? 'el hogar'}`);
  // Corto, para que quepa en la fila junto al saldo.
  const ve = pareja ? 'Ve' : 'Ven';
  const corto = (el: ElementoPatrimonialDTO) =>
    ({
      nada: '🔒 Solo tú la ves',
      transferir: pareja ? '🔁 Puede transferirte' : '🔁 Pueden transferirte',
      saldo: `👀 ${ve} el saldo`,
      todo: `👀 ${ve} todo`,
      personalizado: '⚙️ A tu medida',
    })[nivelDe(el)];

  if (!cuentas) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const cambiar = (el: ElementoPatrimonialDTO, v: string | null) => {
    if (!v || v === nivelDe(el)) return;
    void guardar(
      () => aplicarNivel(token, el.id, v as NivelHogar, el.participaConsolidacion),
      () => undefined,
    ).then(() => cargar());
  };

  const fila = (el: ElementoPatrimonialDTO) => (
    <Elegir
      key={el.id}
      label={`¿Qué compartes de ${el.nombre}?`}
      value={nivelDe(el) === 'personalizado' ? null : nivelDe(el)}
      options={opcionesNivel(pareja)}
      onChange={(v) => cambiar(el, v)}
      boton={(abrir) => (
        <TxRow
          title={el.nombre}
          subtitle={corto(el)}
          amount={money(el.valorVigente, el.moneda)}
          negativo={el.valorVigente < 0}
          logo={{ emoji: emojiElemento(el, preferencias.emojis.elementos) }}
          onPress={abrir}
        />
      )}
    />
  );

  const suman = cuentas.filter((e) => e.participaConsolidacion);
  const noSuman = cuentas.filter((e) => !e.participaConsolidacion);
  return (
    <Screen onRefresh={cargar}>
      <Section title={`🏠 Suman a la plata del hogar (${suman.length})`}>
        {suman.length === 0 ? (
          <Nota>Ninguna todavía.</Nota>
        ) : (
          <ListCard>{suman.map(fila)}</ListCard>
        )}
      </Section>
      <Section title={`🙋 Solo tuyas (${noSuman.length})`}>
        {noSuman.length === 0 ? <Nota>Todas suman al hogar.</Nota> : <ListCard>{noSuman.map(fila)}</ListCard>}
      </Section>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
