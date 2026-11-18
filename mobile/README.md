# Tow for Android

Native Flutter client for the existing Tow household server. Requires Android 7+
(API 24), Google Play services, Flutter 3.47.9 / Dart 3.13.7, Java 17, and Android
SDK 36. The server remains the source of truth; changes require a connection.

## Direction contract

This is an Android adaptation of the existing Tow interface. Preserve its name,
logo, teal seed (`#005f6a`), household terminology, and three destinations. Material
3 supplies light/dark color roles, typography, controls, and interactions. Compact
layouts use a navigation bar; widths of 600 logical pixels and above use a rail.
Use native forms, date/time pickers, system Back, and accessible touch targets.
The primary action creates a chore. Loading, network failure, expired sessions,
and missing notification configuration remain visible and recoverable. Review
phone and expanded layouts, dark mode, and enlarged text using emulator captures;
synthetic household evidence does not establish live authentication or delivery.

## Configure and run

Use **`ravelo.carlos@gmail.com`** for Tow's Firebase/Google Cloud setup. Cloud
provisioning must use that account. Its gcloud and Drive authentication was
verified on 2026-11-17. Firebase project `chores-25a18` now has the Android app
registered, with the permanent release SHA-1/SHA-256 and native OAuth client.
Server credentials passed an FCM validation-only request, and a temporary emulator
probe received a real remote notification while backgrounded. Production rollout
and real-phone Google sign-in/remote delivery still need verification.

1. Create/select a Firebase project and register the Android application
   **`uk.dumbhome.tow`**. Download its `google-services.json` to
   `android/app/src/production/google-services.json` (gitignored). Enable the Firebase Cloud
   Messaging HTTP v1 API. Firebase Authentication and Firestore are not required.
2. Copy `config.example.json` to `config.json` (gitignored). Set
   `GOOGLE_SERVER_CLIENT_ID` to the **web** OAuth client ID already configured as
   `GOOGLE_CLIENT_ID` on the Tow server. Register an **Android OAuth client** in
   that web client's Google Cloud project for package `uk.dumbhome.tow` and your
   signing certificate's SHA-1. Register debug and release fingerprints separately.
   `cd android && ./gradlew signingReport` prints the debug signing fingerprints.
   Firebase and Google sign-in can use separate projects; the OAuth Android and
   web clients must belong to the same OAuth project.
3. Deploy the server changes in this repository. Keep `PUBLIC_ORIGIN`,
   `SESSION_SECRET`, and `ALLOWED_EMAILS` configured as before.
4. Run:

   ```sh
   flutter pub get --enforce-lockfile
   flutter run --dart-define-from-file=config.json
   ```

5. Sign in, open Settings, connect this phone, and allow notifications. Every
   family member signs in and connects their own phone. Test foreground,
   background, and closed-app delivery and sound on a real phone.

Without Firebase configuration, the app still builds and displays an honest
notification setup state. Without the OAuth client ID, sign-in reports that the
build needs configuration. Such builds are development artifacts, not usable
household releases. The default server URL is `https://todo.dumbhome.uk`.

## Server push setup

Create a service account with the Firebase Cloud Messaging API Admin role
(`roles/firebasecloudmessaging.admin`) in the target Firebase project. Mount its
JSON key read-only into the Tow container and set:

```dotenv
NOTIFICATION_PROVIDER=fcm
FCM_SERVICE_ACCOUNT_FILE=/run/secrets/tow-fcm.json
ENABLE_NOTIFICATIONS=true
```

The key stays on the server; never include it in the Android app, repository, or
build arguments. Back up SQLite before deploying migration `0010_mobile_devices`.
The server stores each installation's current token, supports multiple phones per
member, removes unregistered tokens, and rechecks the household allowlist for
mobile requests. Session tokens are stored in Android encrypted storage and expire
after 30 days; sign in again when prompted. Sign-out unregisters this installation
and invalidates its FCM token. Network errors during unregister keep the account
signed in so it can retry rather than silently leaving reminders connected.

Browser cookie sessions retain same-origin protection. Native sessions have a
separate audience and use explicit Bearer authentication over HTTPS. Mobile login
exchanges a Google ID token for a native session and never uses an embedded webview.

