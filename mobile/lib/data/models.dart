import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz;

typedef Json = Map<String, dynamic>;

class Member {
  final String id, name;
  Member.fromJson(Json json)
    : id = json['id'] as String,
      name = json['name'] as String? ?? 'Member';
}

class Chore {
  final String id, title, status;
  final String? description, assigneeId, rrule;
  final DateTime? due, resolvedAt, unassignedSince;
  final bool remind;
  Chore.fromJson(Json json)
    : id = json['id'] as String,
      title = json['title'] as String,
      status = json['status'] as String,
      description = json['description'] as String?,
      assigneeId = json['assignee_id'] as String?,
      rrule = json['recurrence'] is Map
          ? json['recurrence']['rrule'] as String?
          : json['recurrence'] as String?,
      due = _date(json['due_date']),
      resolvedAt = _date(json['resolved_at']),
      unassignedSince = _date(json['unassigned_since']),
      remind = json['remind_until_done'] == 1;
  bool get isOpen => status == 'open';
  bool canUndo(DateTime now) =>
      status == 'completed' ||
      (status == 'skipped' &&
          resolvedAt != null &&
          now.difference(resolvedAt!).inMilliseconds <= 30000);
  static DateTime? _date(dynamic value) =>
      value is String ? DateTime.tryParse(value) : null;
  String dueLabel(String zone) => due == null
      ? 'No due date'
      : DateFormat.yMMMd().add_jm().format(
          tz.TZDateTime.from(due!, tz.getLocation(zone)),
        );
}

List<Chore> sortChores(Iterable<Chore> chores) => chores.toList()
  ..sort((a, b) {
    if (a.due == null && b.due != null) return 1;
    if (a.due != null && b.due == null) return -1;
    final date = a.due?.compareTo(b.due!) ?? 0;
    return date == 0 ? a.title.compareTo(b.title) : date;
  });

/// Keep the web app's today-or-next-future bucket, using household time, not phone time.
List<Chore> whatsNext(
  List<Chore> chores,
  String memberId,
  String zone,
  DateTime now,
) {
  final location = tz.getLocation(zone);
  String key(DateTime time) =>
      DateFormat('yyyy-MM-dd').format(tz.TZDateTime.from(time, location));
  final today = key(now);
  final candidates = chores
      .where(
        (c) =>
            c.isOpen &&
            c.assigneeId == memberId &&
            c.due != null &&
            key(c.due!).compareTo(today) >= 0,
      )
      .toList();
  if (candidates.isEmpty) return [];
  final firstKey = candidates
      .map((c) => key(c.due!))
      .reduce((a, b) => a.compareTo(b) < 0 ? a : b);
  return sortChores(candidates.where((c) => key(c.due!) == firstKey));
}
