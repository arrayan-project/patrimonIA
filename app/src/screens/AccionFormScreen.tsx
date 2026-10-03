import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { useToast } from '../ui/Toast';
import { Button, contadorPasos, ErrorText, Field, Nota, Screen } from '../ui';

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
  /** Largo mínimo del texto (por defecto 3, lo que pide el backend para un motivo). */
  minimo?: number;
  aviso: string;
  peligro?: boolean;
  /** Cuántas pantallas volver al terminar (2 si lo que se abría ya no existe). */
  volver?: number;
}

export function AccionFormScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const p = nav.route.params as unknown as AccionFormParams;
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useTitulo(p.titulo);

  const listo = texto.trim().length >= (p.minimo ?? 3);

  const ejecutar = async () => {
    if (!listo) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/comandos/${p.comando}`, { ...p.body, [p.campo ?? 'motivo']: texto.trim() }, token);
      toast.mostrar(p.aviso);
      nav.back(p.volver ?? 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  const paso = contadorPasos();
  return (
    <Screen
      pie={
        <Button
          title={p.boton}
          variant={p.peligro ? 'danger' : undefined}
          onPress={ejecutar}
          loading={busy}
          disabled={!listo}
        />
      }
    >
      {p.explicacion ? <Nota>{p.explicacion}</Nota> : null}
      <Field
        label={p.pregunta}
        paso={paso({ hecho: listo })}
        value={texto}
        onChangeText={setTexto}
        placeholder={p.placeholder}
        autoCapitalize="sentences"
        autoFocus
      />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

/** Abre `AccionForm` desde un Detalle. */
export function irAAccion(nav: ReturnType<typeof useNav>, params: AccionFormParams): void {
  nav.go('AccionForm', params as unknown as Record<string, unknown>);
}
