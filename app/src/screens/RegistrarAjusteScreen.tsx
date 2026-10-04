import { useState } from 'react';
import { api, ApiError, type AjustePatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav, useTitulo } from '../navigation/navigator';
import { money } from '../format';
import { GLOSARIO } from '../labels';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import {
  contadorPasos,
  aISO,
  AmountInput,
  Ayuda,
  Button,
  Cuando,
  ErrorText,
  Field,
  Migaja,
  Nota,
  Screen,
  Segmented,
} from '../ui';

export function RegistrarAjusteScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string;
  const valorActual = nav.route.params?.valorActual as number | undefined;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const contexto = nav.route.params?.contexto as string | undefined;
  const modoInteres = nav.route.params?.modoInteres === true;
  const sentidoInicial = (nav.route.params?.sentidoInicial as 'Mayor' | 'Menor' | undefined) ?? 'Menor';
  const magnitudInicial = nav.route.params?.magnitudInicial as number | undefined;
  const motivoInicial = (nav.route.params?.motivoInicial as string | undefined) ?? '';

  const [direccion, setDireccion] = useState<'Mayor' | 'Menor'>(sentidoInicial);
  const [magnitud, setMagnitud] = useState(
    magnitudInicial != null && magnitudInicial > 0 ? String(Math.round(magnitudInicial)) : '',
  );
  const [fecha, setFecha] = useState(aISO(new Date()));
  const [motivo, setMotivo] = useState(motivoInicial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const monto = (direccion === 'Menor' ? -1 : 1) * (Number(magnitud) || 0);
  const errMagnitud = Number(magnitud) > 0 ? '' : 'Ingresa la diferencia (mayor a 0).';
  const errMotivo = motivo.trim().length >= 3 ? '' : 'Explica brevemente el motivo (mínimo 3 letras).';
  const permitirSalida = useConfirmarDescarte(
    (Number(magnitud) > 0 || motivo.trim().length > 0) && !loading,
  );

  const listo = !errMagnitud && !errMotivo;

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
      toast.mostrar(modoInteres ? 'Interés registrado' : 'Ajuste registrado');
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  // HZ-19 y HZ-24: numera las preguntas en el orden en que se muestran y marca el
  // paso actual (el primer obligatorio sin completar).
  const paso = contadorPasos();
  useTitulo(modoInteres ? 'Registrar interés' : undefined);

  const resumen =
    valorActual !== undefined && Number(magnitud) > 0
      ? `El valor pasa de ${money(valorActual, moneda)} a ${money(valorActual + monto, moneda)}.`
      : 'Completa la diferencia y el motivo.';

  return (
    <Screen
      pie={
        <>
          <Nota>{resumen}</Nota>
          <Button
            title={modoInteres ? 'Registrar interés' : 'Registrar ajuste'}
            onPress={onSubmit}
            loading={loading}
            disabled={!listo}
          />
        </>
      }
    >
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Ayuda>
        {modoInteres
          ? 'El interés aumenta el saldo. Sugerimos saldo × tasa anual ÷ 12; ajústalo al período real.'
          : GLOSARIO.ajuste}
      </Ayuda>

      <AmountInput
        label={modoInteres ? '¿Cuánto interés?' : '¿Cuánto es la diferencia?'}
        paso={paso({ hecho: !errMagnitud })}
        value={magnitud}
        onChange={setMagnitud}
        moneda={moneda}
      />
      {/* HZ-22: la decisión que cambia el significado del registro va en el paso 2. */}
      {!modoInteres && (
        <Segmented
          label="¿El valor real es menor o mayor?"
          paso={paso({ hecho: true })}
          options={['Menor', 'Mayor'] as const}
          value={direccion}
          onChange={setDireccion}
        />
      )}
      <Field
        label="¿Por qué hay una diferencia?"
        paso={paso({ hecho: !errMotivo })}
        value={motivo}
        onChangeText={setMotivo}
        placeholder="p. ej. comisión que no anoté"
        autoCapitalize="sentences"
      />
      <Cuando value={fecha} onChange={setFecha} paso={paso({ hecho: !!fecha })} />

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
