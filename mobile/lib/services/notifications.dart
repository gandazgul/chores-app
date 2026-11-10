import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

import '../data/api.dart';

@pragma('vm:entry-point')
Future<void> backgroundMessage(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Notification payloads are displayed by Android while backgrounded.
}

class TowNotifications extends ChangeNotifier {
  final TowApi api;
  final FlutterSecureStorage storage;
  TowNotifications(this.api, this.storage);
  final local = FlutterLocalNotificationsPlugin();
  final subscriptions = <StreamSubscription<dynamic>>[];
  String status = 'Connect this phone to receive chore reminders.';
  bool available = false, connected = false, busy = false;
  VoidCallback? onOpen;
  String? _installation;
  static const channel = AndroidNotificationChannel(
    'tow_reminders_v1',
    'Chore reminders',
    description: 'Assigned chores and unclaimed household work',
    importance: Importance.high,
    playSound: true,
    enableVibration: true,
  );

  Future<void> initialize() async {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(backgroundMessage);
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
          ?.createNotificationChannel(channel);
      subscriptions.add(
        FirebaseMessaging.onMessage.listen((message) async {
          if (api.token == null || !connected) return;
          await local.show(
            id: message.messageId.hashCode & 0x7fffffff,
            title: message.notification?.title ?? 'Tow',
            body: message.notification?.body,
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
        }),
      );
      subscriptions.add(
        FirebaseMessaging.onMessageOpenedApp.listen((_) => onOpen?.call()),
      );
      subscriptions.add(
        // HTTP v1 uses registration tokens; the newer FID transport is a separate migration.
        // ignore: deprecated_member_use
        FirebaseMessaging.instance.onTokenRefresh.listen((token) async {
          if (api.token == null || !connected) return;
          try {
            await _register(token);
          } catch (_) {
            connected = false;
            status = 'Could not reconnect reminders. Tap Connect to retry.';
            notifyListeners();
          }
        }),
      );
      available = true;
      if (await FirebaseMessaging.instance.getInitialMessage() != null) {
        onOpen?.call();
      }
    } catch (_) {
      status = 'Notifications need Firebase configuration in this build.';
    }
    notifyListeners();
  }

  Future<String> installation() async {
    _installation ??=
        await storage.read(key: 'installation') ?? const Uuid().v4();
    await storage.write(key: 'installation', value: _installation);
    return _installation!;
  }

  Future<void> _register(String token) async {
    await api.request('PUT', '/api/users/me/devices', {
      'installationId': await installation(),
      'token': token,
    });
  }

  Future<void> connect({bool requestPermission = true}) async {
    if (!available || busy || api.token == null) return;
    busy = true;
    notifyListeners();
    try {
      final settings = requestPermission
          ? await FirebaseMessaging.instance.requestPermission()
          : await FirebaseMessaging.instance.getNotificationSettings();
      if (settings.authorizationStatus != AuthorizationStatus.authorized) {
        connected = false;
        status = 'Notifications are off. Allow them in Android settings, then connect again.';
        return;
      }
      await FirebaseMessaging.instance.setAutoInitEnabled(true);
      // ignore: deprecated_member_use
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) {
        throw ApiException('No device token yet. Try connecting again.');
      }
      await _register(token);
      connected = true;
      status =
          'This phone is connected. Send a test to check sound and delivery.';
    } catch (e) {
      connected = false;
      status = e is ApiException ? e.message : 'Could not connect notifications. Check your connection and try again.';
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> disconnect() async {
    // Do not silently log out while this device remains registered for the account.
    if (available) {
      await api.request('DELETE', '/api/users/me/devices', {
        'installationId': await installation(),
      });
      await FirebaseMessaging.instance.setAutoInitEnabled(false);
      // ignore: deprecated_member_use
      await FirebaseMessaging.instance.deleteToken();
      await local.cancelAll();
    }
    connected = false;
    status = 'Connect this phone to receive chore reminders.';
    notifyListeners();
  }

  Future<void> invalidateToken() async {
    await FirebaseMessaging.instance.setAutoInitEnabled(false);
    // ignore: deprecated_member_use
    await FirebaseMessaging.instance.deleteToken();
    await local.cancelAll();
    connected = false;
    notifyListeners();
  }

  Future<void> openSettings() async {
    await local.openAppNotificationSettings();
  }

  @override
  void dispose() {
    for (final subscription in subscriptions) {
      subscription.cancel();
    }
    super.dispose();
  }
}
