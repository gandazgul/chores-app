import 'dart:async';

import 'package:flutter/material.dart';

import '../data/household.dart';
import '../data/models.dart';
import '../services/notifications.dart';
import 'editor.dart';
import 'settings.dart';

class HomeScreen extends StatefulWidget {
  final Household household;
  final TowNotifications notifications;
  final Future<void> Function() signOut;
  const HomeScreen({
    super.key,
    required this.household,
    required this.notifications,
    required this.signOut,
  });
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  int tab = 0;
  String query = '';
  final searchController = TextEditingController();
  Timer? timer;
  Household get h => widget.household;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.notifications.onOpen = () {
      if (mounted) {
        setState(() => tab = 0);
        h.refresh();
      }
    };
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      h.refresh();
      widget.notifications.connect(requestPermission: false);
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    searchController.dispose();
    widget.notifications.onOpen = null;
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> perform(
    Future<void> Function() action, {
    Chore? undo,
    String? success,
  }) async {
    try {
      await h.mutate(action);
      if (!mounted) return;
      if (success != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success),
            duration: Duration(seconds: undo == null ? 4 : 30),
            action: undo == null
                ? null
                : SnackBarAction(
                    label: 'Undo',
                    onPressed: () => perform(
                      () => h.api.update(undo, {'resolution': 'open'}),
                    ),
                  ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> edit([Chore? chore]) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ChoreEditor(household: h, chore: chore),
      ),
    );
    if (changed == true) await h.refresh();
  }

