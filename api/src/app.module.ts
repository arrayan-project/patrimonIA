import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyInterceptor } from './common/idempotency.interceptor.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsuarioModule } from './usuario/usuario.module.js';
import { HogarModule } from './hogar/hogar.module.js';
import { ElementoModule } from './elemento/elemento.module.js';
import { EventoFinancieroModule } from './evento-financiero/evento.module.js';
import { AhorroModule } from './ahorro/ahorro.module.js';
import { OtraPersonaModule } from './otra-persona/otra-persona.module.js';
import { SolicitudModule } from './solicitud/solicitud.module.js';
import { ValorizacionModule } from './valorizacion/valorizacion.module.js';
import { AgrupacionModule } from './agrupacion/agrupacion.module.js';
import { AjustePatrimonialModule } from './ajuste-patrimonial/ajuste.module.js';
import { CategoriaMovimientoModule } from './categoria-movimiento/categoria-movimiento.module.js';
import { TipoElementoModule } from './tipo-elemento/tipo-elemento.module.js';
import { ConsolidacionModule } from './consolidacion/consolidacion.module.js';
import { EtiquetaModule } from './etiqueta/etiqueta.module.js';
import { MovimientoProgramadoModule } from './movimiento-programado/movimiento-programado.module.js';
import { NotificacionModule } from './notificacion/notificacion.module.js';
import { PlanificacionModule } from './planificacion/planificacion.module.js';
import { PlantillaMovimientoModule } from './plantilla-movimiento/plantilla-movimiento.module.js';
import { PresupuestoModule } from './presupuesto/presupuesto.module.js';
import { ProyeccionesModule } from './proyecciones/proyecciones.module.js';
import { ReporteModule } from './reporte/reporte.module.js';
import { TipoCambioModule } from './tipo-cambio/tipo-cambio.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditoriaModule,
    AuthModule,
    HealthModule,
    UsuarioModule,
    HogarModule,
    ElementoModule,
    EventoFinancieroModule,
    AhorroModule,
    OtraPersonaModule,
    SolicitudModule,
    ValorizacionModule,
    AjustePatrimonialModule,
    AgrupacionModule,
    CategoriaMovimientoModule,
    TipoElementoModule,
    EtiquetaModule,
    ConsolidacionModule,
    MovimientoProgramadoModule,
    NotificacionModule,
    PlanificacionModule,
    PlantillaMovimientoModule,
    PresupuestoModule,
    ProyeccionesModule,
    ReporteModule,
    TipoCambioModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor }],
})
export class AppModule {}
