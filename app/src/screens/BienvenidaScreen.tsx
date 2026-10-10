import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { api, ApiError, type InvitacionDTO } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { useNav } from '../navigation/navigator';
import { ErrorText, panelDe, Screen, tinte, useC, type Paleta } from '../ui';
import { TarjetaInvitacion } from './InvitacionesScreen';
import { EnlaceAcceso } from '../ui/acceso';
import { Text } from '../ui/Text';

/** G35 tanda 6: sin hogar, dos tarjetas grandes en vez de botones y párrafos. */
export function BienvenidaScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const nav = useNav();
  const { session, cerrarSesion } = useAuth();
  // G39 (H6): con una invitación pendiente, se acepta aquí mismo con un toque.
  const [invitaciones, setInvitaciones] = useState<InvitacionDTO[]>([]);
  const [actuando, setActuando] = useState<string | null>(null);
  const [error, setError] = useState('');
  const token = session?.token ?? '';
  const cargar = useCallback(async () => {
    if (!token) return;
    setInvitaciones(await api.get<InvitacionDTO[]>('/usuarios/me/invitaciones?estado=PENDIENTE', token).catch(() => []));
  }, [token]);
  useCargaAlEnfocar(cargar);
  const responder = async (inv: InvitacionDTO, acepta: boolean) => {
    setActuando(inv.id);
    setError('');
    try {
      await api.post(acepta ? '/comandos/AceptarInvitacion' : '/comandos/RechazarInvitacion', { invitacionId: inv.id }, token);
      if (acepta) {
        nav.reset('Tabs');
        return;
      }
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
    setActuando(null);
  };

  const opcion = (emoji: string, titulo: string, sub: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed }) => [styles.tarjeta, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.circulo}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );

  return (
    <Screen pie={<EnlaceAcceso title="🚪 Cerrar sesión" onPress={cerrarSesion} />}>
      <Text style={styles.hola} accessibilityRole="header">
        👋 Hola, {session?.usuario.nombre}
      </Text>
      <Text style={styles.pregunta}>¿Cómo quieres empezar?</Text>

      {invitaciones.map((inv) => (
        <TarjetaInvitacion
          key={inv.id}
          inv={inv}
          actuando={actuando === inv.id}
          onAceptar={() => void responder(inv, true)}
          onRechazar={() => void responder(inv, false)}
        />
      ))}
      <ErrorText>{error}</ErrorText>
      {opcion('🏠', 'Crear mi hogar', 'Aunque vivas solo: ahí se ordena tu plata', () =>
        nav.go('CrearHogar'),
      )}
      {invitaciones.length === 0 &&
        opcion('✉️', 'Me invitaron', 'Únete al hogar de otra persona', () => nav.go('Invitaciones'))}
    </Screen>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    hola: { fontSize: 28, fontWeight: '800', color: c.text, marginTop: 12 },
    pregunta: { fontSize: 16, color: c.muted, marginBottom: 8 },
    tarjeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      minHeight: 88,
      ...panelDe(c),
    },
    circulo: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tinte(c.primary, 0.14),
    },
    emoji: { fontSize: 26 },
    titulo: { fontSize: 17, fontWeight: '800', color: c.text },
    sub: { fontSize: 13, color: c.muted },
    chev: { fontSize: 26, color: c.mutedDim },
  });
