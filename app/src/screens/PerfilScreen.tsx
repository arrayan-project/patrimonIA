import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError, type UsuarioDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { irAAccion } from './AccionFormScreen';
import { Text } from '../ui/Text';
import { Button, CampoAlSalir, Dato, Datos, ErrorText, radio, Screen, Skeleton, useC, type Paleta } from '../ui';

/** Mi perfil (plantilla Ajustes, R5): el nombre se guarda al salir del campo. */
export function PerfilScreen() {
  const { token } = useSession();
  const nav = useNav();
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const [me, setMe] = useState<UsuarioDTO | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<UsuarioDTO>('/usuarios/me', token)
      .then(setMe)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : 'Error'));
  }, [token]);

  if (!me) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton filas={2} />}
      </Screen>
    );
  }

  return (
    <Screen>
      {/* G35: quién eres, como la tarjeta de Ajustes. */}
      <View style={styles.cabeza}>
        <View style={styles.inicial}>
          <Text style={styles.inicialTxt}>{me.nombre.trim().charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.nombre} numberOfLines={1}>
          {me.nombre}
        </Text>
        <Text style={styles.dato} numberOfLines={1}>
          {me.email}
        </Text>
      </View>
      <CampoAlSalir
        label="✏️ ¿Cómo te llamamos?"
        value={me.nombre}
        autoCapitalize="words"
        onGuardar={async (nombre) => {
          await api.post('/comandos/ActualizarDatosUsuario', { nombre }, token);
          setMe({ ...me, nombre });
        }}
      />
      <Datos>
        <Dato etiqueta="📧 Tu correo" valor={me.email} />
      </Datos>
      <ErrorText>{error}</ErrorText>
      <Button
        title="👋 Desactivar mi cuenta"
        variant="danger"
        onPress={() =>
          irAAccion(nav, {
            titulo: 'Desactivar mi cuenta',
            explicacion:
              'No podrás volver a iniciar sesión. Tus cuentas, bienes y membresías pasadas se conservan. Se cierra la sesión ahora.',
            pregunta: '¿Por qué te vas?',
            boton: 'Desactivar mi cuenta',
            comando: 'DesactivarUsuario',
            body: {},
            aviso: 'Cuenta desactivada',
            peligro: true,
            cerrarSesion: true,
          })
        }
      />
    </Screen>
  );
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    cabeza: {
      alignItems: 'center',
      gap: 4,
      padding: 20,
      borderRadius: radio.tarjeta,
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
    },
    inicial: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    inicialTxt: { fontSize: 30, fontWeight: '800', color: c.primaryText },
    nombre: { fontSize: 20, fontWeight: '800', color: c.text },
    dato: { fontSize: 14, color: c.muted },
  });
