# The Lightsail box, for keeps (piece P6)

Decisions a later session should not re-derive. Each is reversible. This is S0b made permanent and
parameterised (`spike-512mb.md` holds what S0b ran and measured on a real 512 MB box).

> **NOT RUN ANYWHERE against a real box.** P6 was written in a sandbox that cannot reach AWS. Nothing in
> `ops/box/` or the paste-ready script has ever run on Ubuntu or touched an account. Section "Run here,
> never run anywhere" lists exactly what was exercised. Do not relay any command in this note as "works".

## Where things are

- **`ops/box/`, in the repo.** One folder of small steps run **on the box as root**, in order: `10-swap`, `20-node`, `30-account`, `40-unpack`, `50-env`, `60-service`, `80-admin`, `70-caddy`, `90-ssh`, then `verify`. `run-all.sh` runs them; `params.sh` is the only home of per-box values (every one a variable with a default, overridable by the environment); `gen-env.js` writes the secrets file; `selftest.sh` tests what needs no box. Reason for a folder of steps over one script: P7 and any later deploy re-run one step (`40-unpack` with a new tarball) without redoing the rest, and each step is idempotent. Reason for `ops/`: it is neither `cms/` (the app) nor `content/` (the seed).
- **The paste-ready script, outside git:** `/Users/hau/projects/freelance/v-robotic/one-off/20261109-0957-p6-box.sh`. It runs on the Mac with `aws`: creates key pair, instance, static address, firewall; uploads the artifact and the `ops/box` scripts; runs `run-all.sh` over ssh; reboots the box and re-verifies. It refuses (exit 2) before creating anything. `--selftest` runs its parsers.
- **Parameters** (all in `params.sh`): swap file and size, swappiness, Node major and dir, service name and user, app/data/env dirs, port, heap, locale, `DOMAIN`, `ACME_EMAIL`, `ADMIN_EMAIL`, tarball path, `DRY_RUN`. The one-off adds: instance name, region, zone, blueprint, bundle, static address name, ssh CIDR, run id or artifact file. Name, region and admin email are **required and never invented**.

## Decisions

