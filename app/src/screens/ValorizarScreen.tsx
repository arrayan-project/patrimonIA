import { useState } from 'react';
import { api, ApiError, type ValorizacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import { aISO, Button, CambioPeriodo, Cuando, ErrorText, Migaja, MontoBanda, Screen, useC } from '../ui';

/**
 * Actualizar cuánto vale una casa, un auto o una inversión (G35; comando
 * RegistrarValorizacion). El nuevo valor reemplaza al de hoy: la resta en vivo
 * (Hoy dice → Ahora = Sube / Baja) lo muestra sin explicarlo.
 */
export function ValorizarScreen() {
  const c = useC();
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();
  const elementoId = nav.route.params?.elementoId as string;
  const valorActual = nav.route.params?.valorActual as number | undefined;
  const moneda = (nav.route.params?.moneda as string | undefined) ?? 'CLP';
  const contexto = nav.route.params?.contexto as string | undefined;

  const [valorNuevo, setValorNuevo] = useState('');
  const [fecha, setFecha] = useState(aISO(new Date()));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const permitirSalida = useConfirmarDescarte(valorNuevo.trim() !== '' && !loading);
  const listo = valorNuevo.trim() !== '' && Number(valorNuevo) >= 0;

  const onSubmit = async () => {
    if (!listo) return;
    setError('');
    setLoading(true);
    try {
      await api.post<ValorizacionDTO>(
        '/comandos/RegistrarValorizacion',
        { elementoId, valorNuevo: Number(valorNuevo), fecha },
        token,
      );
      toast.mostrar('Valor actualizado');
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen pie={<Button title="📈 Guardar valor" onPress={onSubmit} loading={loading} disabled={!listo} />}>
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <MontoBanda label="¿Cuánto vale hoy?" value={valorNuevo} onChange={setValorNuevo} moneda={moneda} color={c.primary} emoji="📈">
        {listo && valorActual !== undefined ? (
          <CambioPeriodo
            etiquetaAntes="📍 Hoy dice"
            etiquetaAhora="✏️ Ahora"
            subio="📈 Sube"
            bajo="📉 Baja"
            antes={valorActual}
            hoy={Number(valorNuevo)}
            formato={(n) => money(n, moneda)}
          />
        ) : null}
      </MontoBanda>
      <Cuando label="¿A qué fecha?" value={fecha} onChange={setFecha} />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
