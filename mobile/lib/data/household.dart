import 'package:flutter/foundation.dart';

import 'api.dart';
import 'models.dart';

class Household extends ChangeNotifier {
  final TowApi api;
  Household(this.api);
  bool _disposed = false;
  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  void _changed() {
    if (!_disposed) notifyListeners();
  }

  List<Chore> chores = [];
  List<Member> members = [];
  String memberId = '', name = '', timeZone = 'UTC', provider = '';
  String? error;
  bool loading = false, busy = false, expired = false, loaded = false;
  Future<void> refresh() async {
    if (loading) return;
    loading = true;
    error = null;
    _changed();
    try {
      final results = await Future.wait([
        api.request('GET', '/api/users/me'),
        api.chores(),
        api.members(),
      ]);
      final me = results[0] as Json;
      memberId = me['user']['id'] as String;
      name = me['user']['name'] as String;
      timeZone = me['timeZone'] as String;
      provider = me['notificationProvider'] as String;
      chores = results[1] as List<Chore>;
      members = results[2] as List<Member>;
      loaded = true;
      expired = false;
    } catch (e) {
      error = e.toString();
      expired = e is ApiException && e.status == 401;
    } finally {
      loading = false;
      _changed();
    }
  }

  Future<void> mutate(Future<void> Function() action) async {
    if (busy) return;
    busy = true;
    _changed();
    try {
      await action();
      await refresh();
    } finally {
      busy = false;
      _changed();
    }
  }

  String memberName(String? id) => id == null
      ? 'Pool'
      : members.where((m) => m.id == id).firstOrNull?.name ?? 'Member';
}
