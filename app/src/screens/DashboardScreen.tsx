import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AgrupacionDTO,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type PatrimonioIndividualDTO,
  type VariacionPatrimonialDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { Ionicons } from '@expo/vector-icons';
import { guardar, leer } from '../auth/secureStorage';
import { money } from '../format';
import {
  Button,
  colorCategoria,
  colors,
  EmptyState,
  ErrorText,
  etiqueta,
  FAB,
  MenuLink,
  MoneyText,
  Screen,
  SelectRow,
  Title,
  Skeleton,
} from '../ui';

export function DashboardScreen() {
  const { token, usuario } = useSession();
  const nav = useNav();
  const claveHogar = `patrimonia.hogar.${usuario.id}`;

  const [hogares, setHogares] = useState<HogarDTO[]>([]);
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [patrimonio, setPatrimonio] = useState<PatrimonioIndividualDTO | null>(null);
  const [variacion, setVariacion] = useState<VariacionPatrimonialDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [agrupaciones, setAgrupaciones] = useState<AgrupacionDTO[]>([]);
  const [pasos, setPasos] = useState({ cuenta: false, movimiento: false, objetivo: false });
  const [onbOculto, setOnbOculto] = useState(true);
  const claveOnb = `patrimonia.onboarding.${usuario.id}`;
  const [error, setError] = useState('');
  const [noLeidas, setNoLeidas] = useState(0);

  const elegirHogar = useCallback(
    (id: string) => {
      setHogarId(id);
      void guardar(claveHogar, id);
    },
    [claveHogar],
  );

  const cargar = useCallback(async () => {
    setError('');
    try {
      const lista = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      if (lista.length === 0) {
        nav.reset('Bienvenida');
        return;
      }
      setHogares(lista);
      const guardado = await leer(claveHogar);
      const activo = lista.find((h) => h.id === guardado)?.id ?? lista[0].id;
      setHogarId(activo);

      const [h, p, els, ags] = await Promise.all([
        api.get<HogarDTO>(`/hogares/${activo}`, token),
        api.get<PatrimonioIndividualDTO>('/usuarios/me/patrimonio-individual', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
        api.get<AgrupacionDTO[]>('/usuarios/me/agrupaciones', token).catch(() => []),
      ]);
      setHogar(h);
      setPatrimonio(p);
      setElementos(els);
      setAgrupaciones(ags);

      try {
        const onbHecho = (await leer(claveOnb)) === 'ok';
        const [objs, evs] = await Promise.all([
          api.get<unknown[]>('/objetivos-financieros', token).catch(() => []),
          api.get<unknown[]>(`/hogares/${activo}/eventos-financieros`, token).catch(() => []),
        ]);
        const p3 = {
          cuenta: els.length > 0,
          movimiento: evs.length > 0,
          objetivo: objs.length > 0,
        };
        setPasos(p3);
        setOnbOculto(onbHecho || (p3.cuenta && p3.movimiento && p3.objetivo));
      } catch {
        setOnbOculto(true);
      }

      try {
        const hace30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
        setVariacion(
          await api.get<VariacionPatrimonialDTO>(
            `/usuarios/me/variacion-patrimonial?desde=${hace30}`,
            token,
          ),
        );
      } catch {
        setVariacion(null);
      }
      try {
        const { noLeidas: n } = await api.get<{ noLeidas: number }>(
          '/usuarios/me/notificaciones/no-leidas',
          token,
        );
        setNoLeidas(n);
      } catch {
        setNoLeidas(0);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, nav, claveHogar, claveOnb]);

  useCargaAlEnfocar(cargar);

  // recarga el detalle al cambiar de hogar activo
  useEffect(() => {
    if (!hogarId) return;
    let vivo = true;
    api
      .get<HogarDTO>(`/hogares/${hogarId}`, token)
      .then((h) => vivo && setHogar(h))
      .catch(() => undefined);
  }, [hogarId, token]);

  if (!hogar || !patrimonio) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const cerrarOnboarding = () => {
    setOnbOculto(true);
    void guardar(claveOnb, 'ok');
  };

  const PasoOnb = ({ hecho, texto, onPress }: { hecho: boolean; texto: string; onPress: () => void }) => (
    <Pressable style={styles.paso} onPress={onPress}>
      <Text style={{ fontSize: 16 }}>{hecho ? '✅' : '⬜️'}</Text>
      <Text style={[styles.pasoTexto, hecho && { color: colors.muted, textDecorationLine: 'line-through' }]}>
        {texto}
      </Text>
    </Pressable>
  );

  return (
    <Screen
      onRefresh={cargar}
      fab={
        elementos.length > 0 ? (
          <FAB icon="add" onPress={() => nav.go('RegistrarMovimiento')} />
        ) : undefined
      }
    >
      <Title>{hogar.nombre}</Title>

      {!onbOculto && (
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.sectionTitle}>Primeros pasos</Text>
            <Pressable hitSlop={8} onPress={cerrarOnboarding}>
              <Text style={styles.muted}>Ocultar</Text>
            </Pressable>
          </View>
          <PasoOnb hecho={pasos.cuenta} texto="Agrega tu primera cuenta o bien" onPress={() => nav.go('AgregarElemento')} />
          <PasoOnb hecho={pasos.movimiento} texto="Registra un movimiento" onPress={() => nav.go('RegistrarMovimiento')} />
          <PasoOnb hecho={pasos.objetivo} texto="Crea un objetivo de ahorro" onPress={() => nav.go('Objetivos')} />
        </View>
      )}

      {hogares.length > 1 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hogar activo</Text>
          {hogares.map((h) => (
            <SelectRow
              key={h.id}
              label={h.nombre}
              selected={h.id === hogarId}
              onPress={() => elegirHogar(h.id)}
            />
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Mi patrimonio</Text>
        {patrimonio.porMoneda.length === 0 ? (
          <Text style={styles.muted}>Aún no tienes cuentas ni bienes.</Text>
        ) : (
          patrimonio.porMoneda.map((m) => {
            const v = variacion?.porMoneda.find((x) => x.moneda === m.moneda);
            return (
              <View key={m.moneda} style={styles.resumen}>
                <MoneyText monto={m.patrimonio} moneda={m.moneda} style={styles.resumenNeto} />
                <View style={styles.resumenFila}>
                  <Text style={styles.muted}>Líquido {money(m.valorLiquido, m.moneda)}</Text>
                  {v && v.variacion !== 0 && (
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: v.variacion >= 0 ? colors.primary : colors.danger,
                      }}
                    >
                      {v.variacion >= 0 ? '▲' : '▼'} {money(Math.abs(v.variacion), m.moneda)}
                      {v.variacionPorcentaje != null ? ` (${v.variacionPorcentaje}%)` : ''} · 30 días
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cuentas y bienes</Text>
        {(() => {
          const fila = (el: ElementoPatrimonialDTO) => (
            <Pressable
              key={el.id}
              style={styles.elemento}
              onPress={() => nav.go('ElementoDetalle', { elementoId: el.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.elementoNombre}>{el.nombre}</Text>
                <Text style={styles.muted}>{etiqueta(el.categoriaFuncional)}</Text>
              </View>
              <MoneyText monto={el.valorVigente} moneda={el.moneda} style={styles.elementoValor} />

              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          );
          if (elementos.length === 0) {
            return (
              <EmptyState
                icon="wallet-outline"
                titulo="Aún no tienes cuentas ni bienes"
                descripcion="Agrega tu primera cuenta, inversión o deuda para empezar a llevar tu patrimonio."
                accion="Agregar mi primera cuenta"
                onAccion={() => nav.go('AgregarElemento')}
              />
            );
          }
          const agrupados = new Set(agrupaciones.flatMap((a) => a.elementoIds));
          const sinAgrupar = elementos.filter((el) => !agrupados.has(el.id));
          const hayGrupos = agrupaciones.some((a) => a.elementoIds.length > 0);
          return (
            <>
              {agrupaciones.map((a, i) => {
                const els = elementos.filter((el) => a.elementoIds.includes(el.id));
                if (els.length === 0) return null;
                return (
                  <View key={a.id}>
                    <View style={styles.grupoHead}>
                      <View style={[styles.grupoPunto, { backgroundColor: colorCategoria(a.color, i) }]} />
                      <Text style={styles.grupoTitulo}>{a.nombre}</Text>
                    </View>
                    {els.map(fila)}
                  </View>
                );
              })}
              {sinAgrupar.length > 0 && hayGrupos && (
                <Text style={[styles.grupoTitulo, { marginLeft: 14 }]}>Sin agrupar</Text>
              )}
              {sinAgrupar.map(fila)}
            </>
          );
        })()}
        {elementos.length > 0 && (
          <View style={styles.actions}>
            <Button title="Agregar elemento" variant="secondary" onPress={() => nav.go('AgregarElemento')} />
            <Button title="Registrar movimiento" onPress={() => nav.go('RegistrarMovimiento')} />
          </View>
        )}
      </View>

      {noLeidas > 0 && (
        <MenuLink
          icon="notifications-outline"
          title="Notificaciones"
          subtitle={`${noLeidas} sin leer`}
          badge={noLeidas}
          onPress={() => nav.go('Notificaciones')}
        />
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  resumen: { gap: 4, borderTopWidth: 1, borderTopColor: colors.faint, paddingTop: 8 },
  resumenNeto: { fontSize: 24, fontWeight: '800' },
  resumenFila: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  grupoHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  grupoPunto: { width: 8, height: 8, borderRadius: 4 },
  grupoTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paso: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  pasoTexto: { fontSize: 14, color: colors.text },
  elemento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.faint,
    paddingVertical: 10,
  },
  elementoNombre: { fontSize: 15, color: colors.text, fontWeight: '600' },
  elementoValor: { fontSize: 15 },
  actions: { gap: 8, marginTop: 8 },
});
