import { useState } from 'react';
import { api, ApiError, type AjustePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import { aISO, Button, CambioPeriodo, Cuando, ErrorText, Field, Migaja, MontoBanda, Nota, Screen, Segmented, useC } from '../ui';

/**
 * Corregir el saldo (G35; comando RegistrarAjustePatrimonial): se pregunta
 * cuánto tiene de verdad (lo que dice el banco) y la app calcula la
 * diferencia y si es mayor o menor. Lo que se guarda es lo mismo de antes (un
 * ajuste con su monto con signo). En modo interés ("Sumar intereses") se
 * pregunta el interés, que sube lo que se debe. Sin `valorActual` (no debería
 * pasar) se vuelve a pedir la diferencia y si es menor o mayor.
 */
export function RegistrarAjusteScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string;
  const valorActual = nav.route.params?.valorActual as number | undefined;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const contexto = nav.route.params?.contexto as string | undefined;
  // En una deuda se habla de lo que se debe (en positivo): el valor guardado es negativo.
  const deuda = nav.route.params?.deuda === true;
  const modoInteres = nav.route.params?.modoInteres === true;
  const sentidoInicial = (nav.route.params?.sentidoInicial as 'Mayor' | 'Menor' | undefined) ?? 'Menor';
  const magnitudInicial = nav.route.params?.magnitudInicial as number | undefined;
  const motivoInicial = (nav.route.params?.motivoInicial as string | undefined) ?? '';
  const porReal = !modoInteres && valorActual !== undefined;

  const [direccion, setDireccion] = useState<'Mayor' | 'Menor'>(sentidoInicial);
  const [magnitud, setMagnitud] = useState(
    magnitudInicial != null && magnitudInicial > 0 ? String(Math.round(magnitudInicial)) : '',
  );
  const [real, setReal] = useState('');
  const [fecha, setFecha] = useState(aISO(new Date()));
  const [motivo, setMotivo] = useState(motivoInicial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verDe = (v: number) => (deuda ? -v : v);
  const monto = porReal
    ? real.trim() === ''
      ? 0
      : verDe(Number(real)) - (valorActual ?? 0)
    : (direccion === 'Menor' ? -1 : 1) * (Number(magnitud) || 0);
  const errMonto = monto !== 0 ? '' : 'falta';
  const errMotivo = motivo.trim().length >= 3 ? '' : 'falta';
  const permitirSalida = useConfirmarDescarte(
    (real.trim() !== '' || Number(magnitud) > 0 || motivo.trim() !== motivoInicial) && !loading,
  );
  const listo = !errMonto && !errMotivo;

  const onSubmit = async () => {
    if (!listo) return;
    setError('');
    setLoading(true);
    try {
      await api.post<AjustePatrimonialDTO>(
        '/comandos/RegistrarAjustePatrimonial',
        { elementoId, monto, motivo: motivo.trim(), fecha },
        token,
      );
      toast.mostrar(modoInteres ? 'Intereses sumados' : 'Saldo corregido');
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  useTitulo(modoInteres ? 'Sumar intereses' : undefined);

  const resta =
    valorActual !== undefined && monto !== 0 ? (
      <CambioPeriodo
        etiquetaAntes={deuda ? '📍 Hoy debes' : '📍 Hoy dice'}
        etiquetaAhora={modoInteres ? '✏️ Después' : '✅ De verdad'}
        subio={modoInteres ? '💹 Sube' : '📈 Sube'}
        bajo="📉 Baja"
        antes={verDe(valorActual)}
        hoy={verDe(valorActual + monto)}
        formato={(n) => money(n, moneda)}
        subirEsMalo={deuda}
      />
    ) : null;

  return (
    <Screen
      pie={
        <Button
          title={modoInteres ? '💹 Sumar intereses' : '🔧 Corregir el saldo'}
          onPress={onSubmit}
          loading={loading}
          disabled={!listo}
        />
      }
    >
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      {modoInteres ? (
        <MontoBanda label="¿Cuánto interés?" value={magnitud} onChange={setMagnitud} moneda={moneda} color={c.danger} emoji="💹">
          {resta}
        </MontoBanda>
      ) : porReal ? (
        <MontoBanda
          label={deuda ? '¿Cuánto debes de verdad?' : '¿Cuánto tiene de verdad?'}
          value={real}
          onChange={setReal}
          moneda={moneda}
          color={c.primary}
          emoji="🔧"
        >
          {resta}
        </MontoBanda>
      ) : (
        <>
          <MontoBanda label="¿Cuánto es la diferencia?" value={magnitud} onChange={setMagnitud} moneda={moneda} color={c.primary} emoji="🔧" />
          <Segmented
            label="¿El valor real es menor o mayor?"
            options={['Menor', 'Mayor'] as const}
            value={direccion}
            onChange={setDireccion}
          />
        </>
      )}
      <Nota>
        {modoInteres
          ? 'Sugerido: lo que debes × la tasa del año ÷ 12. Cámbialo si tu banco dice otra cosa.'
          : 'Úsalo si no sabes qué pasó. Si sabes, mejor anota el movimiento.'}
      </Nota>
      <Field
        label={modoInteres ? '¿De qué es?' : '¿Por qué no cuadra?'}
        value={motivo}
        onChangeText={setMotivo}
        placeholder="p. ej. una comisión que no anoté"
        autoCapitalize="sentences"
      />
      <Cuando value={fecha} onChange={setFecha} />

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
