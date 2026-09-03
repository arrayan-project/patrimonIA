import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type InvitacionDTO,
  type PatrimonioIndividualDTO,
} from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { guardar, leer } from '../auth/secureStorage';
import { money } from '../format';
import { Button, colors, ErrorText, Field, LinkButton, Row, Screen, SelectRow, Title } from '../ui';

export function DashboardScreen() {
  const { token, usuario } = useSession();
  const { cerrarSesion } = useAuth();
  const nav = useNav();
  const claveHogar = `patrimonia.hogar.${usuario.id}`;

  const [hogares, setHogares] = useState<HogarDTO[]>([]);
  const [hogarId, setHogarId] = useState<string | null>(null);
  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [patrimonio, setPatrimonio] = useState<PatrimonioIndividualDTO | null>(null);
  const [elementos, setElementos] = useState<ElementoPatrimonialDTO[]>([]);
  const [error, setError] = useState('');
  const [noLeidas, setNoLeidas] = useState(0);
  const [email, setEmail] = useState('');
  const [invitando, setInvitando] = useState(false);
  const [aviso, setAviso] = useState('');

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

      const [h, p, els] = await Promise.all([
        api.get<HogarDTO>(`/hogares/${activo}`, token),
        api.get<PatrimonioIndividualDTO>('/usuarios/me/patrimonio-individual', token),
        api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
      ]);
      setHogar(h);
      setPatrimonio(p);
      setElementos(els);
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
  }, [token, nav, claveHogar]);

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

  const esAdmin = hogar?.miembros?.some(
    (m) => m.usuarioId === usuario.id && m.rol === 'ADMINISTRADOR',
  );

  const invitar = async () => {
    if (!hogar) return;
    setInvitando(true);
    setError('');
    setAviso('');
    try {
      await api.post<InvitacionDTO>(
        '/comandos/InvitarMiembro',
        { hogarId: hogar.id, emailInvitado: email.trim() },
        token,
      );
      setAviso(`Invitación enviada a ${email.trim()}`);
      setEmail('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setInvitando(false);
    }
  };

  if (!hogar || !patrimonio) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <ActivityIndicator color={colors.primary} />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      <Title>{hogar.nombre}</Title>

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
          <Text style={styles.muted}>Aún no tienes elementos patrimoniales.</Text>
        ) : (
          patrimonio.porMoneda.map((m) => (
            <Row key={m.moneda} left={`Patrimonio (${m.moneda})`} right={money(m.patrimonio, m.moneda)} />
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Elementos</Text>
        {elementos.map((el) => (
          <Pressable
            key={el.id}
            style={styles.elemento}
            onPress={() => nav.go('ElementoDetalle', { elementoId: el.id })}
          >
            <View>
              <Text style={styles.elementoNombre}>{el.nombre}</Text>
              <Text style={styles.muted}>{el.categoriaFuncional}</Text>
            </View>
            <Text style={styles.elementoValor}>{money(el.valorVigente, el.moneda)}</Text>
          </Pressable>
        ))}
        <View style={styles.actions}>
          <Button title="Agregar elemento" variant="secondary" onPress={() => nav.go('AgregarElemento')} />
          {elementos.length > 0 && (
            <Button title="Registrar movimiento" onPress={() => nav.go('RegistrarMovimiento')} />
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Miembros del hogar</Text>
        {hogar.miembros?.map((m) => (
          <Row key={m.usuarioId} left={m.nombre} right={m.rol} />
        ))}
        {esAdmin && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Field
              label="Invitar por email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="persona@email.cl"
            />
            {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
            <Button
              title="Enviar invitación"
              onPress={invitar}
              loading={invitando}
              disabled={!email.trim()}
            />
          </View>
        )}
      </View>

      <ErrorText>{error}</ErrorText>
      <LinkButton
        title={noLeidas > 0 ? `Notificaciones (${noLeidas})` : 'Notificaciones'}
        onPress={() => nav.go('Notificaciones')}
      />
      <LinkButton
        title="Patrimonio del hogar"
        onPress={() => nav.go('HogarConsolidado', { hogarId: hogar.id })}
      />
      <LinkButton title="Evolución de mi patrimonio" onPress={() => nav.go('EvolucionPatrimonio')} />
      <LinkButton title="Objetivos financieros" onPress={() => nav.go('Objetivos')} />
      <LinkButton title="Presupuestos" onPress={() => nav.go('Presupuestos')} />
      <LinkButton
        title="Movimientos programados"
        onPress={() => nav.go('MovimientosProgramados')}
      />
      <LinkButton
        title="Gestionar hogar"
        onPress={() => nav.go('GestionHogar', { hogarId: hogar.id })}
      />
      <LinkButton title="Ajustes" onPress={() => nav.go('Ajustes')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  elemento: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.faint,
    paddingVertical: 10,
  },
  elementoNombre: { fontSize: 15, color: colors.text, fontWeight: '600' },
  elementoValor: { fontSize: 15, color: colors.text },
  actions: { gap: 8, marginTop: 8 },
  aviso: { color: colors.primary, fontSize: 14 },
});
