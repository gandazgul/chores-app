import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/household.dart';
import '../data/models.dart';

class ChoreEditor extends StatefulWidget {
  final Household household;
  final Chore? chore;
  const ChoreEditor({super.key, required this.household, this.chore});
  @override
  State<ChoreEditor> createState() => _ChoreEditorState();
}

class _ChoreEditorState extends State<ChoreEditor> {
  final form = GlobalKey<FormState>();
  late final title = TextEditingController(text: widget.chore?.title);
  late final description = TextEditingController(
    text: widget.chore?.description,
  );
  late String rrule = widget.chore?.rrule ?? '';
  late String assignee = widget.chore == null
      ? widget.household.memberId
      : widget.chore!.assigneeId ?? '';
  late bool remind = widget.chore?.remind ?? true;
  late DateTime? due = widget.chore?.due?.toLocal();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    title.dispose();
    description.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.household.api.save(widget.chore, {
        'title': title.text.trim(),
        'description': description.text.trim(),
        'rrule': rrule.isEmpty ? null : rrule,
        'assigneeId': assignee.isEmpty ? null : assignee,
        'remindUntilDone': remind,
        'dueDate': due?.toUtc().toIso8601String(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> chooseDate() async {
    final initial = due ?? DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(initial.year - 20),
      lastDate: DateTime(initial.year + 50),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null || !mounted) return;
    setState(
      () => due = DateTime(
        date.year,
        date.month,
        date.day,
        time.hour,
        time.minute,
      ),
    );
  }

  Future<void> delete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete this chore?'),
        content: Text(
          '“${widget.chore!.title}” will be deleted. This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep chore'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.household.api.delete(widget.chore!);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const recurrences = {
      '': 'Once',
      'FREQ=DAILY': 'Daily',
      'FREQ=WEEKLY': 'Weekly',
      'FREQ=MONTHLY': 'Monthly',
    };
    return PopScope(
      canPop: !busy,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.chore == null ? 'New chore' : 'Edit chore'),
        ),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 640),
              child: Form(
                key: form,
                child: ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          error!,
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ),
                    TextFormField(
                      controller: title,
                      enabled: !busy,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: const InputDecoration(
                        labelText: 'Chore title',
                        border: OutlineInputBorder(),
                      ),
                      validator: (value) =>
                          value == null || value.trim().isEmpty
                          ? 'Give this chore a title.'
                          : null,
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: description,
                      enabled: !busy,
                      minLines: 2,
                      maxLines: 5,
                      decoration: const InputDecoration(
                        labelText: 'Details (optional)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 20),
                    DropdownButtonFormField<String>(
                      initialValue: assignee,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Assigned to',
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        const DropdownMenuItem(
                          value: '',
                          child: Text('Pool — anyone can claim'),
                        ),
                        ...widget.household.members.map(
                          (m) => DropdownMenuItem(
                            value: m.id,
                            child: Text(m.name),
                          ),
                        ),
                      ],
                      onChanged: busy
                          ? null
                          : (value) => setState(() => assignee = value!),
                    ),
                    const SizedBox(height: 20),
                    DropdownButtonFormField<String>(
                      initialValue: rrule,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Repeat',
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        for (final entry in recurrences.entries)
                          DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                        if (!recurrences.containsKey(rrule))
                          DropdownMenuItem(
                            value: rrule,
                            child: const Text('Custom schedule (preserved)'),
                          ),
                      ],
                      onChanged: busy
                          ? null
                          : (value) => setState(() => rrule = value!),
                    ),
                    const SizedBox(height: 12),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Due date and time'),
                      subtitle: Text(
                        due == null
                            ? 'No date set'
                            : DateFormat.yMMMd().add_jm().format(due!),
                      ),
                      onTap: busy ? null : chooseDate,
                      trailing: due == null
                          ? const Icon(Icons.calendar_today)
                          : IconButton(
                              tooltip: 'Clear due date',
                              onPressed: busy
                                  ? null
                                  : () => setState(() => due = null),
                              icon: const Icon(Icons.close),
                            ),
                    ),
                    Text(
                      'Choose times in this phone’s timezone. Your household views use ${widget.household.timeZone}.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Remind until done'),
                      subtitle: const Text(
                        'Send chore reminders, respecting quiet hours.',
                      ),
                      value: remind,
                      onChanged: busy
                          ? null
                          : (value) => setState(() => remind = value),
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: busy ? null : save,
                      child: Text(busy ? 'Saving…' : 'Save chore'),
                    ),
                    const SizedBox(height: 12),
                    if (widget.chore != null)
                      TextButton.icon(
                        onPressed: busy ? null : delete,
                        icon: const Icon(Icons.delete_outline),
                        label: const Text('Delete chore'),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
