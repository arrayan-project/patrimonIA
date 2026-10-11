import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { api, ApiError, type ElementoPatrimonialDTO, type HogarDTO, type MiembroDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { emojiElemento } from '../emojis';
import { usePreferencias } from '../preferencias';
import { aplicarRespuestas } from '../compartirHogar';
import { guardadoDe, respuestaCorta, respuestasDe, type Respuestas } from '../compartirPreguntas';
import { cuentasDelDia } from '../fotoMes';
import { ErrorText, ListCard, Nota, Screen, Section, Skeleton, TxRow, useGuardarAlInstante } from '../ui';
import { PreguntasCompartir } from './CompartirConHogar';

/**
 * G39 (H4): todas tus cuentas en una lista, ordenadas en lo que suma al hogar
 * y lo que no, con su respuesta corta ("🏠 Del hogar · 🔒 movimientos
 * privados"). Bloque S: tocar una abre debajo las mismas preguntas y la
 * tarjeta "Así lo ve" de Ajustes de la cuenta; se guarda al instante.
 */
export function QueCompartesScreen() {
  const { token, usuario } = useSession();
  const guardar = useGuardarAlInstante();
  const { preferencias } = usePreferencias();
  const [cuentas, setCuentas] = useState<ElementoPatrimonialDTO[] | null>(null);
  const [miembros, setMiembros] = useState<MiembroDTO[]>([]);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [propias, h] = await Promise.all([
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
        api
          .get<HogarDTO[]>('/usuarios/me/hogares', token)
          .then((hs) => (hs[0] ? api.get<HogarDTO>(`/hogares/${hs[0].id}`, token) : null)),
      ]);
      setCuentas(propias.filter((e) => e.estado === 'ACTIVO' && e.naturaleza !== 'CUSTODIA_INFORMAL'));
      setMiembros((h?.miembros ?? []).filter((m) => m.usuarioId !== usuario.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, usuario.id]);
  useCargaAlEnfocar(cargar);

  const pareja = miembros.length === 1 ? miembros[0].nombre : undefined;
  useTitulo(`Qué compartes con ${pareja ?? 'el hogar'}`);
  if (!cuentas) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  // Optimista: la fila cambia de grupo al tiro; si falla, se recarga lo guardado.
  const responder = (el: ElementoPatrimonialDTO, r: Respuestas) => {
    const g = guardadoDe(r);
    setCuentas((cs) =>
      (cs ?? []).map((x) => (x.id === el.id ? { ...x, participaConsolidacion: g.consolida, visibilidadPorTipo: g.niveles } : x)),
    );
    void guardar(
      () => aplicarRespuestas(token, el.id, r, el.participaConsolidacion),
      () => undefined,
    ).then(() => cargar());
  };

  const fila = (el: ElementoPatrimonialDTO) => (
    <View key={el.id}>
      <TxRow
        title={el.nombre}
        subtitle={respuestaCorta(respuestasDe(el))}
        lineasSubtitulo={2}
        amount={money(el.valorVigente, el.moneda)}
        negativo={el.valorVigente < 0}
        logo={{ emoji: emojiElemento(el, preferencias.emojis.elementos) }}
        // Bloque S: con un solo miembro en el hogar, no se abren las preguntas.
        onPress={miembros.length > 0 ? () => setAbierta((a) => (a === el.id ? null : el.id)) : undefined}
      />
      {abierta === el.id && miembros.length > 0 && (
        <View style={{ gap: 12, paddingVertical: 12 }}>
          <PreguntasCompartir
            categoriaFuncional={el.categoriaFuncional}
            respuestas={respuestasDe(el)}
            onChange={(r) => responder(el, r)}
            pareja={pareja}
            delDiaADia={cuentasDelDia([el], preferencias.mes.cuentas).includes(el.id)}
            cuentaActual={el}
            cuenta={{ nombre: el.nombre, saldo: money(el.valorPendiente ?? el.valorVigente, el.moneda) }}
            yo={usuario.nombre.split(' ')[0]}
          />
        </View>
      )}
    </View>
  );

  const suman = cuentas.filter((e) => e.participaConsolidacion);
  const noSuman = cuentas.filter((e) => !e.participaConsolidacion);
  return (
    <Screen onRefresh={cargar}>
      {miembros.length === 0 && <Nota>👥 Cuando alguien se una a tu hogar, aquí eliges qué compartes con esa persona.</Nota>}
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
