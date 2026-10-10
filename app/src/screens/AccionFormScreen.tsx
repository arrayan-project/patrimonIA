import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useAuth, useSession } from '../auth/AuthContext';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import { Text } from '../ui/Text';
import { Button, DateField, ErrorText, Field, Pastilla, Question, Screen, tinte, useC, type Paleta } from '../ui';

/** G39 (F-7): un motivo a un toque (el texto es lo que se guarda). */
export interface Motivo {
  emoji: string;
  texto: string;
}

/**
 * G39 (F-7): el motivo viene elegido (el primero) y se ve como paso hecho;
 * otro se elige con un toque, y "✍️ Otro" abre el campo para escribirlo.
 * `valor` es el texto que se envía; '' mientras "Otro" está vacío.
 */
export function ElegirMotivo({
  pregunta,
  motivos,
  valor,
  onChange,
  placeholder,
}: {
  pregunta: string;
  motivos: Motivo[];
  valor: string;
  onChange: (texto: string) => void;
  placeholder?: string;
}) {
  const [otro, setOtro] = useState(!motivos.some((m) => m.texto === valor));
  return (
    <View style={{ gap: 8 }}>
      <Question>{pregunta}</Question>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {motivos.map((m) => (
          <Pastilla
            key={m.texto}
            label={`${m.emoji} ${m.texto}`}
            activo={!otro && valor === m.texto}
            onPress={() => {
              setOtro(false);
              onChange(m.texto);
            }}
          />
        ))}
        <Pastilla
          label="✍️ Otro"
          activo={otro}
          onPress={() => {
            setOtro(true);
            onChange('');
          }}
        />
      </View>
      {otro && <Field label="Escribe el motivo" value={valor} onChangeText={onChange} placeholder={placeholder} autoCapitalize="sentences" autoFocus />}
    </View>
  );
}

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
  /** G39 (F-7): motivos a un toque en vez del campo; el primero viene elegido. */
  motivos?: Motivo[];
  /**
   * G39 (C4): al cerrar una cuenta o deuda con saldo, se dice cuánto tiene y
   * se pregunta qué pasó con eso antes de cerrarla.
   */
  cierre?: { elementoId: string; deuda: boolean };
}

export function AccionFormScreen() {
  const { token } = useSession();
  const { cerrarSesion } = useAuth();
  const nav = useNav();
  const toast = useToast();
  const c = useC();
  const styles = useMemo(() => crearEstilos(c), [c]);
  const p = nav.route.params as unknown as AccionFormParams;
  const [texto, setTexto] = useState(p.motivos?.[0]?.texto ?? '');
  const [fecha, setFecha] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // G39 (C4): lo que todavía tiene la cuenta (se recarga al volver de moverla).
  const [cuenta, setCuenta] = useState<ElementoPatrimonialDTO | null>(null);
  const [yaNo, setYaNo] = useState(false);
  const cargarCuenta = useCallback(async () => {
    if (!p.cierre) return;
    try {
      setCuenta(await api.get<ElementoPatrimonialDTO>(`/elementos-patrimoniales/${p.cierre.elementoId}`, token));
    } catch {
      setCuenta(null);
    }
  }, [p.cierre, token]);
  useCargaAlEnfocar(cargarCuenta);

  useTitulo(p.titulo);

  const saldo = !cuenta
    ? 0
    : p.cierre?.deuda
      ? (cuenta.valorPendiente ?? Math.abs(cuenta.valorVigente))
      : cuenta.valorVigente;
  const conSaldo = Math.abs(saldo) > 0;
  const listo =
    texto.trim().length >= (p.minimo ?? 3) && (!p.cierre || (cuenta !== null && (!conSaldo || yaNo)));

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
      {p.cierre && cuenta && conSaldo && (
        <View style={{ gap: 8 }}>
          <Question>
            {p.cierre.deuda
              ? `💳 Todavía debes ${money(saldo, cuenta.moneda)}. ¿Qué pasa con eso?`
              : `💰 Todavía tiene ${money(saldo, cuenta.moneda)}. ¿Dónde quedó esa plata?`}
          </Question>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {p.cierre.deuda ? (
              <Pastilla
                label="💳 La pagué"
                onPress={() =>
                  nav.go('RegistrarMovimiento', {
                    tipo: 'TRANSFERENCIA',
                    destinoId: cuenta.id,
                    titulo: 'Pagar',
                    pago: true,
                    monto: saldo,
                  })
                }
              />
            ) : (
              saldo > 0 && (
                <Pastilla
                  label="🔁 La pasé a otra cuenta"
                  onPress={() => nav.go('RegistrarMovimiento', { tipo: 'TRANSFERENCIA', origenId: cuenta.id, monto: saldo })}
                />
              )
            )}
            <Pastilla
              label={p.cierre.deuda ? '🚫 Ya no la debo' : '🚫 Ya no la tengo'}
              activo={yaNo}
              onPress={() => setYaNo(!yaNo)}
            />
          </View>
          {yaNo && (
            <Text style={styles.nota}>
              {p.cierre.deuda
                ? `Los ${money(saldo, cuenta.moneda)} dejan de contar en lo que debes.`
                : `Los ${money(saldo, cuenta.moneda)} dejan de contar en tu plata.`}
            </Text>
          )}
        </View>
      )}
      {p.motivos ? (
        <ElegirMotivo
          pregunta={p.pregunta}
          motivos={p.motivos}
          valor={texto}
          onChange={setTexto}
          placeholder={p.placeholder ?? ejemploDe(p.comando)}
        />
      ) : (
        <Field
          label={p.pregunta}
          value={texto}
          onChangeText={setTexto}
          placeholder={p.placeholder ?? ejemploDe(p.comando)}
          autoCapitalize={p.teclado === 'email' ? 'none' : 'sentences'}
          keyboardType={p.teclado === 'email' ? 'email-address' : 'default'}
          autoFocus={!p.cierre}
        />
      )}
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
  if (k === 'DesactivarElementoPatrimonial') return '📦';
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
  if (comando.startsWith('Desactivar')) return 'Ej.: me cambié de banco';
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
    nota: { fontSize: 14, color: c.muted },
  });

/** Abre `AccionForm` desde un Detalle. */
export function irAAccion(nav: ReturnType<typeof useNav>, params: AccionFormParams): void {
  nav.go('AccionForm', params as unknown as Record<string, unknown>);
}
