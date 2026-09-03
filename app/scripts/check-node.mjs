// Aborta con un mensaje claro si se corre con una versión de Node incompatible.
// Expo SDK 57 exige Node >= 22.12.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error(
    `\n  ✗ Node ${process.versions.node} no sirve para este proyecto (hace falta >= 22.12).\n` +
      `    En esta carpeta corre primero:  nvm use\n` +
      `    (o revisa que 'node -v' muestre v22.x antes de 'npm start')\n`,
  );
  process.exit(1);
}
