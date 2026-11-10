import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:timezone/data/latest.dart' as tz;
import 'package:tow/data/api.dart';
import 'package:tow/data/household.dart';
import 'package:tow/data/models.dart';
import 'package:tow/services/notifications.dart';
import 'package:tow/ui/home.dart';

Json chore(
  String id,
  String? due, {
  String? member = 'me',
  String status = 'open',
}) => {
  'id': id,
  'title': id,
  'status': status,
  'assignee_id': member,
  'due_date': due,
  'remind_until_done': 1,
};
void main() {
  setUpAll(tz.initializeTimeZones);
  test('Next follows household midnight, skips overdue and undated work, and isolates assignee', () {
    final rows = [
      chore('today', '2026-11-07T02:00:00Z'),
      chore('tomorrow', '2026-11-07T15:00:00Z'),
      chore('overdue', '2026-11-05T15:00:00Z'),
      chore('undated', null),
      chore('pool', '2026-11-07T02:00:00Z', member: null),
      chore('other', '2026-11-07T02:00:00Z', member: 'other'),
    ].map(Chore.fromJson).toList();
    expect(
      whatsNext(
        rows,
        'me',
        'America/New_York',
        DateTime.parse('2026-11-07T01:00:00Z'),
      ).map((c) => c.id),
      ['today'],
    );
    expect(
      whatsNext(
        rows,
        'me',
        'America/New_York',
        DateTime.parse('2026-11-07T06:00:00Z'),
      ).map((c) => c.id),
      ['tomorrow'],
    );
  });
  test('API sends explicit bearer credentials, reports conflicts and never follows redirects', () async {
    final api = TowApi(
      'https://tow.example',
      client: MockClient((request) async {
        expect(request.headers['Authorization'], 'Bearer native-session');
        expect(request.followRedirects, false);
        return http.Response(jsonEncode({'error': 'Already claimed'}), 409);
      }),
    )..token = 'native-session';
    await expectLater(
      api.request('POST', '/api/chores/example/assignment', {
        'action': 'claim',
      }),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          'Already claimed',
        ),
      ),
    );
  });
  testWidgets(
    'Board search and Pool claim use shared server data, with large text and a narrow phone',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final rows = [
        chore('Clean kitchen', '2026-11-07T12:00:00Z'),
        chore('Take recycling out', null, member: null),
      ];
      String? claimed;
      final api = TowApi(
        'https://tow.example',
        client: MockClient((request) async {
          if (request.url.path.endsWith('/assignment')) {
            claimed = jsonDecode(request.body)['action'] as String;
            rows[1]['assignee_id'] = 'me';
            return http.Response('{}', 200);
          }
          return http.Response(
            jsonEncode(switch (request.url.path) {
              '/api/users/me' => {
                'user': {'id': 'me', 'name': 'Alex'},
                'timeZone': 'America/New_York',
                'notificationProvider': 'fcm',
              },
              '/api/members' => [
                {'id': 'me', 'name': 'Alex'},
              ],
              _ => rows,
            }),
            200,
          );
        }),
      );
      final household = Household(api);
      await household.refresh();
      final notifications = TowNotifications(api, const FlutterSecureStorage());
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(useMaterial3: true),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: const TextScaler.linear(1.3)),
            child: child!,
          ),
          home: HomeScreen(
            household: household,
            notifications: notifications,
            signOut: () async {},
          ),
        ),
      );
      await tester.tap(find.text('Board').last);
      await tester.pumpAndSettle();
      expect(find.text('Clean kitchen'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'recycling');
      await tester.pumpAndSettle();
      expect(find.text('Clean kitchen'), findsNothing);
      await tester.tap(find.text('Pool').last);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Actions for Take recycling out'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Claim chore'));
      await tester.pumpAndSettle();
      expect(claimed, 'claim');
      expect(find.text('The Pool is clear'), findsOneWidget);
      await tester.tap(find.text('Board').last);
      await tester.pumpAndSettle();
      expect(find.text('recycling'), findsOneWidget);
      expect(find.text('Clean kitchen'), findsNothing);
      expect(find.text('Take recycling out'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      notifications.dispose();
      household.dispose();
      api.client.close();
    },
  );
}
