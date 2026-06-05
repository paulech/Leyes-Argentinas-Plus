const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const manifestPath = path.join(__dirname, 'manifest.json');

// 1. Leer y parsear manifest.json
if (!fs.existsSync(manifestPath)) {
  console.error('Error: No se encontró manifest.json en el directorio actual.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const oldVersion = manifest.version;

// 2. Determinar incremento de versión (por defecto incrementa patch)
const parts = oldVersion.split('.').map(Number);
if (parts.length !== 3 || parts.some(isNaN)) {
  console.error(`Error: Formato de versión inválido en manifest.json: "${oldVersion}". Debe ser X.Y.Z`);
  process.exit(1);
}

// Analizar argumentos de consola
const args = process.argv.slice(2);
if (args.includes('--major')) {
  parts[0] += 1;
  parts[1] = 0;
  parts[2] = 0;
} else if (args.includes('--minor')) {
  parts[1] += 1;
  parts[2] = 0;
} else {
  // Parche por defecto
  parts[2] += 1;
}

const newVersion = parts.join('.');
manifest.version = newVersion;

// 3. Escribir nueva versión en manifest.json
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`\n==================================================`);
console.log(`   Leyes-Plus Argentina — Release Automation`);
console.log(`==================================================`);
console.log(`✔ Versión actualizada: v${oldVersion} ➔ v${newVersion}`);

// 4. Crear carpeta de releases si no existe
const releasesDir = path.join(__dirname, 'releases');
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir);
  console.log(`✔ Creado directorio de releases: /releases`);
}

// 5. Empaquetar a ZIP usando PowerShell (sin dependencias npm)
const zipName = `leyes-plus-argentina-v${newVersion}.zip`;
const zipPath = path.join(releasesDir, zipName);

console.log(`\nEmpaquetando archivos de producción...`);
console.log(`- Incluyendo: manifest.json, src/, icons/, libs/`);
console.log(`- Excluyendo: herramientas de desarrollo, documentación, releases/`);

try {
  // Comando PowerShell nativo para comprimir
  const psCommand = `powershell -Command "Compress-Archive -Path manifest.json, icons, libs, src -DestinationPath '${zipPath}' -Force"`;
  execSync(psCommand, { stdio: 'inherit' });
  
  console.log(`\n✔ ¡Empaquetado completado con éxito!`);
  console.log(`📦 Archivo creado: releases/${zipName}`);
  console.log(`==================================================\n`);
  console.log(`Listo para subir a la Chrome Web Store Developer Dashboard.`);
  console.log(`Ficha de descripción y política en: webstore/`);
} catch (error) {
  console.error('\n✖ Error al empaquetar el archivo ZIP:', error.message);
  // Revertir cambio de versión en manifest en caso de fallo
  manifest.version = oldVersion;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Revertida versión de manifest.json a v${oldVersion}`);
  process.exit(1);
}
