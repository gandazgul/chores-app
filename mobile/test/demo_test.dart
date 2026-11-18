import 'package:flutter_test/flutter_test.dart';
import 'package:tow/data/api.dart';

import '../test_driver/demo_server.dart';

void main() {
  test('demo supports the chore lifecycle without a network server', () async {
    final server = DemoServer();
    final api = TowApi('https://preview.invalid', client: server.client);
    await api.save(null, {
      'title': 'Walk the dog',
      'description': 'Bring water',
      'assigneeId': null,
      'rrule': 'FREQ=DAILY',
      'remindUntilDone': true,
      'dueDate': '2026-11-18T12:00:00Z',
    });
    var chore = (await api.chores()).last;
    expect(chore.title, 'Walk the dog');
    expect(chore.rrule, 'FREQ=DAILY');
    expect(chore.remind, isTrue);
    await api.assign(chore, 'claim');
    expect((await api.chores()).last.assigneeId, 'me');
    await api.update(chore, {'done': true});
    expect((await api.chores()).last.status, 'completed');
    await api.update(chore, {'resolution': 'open'});
    expect((await api.chores()).last.resolvedAt, isNull);
    await api.update(chore, {
      'title': 'Walk together',
      'rrule': null,
      'remindUntilDone': false,
    });
    chore = (await api.chores()).last;
    expect(chore.title, 'Walk together');
    expect(chore.rrule, isNull);
    expect(chore.remind, isFalse);
    await api.assign(chore, 'release');
    expect((await api.chores()).last.assigneeId, isNull);
    await api.delete(chore);
    expect((await api.chores()).where((c) => c.id == chore.id), isEmpty);
    await api.request('PUT', '/api/users/me/quiet-hours', {
      'enabled': false,
      'start': '22:00',
      'end': '09:00',
    });
    expect(
      (await api.request('GET', '/api/users/me/quiet-hours'))['enabled'],
      false,
    );
    await expectLater(
      api.request('GET', '/api/unsupported'),
      throwsA(isA<ApiException>()),
    );
    server.reset();
    expect((await api.chores()).length, 4);
    expect(
      (await api.request('GET', '/api/users/me/quiet-hours'))['enabled'],
      true,
    );
  });
}
