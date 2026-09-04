import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type AsignacionDTO,
  type ObjetivoFinancieroDTO,
} from '../api/client';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { money } from '../format';
import { useToast } from '../ui/Toast';
import {
  Ayuda,
  Button,
  ErrorText,
  Field,
  ListItem,
  MoneyField,
  Nota,
  Panel,
  Screen,
  SectionTitle,
  Title,
  Skeleton,
} from '../ui';

/** A7 — todas las asignaciones: con objetivo y sueltas ("Fondo emergencia"…). */
export function AsignacionesScreen() {
  const { token } = useSession();
  const nav = useNav();
  const toast = useToast();

  const [asignaciones, setAsignaciones] = useState<AsignacionDTO[] | null>(null);
  const [objetivos, setObjetivos] = useState<ObjetivoFinancieroDTO[]>([]);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    setError('');
    try {
      const [asg, obj] = await Promise.all([
        api.get<AsignacionDTO[]>('/asignaciones', token),
        api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token).catch(() => []),
      ]);
      setAsignaciones(asg);
      setObjetivos(obj);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token]);

  useCargaAlEnfocar(cargar);

  const crear = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(
        '/comandos/CrearAsignacion',
        {
          nombre: nombre.trim(),
          ...(Number(monto) > 0 ? { montoObjetivo: Number(monto) } : {}),
        },
        token,
      );
      toast.mostrar('Asignación creada');
      setNombre('');
      setMonto('');
      await cargar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  if (!asignaciones) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  const nombreObjetivo = new Map(objetivos.map((o) => [o.id, o.nombre]));
  const conObjetivo = asignaciones.filter((a) => a.objetivoId);
  const sueltas = asignaciones.filter((a) => !a.objetivoId);

  const fila = (a: AsignacionDTO) => (
    <ListItem
      key={a.id}
      title={a.nombre}
      subtitle={
        a.objetivoId
          ? (nombreObjetivo.get(a.objetivoId) ?? 'Objetivo')
          : a.montoObjetivo
            ? `Meta ${money(a.montoObjetivo, 'CLP')}`
            : 'Sin meta'
      }
      right={money(a.totalReservado, 'CLP')}
      onPress={() => nav.go('AsignacionDetalle', { asignacionId: a.id })}
    />
  );

  return (
    <Screen onRefresh={cargar}>
      <Title>Asignaciones</Title>
      <Ayuda>
        Una asignación "aparta" dinero de tus cuentas para un propósito. Puede
        colgar de un objetivo (ej. "Pie casa") o ser independiente, como un fondo
        de emergencia o los regalos de Navidad.
      </Ayuda>

      {sueltas.length > 0 && (
        <Panel gap={0}>
          <SectionTitle>Independientes</SectionTitle>
          {sueltas.map(fila)}
        </Panel>
      )}

      {conObjetivo.length > 0 && (
        <Panel gap={0}>
          <SectionTitle>De un objetivo</SectionTitle>
          {conObjetivo.map(fila)}
        </Panel>
      )}

      {asignaciones.length === 0 && (
        <Panel>
          <Nota>Aún no tienes asignaciones.</Nota>
        </Panel>
      )}

      <Panel>
        <SectionTitle>Nueva asignación independiente</SectionTitle>
        <Field
          label="Nombre"
          value={nombre}
          onChangeText={setNombre}
          autoCapitalize="sentences"
          placeholder="Fondo de emergencia"
        />
        <MoneyField label="Meta (opcional)" value={monto} onChange={setMonto} />
        <Nota>Para una asignación dentro de un objetivo, entra al objetivo y créala ahí.</Nota>
        <Button title="Crear asignación" loading={busy} disabled={!nombre.trim()} onPress={crear} />
      </Panel>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
