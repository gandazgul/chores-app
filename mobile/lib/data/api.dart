import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'models.dart';

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, [this.status = 0]);
  @override
  String toString() => message;
}

class TowApi {
  final Uri base;
  final http.Client client;
  String? token;
  TowApi(String origin, {http.Client? client})
    : base = Uri.parse(origin),
      client = client ?? http.Client() {
    if (base.scheme != 'https' ||
        base.host.isEmpty ||
        base.userInfo.isNotEmpty ||
        base.hasQuery ||
        base.hasFragment ||
        (base.path.isNotEmpty && base.path != '/')) {
      throw ArgumentError('TOW_API_URL must be an HTTPS origin.');
    }
  }
  Future<dynamic> request(String method, String path, [Json? body]) async {
    final request = http.Request(method, base.resolve(path))
      ..followRedirects = false;
    request.headers['Accept'] = 'application/json';
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    try {
      final response = await client
          .send(request)
          .then(http.Response.fromStream)
          .timeout(const Duration(seconds: 20));
      dynamic payload;
      try {
        payload = response.body.isEmpty ? null : jsonDecode(response.body);
      } on FormatException {
        throw ApiException(
          'Unexpected server response. Check the server address and try again.',
          response.statusCode,
        );
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiException(
          response.statusCode == 401
              ? 'Your session has expired. Sign in again.'
              : payload is Map
              ? payload['error'] as String? ?? 'Request failed. Try again.'
              : 'Request failed. Try again.',
          response.statusCode,
        );
      }
      return payload;
    } on TimeoutException {
      throw ApiException(
        'The server took too long. Refresh to check whether your change was saved before retrying.',
      );
    } on SocketException {
      throw ApiException(
        'Cannot reach Tow. Check your connection and try again.',
      );
    } on http.ClientException {
      throw ApiException(
        'Cannot reach Tow. Check your connection and try again.',
      );
    }
  }

  Future<List<Chore>> chores() async =>
      (await request('GET', '/api/chores') as List)
          .map((e) => Chore.fromJson(e as Json))
          .toList();
  Future<List<Member>> members() async =>
      (await request('GET', '/api/members') as List)
          .map((e) => Member.fromJson(e as Json))
          .toList();
  Future<void> save(Chore? chore, Json body) async => request(
    chore == null ? 'POST' : 'PUT',
    chore == null
        ? '/api/chores'
        : '/api/chores/${Uri.encodeComponent(chore.id)}',
    body,
  );
  Future<void> update(Chore chore, Json body) => save(chore, body);
  Future<void> assign(Chore chore, String action) async => request(
    'POST',
    '/api/chores/${Uri.encodeComponent(chore.id)}/assignment',
    {'action': action},
  );
  Future<void> delete(Chore chore) async =>
      request('DELETE', '/api/chores/${Uri.encodeComponent(chore.id)}');
}
