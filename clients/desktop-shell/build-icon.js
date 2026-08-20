const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const buildDir = path.join(__dirname, 'build');
  const source = path.join(buildDir, 'icon.svg');
  const target = path.join(buildDir, 'icon.png');

  fs.mkdirSync(buildDir, { recursive: true });
  await sharp(source)
    .resize(1024, 1024)
    .png()
    .toFile(target);

  console.log(`Generated ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
