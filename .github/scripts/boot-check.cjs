// Loads Strapi from the packaged tree (dist only, no TypeScript sources) and runs one query,
// without opening a port. Proves the native SQLite driver loads and the app boots.
// Run from the package root, with the secrets set in the environment.
const fs = require('fs');
const root = process.cwd();
const { createStrapi } = require(root + '/node_modules/@strapi/strapi');

(async () => {
  const app = await createStrapi({ appDir: root, distDir: root + '/dist' }).load();
  const rows = await app.db.connection.raw('select 1 as ok');
  if (rows[0].ok !== 1) throw new Error('unexpected query result');
  if (!fs.existsSync(root + '/dist/build/index.html')) throw new Error('admin build missing');
  console.log('boot-check ok: app loaded, SQLite answered, admin build present');
  await app.destroy();
  process.exit(0);
})().catch((e) => {
  console.error('boot-check FAILED', e);
  process.exit(1);
});
