# Tow

Tow is a household chore app for steady recurring chore management.

## Features

- Add, edit, and delete chores
- Mark chores as complete
- User authentication
- Assigned Chore Push Notifications through Gotify

## Project Structure

The project is built with Astro and Deno. It uses Google Sign-In for
authentication, SQLite through `node:sqlite` for data storage, and an in-process
scheduler for assigned Chore Nags.

## Installation

To get started with the project, clone the repository and install the
dependencies:

```bash
git clone https://github.com/gandazgul/chores-app.git
cd chores-app
deno install
```

## Usage

### Running the development server:

```bash
deno task dev
```

This will start the development server. Open
[http://localhost:8080](http://localhost:8080) (or the port specified in your
console) to view it in the browser.

### Building for production:

```bash
deno task build
```

This command builds the app for production to the `dist` folder. It correctly
bundles the application in production mode and optimizes the build for the best
performance. The build is minified, and the filenames include hashes. Your app
is ready to be deployed!

### Running the container locally:

Build and run with Podman:

```bash
podman build -f Containerfile -t tow .
podman volume create tow-data
podman run --rm -p 8080:8080 --env-file .env -v tow-data:/data tow
```

The image uses Deno 2.9.7 and includes its runtime dependencies. Startup uses
`--cached-only --frozen`; it never installs packages. SQLite lives at
`/data/chores.db` in the container (`DB_PATH` overrides the path). Mount the
whole directory so SQLite journals persist beside the database. Without a
container, `DB_ENV` selects the legacy development/test/production filename.

## Production deployment

The deployment at `https://todo.dumbhome.uk` is defined in the neighboring
`k8s-infrastructure` repository: `apps/Tow.yaml` and
`apps/generic/overlays/tow/`, registered for the `gandazgul` cluster. It uses
YASR `configs/tow`, port 8080, one replica, and `Recreate` updates because the
scheduler and SQLite assume one app process. `/healthz` checks database access
and becomes reachable only after startup migrations and scheduler setup.

Required configuration:

- `PUBLIC_ORIGIN=https://todo.dumbhome.uk`
- `ENABLE_AUTH=true`, `COOKIE_SECURE=true`
- `GOOGLE_CLIENT_ID`, a stable random `SESSION_SECRET`, and `ALLOWED_EMAILS`
- `HOUSEHOLD_TZ`, `GOTIFY_URL=https://notify.dumbhome.uk`

Set the Google OAuth web client's Authorized JavaScript origins to include
`https://todo.dumbhome.uk`. Sign-in uses a popup and posts the credential to
`/api/auth/login`; there is no OAuth redirect callback route. Each household
account must be explicitly allowlisted and each member adds their own Gotify
application token in Settings. Google client secrets are not used by Tow.

`PUBLIC_ORIGIN` is authoritative for every unsafe request, including forms and
JSON. The app ignores forwarded headers for CSRF decisions. Astro's narrower
form-only origin check is replaced by this middleware so TLS termination at
ingress works without trusting arbitrary proxy headers. Direct development uses
the request origin when `PUBLIC_ORIGIN` is unset.

The cluster's shared SealedSecret holds `TOW_GOOGLE_CLIENT_ID`,
`TOW_SESSION_SECRET`, and `TOW_ALLOWED_EMAILS`. Raw values belong only in the
ignored `clusters/gandazgul/secrets.env`; regenerate using the infrastructure
repository's `configure-cluster.sh` workflow.

### Backups and recovery

The `tow-backup` CronJob creates a consistent SQLite snapshot at 04:00 in the
household timezone, on the backup volume under `apps/tow`. Successful backups
retain 30 days. Run a manual backup before each migration-bearing release:

```bash
kubectl create job --from=cronjob/tow-backup tow-backup-before-release
kubectl wait --for=condition=complete job/tow-backup-before-release --timeout=120s
```

The image also exposes
`deno run -A --cached-only scripts/backup_db.ts DESTINATION`. It uses SQLite
`VACUUM INTO`, not a copy of a live database. Protect backups as secrets because
they include members' Gotify tokens.

To restore: stop Tow (scale to zero and temporarily suspend its Flux
Kustomization if GitOps is active), save the current data directory, replace
`chores.db` with a verified snapshot while no writer is running, and restore
ownership to UID/GID 1993. Do not reuse journal/WAL files from another database.
Start an image compatible with that snapshot, verify `/healthz` and household
data, then resume Flux. Migrations are forward-only; rolling an image back does
not roll the schema back.

### Release checks

```bash
deno task ci
E2E_PORT=18080 deno task test:e2e
DOCKER_CLI=podman deno task test:production-lifecycle
```

Browser tests use a separate database and never reuse an existing server. The
container lifecycle test covers fresh and legacy migrations, a read-only root
filesystem, HTTPS-origin form/JSON requests, backup restoration, scheduler
recovery, disabled notifications, and refusal to serve an incompatible schema.
GitHub Actions runs these checks before publishing immutable SHA-tagged images
to GHCR. Pin deployment images by digest; the homelab also supports Harbor.

Before household use, verify Google sign-in, create/assign/complete/skip a
chore, receive a real Gotify notification, and confirm persistence after a pod
restart.

## Notifications

Tow sends assigned Chore Nags through Gotify. Configure `GOTIFY_URL` and each
Member's Gotify Application Token. Set `ENABLE_NOTIFICATIONS=false` to stop the
scheduler, Delivery Slot creation, and sends. Each Member can enable or disable
personal Quiet Hours and choose start/end times in Notification Settings. Times
use `HOUSEHOLD_TZ`. Until a Member saves a preference, `QUIET_HOURS_START` and
`QUIET_HOURS_END` supply the defaults (`21:00`-`08:00`, in `HH:MM` format).
Changes apply to unsent reminders on the next scheduler check, including Pool
Blasts and retries; sent reminders are never replayed by a settings change.
Quiet Hours postpone delivery rather than muting a notification's sound.
Delivery is at least once, so a crash after Gotify accepts a message can create
one duplicate external message.

## Contributing

We welcome contributions to Tow. If you'd like to contribute, please follow
these guidelines:

### Reporting Bugs

- Check the existing issues to see if the bug has already been reported.
- If not, open a new issue. Be sure to include a clear title, a detailed
  description of the bug, steps to reproduce it, and any relevant screenshots.

### Suggesting Enhancements

- Open a new issue to discuss your enhancement idea.
- Provide a clear title and a detailed description of the proposed enhancement
  and its benefits.

### Submitting Pull Requests

1. Fork the repository.
2. Create a new branch for your feature or bug fix:
   `git checkout -b feature/your-feature-name` or
   `git checkout -b fix/your-bug-fix-name`.
3. Make your changes and commit them with a clear and descriptive commit
   message.
4. Push your changes to your forked repository:
   `git push origin feature/your-feature-name`.
5. Open a pull request to the `main` branch of the original repository.
6. Ensure your PR description clearly explains the changes and why they are
   needed.
7. Link any relevant issues in your PR description.

## Acknowledgments

This project was created with help from
[opencode](https://github.com/opencodeco/opencode) and Gemini.

## License

This project is licensed under the terms of the MIT [LICENSE](LICENSE).