  Widget row(Chore c) {
    final now = DateTime.now();
    final poolAge = c.unassignedSince == null
        ? null
        : now.difference(c.unassignedSince!).inDays.clamp(0, 99999);
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: IconButton(
        tooltip: c.isOpen
            ? 'Complete ${c.title}'
            : c.canUndo(now)
            ? 'Reopen ${c.title}'
            : 'Skipped',
        onPressed: h.busy || h.expired || (!c.isOpen && !c.canUndo(now))
            ? null
            : () => perform(
                () => h.api.update(
                  c,
                  c.isOpen ? {'done': true} : {'resolution': 'open'},
                ),
                undo: c.isOpen ? c : null,
                success: c.isOpen ? 'Chore completed' : 'Chore reopened',
              ),
        icon: Icon(
          c.isOpen
              ? Icons.radio_button_unchecked
              : c.status == 'completed'
              ? Icons.check_circle
              : Icons.skip_next,
        ),
      ),
      title: Text(
        c.title,
        style: TextStyle(
          decoration: c.isOpen ? null : TextDecoration.lineThrough,
        ),
      ),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 4),
        child: Text(
          [
            '${h.memberName(c.assigneeId)} · ${c.dueLabel(h.timeZone)}',
            if (c.rrule != null) 'Repeats',
            if (tab == 2 && poolAge != null)
              poolAge == 0
                  ? 'In Pool less than a day'
                  : 'In Pool $poolAge ${poolAge == 1 ? 'day' : 'days'}',
            if (!c.isOpen) c.status == 'completed' ? 'Completed' : 'Skipped',
          ].join('\n'),
        ),
      ),
      onTap: h.busy || h.expired ? null : () => edit(c),
      trailing: PopupMenuButton<String>(
        tooltip: 'Actions for ${c.title}',
        enabled: !h.busy && !h.expired,
        onSelected: (value) {
          if (value == 'edit') {
            edit(c);
            return;
          }
          if (value == 'claim' || value == 'release') {
            perform(() => h.api.assign(c, value));
            return;
          }
          perform(
            () => h.api.update(c, {
              'resolution': value == 'skip' ? 'skipped' : 'open',
            }),
            undo: value == 'skip' ? c : null,
            success: value == 'skip' ? 'Chore skipped' : 'Chore reopened',
          );
        },
        itemBuilder: (_) => [
          const PopupMenuItem(value: 'edit', child: Text('Edit chore')),
          if (c.isOpen && c.assigneeId == null)
            const PopupMenuItem(value: 'claim', child: Text('Claim chore')),
          if (c.isOpen && c.assigneeId != null)
            const PopupMenuItem(
              value: 'release',
              child: Text('Return to Pool'),
            ),
          if (c.isOpen)
            const PopupMenuItem(
              value: 'skip',
              child: Text('Skip this occurrence'),
            ),
          if (!c.isOpen && c.canUndo(now))
            const PopupMenuItem(value: 'undo', child: Text('Undo')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: h,
    builder: (context, _) {
      final wide = MediaQuery.sizeOf(context).width >= 600;
      final titles = ["What’s Next", 'Board', 'Pool'];
      final open = tab == 0
          ? whatsNext(h.chores, h.memberId, h.timeZone, DateTime.now())
          : sortChores(
              h.chores.where(
                (c) => c.isOpen && (tab != 2 || c.assigneeId == null),
              ),
            );
      bool matches(Chore c) =>
          tab != 1 ||
          '${c.title} ${c.description ?? ''}'.toLowerCase().contains(
            query.toLowerCase().trim(),
          );
      final visible = open.where(matches).toList();
      final done = sortChores(
        h.chores.where(
          (c) =>
              !c.isOpen &&
              (tab == 0
                  ? c.assigneeId == h.memberId
                  : tab == 2
                  ? c.assigneeId == null
                  : true) &&
              matches(c),
        ),
      );
      final list = RefreshIndicator(
        onRefresh: h.refresh,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 104),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    titles[tab],
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    tab == 0
                        ? 'Your next dated chores. One thing at a time.'
                        : tab == 1
                        ? 'All the work that keeps your home moving.'
                        : 'Unassigned chores, ready for anyone to claim.',
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Dates in ${h.timeZone}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  if (tab == 1)
                    Padding(
                      padding: const EdgeInsets.only(top: 20),
                      child: TextField(
                        controller: searchController,
                        onChanged: (value) => setState(() => query = value),
                        decoration: const InputDecoration(
                          labelText: 'Search chores',
                          prefixIcon: Icon(Icons.search),
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (h.error != null)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      h.error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                    if (h.loaded)
                      const Text(
                        'Showing the last loaded chores. Pull to refresh.',
                      ),
                    TextButton(
                      onPressed: h.expired
                          ? () async {
                              try {
                                await widget.signOut();
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text(e.toString())),
                                  );
                                }
                              }
                            }
                          : h.refresh,
                      child: Text(h.expired ? 'Sign in again' : 'Retry'),
                    ),
                  ],
                ),
              ),
            if (h.loading && !h.loaded)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              ),
            if (h.loaded && visible.isEmpty)
              Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  children: [
                    Icon(
                      tab == 2
                          ? Icons.group_outlined
                          : Icons.check_circle_outline,
                      size: 48,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      tab == 0
                          ? 'Nothing scheduled next'
                          : tab == 1 && query.isNotEmpty
                          ? 'No matching chores'
                          : tab == 2
                          ? 'The Pool is clear'
                          : 'Your Board is clear',
                      style: Theme.of(context).textTheme.titleLarge,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      tab == 0
                          ? 'Check Board for overdue and undated work, or claim a chore from Pool.'
                          : 'Add a chore when something needs doing.',
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ...visible.map(row),
            if (done.isNotEmpty)
              ExpansionTile(
                title: Text('Done (${done.length})'),
                children: done.map(row).toList(),
              ),
          ],
        ),
      );
      return Scaffold(
        appBar: AppBar(
          title: const Text('Tow'),
          actions: [
            IconButton(
              tooltip: 'Refresh chores',
              onPressed: h.loading ? null : h.refresh,
              icon: const Icon(Icons.refresh),
            ),
            IconButton(
              tooltip: 'Settings',
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => SettingsScreen(
                    household: h,
                    notifications: widget.notifications,
                    signOut: widget.signOut,
                  ),
                ),
              ),
              icon: const Icon(Icons.settings_outlined),
            ),
          ],
          bottom: h.loading && h.loaded
              ? const PreferredSize(
                  preferredSize: Size.fromHeight(2),
                  child: LinearProgressIndicator(),
                )
              : null,
        ),
        body: SafeArea(
          child: Row(
            children: [
              if (wide)
                NavigationRail(
                  selectedIndex: tab,
                  onDestinationSelected: (value) => setState(() => tab = value),
                  labelType: NavigationRailLabelType.all,
                  destinations: const [
                    NavigationRailDestination(
                      icon: Icon(Icons.today_outlined),
                      label: Text('Next'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.view_list_outlined),
                      label: Text('Board'),
                    ),
                    NavigationRailDestination(
                      icon: Icon(Icons.group_outlined),
                      label: Text('Pool'),
                    ),
                  ],
                ),
              Expanded(child: list),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: h.busy || !h.loaded || h.expired ? null : () => edit(),
          label: const Text('New chore'),
          icon: const Icon(Icons.add),
        ),
        bottomNavigationBar: wide
            ? null
            : NavigationBar(
                selectedIndex: tab,
                onDestinationSelected: (value) => setState(() => tab = value),
                destinations: const [
                  NavigationDestination(
                    icon: Icon(Icons.today_outlined),
                    label: 'Next',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.view_list_outlined),
                    label: 'Board',
                  ),
                  NavigationDestination(
                    icon: Icon(Icons.group_outlined),
                    label: 'Pool',
                  ),
                ],
              ),
      );
    },
  );
}
