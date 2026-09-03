// Aborta con un mensaje claro si se corre con una versión de Node incompatible.
// El toolchain (NestJS 12, Prisma 7) exige Node >= 22.12 — con Node 20 el proceso
// arranca y muere sin dejar nada escuchando, que es difícil de diagnosticar.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(
    `\n  ✗ Node ${process.versions.node} no sirve para este proyecto (hace falta >= 22.12).\n` +
      `    En esta carpeta corre primero:  nvm use\n` +
      `    (o revisa que 'node -v' muestre v22.x antes de 'npm run ...')\n`,
  );
  process.exit(1);
}
