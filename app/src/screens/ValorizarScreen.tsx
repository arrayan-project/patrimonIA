import { useState } from 'react';
import { api, ApiError, type ValorizacionDTO } from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useConfirmarDescarte } from '../hooks/useConfirmarDescarte';
import { useToast } from '../ui/Toast';
import { GLOSARIO } from '../labels';
import { aISO, AmountInput, Ayuda, Button, contadorPasos, Cuando, ErrorText, Migaja, Nota, Screen } from '../ui';

export function ValorizarScreen() {
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
      toast.mostrar('Valorización registrada');
      permitirSalida();
      nav.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const paso = contadorPasos();
  return (
    <Screen
      pie={
        <>
          <Nota>
            {listo && valorActual !== undefined
              ? `Pasa de ${money(valorActual, moneda)} a ${money(Number(valorNuevo), moneda)}. No es un movimiento de plata.`
              : 'Completa el valor.'}
          </Nota>
          <Button title="Registrar valorización" onPress={onSubmit} loading={loading} disabled={!listo} />
        </>
      }
    >
      {contexto ? <Migaja>{contexto}</Migaja> : null}
      <Ayuda>{GLOSARIO.valorizar}</Ayuda>
      <AmountInput label="¿Cuánto vale?" paso={paso({ hecho: listo })} value={valorNuevo} onChange={setValorNuevo} moneda={moneda} />
      <Cuando label="¿A qué fecha?" value={fecha} onChange={setFecha} paso={paso({ hecho: !!fecha })} />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
