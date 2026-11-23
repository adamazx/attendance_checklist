# Production deploy (Docker on the VPS)

The app is built **on the VPS** (no registry) and runs as a small Compose stack.
Server setup (users, firewall, Docker, fail2ban, backups) belongs to the separate
VPS runbook. This file covers only what lives in this repo.

## Files

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage build. Target `runner` = the app (Next standalone, non-root `node`). Target `migrate` = one-off `pnpm payload migrate`. |
| `.dockerignore` | Keeps secrets, `media/`, `docs/`, student data exports (`*.xls*`, `*.csv`) and `node_modules` out of the build context. |
| `docker-compose.prod.yml` | Project `mtyk`: `postgres` (no ports), `app` (127.0.0.1:3000 only), `migrate` (profile `migrate`), `caddy` (host network, 80/443). |
| `deploy/Caddyfile` | TLS, security headers, 15 MB body limit, JSON access log → `/var/log/caddy/access.log`. |
| `deploy/.env.production.example` | Template for the real `deploy/.env.production` (gitignored, `chmod 600`). |
| `deploy/fail2ban/` | **Example** filter + jail for failed logins (installed on the host by the runbook). |

## Host vs repo

- **Repo:** everything above.
- **Host only:** `deploy/.env.production`, `/var/log/caddy/`, fail2ban config in `/etc/fail2ban/`, the backup script and its cron, and the Docker volumes `mtyk_pgdata`, `mtyk_media` (student photos), `mtyk_caddy_data` (certificates) and `mtyk_caddy_config`.

All commands below use:

```sh
C="docker compose -f docker-compose.prod.yml --env-file deploy/.env.production"
```

## First deploy

> **Always build with `$C --profile migrate build`.** `migrate` sits behind a profile, so a plain `$C build` skips it. `run` only builds an image that doesn't exist yet. Without the profile, every deploy after the first would run the *old* migrate image, which has the old migrations.

1. `cp deploy/.env.production.example deploy/.env.production && chmod 600 deploy/.env.production`, then fill in the values (`openssl rand -hex 24` for the Postgres password, `openssl rand -hex 32` for `PAYLOAD_SECRET`).
2. `sudo mkdir -p /var/log/caddy`
3. `$C --profile migrate build`
4. `$C run --rm -T migrate`
5. `$C up -d postgres app` — **not Caddy yet.**
6. `curl -fsS http://127.0.0.1:3000/api/health` → `{"status":"ok"}`
7. Create the first admin **on the VPS, through loopback** (see below).
8. `$C up -d` — starts Caddy, and the site goes public.

> ⚠️ Payload's first-register makes **whoever arrives first** the admin. The domain becomes public via Certificate Transparency logs as soon as Caddy requests a certificate. So create the admin over `127.0.0.1:3000` *before* Caddy ever starts.

### First admin (loopback only)

The password is read from a prompt, so it is not saved in shell history or shown in the process list (`printf` and `read` are shell builtins). Avoid `"` and `\` in these values; they are not JSON-escaped.

```sh
ADMIN_EMAIL='admin@example.ac.th'        # placeholder
ADMIN_NAME='ชื่อ นามสกุล'                  # placeholder (fullName)
read -rs -p 'Admin password: ' ADMIN_PW; echo
printf '{"email":"%s","password":"%s","confirmPassword":"%s","fullName":"%s","role":"admin"}' \
  "$ADMIN_EMAIL" "$ADMIN_PW" "$ADMIN_PW" "$ADMIN_NAME" \
  | curl -fsS -o /dev/null -w 'first-register: %{http_code}\n' \
      -H 'Content-Type: application/json' --data-binary @- \
      http://127.0.0.1:3000/api/users/first-register
unset ADMIN_PW
```

Expect `first-register: 200`. Once a user exists, first-register refuses any further request.

## Routine deploy

```sh
git pull --ff-only
# The dump holds real student data: owner-only permissions; delete/rotate it per the backup policy.
umask 077 && mkdir -p ~/backups && chmod 700 ~/backups
$C exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > ~/backups/pre-deploy-$(date +%F-%H%M).dump
docker tag mtyk-app:latest mtyk-app:prev      # keep the running image for rollback
$C --profile migrate build                    # app AND migrate (see the note above)
$C run --rm -T migrate
$C up -d
curl -fsS http://127.0.0.1:3000/api/health
```

The pre-deploy dump is a full copy of student data. Don't leave it around: delete it once the deploy is confirmed good, or let the host backup rotation remove it.

### Rollback

```sh
docker tag mtyk-app:prev mtyk-app:latest
$C up -d --no-build app
```

If the deploy being rolled back **ran a migration**, the old image may not match the new schema. In that case, also restore the `pg_dump` taken just before that deploy.

## Staging

Use the same stack with a test `APP_DOMAIN` (e.g. a `staging.` subdomain), an empty DB and **fake** data only. Turn on the Caddyfile's commented `acme_ca` (Let's Encrypt staging) line for trial runs. To go live:

For staging too, follow the first-deploy order: create the admin over loopback before Caddy starts. To go live:

1. `$C down -v` (wipes the DB, photos and test certs)
2. Set the real `APP_DOMAIN` and comment out `acme_ca` again.
3. `$C --profile migrate build` (the URL is baked in at build time), then `run --rm -T migrate`, then `up -d postgres app`.
4. Create the first admin over loopback, as above. Only then run `$C up -d` (Caddy).

## Notes

- Docker does **not** restart an *unhealthy* container by itself. The healthcheck feeds `docker ps` and monitoring. The app recovers by itself when Postgres comes back (no restart needed).
- The build fetches the Sarabun web font from Google Fonts, so it needs outbound HTTPS. Self-hosting that font is a follow-up.
- Never set any `S3_*` variable: photos live on the `media` volume.
- Raise the HSTS `max-age` in the Caddyfile to one year after go-live.
