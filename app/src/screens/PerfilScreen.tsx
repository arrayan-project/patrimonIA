import { useEffect, useState } from 'react';
import { api, ApiError, type UsuarioDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { irAAccion } from './AccionFormScreen';
import { AccionDestructiva, CampoAlSalir, Dato, Datos, ErrorText, Nota, Screen, Skeleton } from '../ui';

/** Mi perfil (plantilla Ajustes, R5): el nombre se guarda al salir del campo. */
export function PerfilScreen() {
  const { token } = useSession();
  const nav = useNav();
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
      <CampoAlSalir
        label="Nombre"
        value={me.nombre}
        autoCapitalize="words"
        onGuardar={async (nombre) => {
          await api.post('/comandos/ActualizarDatosUsuario', { nombre }, token);
          setMe({ ...me, nombre });
        }}
      />
      <Datos>
        <Dato etiqueta="Correo" valor={me.email} />
      </Datos>
      <Nota>Los cambios se guardan solos.</Nota>
      <ErrorText>{error}</ErrorText>
      <AccionDestructiva
        title="Desactivar mi cuenta"
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
