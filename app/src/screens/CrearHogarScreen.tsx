import { useState } from 'react';
import { api, ApiError, type HogarDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { useIdempotencyKey } from '../hooks/useIdempotencyKey';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { Button, ErrorText, Field, Nota, Screen, Select } from '../ui';
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
  const permitirSalida = useConfirmarDescarte(
    (nombre.trim().length > 0 || moneda !== 'CLP') && !loading,
  );
  const errNombre = nombre.trim() ? '' : 'Escribe un nombre para el hogar.';
  const errMoneda = /^[A-Za-z]{3}$/.test(moneda.trim()) ? '' : 'Usa el código de 3 letras (CLP, USD…).';

  const onSubmit = async () => {
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
      // G32 H-04 — en vez de un Inicio vacío, seguir directo con la primera cuenta.
      nav.reset('Tabs', undefined, [
        {
          name: 'AgregarElemento',
          params: {
            mensaje:
              'Hogar creado. Empecemos por tu cuenta principal (la corriente o la vista): con ella ya puedes registrar ingresos y gastos.',
          },
        },
      ]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      pie={
        <>
          <Nota>👑 Quedas a cargo del hogar; después invitas a los demás.</Nota>
          <Button title="🏠 Crear mi hogar" onPress={onSubmit} loading={loading} disabled={!!(errNombre || errMoneda)} />
        </>
      }
    >
      <Field
        label="🏠 ¿Cómo se llama tu hogar?"
        value={nombre}
        onChangeText={setNombre}
        placeholder="Ej.: Casa"
        autoCapitalize="sentences"
      />
      <Select
        label="💱 ¿En qué moneda quieres ver el total?"
        value={moneda}
        options={OPC_MONEDA}
        onChange={setMoneda}
        permiteOtro
      />
      <Nota>Se puede cambiar después en Ajustes › Personas del hogar.</Nota>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
