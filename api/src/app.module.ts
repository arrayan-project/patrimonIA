import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsuarioModule } from './usuario/usuario.module.js';
import { HogarModule } from './hogar/hogar.module.js';
import { ElementoModule } from './elemento/elemento.module.js';
import { EventoFinancieroModule } from './evento-financiero/evento.module.js';
import { ValorizacionModule } from './valorizacion/valorizacion.module.js';
import { AjustePatrimonialModule } from './ajuste-patrimonial/ajuste.module.js';
import { PlanificacionModule } from './planificacion/planificacion.module.js';
import { PresupuestoModule } from './presupuesto/presupuesto.module.js';
import { ProyeccionesModule } from './proyecciones/proyecciones.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditoriaModule,
    AuthModule,
    HealthModule,
    UsuarioModule,
    HogarModule,
    ElementoModule,
    EventoFinancieroModule,
    ValorizacionModule,
    AjustePatrimonialModule,
    PlanificacionModule,
    PresupuestoModule,
    ProyeccionesModule,
  ],
})
export class AppModule {}
