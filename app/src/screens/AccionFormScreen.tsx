import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError } from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { Text } from '../ui/Text';
import { Button, DateField, ErrorText, Field, Screen, tinte, useC, type Paleta } from '../ui';

/**
 * Formulario de una sola pregunta de texto que ejecuta un comando (plantillas
 * de pantalla, R3). Lo usan las acciones de un Detalle que el backend pide con
 * motivo (eliminar, anular, cancelar, cerrar, condonar) y "Agregar parte" de
 * una meta. El formulario ya es la confirmación: no hay diálogo extra.
 */
export interface AccionFormParams {
  /** Título de la barra. */
  titulo: string;
  /** Qué va a pasar, en una o dos frases, sobre la pregunta. */
  explicacion?: string;
  pregunta: string;
  placeholder?: string;
  /** Texto del botón: la acción completa ("Eliminar movimiento"). */
  boton: string;
  /** Nombre del comando: POST /comandos/{comando}. */
  comando: string;
  /** Cuerpo fijo; el texto se agrega en `campo`. */
  body: Record<string, unknown>;
  /** Clave del texto en el cuerpo (por defecto `motivo`). */
  campo?: string;
  /** Largo mínimo del texto (por defecto 3, lo que pide el backend para un motivo). Con 0 es opcional y, vacío, no se envía. */
  minimo?: number;
  /** Fecha opcional (p. ej. la de salida del patrimonio): clave en el cuerpo y la pregunta. Vacía, no se envía. */
  fecha?: { campo: string; pregunta: string };
  aviso: string;
  peligro?: boolean;
  /** Cuántas pantallas volver al terminar (2 si lo que se abría ya no existe). */
  volver?: number;
  /** Teclado del campo (p. ej. un email para invitar). */
  teclado?: 'email';
  /** Cerrar la sesión al terminar (p. ej. desactivar la propia cuenta). */
  cerrarSesion?: boolean;
  /** Volver al Inicio al terminar (p. ej. tras eliminar el hogar). */
  aInicio?: boolean;
}

export function AccionFormScreen() {
  const { token } = useSession();
  const { cerrarSesion } = useAuth();
  const nav = useNav();
  const toast = useToast();
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const p = nav.route.params as unknown as AccionFormParams;
  const [texto, setTexto] = useState('');
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useTitulo(p.titulo);

  const listo = texto.trim().length >= (p.minimo ?? 3);

  const ejecutar = async () => {
    if (!listo) return;
    setBusy(true);
    setError('');
    try {
      await api.post(
        `/comandos/${p.comando}`,
        {
          ...p.body,
          ...(texto.trim() ? { [p.campo ?? 'motivo']: texto.trim() } : {}),
          ...(p.fecha && fecha ? { [p.fecha.campo]: fecha } : {}),
        },
        token,
      );
      toast.mostrar(p.aviso);
      if (p.cerrarSesion) cerrarSesion();
      else if (p.aInicio) nav.reset('Tabs');
      else nav.back(p.volver ?? 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const emoji = emojiDe(p);
  const color = p.peligro ? c.danger : c.primary;
  return (
    <Screen
      pie={
        <Button
          title={`${emoji} ${p.boton}`}
          variant={p.peligro ? 'danger' : undefined}
          onPress={ejecutar}
          loading={busy}
          disabled={!listo}
        />
      }
    >
      {/* G35: qué va a pasar, en una banda con el emoji de la acción. */}
      {p.explicacion ? (
        <View style={[styles.banda, { backgroundColor: tinte(color, 0.12), borderColor: tinte(color, 0.28) }]}>
          <Text style={styles.bandaEmoji}>{emoji}</Text>
          <Text style={styles.bandaTxt}>{p.explicacion}</Text>
        </View>
      ) : null}
      <Field
        label={p.pregunta}
        value={texto}
        onChangeText={setTexto}
        placeholder={p.placeholder ?? ejemploDe(p.comando)}
        autoCapitalize={p.teclado === 'email' ? 'none' : 'sentences'}
        keyboardType={p.teclado === 'email' ? 'email-address' : 'default'}
        autoFocus
      />
      {p.fecha && <DateField label={p.fecha.pregunta} value={fecha} onChange={setFecha} optional />}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

/** G35: el emoji de la acción, según el comando (así no lo repite cada pantalla que abre Confirmar). */
function emojiDe(p: AccionFormParams): string {
  const k = p.comando;
  if (k === 'DesactivarUsuario') return '👋';
  if (k.startsWith('Eliminar') || k.startsWith('Anular')) return '🗑️';
  if (k.startsWith('Cancelar')) return '🚫';
  if (k.startsWith('Desactivar')) return '⏸️';
  if (k.startsWith('Cerrar')) return '🔒';
  if (k.startsWith('Invitar')) return '✉️';
  if (k.startsWith('Remover')) return '🚪';
  if (k.startsWith('Corregir')) return '✏️';
  if (k.startsWith('Reactivar')) return '♻️';
  if (k.startsWith('Crear')) return '➕';
  if (k === 'CondonarDeuda') return '🤝';
  if (k === 'DeclararIncobrable') return '🙅';
  return p.peligro ? '⚠️' : '✍️';
}

/** G35: un ejemplo de motivo en el campo, para que se entienda qué escribir. */
function ejemploDe(comando: string): string | undefined {
  if (comando === 'DesactivarUsuario') return 'Ej.: ya no la uso';
  if (comando === 'CrearAsignacion') return 'Ej.: Pie';
  if (comando.startsWith('Anular')) return 'Ej.: lo anoté por error';
  if (comando.startsWith('Eliminar')) return 'Ej.: ya no lo necesito';
  if (comando.startsWith('Cancelar')) return 'Ej.: ya no lo voy a pagar';
  if (comando.startsWith('Desactivar')) return 'Ej.: la cerré';
  if (comando.startsWith('Cerrar')) return 'Ej.: terminó el mes';
  if (comando.startsWith('Remover')) return 'Ej.: ya no vive aquí';
  if (comando.startsWith('Reactivar')) return 'Ej.: la volví a usar';
  if (comando === 'CondonarDeuda' || comando === 'DeclararIncobrable') return 'Ej.: no me la van a pagar';
  return undefined;
}

const crearEstilos = (c: Paleta) =>
  StyleSheet.create({
    banda: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, borderWidth: 1, padding: 16 },
    bandaEmoji: { fontSize: 28 },
    bandaTxt: { flex: 1, fontSize: 15, lineHeight: 21, color: c.text },
  });

/** Abre `AccionForm` desde un Detalle. */
export function irAAccion(nav: ReturnType<typeof useNav>, params: AccionFormParams): void {
  nav.go('AccionForm', params as unknown as Record<string, unknown>);
}
