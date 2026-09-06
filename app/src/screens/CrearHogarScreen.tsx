import { useState } from 'react';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { Ayuda, Button, ErrorText, Field, Paragraph, Screen, Select, Title } from '../ui';
import { MONEDAS_FRECUENTES, NOMBRE_MONEDA } from '../labels';

const OPC_MONEDA = MONEDAS_FRECUENTES.map((m) => ({
  value: m,
  label: `${m} — ${NOMBRE_MONEDA[m] ?? m}`,
}));

export function CrearHogarScreen() {
  const { token } = useSession();
  const nav = useNav();
  const { key } = useIdempotencyKey();
  const [nombre, setNombre] = useState('');
  const [moneda, setMoneda] = useState('CLP');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [intento, setIntento] = useState(false);
  const permitirSalida = useConfirmarDescarte(
    (nombre.trim().length > 0 || moneda !== 'CLP') && !loading,
  );
  const errNombre = nombre.trim() ? '' : 'Escribe un nombre para el hogar.';
  const errMoneda = /^[A-Za-z]{3}$/.test(moneda.trim()) ? '' : 'Usa el código de 3 letras (CLP, USD…).';

  const onSubmit = async () => {
    setIntento(true);
    if (errNombre || errMoneda) return;
    setError('');
    setLoading(true);
    try {
      await api.comando<HogarDTO>(
        '/comandos/CrearHogar',
        { nombre: nombre.trim(), monedaConsolidacion: moneda.trim().toUpperCase() },
        token,
        key,
      );
      // "usuario = Administrador" es resultado automático del comando.
      permitirSalida();
      nav.reset('Tabs');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title>Crear hogar</Title>
      <Paragraph>Al crear el hogar quedas como su administrador.</Paragraph>

      <Field
        label="Nombre del hogar"
        value={nombre}
        onChangeText={setNombre}
        placeholder="p. ej. Familia Pérez"
        autoCapitalize="sentences"
        error={intento ? errNombre : undefined}
      />

      <Select label="Moneda del hogar" value={moneda} options={OPC_MONEDA} onChange={setMoneda} permiteOtro />
      <Ayuda>
        En esta moneda se muestra el patrimonio consolidado del hogar. Se puede
        cambiar después desde "Gestionar hogar".
      </Ayuda>

      <ErrorText>{error}</ErrorText>
      <Button title="Crear hogar" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
