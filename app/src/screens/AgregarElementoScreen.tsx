import { useState } from 'react';
import { api, ApiError, type ElementoPatrimonialDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
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

  const esDeudaOCredito = categoria === 'DEUDA' || categoria === 'CREDITO';

  const onCategoria = (c: (typeof CATEGORIAS)[number]) => {
    setCategoria(c);
    setValorizable(c === 'ACTIVO' || c === 'INVERSION' ? 'Sí' : 'No');
  };

  const onSubmit = async () => {
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
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>Agregar elemento patrimonial</Title>
      <Paragraph>Una cuenta, un activo, una inversión. Quedas como propietario al 100%.</Paragraph>

      <Field label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Cuenta corriente" autoCapitalize="sentences" />
      <Select label="Tipo" value={tipo} options={OPC_TIPO} onChange={setTipo} permiteOtro />
      <Select
        label="Categoría funcional"
        value={categoria}
        options={OPC_CATEGORIA}
        onChange={(c) => onCategoria(c as (typeof CATEGORIAS)[number])}
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
            onChange={setValorPendiente}
            moneda={moneda.trim().toUpperCase() || undefined}
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

      <ErrorText>{error}</ErrorText>
      <Button title="Registrar elemento" onPress={onSubmit} loading={loading} disabled={!nombre.trim()} />
    </Screen>
  );
}
