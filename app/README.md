# PatrimonIA — App

Cliente móvil. React Native + Expo (SDK 57, TypeScript).

## Puesta en marcha

```bash
npm install
npm start          # abre Expo — escanear QR con Expo Go, o pulsar 'a' / 'i'
npm run android    # emulador Android
npm run ios        # simulador iOS (requiere macOS)
```

## Estado

- Fase 0 — proyecto inicializado. `App.tsx` es una pantalla en blanco (solo el
  nombre). Sin lógica de negocio. Verificado: `tsc --noEmit` limpio,
  `expo-doctor` 21/21, `expo export` (android) empaqueta sin errores.
- Fase 1 — pantallas del Flujo 2 (Registro, Bienvenida/Elegir camino, Crear
  Hogar, Ingresar código / ver invitaciones). Ver `Docs/UX_FLOWS.docx`.

## Backend

La API corre en `../api` (`http://localhost:3000`). Healthcheck: `GET /health`.
