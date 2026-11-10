import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:timezone/data/latest.dart' as tz;

import 'data/api.dart';
import 'data/household.dart';
import 'services/notifications.dart';
import 'ui/home.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  tz.initializeTimeZones();
  runApp(const TowApp());
}

class TowApp extends StatefulWidget {
  const TowApp({super.key});
  @override
  State<TowApp> createState() => _TowAppState();
}

class _TowAppState extends State<TowApp> {
  final storage = const FlutterSecureStorage();
  final api = TowApi(
    const String.fromEnvironment(
      'TOW_API_URL',
      defaultValue: 'https://todo.dumbhome.uk',
    ),
  );
  late final notifications = TowNotifications(api, storage);
  Household? household;
  bool starting = true, signingIn = false;
  String? error;
  Future<void>? googleReady;
  @override
  void initState() {
    super.initState();
    restore();
  }

  Future<void> restore() async {
    try {
      api.token = await storage.read(key: 'session');
      await notifications.initialize();
      if (api.token != null) await enterHousehold();
    } catch (_) {
      error = 'Could not restore your session. Try signing in again.';
    } finally {
      if (mounted) setState(() => starting = false);
    }
  }

  Future<void> enterHousehold() async {
    final next = Household(api);
    await next.refresh();
    if (!mounted) {
      next.dispose();
      return;
    }
    setState(() {
      household?.dispose();
      household = next;
    });
    if (!next.expired) await notifications.connect(requestPermission: false);
  }

  Future<void> signIn() async {
    setState(() {
      signingIn = true;
      error = null;
    });
    try {
      const clientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
      if (clientId.isEmpty) {
        throw ApiException('Google sign-in needs configuration in this build.');
      }
      googleReady ??= GoogleSignIn.instance.initialize(
        serverClientId: clientId,
      );
      await googleReady;
      final account = await GoogleSignIn.instance.authenticate();
      final credential = account.authentication.idToken;
      if (credential == null) {
        throw ApiException(
          'Google did not return a sign-in credential. Try again.',
        );
      }
      api.token = null;
      final response = await api.request('POST', '/api/auth/mobile', {
        'credential': credential,
      });
      api.token = response['token'] as String;
      await storage.write(key: 'session', value: api.token);
      await enterHousehold();
    } on GoogleSignInException catch (e) {
      if (e.code != GoogleSignInExceptionCode.canceled) error = 'Google sign-in failed. Check your connection and the app configuration.';
    } catch (e) {
      error = e.toString();
    } finally {
      if (mounted) setState(() => signingIn = false);
    }
  }

  Future<void> signOut() async {
    try {
      await notifications.disconnect();
    } on ApiException catch (e) {
      if (e.status != 401) rethrow;
      // Revoked or expired session cannot unregister; deleting the FCM token invalidates delivery.
      if (notifications.available) {
        // The sign-out retry path below is handled through device token invalidation.
        await notifications.invalidateToken();
      }
    }
    await storage.delete(key: 'session');
    api.token = null;
    if (googleReady != null) await GoogleSignIn.instance.signOut();
    if (!mounted) return;
    setState(() {
      household?.dispose();
      household = null;
    });
  }

  @override
  void dispose() {
    household?.dispose();
    notifications.dispose();
    api.client.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Tow',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff005f6a)),
      useMaterial3: true,
    ),
    darkTheme: ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xff005f6a),
        brightness: Brightness.dark,
      ),
      useMaterial3: true,
    ),
    home: starting
        ? const Scaffold(body: Center(child: CircularProgressIndicator()))
        : household != null
        ? HomeScreen(
            household: household!,
            notifications: notifications,
            signOut: signOut,
          )
        : Scaffold(
            body: SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(32),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Image.asset(
                          'assets/tow.png',
                          width: 80,
                          height: 80,
                          semanticLabel: 'Tow',
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'Tow',
                          style: Theme.of(context).textTheme.displayMedium,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'A little care. A shared home.',
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'See what’s next, share the work, and keep your household moving.',
                        ),
                        const SizedBox(height: 32),
                        if (error != null)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: Text(error!, semanticsLabel: error),
                          ),
                        FilledButton.icon(
                          onPressed: signingIn ? null : signIn,
                          icon: signingIn
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.login),
                          label: Text(
                            signingIn ? 'Signing in…' : 'Continue with Google',
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Text('Use your household Google account.'),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
  );
}
