import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type elemento_patrimonial as ElementoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { EventoFinancieroService } from '../evento-financiero/evento.service.js';
import { errorConCodigo } from '../common/errores.js';
import type { RegistrarPlataDeOtraPersonaDto } from './dto/registrar-plata.dto.js';

/** Saldo con una persona en una moneda. `saldo` con signo: + te debe, − le debes. */
export interface PersonaDTO {
  persona: string;
  moneda: string;
  saldo: number;
  deudaId: string | null;
  creditoId: string | null;
}

export interface ResultadoPlataDeOtraPersonaDTO extends PersonaDTO {
  /** Transferencias registradas, en orden. */
  eventoIds: string[];
  /** HZ-20: el ingreso anulado, si lo hubo. */
  anuladoId: string | null;
}

/** El tipo con que nacen la deuda y el crédito de una persona (texto libre, REQUISITES §D). */
const TIPO_PERSONA = 'plata_de_otra_persona';

/** Se reconoce a la persona por su nombre, sin distinguir mayúsculas ni espacios. */
function clave(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

type Persona = { deuda: ElementoRow | null; credito: ElementoRow | null };

/**
 * D-3 / D-8 — Plata de otra persona (M8, M10; HZ-11, HZ-20). Entra o sale plata
 * de una cuenta por cuenta de una persona: no es ingreso ni gasto del usuario,
 * es una TRANSFERENCIA contra el saldo con esa persona, guardado como una
 * DEUDA (le debes) o un CREDITO (te debe) de naturaleza CUSTODIA_INFORMAL.
 *
 * - Si la persona no tiene saldo, la deuda o el crédito nace con pendiente 0.
 *   Es el único lugar donde se admite (HZ-11): el alta normal exige > 0.
 * - Si el movimiento supera el saldo, se salda a 0 y lo que sobra abre o
 *   aumenta el opuesto. Los elementos en 0 no se desactivan: se reúsan.
 * - Todo en una transacción, con la auditoría encadenada a la del comando raíz.
 */
@Injectable()
export class OtraPersonaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventoFinancieroService,
  ) {}

  async registrar(
    actorId: string,
    dto: RegistrarPlataDeOtraPersonaDto,
  ): Promise<ResultadoPlataDeOtraPersonaDTO> {
    const persona = dto.persona.trim().replace(/\s+/g, ' ');
    const cuenta = await this.#cuenta(dto.cuentaId, actorId);
    const fecha = dto.fecha ?? new Date().toISOString().slice(0, 10);

    if ((dto.anularIngresoId || dto.registrarEntrada) && dto.direccion !== 'SALE') {
      throw errorConCodigo(
        BadRequestException,
        'PREVIO_NO_VALIDO',
        'anularIngresoId y registrarEntrada solo aplican a la plata que sale',
      );
    }
    if (dto.anularIngresoId && dto.registrarEntrada) {
      throw errorConCodigo(
        BadRequestException,
        'PREVIO_NO_VALIDO',
        'Usa anularIngresoId o registrarEntrada, no ambos',
      );
    }

    // HZ-20 — el ingreso mal anotado: se registra de nuevo en su cuenta, con su monto y fecha.
    const ingreso = dto.anularIngresoId ? await this.#ingreso(dto.anularIngresoId, actorId) : null;
    if (ingreso && ingreso.cuenta.moneda !== cuenta.moneda) {
      throw errorConCodigo(
        BadRequestException,
        'MONEDA_DISTINTA',
        'El ingreso y la cuenta deben estar en la misma moneda',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const raizId = await this.auditoria.registrar(tx, {
        comando: 'RegistrarPlataDeOtraPersona',
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: cuenta.id,
        valorPosterior: {
          direccion: dto.direccion,
          persona,
          monto: dto.monto,
          moneda: cuenta.moneda,
          fecha,
          ...(ingreso ? { anular_ingreso_id: ingreso.id } : {}),
          ...(dto.registrarEntrada ? { registrar_entrada: true } : {}),
        },
      });

      const eventoIds: string[] = [];
      if (ingreso) {
        await this.eventos.anularEventoEnTx(
          tx,
          actorId,
          { eventoId: ingreso.id, motivo: `Era plata de ${persona}` },
          { encadenadaDeId: raizId },
        );
        eventoIds.push(
          ...(await this.#mover(tx, actorId, raizId, {
            direccion: 'ENTRA',
            cuenta: ingreso.cuenta,
            monto: ingreso.monto,
            fecha: ingreso.fecha,
            persona,
            glosa: ingreso.glosa,
          })),
        );
      } else if (dto.registrarEntrada) {
        eventoIds.push(
          ...(await this.#mover(tx, actorId, raizId, {
            direccion: 'ENTRA',
            cuenta,
            monto: dto.monto,
            fecha,
            persona,
            glosa: null,
          })),
        );
      }
      eventoIds.push(
        ...(await this.#mover(tx, actorId, raizId, {
          direccion: dto.direccion,
          cuenta,
          monto: dto.monto,
          fecha,
          persona,
          glosa: dto.glosa?.trim() || null,
        })),
      );

      const p = await this.#persona(tx, actorId, persona, cuenta.moneda);
      return { ...this.#saldo(persona, cuenta.moneda, p), eventoIds, anuladoId: ingreso?.id ?? null };
    });
  }

  /**
   * Los saldos con personas del usuario (deudas y créditos CUSTODIA_INFORMAL
   * propios y activos), uno por persona y moneda. Los que están en 0 se
   * ocultan salvo con `todas`.
   */
  async personas(actorId: string, todas = false): Promise<PersonaDTO[]> {
    const els = await this.prisma.elemento_patrimonial.findMany({
      where: {
        estado: 'ACTIVO',
        naturaleza: 'CUSTODIA_INFORMAL',
        categoria_funcional: { in: ['DEUDA', 'CREDITO'] },
        elemento_propietario: { some: { usuario_id: actorId } },
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    });
    const grupos = new Map<string, { nombre: string; moneda: string; p: Persona }>();
    for (const e of els) {
      const nombre = e.contraparte ?? e.nombre;
      const k = `${clave(nombre)}|${e.moneda}`;
      const g = grupos.get(k) ?? { nombre, moneda: e.moneda, p: { deuda: null, credito: null } };
      if (e.categoria_funcional === 'DEUDA') g.p.deuda ??= e;
      else g.p.credito ??= e;
      grupos.set(k, g);
    }
    return [...grupos.values()]
      .map((g) => this.#saldo(g.nombre, g.moneda, g.p))
      .filter((p) => todas || p.saldo !== 0)
      .sort((a, b) => a.persona.localeCompare(b.persona, 'es') || a.moneda.localeCompare(b.moneda));
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /**
   * Registra la(s) transferencia(s) contra el saldo con la persona. ENTRA: baja
   * primero el crédito (te devuelve) y lo que sobra aumenta la deuda. SALE: baja
   * primero la deuda y lo que sobra aumenta el crédito.
   */
  async #mover(
    tx: Prisma.TransactionClient,
    actorId: string,
    raizId: string,
    m: {
      direccion: 'ENTRA' | 'SALE';
      cuenta: ElementoRow;
      monto: number;
      fecha: string;
      persona: string;
      glosa: string | null;
    },
  ): Promise<string[]> {
    const p = await this.#persona(tx, actorId, m.persona, m.cuenta.moneda);
    const entra = m.direccion === 'ENTRA';
    const primero = entra ? p.credito : p.deuda;
    const disponible = primero ? new Prisma.Decimal(primero.valor_vigente).abs() : new Prisma.Decimal(0);
    const total = new Prisma.Decimal(m.monto);
    const parteA = Prisma.Decimal.min(total, disponible);
    const parteB = total.minus(parteA);
    const glosa = m.glosa ?? (entra ? `Plata de ${m.persona}` : `Para ${m.persona}`);

    const ids: string[] = [];
    const transferir = async (persona: ElementoRow, monto: Prisma.Decimal) => {
      const ev = await this.eventos.registrarEventoEnTx(
        tx,
        actorId,
        {
          tipo: 'TRANSFERENCIA',
          monto: monto.toNumber(),
          moneda: m.cuenta.moneda,
          fecha: m.fecha,
          elementoOrigenId: entra ? persona.id : m.cuenta.id,
          elementoDestinoId: entra ? m.cuenta.id : persona.id,
          glosa,
        },
        { encadenadaDeId: raizId },
      );
      ids.push(ev.id);
    };

    if (primero && parteA.greaterThan(0)) await transferir(primero, parteA);
    if (parteB.greaterThan(0)) {
      const categoria = entra ? 'DEUDA' : 'CREDITO';
      const segundo =
        (entra ? p.deuda : p.credito) ??
        (await this.#crearSaldo(tx, actorId, raizId, categoria, m.persona, m.cuenta));
      await transferir(segundo, parteB);
    }
    return ids;
  }

  /** La deuda o el crédito de la persona, con pendiente 0 (HZ-11). */
  async #crearSaldo(
    tx: Prisma.TransactionClient,
    actorId: string,
    raizId: string,
    categoria: 'DEUDA' | 'CREDITO',
    persona: string,
    cuenta: ElementoRow,
  ): Promise<ElementoRow> {
    const cero = new Prisma.Decimal(0);
    const creado = await tx.elemento_patrimonial.create({
      data: {
        nombre: persona,
        tipo: TIPO_PERSONA,
        categoria_funcional: categoria,
        ambito: 'PERSONAL',
        valor_vigente: cero,
        moneda: cuenta.moneda,
        participa_valor_liquido: false,
        // Si la cuenta suma al hogar, la plata ajena que guarda también: si no,
        // el patrimonio del hogar se inflaría con plata de otra persona.
        participa_consolidacion: cuenta.participa_consolidacion,
        admite_valorizacion: false,
        visibilidad: 'PRIVADA',
        estado: 'ACTIVO',
        valor_pendiente: cero,
        valor_pendiente_inicial: cero,
        naturaleza: 'CUSTODIA_INFORMAL',
        contraparte: persona,
      },
    });
    await tx.elemento_propietario.create({
      data: { elemento_id: creado.id, usuario_id: actorId, porcentaje: new Prisma.Decimal(100) },
    });
    await this.auditoria.registrar(tx, {
      comando: 'RegistrarElementoPatrimonial',
      usuarioId: actorId,
      entidadTipo: 'ELEMENTO_PATRIMONIAL',
      entidadId: creado.id,
      encadenadaDeId: raizId,
      valorPosterior: {
        nombre: persona,
        categoria_funcional: categoria,
        naturaleza: 'CUSTODIA_INFORMAL',
        contraparte: persona,
        moneda: cuenta.moneda,
        valor_pendiente: 0,
        participa_consolidacion: cuenta.participa_consolidacion,
        propietarios: [{ usuario_id: actorId, porcentaje: 100 }],
      },
    });
    return creado;
  }

  /** La deuda y el crédito de la persona en esa moneda (los más antiguos), leídos en `tx`. */
  async #persona(
    tx: Prisma.TransactionClient,
    actorId: string,
    persona: string,
    moneda: string,
  ): Promise<Persona> {
    const els = await tx.elemento_patrimonial.findMany({
      where: {
        estado: 'ACTIVO',
        moneda,
        naturaleza: 'CUSTODIA_INFORMAL',
        categoria_funcional: { in: ['DEUDA', 'CREDITO'] },
        elemento_propietario: { some: { usuario_id: actorId } },
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    });
    const k = clave(persona);
    const suyos = els.filter((e) => clave(e.contraparte ?? e.nombre) === k);
    return {
      deuda: suyos.find((e) => e.categoria_funcional === 'DEUDA') ?? null,
      credito: suyos.find((e) => e.categoria_funcional === 'CREDITO') ?? null,
    };
  }

  #saldo(persona: string, moneda: string, p: Persona): PersonaDTO {
    const saldo = new Prisma.Decimal(p.credito?.valor_vigente ?? 0).plus(p.deuda?.valor_vigente ?? 0);
    return {
      persona,
      moneda,
      saldo: saldo.toNumber(),
      deudaId: p.deuda?.id ?? null,
      creditoId: p.credito?.id ?? null,
    };
  }

  /** Una cuenta propia y activa: no un bien, un crédito ni el saldo con una persona. */
  async #cuenta(elementoId: string, actorId: string): Promise<ElementoRow> {
    const e = await this.prisma.elemento_patrimonial.findUnique({
      where: { id: elementoId },
      include: { elemento_propietario: { where: { usuario_id: actorId } } },
    });
    if (!e || e.elemento_propietario.length === 0) {
      throw errorConCodigo(ForbiddenException, 'ORIGEN_AJENO', 'No eres propietario del elemento');
    }
    if (
      e.estado !== 'ACTIVO' ||
      e.categoria_funcional === 'ACTIVO' ||
      e.categoria_funcional === 'CREDITO' ||
      e.naturaleza === 'CUSTODIA_INFORMAL'
    ) {
      throw errorConCodigo(
        BadRequestException,
        'CUENTA_NO_VALIDA',
        'La plata de otra persona entra o sale de una cuenta activa',
      );
    }
    const { elemento_propietario: _, ...fila } = e;
    return fila;
  }

  /** HZ-20 — el ingreso a corregir, con la cuenta donde entró. */
  async #ingreso(eventoId: string, actorId: string) {
    const ev = await this.prisma.evento_financiero.findUnique({ where: { id: eventoId } });
    if (!ev) throw errorConCodigo(NotFoundException, 'EVENTO_NO_ENCONTRADO', 'Evento no encontrado');
    if (ev.tipo !== 'INGRESO' || ev.anulado) {
      throw errorConCodigo(
        BadRequestException,
        'PREVIO_NO_VALIDO',
        'Solo se corrige un ingreso vigente',
      );
    }
    const impacto = await this.prisma.impacto_patrimonial.findFirstOrThrow({
      where: { origen_tipo: 'EVENTO_FINANCIERO', origen_id: ev.id },
    });
    return {
      id: ev.id,
      monto: Number(ev.monto),
      fecha: ev.fecha.toISOString().slice(0, 10),
      glosa: ev.glosa,
      cuenta: await this.#cuenta(impacto.elemento_id, actorId),
    };
  }
}
