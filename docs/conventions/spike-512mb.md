# The 512 MB spike (piece S0b)

Decisions and commands a later session should not re-derive; P6 lifts the commands. Each decision is
reversible. The numbers are not in this note yet: the script below measures them, and the orchestrator
records them where the plan keeps its decisions.

**Pass mark (plan decisions table, `docs/plan.md#L229`):** admin loads in under 3 seconds, a save
completes in under 2 seconds, no out-of-memory restart in 10 minutes. Miss it and the 1 GB plan is
the fallback, which is the human's spend: the script never resizes anything.

## How it runs

One script, run by the human in their own terminal (a Claude session's sandbox cannot use `aws`):
`/Users/hau/projects/freelance/v-robotic/one-off/20261108-1405-s0b-spike.sh`, kept outside git. It
needs `INSTANCE_NAME` and `REGION` and refuses without them. It prints the plan, the price and a
15-second Ctrl-C window before creating anything, and prints the delete commands every time it ends.

## What is measured, and how

| Number | Method | Where |
|---|---|---|
| Save under 2 s | A real admin login, then a `PUT` of a Product (summary plus a 2 KB description) through the admin's own content-manager API, about every 10 s for 10 minutes; `curl`'s total time per call. Every save must be under 2000 ms. | On the box, to `127.0.0.1:1337`, so it is Strapi's time without the network |
| No out-of-memory restart | A 10-second sample of the service's process id, restart count (`NRestarts`), resident memory, the service cgroup's memory, free memory and swap used; at the end the kernel log is searched for out-of-memory lines. A changed process id or a restart count above zero fails. | On the box, systemd `Restart=always` so a restart is visible, not hidden |
| Admin under 3 s | By eye in Chrome: Network tab, cache disabled, hard reload, read the "Load" figure. The script also times the admin page and its script/style files fetched one after another from the Mac, labelled a hint only. | The human's browser, public address |

The 10 minutes are the script's own saves, lists and admin page fetches **plus the human using the
admin by hand** during the same window, so the memory figure covers what the client will do. The two
minutes before are a quiet window for the cold admin load. Samples go to `logs/<stem>-samples.csv`
and every call time to `logs/<stem>-times.csv`.

## Decisions

- **Instance size: the cheapest 512 MB IPv4 Linux plan, looked up by the script** (`get-bundles`, memory 0.5 GB, no IPv6-only plans), and it refuses any other memory size. Reason: the spike is only valid on the plan the client would pay for.
- **Image: Ubuntu 24.04 (`ubuntu_24_04`).** Reason: current LTS, matches the box P6 will stand up. Overridable with `BLUEPRINT`.
- **Name and region are never invented**: required environment variables. Reason: they start billing in a place the human chose.
- **A key pair made on the Mac and imported (`ssh-keygen -t rsa -b 4096`, `import-key-pair`)**, not Lightsail's default key. Reason: the private key never passes through `aws` output. It is RSA because `ImportKeyPair` rejected an ed25519 key ("format of this public key is not valid"); the script checks the `.pub` starts with `ssh-rsa ` and retries once with the key passed as plain text.
- **Firewall: ports 22 and 1337 open to the Mac's current public address only** (`put-instance-public-ports`, address read from `checkip.amazonaws.com`). Reason: a test box with an admin login should not face the internet. If the Mac's address changes mid-run, ssh stops and the run fails red; rerun on a new name.
- **Swap: a 2 GB file, `vm.swappiness=10`, persisted in `/etc/fstab` and `/etc/sysctl.d`.** Reason: the plan says 2 GB of swap. **This changes what the result means**: memory pressure is absorbed by swap, so "no out-of-memory restart" is with swap on, and the number to read beside it is "most swap used". The script reports it.
- **Node heap cap: `--max-old-space-size=320` (override `HEAP_MB`).** Reason: the plan says "a capped heap"; 320 MB leaves about 100 MB for native memory (SQLite, sharp) and the system on a box with roughly 450 MB usable. This is a guess to be tuned by the numbers.
- **Node 24 from the nodejs.org tarball into `/opt/node`, checked against the published sha256**, not an apt repository. Reason: one download, no repository key to trust, same major as `.nvmrc`.
- **Layout: app in `/opt/strapi/app`, database in `/var/lib/strapi/data.db` (absolute `DATABASE_FILENAME`), service `strapi` under systemd.** Reason: the architecture keeps the database outside the deploy directory; the absolute path is respected (`docs/conventions/cms-build.md#L16`).
- **Secrets: generated on the box by `node -e` with `crypto.randomBytes`, written to `.env` mode 600, never printed**; the six keys are counted, not shown. The scaffold's own one-line generator (`docs/conventions/scaffold.md#L10`) is the same call.
- **The throwaway admin is registered by the script** (`POST /admin/register-admin`), with a random password written on the box and copied to `<DOWNLOAD_ROOT>/s0b-spike-<name>/admin-login.txt` (mode 600) for the human's browser login. Reason: the save timing needs a logged-in session. It is never printed or logged.
- **Admin load time is the human's figure from Chrome, not the script's.** Reason: no browser starts in any Claude session and a `curl` does not run the admin's code.
- **No resize, no delete by the script.** Reason: a resize is a spend and a delete is irreversible; both are the human's.

## The commands, in order (what the script runs; P6 lifts these)

From the Mac:

```
aws lightsail get-bundles --region R --query '<0.5 GB, LINUX_UNIX, not ipv6, cheapest>'
aws lightsail import-key-pair --region R --key-pair-name N-key --public-key-base64 <base64 of key.pub>
aws lightsail create-instances --region R --availability-zone Ra --instance-names N --blueprint-id ubuntu_24_04 --bundle-id <512 MB bundle> --key-pair-name N-key --ip-address-type ipv4
aws lightsail get-instance --region R --instance-name N          (poll until running and an address)
aws lightsail put-instance-public-ports --region R --instance-name N --port-infos fromPort=22,toPort=22,protocol=tcp,cidrs=<my ip>/32 fromPort=1337,toPort=1337,protocol=tcp,cidrs=<my ip>/32
gh run download 42456551046 --repo ancJ29/v-robotic --name cms-linux-x64 --dir <dir>
scp <cms-da22ac2-linux-x64.tar.gz> ubuntu@IP:/home/ubuntu/cms.tar.gz
```

On the box (`setup.sh`, embedded in the one-off script):

```
sudo fallocate -l 2G /swapfile; sudo chmod 600 /swapfile; sudo mkswap /swapfile; sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf; sudo sysctl -p /etc/sysctl.d/99-swappiness.conf
curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt; download node-v24.*-linux-x64.tar.xz; sha256sum -c; sudo tar -xJf ... -C /opt/node --strip-components=1
tar -xzf cms.tar.gz -C /opt/strapi/app
node -e '<generate six secrets into .env from .env.example, add DATABASE_FILENAME=/var/lib/strapi/data.db>'
systemd unit: User=ubuntu, WorkingDirectory=/opt/strapi/app, NODE_ENV=production,
  NODE_OPTIONS=--max-old-space-size=320, ExecStart=/opt/node/bin/node node_modules/.bin/strapi start,
  Restart=always, RestartSec=2, MemoryAccounting=yes
sudo systemctl daemon-reload; sudo systemctl enable --now strapi
curl http://127.0.0.1:1337/_health        (204 when ready)
curl -X POST http://127.0.0.1:1337/admin/register-admin   (first admin; body from a mode-600 file)
```

Measuring (`measure.sh`): `POST /admin/login`, then `POST` and repeated `PUT` on
`/content-manager/collection-types/api::product.product[/documentId]` with a Bearer token, timed with
`curl -w '%{http_code} %{time_total}'`.

## Things to know, unverified until the first run

- **Lightsail's plan names and prices change**; the script reads them rather than assuming. The price it prints is the one to quote.
- **Admin over plain http**: Strapi in production may refuse to set its session cookie over http, which would show as a login that does not stick in the browser. The script's own timing is unaffected (it uses the login token, not the cookie). If it happens, the fix is a tunnel (`ssh -L 1337:127.0.0.1:1337`) and a browser on `localhost`, or the Caddy front P6 plans; record which in the result.
- **The product's `locale`**: the saves use the default locale (Vietnamese, from `STRAPI_PLUGIN_I18N_INIT_LOCALE_CODE` in `.env.example`). A required-field or locale rejection shows as a failed create, with the first 300 characters of the reply in the log.
- **Not tested here**: the script could only be checked for syntax and its refusals in the sandbox. Nothing past the refusals has run.
- **The number is a floor**: bare Strapi, no R2 provider, no sharp work, no live content (`docs/plan.md#L110`). It was taken before the client's real catalogue existed, with one test product and an empty database, so a full catalogue, image processing and the R2 provider will use more memory and time than any figure here. P6 and later readers should treat a pass as "bare Strapi fits", not "the live site fits".
