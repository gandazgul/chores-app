// Local Android notification preview. No Firebase or production device registration.
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:tow/data/api.dart';
import 'package:tow/services/notifications.dart';

class DemoNotifications extends TowNotifications {
  DemoNotifications(TowApi api) : super(api, const FlutterSecureStorage());
  static const explanation =
      'Offline demo: sample chores reset when the app restarts or you sign out. '
      'Repeats and quiet hours are saved for preview only. '
      'Test notifications come from this phone; family sync and server reminders are not connected.';

  @override
  Future<void> initialize() async {
    await local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('ic_notification'),
      ),
      onDidReceiveNotificationResponse: (_) => onOpen?.call(),
    );
    await local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(TowNotifications.channel);
    available = true;
    status = explanation;
    notifyListeners();
  }

  @override
  Future<void> connect({bool requestPermission = true}) async {
    final android = local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >();
    connected =
        (requestPermission
            ? await android?.requestNotificationsPermission()
            : await android?.areNotificationsEnabled()) ??
        false;
    status =
        '$explanation\n\n${connected ? 'Ready to send a local test notification.' : 'Allow notifications to try a local test.'}';
    notifyListeners();
  }

  Future<void> sendTest() async {
    await connect(requestPermission: false);
    if (!connected) {
      throw ApiException('Allow notifications before sending a test.');
    }
    await local.show(
      id: 1,
      title: 'Tow Demo · Chore reminder',
      body: 'Reset the kitchen. This is a local test notification.',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'tow_reminders_v1',
          'Chore reminders',
          importance: Importance.high,
          priority: Priority.high,
          icon: 'ic_notification',
        ),
      ),
    );
  }

  @override
  Future<void> disconnect() async {
    await local.cancelAll();
    connected = false;
    status = explanation;
    notifyListeners();
  }

  @override
  Future<void> invalidateToken() => disconnect();
}
