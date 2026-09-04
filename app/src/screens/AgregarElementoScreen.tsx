import { useState } from 'react';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  ErrorText,
  Field,
  MoneyField,
  Paragraph,
  Screen,
  Segmented,
  Select,
  Title,
} from '../ui';
import {
  etiqueta,
  MONEDAS_FRECUENTES,
  NOMBRE_MONEDA,
  TIPOS_ELEMENTO_SUGERIDOS,
} from '../labels';

const CATEGORIAS = ['LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'DEUDA', 'CREDITO'] as const;
const OPC_CATEGORIA = CATEGORIAS.map((c) => ({ value: c, label: etiqueta(c) }));
const OPC_TIPO = TIPOS_ELEMENTO_SUGERIDOS.map((t) => ({ value: t, label: etiqueta(t) }));
const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({
  value: m,
  label: `${m} — ${NOMBRE_MONEDA[m] ?? m}`,
}));

export function AgregarElementoScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const { key } = useIdempotencyKey();

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('cuenta_corriente');
  const [categoria, setCategoria] = useState<(typeof CATEGORIAS)[number]>('LIQUIDEZ');
  const [valorInicial, setValorInicial] = useState('0');
  const [valorPendiente, setValorPendiente] = useState('');
  const [moneda, setMoneda] = useState('CLP');
  const [valorizable, setValorizable] = useState<'No' | 'Sí'>('No');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intento, setIntento] = useState(false);
  const [tocado, setTocado] = useState<Record<string, boolean>>({});

  const esDeudaOCredito = categoria === 'DEUDA' || categoria === 'CREDITO';
  const sucio =
    nombre.trim().length > 0 ||
    tipo !== 'cuenta_corriente' ||
    categoria !== 'LIQUIDEZ' ||
    valorInicial !== '0' ||
    valorPendiente !== '' ||
    moneda !== 'CLP';
  const permitirSalida = useConfirmarDescarte(sucio && !loading);

  // ── Validación en vivo ────────────────────────────────────────────────────
  const errNombre = nombre.trim() ? '' : 'Escribe un nombre para identificarlo.';
  const errMoneda = /^[A-Za-z]{3}$/.test(moneda.trim())
    ? ''
    : 'Usa el código de 3 letras (CLP, USD, EUR…).';
  const errPendiente =
    esDeudaOCredito && !(Number(valorPendiente) > 0)
      ? categoria === 'DEUDA'
        ? 'Indica cuánto debes.'
        : 'Indica cuánto te deben.'
      : '';

  const ver = (campo: string, msg: string) => ((tocado[campo] || intento) && msg ? msg : undefined);
  const marcar = (campo: string) => setTocado((t) => ({ ...t, [campo]: true }));

  const hayErrores = !!(errNombre || errMoneda || errPendiente);

  const onSubmit = async () => {
    setIntento(true);
    if (hayErrores) return;
    setError('');
    setLoading(true);
    try {
      await api.comando<ElementoPatrimonialDTO>(
        '/comandos/RegistrarElementoPatrimonial',
        {
          nombre: nombre.trim(),
          tipo: tipo.trim(),
          categoriaFuncional: categoria,
          moneda: moneda.trim().toUpperCase(),
          ...(esDeudaOCredito
            ? { valorPendiente: Number(valorPendiente) || 0 }
            : {
                valorInicial: Number(valorInicial) || 0,
                participaValorLiquido: categoria === 'LIQUIDEZ',
                admiteValorizacion: valorizable === 'Sí',
              }),
        },
        token,
        key,
      );
      toast.mostrar('Elemento agregado');
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>Agregar cuenta o bien</Title>
      <Paragraph>Una cuenta, un activo, una inversión, una deuda. Quedas como propietario al 100%.</Paragraph>

      <Field
        label="Nombre"
        value={nombre}
        onChangeText={setNombre}
        onBlur={() => marcar('nombre')}
        placeholder="Cuenta corriente"
        autoCapitalize="sentences"
        error={ver('nombre', errNombre)}
      />
      <Select label="Tipo" value={tipo} options={OPC_TIPO} onChange={setTipo} permiteOtro />
      <Select
        label="Categoría funcional"
        value={categoria}
        options={OPC_CATEGORIA}
        onChange={(c) => {
          setCategoria(c as (typeof CATEGORIAS)[number]);
          setValorizable(c === 'ACTIVO' || c === 'INVERSION' ? 'Sí' : 'No');
        }}
      />
      <Ayuda>
        {categoria === 'LIQUIDEZ'
          ? 'Liquidez: efectivo y cuentas de uso diario.'
          : categoria === 'RESERVA'
            ? 'Reserva: fondo de emergencia, plata que guardas pero no gastas.'
            : categoria === 'INVERSION'
              ? 'Inversión: fondos mutuos, APV, acciones, depósitos a plazo.'
              : categoria === 'ACTIVO'
                ? 'Activo: bienes como un inmueble o un vehículo.'
                : categoria === 'DEUDA'
                  ? 'Deuda: lo que debes (un crédito, un préstamo). Resta a tu patrimonio.'
                  : 'Crédito por cobrar: lo que alguien te debe. Suma a tu patrimonio.'}
      </Ayuda>
      {esDeudaOCredito ? (
        <>
          <MoneyField
            label={categoria === 'DEUDA' ? 'Monto que debes' : 'Monto que te deben'}
            value={valorPendiente}
            onChange={(v) => {
              setValorPendiente(v);
              marcar('pendiente');
            }}
            moneda={moneda.trim().toUpperCase() || undefined}
            error={ver('pendiente', errPendiente)}
          />
          <Paragraph>
            {categoria === 'DEUDA'
              ? 'Resta a tu patrimonio. Se salda con transferencias hacia esta deuda.'
              : 'Suma a tu patrimonio. Se reduce cuando te pagan (transferencia hacia esta cuenta).'}
          </Paragraph>
        </>
      ) : (
        <>
          <MoneyField
            label="Valor inicial"
            value={valorInicial}
            onChange={setValorInicial}
            moneda={moneda.trim().toUpperCase() || undefined}
          />
          <Segmented
            label="¿Se valoriza en el tiempo? (inmuebles, inversiones)"
            options={['No', 'Sí'] as const}
            value={valorizable}
            onChange={setValorizable}
          />
          <Paragraph>No se puede cambiar después de crear el elemento.</Paragraph>
        </>
      )}
      <Select label="Moneda" value={moneda} options={OPC_MONEDA} onChange={setMoneda} permiteOtro />
      {intento && errMoneda ? <ErrorText>{errMoneda}</ErrorText> : null}

      <ErrorText>{error}</ErrorText>
      <Button
        title="Agregar"
        onPress={onSubmit}
        loading={loading}
        disabled={intento && hayErrores}
      />
    </Screen>
  );
}
