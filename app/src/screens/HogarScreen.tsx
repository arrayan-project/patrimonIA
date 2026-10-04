import { useCallback, useState } from 'react';
import { useCargaAlEnfocar } from '../hooks/useCargaAlEnfocar';
import {
  api,
  ApiError,
  type ElementoPatrimonialDTO,
  type HogarDTO,
  type ObjetivoFinancieroDTO,
  type PatrimonioConsolidadoDTO,
} from '../api/client';
import { Pressable } from 'react-native';
import { useSession } from '../auth/AuthContext';
import { useNav } from '../navigation/navigator';
import { leer } from '../auth/secureStorage';
import { money } from '../format';
import {
  ErrorText,
  GoalCard,
  Hero,
  IconButton,
  ListCard,
  MenuList,
  Nota,
  Screen,
  Section,
  Skeleton,
  Title,
  TopRow,
  TxRow,
} from '../ui';

/** Tab "Hogar": personas y lo que se comparte. El patrimonio consolidado vive en Inicio (toggle). */
export function HogarScreen() {
  const { token, usuario } = useSession();
  const nav = useNav();
  const claveHogar = `patrimonia.hogar.${usuario.id}`;

  const [hogar, setHogar] = useState<HogarDTO | null>(null);
  const [compartidos, setCompartidos] = useState<ElementoPatrimonialDTO[]>([]);
  // HZ-10 (3) / D-2: cuentas de otros miembros visibles que no suman ("Que
  // puedan transferirte"). Sin esto parecía que ese nivel no hacía nada.
  const [paraTransferir, setParaTransferir] = useState<ElementoPatrimonialDTO[]>([]);
  const [objetivosHogar, setObjetivosHogar] = useState<ObjetivoFinancieroDTO[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [cons, setCons] = useState<PatrimonioConsolidadoDTO | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setError('');
    try {
      const lista = await api.get<HogarDTO[]>('/usuarios/me/hogares', token);
      if (lista.length === 0) {
        nav.reset('Bienvenida');
        return;
      }
      const guardado = await leer(claveHogar);
      const h = lista.find((x) => x.id === guardado) ?? lista[0];
      setHogar(h);
      setCons(await api.get<PatrimonioConsolidadoDTO>(`/hogares/${h.id}/patrimonio-consolidado`, token).catch(() => null));

      try {
        const [els, mios, objs] = await Promise.all([
          api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?alcance=hogar', token),
          api.get<ElementoPatrimonialDTO[]>('/elementos-patrimoniales?propietario=me', token),
          api.get<ObjetivoFinancieroDTO[]>('/objetivos-financieros', token),
        ]);
        // `alcance=hogar` trae solo lo de los otros miembros: lo tuyo que suma al hogar va también.
        const vistos = new Set<string>();
        setCompartidos(
          [...mios, ...els].filter((e) => e.participaConsolidacion && !vistos.has(e.id) && vistos.add(e.id)),
        );
        setParaTransferir(els.filter((e) => !e.participaConsolidacion && e.categoriaFuncional !== 'DEUDA' && e.categoriaFuncional !== 'CREDITO'));
        setObjetivosHogar(objs.filter((o) => o.hogarId));
      } catch {
        setCompartidos([]);
        setParaTransferir([]);
        setObjetivosHogar([]);
      }

      try {
        const { noLeidas: n } = await api.get<{ noLeidas: number }>(
          '/usuarios/me/notificaciones/no-leidas',
          token,
        );
        setNoLeidas(n);
      } catch {
        setNoLeidas(0);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error inesperado');
    }
  }, [token, claveHogar, nav]);

  useCargaAlEnfocar(cargar);

  if (!hogar) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        {!error && <Skeleton />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={cargar}>
      <TopRow
        left={<Title>{hogar.nombre}</Title>}
        right={
          <>
            <IconButton
              icon="notifications-outline"
              badge={noLeidas || undefined}
              accessibilityLabel="Notificaciones"
              onPress={() => nav.go('Notificaciones')}
            />
            <IconButton icon="settings-outline" accessibilityLabel="Ajustes" onPress={() => nav.go('Ajustes')} />
          </>
        }
      />

      {/* Plantilla Resumen: una cifra que responde "¿cuánta plata tiene el hogar?". Tienen − Deben = total. */}
      <Pressable
        onPress={() => nav.go('HogarConsolidado', { hogarId: hogar.id })}
        accessibilityRole="button"
        accessibilityLabel="Ver la plata del hogar"
      >
        <Hero
          label="Plata del hogar"
          value={cons?.total != null ? money(cons.total, cons.monedaConsolidacion) : '—'}
          substats={
            cons &&
            cons.porMoneda.length === 1 &&
            cons.porMoneda[0].moneda === cons.monedaConsolidacion &&
            Math.abs(cons.porMoneda[0].activos - Math.abs(cons.porMoneda[0].pasivos) - cons.porMoneda[0].patrimonioNeto) < 1
              ? [
                  { label: 'Tienen', value: money(cons.porMoneda[0].activos, cons.porMoneda[0].moneda) },
                  { label: 'Deben', value: money(Math.abs(cons.porMoneda[0].pasivos), cons.porMoneda[0].moneda) },
                ]
              : undefined
          }
        />
      </Pressable>
      <Nota>Suma lo que cada uno comparte con el hogar. Lo que no compartes no aparece.</Nota>

      <Section
        title="Lo que suma al hogar"
        accion="Ver todo"
        onAccion={compartidos.length > 4 ? () => nav.go('HogarConsolidado', { hogarId: hogar.id }) : undefined}
      >
        {compartidos.length === 0 ? (
          <Nota>Ninguna cuenta ni bien suma al hogar por ahora.</Nota>
        ) : (
          <ListCard>
            {compartidos.slice(0, 4).map((e) => (
              <TxRow
                key={e.id}
                title={e.nombre}
                subtitle={e.propietarios.map((p) => p.nombre ?? 'Propietario').join(', ')}
                amount={e.valorOculto ? '—' : money(e.valorVigente, e.moneda)}
                logo={{ icon: 'wallet-outline' }}
                onPress={() => nav.go('ElementoDetalle', { elementoId: e.id })}
              />
            ))}
          </ListCard>
        )}
        {compartidos.length > 4 && <Nota>y {compartidos.length - 4} más</Nota>}
      </Section>

      {paraTransferir.length > 0 && (
        <Section title="Para transferir">
          <Nota>Cuentas de otros miembros a las que puedes transferir. No suman al hogar.</Nota>
          <ListCard>
            {paraTransferir.map((e) => (
              <TxRow
                key={e.id}
                title={e.nombre}
                subtitle={e.propietarios.map((p) => p.nombre ?? 'Propietario').join(', ')}
                amount={e.valorOculto ? '' : money(e.valorVigente, e.moneda)}
                logo={{ icon: 'arrow-redo-outline' }}
                onPress={() => nav.go('RegistrarMovimiento', { tipo: 'TRANSFERENCIA', destinoId: e.id })}
              />
            ))}
          </ListCard>
        </Section>
      )}

      <Section title="Metas del hogar">
        {objetivosHogar.length === 0 ? (
          <Nota>Ninguna meta compartida.</Nota>
        ) : (
          objetivosHogar.slice(0, 4).map((o) => (
            <GoalCard
              key={o.id}
              name={o.nombre}
              hint={`${o.progresoPorcentaje}%`}
              pct={o.progresoPorcentaje}
              footLeft={`${money(o.progreso, o.moneda)} de ${money(o.montoObjetivo, o.moneda)}`}
              onPress={() => nav.go('ObjetivoDetalle', { objetivoId: o.id })}
            />
          ))
        )}
      </Section>

      <Section title="Personas">
        <MenuList
          items={[
            {
              title: 'Miembros y roles',
              subtitle: 'Nombre del hogar, miembros, roles, moneda de consolidación',
              icon: 'people-outline',
              onPress: () => nav.go('GestionHogar', { hogarId: hogar.id }),
            },
            {
              title: 'Invitaciones recibidas',
              subtitle: 'Hogares a los que te invitaron',
              icon: 'mail-outline',
              onPress: () => nav.go('Invitaciones'),
            },
          ]}
        />
      </Section>

      <Section title="Más del hogar">
        <MenuList
          items={[
            {
              title: 'Patrimonio del hogar',
              subtitle: 'Consolidado por moneda, distribución de activos y pasivos',
              icon: 'home-outline',
              onPress: () => nav.go('HogarConsolidado', { hogarId: hogar.id }),
            },
            {
              title: 'Movimientos del hogar',
              subtitle: 'Ingresos, gastos y transferencias sobre el patrimonio consolidado',
              icon: 'swap-horizontal-outline',
              onPress: () => nav.go('MovimientosHogar', { hogarId: hogar.id }),
            },
          ]}
        />
      </Section>

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
