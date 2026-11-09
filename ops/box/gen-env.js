// ops/box/gen-env.js <env-file> <params-file>
// Writes the box's environment file: the params file's lines, then the six Strapi secrets.
// An existing file's secrets are kept (rotating them would break sessions and encrypted fields);
// missing ones are generated here with crypto.randomBytes. Nothing is printed except a count.
// NOT RUN ANYWHERE against a real box. Its logic is exercised by selftest.sh on a Mac.
const fs = require('fs');
const crypto = require('crypto');
const [envFile, paramsFile] = process.argv.slice(2);
if (!envFile || !paramsFile) { console.error('usage: gen-env.js <env-file> <params-file>'); process.exit(2); }
const SECRETS = ['APP_KEYS', 'API_TOKEN_SALT', 'ADMIN_JWT_SECRET', 'TRANSFER_TOKEN_SALT', 'JWT_SECRET', 'ENCRYPTION_KEY'];
const r = () => crypto.randomBytes(24).toString('base64');
const parse = (t) => Object.fromEntries(t.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const old = fs.existsSync(envFile) ? parse(fs.readFileSync(envFile, 'utf8')) : {};
const params = fs.readFileSync(paramsFile, 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l));
const lines = [...params];
let kept = 0, made = 0;
for (const k of SECRETS) {
  let v = old[k];
  if (v && !/p5local|replace/.test(v)) kept++;
  else { v = k === 'APP_KEYS' ? [r(), r(), r(), r()].join(',') : r(); made++; }
  lines.push(`${k}=${v}`);
}
const tmp = envFile + '.tmp';
fs.writeFileSync(tmp, lines.join('\n') + '\n', { mode: 0o600 });
fs.chmodSync(tmp, 0o600);
fs.renameSync(tmp, envFile);
console.log(`env file written: ${SECRETS.length} secrets (${kept} kept, ${made} generated); none printed`);
