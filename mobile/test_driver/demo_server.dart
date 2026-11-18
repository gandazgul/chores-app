// Demo-only transport: all requests stay in memory, including unknown routes.
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:tow/data/models.dart';

class DemoServer {
  DemoServer() {
    reset();
  }
  final rows = <Json>[];
  Json quietHours = {};
  int nextId = 0;
  Future<void> Function()? sendNotification;
  late final client = MockClient(handle);

  void reset() {
    final now = DateTime.now().toUtc();
    final due = now.add(const Duration(minutes: 30)).toIso8601String();
    nextId = 0;
    quietHours = {'enabled': true, 'start': '21:00', 'end': '08:00'};
    rows
      ..clear()
      ..addAll([
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
          'unassigned_since': now
              .subtract(const Duration(days: 2))
              .toIso8601String(),
          'remind_until_done': 1,
        },
      ]);
  }

  void edit(Json row, Json body) {
    for (final key in ['title', 'description']) {
      if (body.containsKey(key)) row[key] = body[key];
    }
    for (final entry in {
      'assigneeId': 'assignee_id',
      'dueDate': 'due_date',
    }.entries) {
      if (body.containsKey(entry.key)) row[entry.value] = body[entry.key];
    }
    if (body.containsKey('rrule')) {
      row['recurrence'] = body['rrule'] == null
          ? null
          : {'rrule': body['rrule']};
    }
    if (body.containsKey('remindUntilDone')) {
      row['remind_until_done'] = body['remindUntilDone'] == true ? 1 : 0;
    }
    if (body['done'] == true || body.containsKey('resolution')) {
      row['status'] = body['done'] == true ? 'completed' : body['resolution'];
      row['resolved_at'] = row['status'] == 'open'
          ? null
          : DateTime.now().toUtc().toIso8601String();
    }
    row['unassigned_since'] = row['assignee_id'] == null
        ? row['unassigned_since'] ?? DateTime.now().toUtc().toIso8601String()
        : null;
  }

  Future<http.Response> handle(http.Request request) async {
    final path = request.url.path;
    final method = request.method;
    final body = request.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(request.body) as Json;
    http.Response reply(dynamic value, [int status = 200]) => http.Response(
      jsonEncode(value),
      status,
      headers: {'content-type': 'application/json'},
    );
    if (path == '/api/users/me' && method == 'GET') {
      return reply({
        'user': {'id': 'me', 'name': 'Alex · Demo'},
        'timeZone': 'America/New_York',
        'notificationProvider': 'fcm',
      });
    }
    if (path == '/api/members' && method == 'GET') {
      return reply([
        {'id': 'me', 'name': 'Alex'},
        {'id': 'other', 'name': 'Sam'},
      ]);
    }
    if (path == '/api/users/me/quiet-hours') {
      if (method == 'PUT') quietHours = Map.of(body);
      if (method == 'GET' || method == 'PUT') return reply(quietHours);
    }
    if (path == '/api/users/me/test-notification' && method == 'POST') {
      if (sendNotification == null) {
        return reply({'error': 'Notifications unavailable.'}, 503);
      }
      await sendNotification!();
      return reply({'ok': true});
    }
    if (path == '/api/chores') {
      if (method == 'GET') return reply(rows);
      if (method == 'POST') {
        final row = <String, dynamic>{
          'id': 'demo-${nextId++}',
          'status': 'open',
        };
        edit(row, body);
        rows.add(row);
        return reply(row, 201);
      }
    }
    final parts = request.url.pathSegments;
    if (parts.length >= 3 && parts[0] == 'api' && parts[1] == 'chores') {
      final row = rows.where((r) => r['id'] == parts[2]).firstOrNull;
      if (row == null) return reply({'error': 'Chore not found.'}, 404);
      if (parts.length == 4 && parts[3] == 'assignment' && method == 'POST') {
        if (!['claim', 'release'].contains(body['action'])) {
          return reply({'error': 'Unknown assignment action.'}, 400);
        }
        edit(row, {'assigneeId': body['action'] == 'claim' ? 'me' : null});
        return reply(row);
      }
      if (parts.length == 3 && method == 'PUT') {
        edit(row, body);
        return reply(row);
      }
      if (parts.length == 3 && method == 'DELETE') {
        rows.remove(row);
        return reply({'ok': true});
      }
    }
    return reply({
      'error': 'This action is unavailable in the offline demo.',
    }, 404);
  }
}
