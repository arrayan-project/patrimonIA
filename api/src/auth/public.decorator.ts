import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca un endpoint como accesible sin JWT (ej. login, RegistrarUsuario). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
