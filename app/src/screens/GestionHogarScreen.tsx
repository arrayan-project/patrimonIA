import { useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { confirmar } from '../ui/confirmar';
import { useToast } from '../ui/Toast';
import { Ayuda, Skeleton, Button, ErrorText, etiqueta, Field, LinkButton, Row, Screen, Select, Panel, useC, type Paleta, tipoDe } from '../ui';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({
  value: m,
  label: `${m} — ${NOMBRE_MONEDA[m] ?? m}`,
}));

export function GestionHogarScreen() {
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const { token, usuario } = useSession();
  const { cerrarSesion } = useAuth();
  const toast = useToast();
  const nav = useNav();
  const hogarId = nav.route.params?.hogarId as string;

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [nombre, setNombre] = useState('');
  const [moneda, setMoneda] = useState('CLP');
  const [motivo, setMotivo] = useState('');
  const [email, setEmail] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [intentoInv, setIntentoInv] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const h = await api.get<HogarDTO>(`/hogares/${hogarId}`, token);
      setHogar(h);
      setNombre(h.nombre);
      setMoneda(h.monedaConsolidacion);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error');
    }
  }, [hogarId, token]);

  useCargaAlEnfocar(cargar);

  const run = async (fn: () => Promise<unknown>, salir = false) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (salir) nav.reset('Tabs');
      else await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!hogar) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const soyAdmin = hogar.miembros?.some(
    (m) => m.usuarioId === usuario.id && m.rol === 'ADMINISTRADOR',
  );

  return (
    <Screen onRefresh={cargar}>
      {soyAdmin && (
        <Panel>
          <Field label="Nombre del hogar" value={nombre} onChangeText={setNombre} autoCapitalize="sentences" />
          <Button
            title="Guardar nombre"
            loading={busy}
            onPress={() =>
              run(async () => {
                await api.post(
                  '/comandos/ActualizarDatosHogar',
                  { hogarId, nombre: nombre.trim() },
                  token,
                );
                toast.mostrar('Hogar actualizado');
              })
            }
          />
        </Panel>
      )}

      {soyAdmin && (
        <Panel>
          <Text style={styles.sectionTitle}>Moneda del hogar</Text>
          <Select label="Moneda de consolidación" value={moneda} options={OPC_MONEDA} onChange={setMoneda} permiteOtro />
          <Ayuda>
            En esta moneda se muestra el patrimonio consolidado. Cambiarla no
            recalcula lo ya mostrado con la moneda anterior.
          </Ayuda>
          <Button
            title="Cambiar moneda"
            variant="secondary"
            loading={busy}
            disabled={moneda.trim().toUpperCase() === hogar.monedaConsolidacion}
            onPress={() =>
              run(async () => {
                await api.post(
                  '/comandos/CambiarMonedaConsolidacion',
                  { hogarId, moneda: moneda.trim().toUpperCase() },
                  token,
                );
                toast.mostrar('Moneda actualizada');
              })
            }
          />
        </Panel>
      )}

      <Panel>
        <Text style={styles.sectionTitle}>Miembros</Text>
        {hogar.miembros?.map((m) => (
          <View key={m.usuarioId} style={styles.miembro}>
            <Row left={m.nombre} right={etiqueta(m.rol)} />
            {soyAdmin && m.usuarioId !== usuario.id && (
              <View style={styles.acciones}>
                <Button
                  title={m.rol === 'ADMINISTRADOR' ? 'Hacer miembro' : 'Hacer admin'}
                  variant="secondary"
                  loading={busy}
                  onPress={() =>
                    run(() =>
                      api.post(
                        '/comandos/AsignarRol',
                        {
                          hogarId,
                          usuarioId: m.usuarioId,
                          rol: m.rol === 'ADMINISTRADOR' ? 'MIEMBRO' : 'ADMINISTRADOR',
                        },
                        token,
                      ),
                    )
                  }
                />
                <Button
                  title="Remover"
                  variant="secondary"
                  loading={busy}
                  disabled={motivo.trim().length < 3}
                  onPress={() =>
                    run(() =>
                      api.post(
                        '/comandos/RemoverMiembro',
                        { hogarId, usuarioId: m.usuarioId, motivo: motivo.trim() },
                        token,
                      ),
                    )
                  }
                />
              </View>
            )}
          </View>
        ))}
        {soyAdmin && (
          <Field label="Motivo (para remover)" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
        )}
      </Panel>

      {soyAdmin && (
        <Panel>
          <Text style={styles.sectionTitle}>Invitar a alguien</Text>
          <Field
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            placeholder="persona@email.cl"
            error={intentoInv && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? 'Escribe un email válido.' : undefined}
          />
          {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
          <Button
            title="Enviar invitación"
            loading={busy}
            onPress={() => {
              setIntentoInv(true);
              if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return;
              run(async () => {
                await api.post(
                  '/comandos/InvitarMiembro',
                  { hogarId, emailInvitado: email.trim() },
                  token,
                );
                setAviso(`Invitación enviada a ${email.trim()}`);
                setEmail('');
                setIntentoInv(false);
              });
            }}
          />
        </Panel>
      )}

      <Panel>
        <Text style={styles.sectionTitle}>Salir</Text>
        <Button
          title="Salir del hogar"
          variant="danger"
          loading={busy}
          onPress={async () => {
            if (!(await confirmar('Salir del hogar', 'Dejarás de ver la consolidación y las metas del hogar. Tus elementos siguen siendo tuyos.', 'Salir')))
              return;
            await run(() => api.post('/comandos/SalirDeHogar', { hogarId }, token), true);
          }}
        />
        {soyAdmin && (
          <Button
            title="Eliminar hogar"
            variant="danger"
            loading={busy}
            disabled={motivo.trim().length < 3}
            onPress={async () => {
              if (!(await confirmar('Eliminar hogar', 'Se elimina el hogar y todas sus membresías. Los elementos patrimoniales de cada miembro sobreviven.', 'Eliminar')))
                return;
              await run(
                () => api.post('/comandos/EliminarHogar', { hogarId, motivo: motivo.trim() }, token),
                true,
              );
            }}
          />
        )}
      </Panel>

      <ErrorText>{error}</ErrorText>
      <LinkButton title="Cerrar sesión" onPress={cerrarSesion} />
    </Screen>
  );
}

const crearEstilos = (c: Paleta) => StyleSheet.create({
  sectionTitle: tipoDe(c).seccion,
  miembro: { gap: 6, borderTopWidth: 1, borderTopColor: c.faint, paddingTop: 8 },
  acciones: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  aviso: { color: c.primary, fontSize: 14 },
});