- **Unpack, not install (closes open item 3).** The artifact is a finished 1.4 GB production tree with the Linux SQLite binary in place. An install of ~1,250 packages on a 512 MB box is the wrong place for that work, and S0b ran the unpacked tree. `plan.md` P6 row corrected.
- **The artifact is built by Actions and the box only serves (closes open item 2).** S0a builds and publishes only; putting the file on the box is the one-off's `scp`. `plan.md` S0a row corrected.
- **systemd, not pm2.** S0b measured under systemd; it ships with the box, restarts on crash (`Restart=always`) and starts at boot (`enable`); pm2 would add a Node process of its own on 512 MB. `architecture.md` said pm2; corrected.
- **The start command is lifted from S0b, not invented:** `ExecStart=<app>/node_modules/.bin/strapi start` with `Environment=PATH=<node>/bin:/usr/bin:/bin` and `NODE_OPTIONS=--max-old-space-size=320`. `node node_modules/.bin/strapi` crash-looped 132 times (the shim is a shell script). `selftest.sh` asserts the rendered unit never has `node` before the shim, so a rewrite cannot reintroduce it. The wrong line in `cms-build.md` is also fixed.
- **Swap: 2 GB file, swappiness 10, in `/etc/fstab` and `/etc/sysctl.d`.** S0b's result is "512 MB plus swap"; `verify.sh` fails without it.
- **Accounts and permissions.** A system account `strapi` (no login, shell `nologin`). The code is root-owned and read-only to it; the account owns only `/var/lib/strapi` (SQLite, mode 750), `public/uploads`, `.tmp`, `.cache`. Reason: a Strapi compromise cannot rewrite its own code. **Unverified:** whether Strapi writes anywhere else under the app folder; if the first start fails on a permission, `journalctl -u strapi` names the path and the fix is one more owned folder in `40-unpack.sh` (or `chown -R strapi` as the S0b layout had).
- **Strapi listens on 127.0.0.1 only; Caddy is the only way in.** Firewall: ssh from the human's address, 80 and 443 from anywhere, 1337 closed. S0b opened 1337 for measuring; keeps do not.
- **A static address is allocated and attached.** The sslip.io name is the address with dashes, and a Lightsail public address changes on stop/start unless static. Free while attached; a released-but-unattached one is billed.
- **Caddy from Caddy's own apt repository** (their install page), last in the order. Reason for last: until it runs, Strapi is localhost-only, which is when the first admin is registered, so there is no window where anyone on the internet can register. Certificate: Let's Encrypt, automatic, on the first visit. sslip.io is a shared free domain with public rate limits for certificates; one box, one certificate is fine, repeated delete-and-recreate may hit them (Caddy falls back to a second authority).
- **One code change in `cms/config/server.ts`:** `proxy: { koa: env.bool('PROXY', false) }` and `url: env('PUBLIC_URL', '')`. Behind Caddy Strapi must trust `X-Forwarded-Proto`, or the admin cookie is not marked secure over https (`ctx.request.secure` in Strapi's session code). Both default off, so P5's local use is unchanged. **The artifact must be built after this commit**; the one-off refuses an artifact whose `dist/config/server.js` lacks `PROXY`.
- **ssh: key only, no root login** (`sshd_config.d` drop-in, `sshd -t` before reload). Which addresses may connect is Lightsail's firewall, not `ufw` (one layer, not two to keep in step).
- **Reboot test inside the one-off.** The point of "for keeps" is surviving a reboot; the script reboots with `reboot-instance` and re-runs `verify.sh`.
- **Not in P6, on purpose:** the R2 media provider (needs the bucket, the key, and a package in the artifact: a CMS change for whoever creates the bucket); the client's accounts (the client's names; the first admin is the human's address and the client is added from inside the admin); seeding the catalogue (below); P7's webhook and nightly backup.

## Stand up in the morning, gone at night (the human's rule until the December launch)

- **Teardown script, outside git:** `/Users/hau/projects/freelance/v-robotic/one-off/20261109-0959-p6-teardown.sh` (NOT RUN ANYWHERE). `INSTANCE_NAME=<n> REGION=<r> bash <it>`. Deletes the instance with its add-ons, **releases the static address**, deletes the key pair, removes the local key folder; after each AWS deletion it asks Lightsail until the thing is not found; then lists anything in the region still named after the box and any snapshot from it. Exit 0 only if all verified gone. Names are required, never defaulted, so it cannot be pointed at the wrong box by habit.
- **Idempotent both ways.** Create refuses (exit 2, nothing touched) if the instance, key pair, static address or key folder already exists; teardown treats "already gone" as done, so it is safe on a half-made box and safe twice. The cycle is: create; test; teardown; create again. A create that stopped half way is cleared by the teardown, never by hand. Only a not-found answer counts as "gone"; any other error (sign-in expired, network) is "unknown" and teardown tries to delete anyway and says so.
- **What would still bill after a green teardown:** nothing the scripts make. Not touched: a snapshot taken by hand (listed as STILL BILLING, deleted only with `DELETE_SNAPSHOTS=1`), another static address left unattached, DNS or a domain, resources in another region. The create script makes no snapshot and no disk of its own.
- **Each new box has a new address**, so a new sslip.io name and a new certificate each day. Let's Encrypt limits certificates per name and per registered domain; a handful of boxes before December is expected to be fine, but sslip.io is shared by the world, so if issuance fails, `DOMAIN` can be a name on a domain the human owns.
- **Nothing is left running by P6:** no instance was created.

## Secrets on the box

- P5's `p5local*` keys, `admin@vrobotic.test` and `LocalAdmin#2026` are throwaway local values and **never reach the box.** Three guards: `gen-env.js` replaces any such value; `50-env.sh` refuses and deletes the file if one appears; `80-admin.sh` and the one-off refuse the throwaway email; `verify.sh` greps for them. The artifact holds no `.env` (`40-unpack` and the one-off both refuse one).
- **Where they live:** `/etc/strapi/strapi.env` (the six keys, plus host, port, database path), `root:root`, mode 600, read by systemd (as root) into the service. **The first admin's login** is `/etc/strapi/admin-login.txt`, `root:root`, mode 600, line 1 the email and line 2 the password. Nothing prints either, the one-off does not fetch them, and no report holds them.
- **How the human reads the admin login if they must:** the one-off prints, at its end, the exact command (`ssh -i <key> ubuntu@<address> sudo cat /etc/strapi/admin-login.txt`). That shows the password in their terminal, so it is their choice; the password should be changed at the first login. The `ENV_FILE` is never needed by hand.
- Keys are generated once and kept on re-run: rotating `ENCRYPTION_KEY` or `ADMIN_JWT_SECRET` would log everyone out or break encrypted fields.
- The box's ssh private key is made on the Mac in `<Downloads>/p6-box-<name>/key` (mode 600) and is the only copy.

## Seeding the real catalogue (not done here)

`content/scripts/strapi-bootstrap.mjs` and `import-seed.mjs` take a URL and a token and are reusable unchanged, but they write token files locally and bootstrap registers an admin with the throwaway email. Against the real box, run them through an ssh tunnel (`ssh -L 1337:127.0.0.1:1337`) with the real admin login in the environment, deliberately, by the human or a later piece. `CONTENT_SOURCE` stays `seed` until P7.

## Cost (as understood; the one-off prints the exact price it reads)

Plan `nano_3_0` (512 MB, 1 vCPU, ~20 GB SSD in S0b's measurement; IPv4): about **5 US dollars a month, which is about 17 US cents a day**, billed by the hour from creation until teardown is confirmed (a four-hour test is about 3 cents). Static address: free while attached. Caddy, Let's Encrypt, sslip.io: free. Outbound transfer is included in the plan. `plan.md` keeps the 1 GB fallback at 7 dollars.

## Run here, never run anywhere

**Run here (on a Mac, in the sandbox):** `bash -n` and `shellcheck -S warning` on every script; `ops/box/selftest.sh` (rendered unit, Caddyfile and env text; `gen-env.js` run for real: six secrets, mode 600, kept on re-run, throwaway replaced; refusals exit 2; `DRY_RUN=1 run-all.sh` prints every step); the one-off's `--selftest` and its first refusals (no name, aws not signed in, box scripts missing); the teardown's `--selftest`, its refusals, and a full green run against a stand-in `aws` that answers not-found; `pnpm check`. One command slipped past the rule: the refusal test ran the script, which called `aws sts get-caller-identity` once; it failed to authenticate (metadata endpoint blocked), created nothing and read nothing.

**Never run anywhere:** every step of `ops/box` on Ubuntu (swap, Node download, `useradd`, unpack, systemd unit, `systemctl`, Caddy apt install, `caddy validate`, sshd drop-in, `verify.sh`); the teardown against real AWS (its deletions, `release-static-ip`, the snapshot sweep); the whole one-off past its refusals (`import-key-pair`, `create-instances`, `allocate-static-ip`, `attach-static-ip`, `put-instance-public-ports`, `reboot-instance`, `scp`, the remote run); Caddy's certificate issuance; `strapi start` as user `strapi` under the permissions above; a build with the `PROXY` change on Actions. The swap, Node, unpack, secrets, unit and `register-admin` lines are lifted from S0b, which did run them as user `ubuntu`; what changed around them (account, permissions, env file, Caddy, ssh drop-in, static address) has not.

## Likeliest first-run failures, so the log is read in this order

1. `strapi` fails to start on a permission: see Accounts above.
2. Caddy apt install: repository URL or key changed (check Caddy's install page).
3. Certificate not issued: port 80/443 not open in the Lightsail firewall, or sslip.io rate limit.
4. `verify.sh` "Strapi listens on 127.0.0.1 only": `ss` output format; a check bug, not a box bug, if Strapi is up.
5. Upload slow: the artifact is ~280 MB; the ceiling is 25 minutes for upload and setup.
