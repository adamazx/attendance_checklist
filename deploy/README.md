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

1. `cp deploy/.env.production.example deploy/.env.production && chmod 600 deploy/.env.production`, then fill in the values (`openssl rand -hex 24` for the Postgres password, `openssl rand -hex 32` for `PAYLOAD_SECRET`).
2. `sudo mkdir -p /var/log/caddy`
3. `$C build`
4. `$C run --rm -T migrate`
5. `$C up -d`
6. `curl -fsS http://127.0.0.1:3000/api/health` → `{"status":"ok"}`, then open `https://$APP_DOMAIN/admin` and create the first admin.

## Routine deploy

```sh
git pull --ff-only
$C exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > ~/backups/pre-deploy-$(date +%F-%H%M).dump
docker tag mtyk-app:latest mtyk-app:prev      # keep the running image for rollback
$C build
$C run --rm -T migrate
$C up -d
curl -fsS http://127.0.0.1:3000/api/health
```

### Rollback

```sh
docker tag mtyk-app:prev mtyk-app:latest
$C up -d --no-build app
```

If the deploy being rolled back **ran a migration**, the old image may not match the new schema. In that case, also restore the `pg_dump` taken just before that deploy.

## Staging

Use the same stack with a test `APP_DOMAIN` (e.g. a `staging.` subdomain), an empty DB and **fake** data only. Turn on the Caddyfile's commented `acme_ca` (Let's Encrypt staging) line for trial runs. To go live:

1. `$C down -v` (wipes the DB, photos and test certs)
2. Set the real `APP_DOMAIN` and comment out `acme_ca` again.
3. `$C build` (the URL is baked in at build time), then `run --rm -T migrate`, then `up -d`.

## Notes

- Docker does **not** restart an *unhealthy* container by itself. The healthcheck feeds `docker ps` and monitoring. The app recovers by itself when Postgres comes back (no restart needed).
- The build fetches the Sarabun web font from Google Fonts, so it needs outbound HTTPS. Self-hosting that font is a follow-up.
- Never set any `S3_*` variable: photos live on the `media` volume.
- Raise the HSTS `max-age` in the Caddyfile to one year after go-live.
