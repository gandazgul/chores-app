import 'package:flutter/material.dart';

import '../data/household.dart';
import '../services/notifications.dart';

class SettingsScreen extends StatefulWidget {
  final Household household;
  final TowNotifications notifications;
  final Future<void> Function() signOut;
  const SettingsScreen({
    super.key,
    required this.household,
    required this.notifications,
    required this.signOut,
  });
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool loading = true, busy = false, enabled = true, settingsLoaded = false;
  String start = '21:00', end = '08:00';
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final settings = await widget.household.api.request(
        'GET',
        '/api/users/me/quiet-hours',
      );
      if (!mounted) return;
      setState(() {
        settingsLoaded = true;
        enabled = settings['enabled'] as bool;
        start = settings['start'] as String;
        end = settings['end'] as String;
      });
    } catch (e) {
      error = e.toString();
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> action(Future<void> Function() run, [String? message]) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await run();
      if (message != null && mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> chooseTime(bool isStart) async {
    final parts = (isStart ? start : end).split(':').map(int.parse).toList();
    final selected = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: parts[0], minute: parts[1]),
    );
    if (selected != null && mounted) {
      setState(() {
        final value =
            '${selected.hour.toString().padLeft(2, '0')}:${selected.minute.toString().padLeft(2, '0')}';
        if (isStart) {
          start = value;
        } else {
          end = value;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Settings')),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: AnimatedBuilder(
            animation: widget.notifications,
            builder: (context, _) {
              final n = widget.notifications;
              return ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  Text(
                    widget.household.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Notifications',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 12),
                  Text(n.status),
                  if (widget.household.provider != 'fcm')
                    const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        'The server is not using native notifications yet. Device setup can be completed now; reminders require the server switch to FCM.',
                      ),
                    ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: busy || n.busy || !n.available
                        ? null
                        : () => n.connect(),
                    icon: const Icon(Icons.notifications_active_outlined),
                    label: Text(
                      n.busy
                          ? 'Connecting…'
                          : n.connected
                          ? 'Reconnect this phone'
                          : 'Connect this phone',
                    ),
                  ),
                  OutlinedButton(
                    onPressed:
                        busy ||
                            !n.connected ||
                            widget.household.provider != 'fcm'
                        ? null
                        : () => action(
                            () async {
                              await widget.household.api.request(
                                'POST',
                                '/api/users/me/test-notification',
                              );
                            },
                            'Test accepted. Check this phone for a notification and sound.',
                          ),
                    child: const Text('Send test notification'),
                  ),
                  TextButton(
                    onPressed: () => action(n.openSettings),
                    child: const Text('Android notification settings'),
                  ),
                  const SizedBox(height: 24),
                  const Divider(),
                  const SizedBox(height: 24),
                  Text(
                    'Quiet hours',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Reminders wait until quiet hours end. Times use ${widget.household.timeZone}.',
                  ),
                  if (loading)
                    const Padding(
                      padding: EdgeInsets.all(16),
                      child: LinearProgressIndicator(),
                    )
                  else if (settingsLoaded) ...[
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Pause reminders overnight'),
                      value: enabled,
                      onChanged: busy
                          ? null
                          : (value) => setState(() => enabled = value),
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Start'),
                      trailing: Text(start),
                      onTap: busy || !enabled ? null : () => chooseTime(true),
                    ),
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('End'),
                      trailing: Text(end),
                      onTap: busy || !enabled ? null : () => chooseTime(false),
                    ),
                    FilledButton.tonal(
                      onPressed: busy
                          ? null
                          : () => action(() async {
                              await widget.household.api.request(
                                'PUT',
                                '/api/users/me/quiet-hours',
                                {
                                  'enabled': enabled,
                                  'start': start,
                                  'end': end,
                                },
                              );
                            }, 'Quiet hours saved'),
                      child: const Text('Save quiet hours'),
                    ),
                  ],
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        error!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  TextButton(
                    onPressed: busy ? null : load,
                    child: const Text('Reload settings'),
                  ),
                  const SizedBox(height: 32),
                  const Divider(),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: busy || n.busy
                        ? null
                        : () => action(() async {
                            await widget.signOut();
                            if (context.mounted) {
                              Navigator.of(context)
                                  .popUntil((route) => route.isFirst);
                            }
                          }),
                    icon: const Icon(Icons.logout),
                    label: const Text('Sign out'),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    ),
  );
}
