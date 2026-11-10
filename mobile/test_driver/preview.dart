// Visual QA entrypoint. This in-memory household is never imported by lib/main.dart.
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:tow/data/api.dart';
import 'package:tow/data/models.dart';
import 'package:tow/data/household.dart';
import 'package:tow/services/notifications.dart';
import 'package:tow/ui/home.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  tz.initializeTimeZones();
  final due = DateTime.now()
      .toUtc()
      .add(const Duration(minutes: 30))
      .toIso8601String();
  final rows = <Json>[
    {
      'id': 'kitchen',
      'title': 'Reset the kitchen',
      'description': 'Wipe the counters and put the dishes away.',
      'status': 'open',
      'assignee_id': 'me',
      'due_date': due,
      'recurrence': {'rrule': 'FREQ=DAILY'},
      'remind_until_done': 1,
    },
    {
      'id': 'plants',
      'title': 'Water the living room plants',
      'status': 'open',
      'assignee_id': 'me',
      'due_date': due,
      'remind_until_done': 1,
    },
    {
      'id': 'laundry',
      'title': 'Fold the clean laundry',
      'status': 'open',
      'assignee_id': 'other',
      'due_date': due,
      'remind_until_done': 1,
    },
    {
      'id': 'recycling',
      'title': 'Take the recycling out',
      'status': 'open',
      'assignee_id': null,
      'due_date': null,
      'unassigned_since': DateTime.now()
          .toUtc()
          .subtract(const Duration(days: 2))
          .toIso8601String(),
      'remind_until_done': 1,
    },
  ];
  final api = TowApi(
    'https://preview.invalid',
    client: MockClient((request) async {
      final path = request.url.path;
      if (path.startsWith('/api/chores/') && request.method == 'PUT') {
        final row = rows.firstWhere((r) => r['id'] == path.split('/').last);
        final data = jsonDecode(request.body) as Json;
        if (data['done'] == true) {
          row['status'] = 'completed';
        }
        if (data['resolution'] != null) {
          row['status'] = data['resolution'];
        }
        row['resolved_at'] = DateTime.now().toUtc().toIso8601String();
        return http.Response(jsonEncode(row), 200);
      }
      return http.Response(
        jsonEncode(switch (path) {
          '/api/users/me' => {
            'user': {'id': 'me', 'name': 'Alex'},
            'timeZone': 'America/New_York',
            'notificationProvider': 'fcm',
          },
          '/api/members' => [
            {'id': 'me', 'name': 'Alex'},
            {'id': 'other', 'name': 'Sam'},
          ],
          '/api/users/me/quiet-hours' => {
            'enabled': true,
            'start': '21:00',
            'end': '08:00',
          },
          _ => rows,
        }),
        200,
      );
    }),
  );
  final household = Household(api);
  await household.refresh();
  final notifications = TowNotifications(api, const FlutterSecureStorage());
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
        signOut: () async {},
      ),
    ),
  );
}
