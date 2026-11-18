// Visual QA entrypoint. This in-memory household is never imported by lib/main.dart.
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:tow/data/api.dart';
import 'package:tow/data/household.dart';
import 'package:tow/ui/home.dart';

import 'demo_server.dart';
import 'demo_notifications.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  tz.initializeTimeZones();
  if (appFlavor != 'demo') {
    throw StateError('Build this entrypoint with --flavor demo.');
  }
  final server = DemoServer();
  final api = TowApi('https://preview.invalid', client: server.client);
  final household = Household(api);
  await household.refresh();
  final notifications = DemoNotifications(api);
  await notifications.initialize();
  server.sendNotification = notifications.sendTest;
  runApp(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff005f6a)),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xff005f6a),
          brightness: Brightness.dark,
        ),
      ),
      home: HomeScreen(
        household: household,
        notifications: notifications,
        signOut: () async {
          await notifications.disconnect();
          server.reset();
          await household.refresh();
        },
      ),
    ),
  );
}
