export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: { keys: env.array('APP_KEYS') },
  // Behind Caddy (P6) the box sets PROXY=true so Strapi trusts X-Forwarded-Proto and marks the admin
  // cookie secure, and PUBLIC_URL to the https address. Both default off: local and plain-http use is unchanged.
  proxy: { koa: env.bool('PROXY', false) },
  url: env('PUBLIC_URL', ''),
});