Register family phones before switching providers, or keep notifications disabled
while doing so. Existing sent delivery slots are not replayed on the provider
switch. The scheduler still owns recurrence and personal quiet hours. The outbox
is at least once: partial multi-phone failure may retry a message already accepted
by another phone. No Pushover fallback is used when `NOTIFICATION_PROVIDER=fcm`.

Reminders use Android's `tow_reminders_v1` high-importance channel with default
sound and vibration. Android permission, channel settings, Do Not Disturb, and
manufacturer restrictions still govern presentation. The in-app test bypasses Tow
quiet hours, is limited to one attempt per member per 30 seconds, and confirms
provider acceptance rather than actual phone receipt.

## Local release setup

The permanent signing keystore is at
`~/.local/share/tow/signing/tow-release.jks`; its passwords and alias are in the
ignored `android/key.properties`. Keep a secure backup of both. The release
certificate SHA-1 is `062D3A02428937C3529129A6BD1538533C444986`.
Do not replace this key when making future updates. The demo keeps its separate
debug certificate even when production signing is configured.

The server-only FCM key is stored locally at
`~/.local/share/tow/server/fcm-service-account.json` and in the infrastructure
repository's ignored secrets file as `TOW_FCM_SERVICE_ACCOUNT_JSON`. Its dedicated
service account `tow-fcm@chores-25a18.iam.gserviceaccount.com` has only the FCM API
Admin role. Kubernetes mounts the sealed secret read-only into Tow. Neither the
private server key nor the signing key belongs in an APK or Git.

## Builds and signing

```sh
flutter analyze
flutter test
flutter build apk --debug --dart-define-from-file=config.json
```

For household distribution, create a durable signing keystore and an ignored
`android/key.properties`:

```properties
storeFile=/absolute/path/to/tow-release.jks
storePassword=YOUR_PASSWORD
keyAlias=tow
keyPassword=YOUR_PASSWORD
```

Register this certificate's SHA-1 with Google before building a signed APK:

```sh
flutter build apk --release --dart-define-from-file=config.json
```

Back up the keystore securely; future updates must use the same key. Production release builds
without `key.properties` are unsigned. CI analyzes, tests, and compiles an
unconfigured debug APK without production secrets. `flutter_local_notifications`
is constrained to 22.x for SDK 36 compatibility; 23.x requires SDK 37.
The FCM client uses registration-token APIs for the server's HTTP v1 transport;
Firebase Messaging 17's newer FID transport is intentionally not mixed into it.

## Phone demo

The default flavor is `production`. The separate `demo` flavor installs as
**Tow Demo** (`uk.dumbhome.tow.demo`) alongside the production app. Build it with:

```sh
flutter build apk --release --flavor demo --target test_driver/preview.dart
```

The output is `build/app/outputs/flutter-apk/app-demo-release.apk`. The demo
uses the local debug signing certificate for direct installation and does not
require `config.json`, Google login, or Firebase. It is not a Play release.
Download the APK on Android, open it, and allow installation from the downloading
app if Android prompts. In Settings, tap **Connect this phone**, grant notification
permission, then **Send test notification** to check a real local notification.

Chores can be added, edited, claimed/released, completed/skipped, undone, and
deleted. Settings persist in memory. Restarting the app or signing out resets
the sample household. Recurrence and quiet hours can be edited but no scheduler
runs in this demo. Family sync and remote FCM delivery are not connected.

## Visual QA

`flutter run --flavor demo -t test_driver/preview.dart` opens an explicitly synthetic household
for emulator layout inspection. It uses the same production widgets and an
in-memory HTTP fixture; it does not connect to the live server and is never
imported by the production entrypoint. Use normal and dark themes, 1.3 font scale,
and phone/tablet widths. Core widget tests cover navigation, search, and Pool
claiming; model tests cover household timezone boundaries.

References: [Flutter Android deployment](https://docs.flutter.dev/deployment/android),
[Google sign-in Android setup](https://pub.dev/packages/google_sign_in_android),
[FCM Flutter setup](https://firebase.google.com/docs/cloud-messaging/flutter/get-started),
[FCM HTTP v1 authorization](https://firebase.google.com/docs/cloud-messaging/auth-server).
