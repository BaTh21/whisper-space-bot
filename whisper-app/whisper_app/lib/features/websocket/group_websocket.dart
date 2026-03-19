import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:whisper_space_flutter/core/services/storage_service.dart';
import 'package:whisper_space_flutter/core/constants/api_constants.dart';
import 'package:whisper_space_flutter/features/chat/model/chat_model/chat_list_model.dart';

class GroupWebsocket {
  final int groupId;
  final StorageService storageService;
  WebSocketChannel? _channel;
  Stream<Map<String, dynamic>>? _broadcastStream;

  GroupWebsocket({required this.groupId, required this.storageService});

  Future<WebSocketChannel> connect() async {
    final token = storageService.getToken();
    if (token == null) throw Exception('User is not authenticated');

    final url = Uri.parse(
      '${ApiConstants.wsBaseUrl}/api/v1/ws/group/$groupId?token=$token',
    );

    _channel = WebSocketChannel.connect(url);

    _broadcastStream = _channel!.stream
        .map((event) => jsonDecode(event) as Map<String, dynamic>)
        .asBroadcastStream();

    _broadcastStream!.listen(
      (event) => print('WS DEBUG: $event'),
      onError: (err) => print('WS ERROR: $err'),
      onDone: () => print('WS CLOSED'),
    );

    return _channel!;
  }

  void send(Map<String, dynamic> data) {
    _channel?.sink.add(jsonEncode(data));
  }

  void sendMessage(String content, String? replyTo, {String? tempId}) {
    send({
      "message_type": "text",
      "reply_to": replyTo,
      "content": content,
      "temp_id": tempId ?? DateTime.now().millisecondsSinceEpoch.toString(),
    });
  }

  void sendEditMessage(int messageId, String newContent) {
    send({
      "action": "edit",
      "message_id": messageId,
      "new_content": newContent,
    });
  }

  void sendDeleteMessage(int messageId) {
    send({"action": "delete", "message_id": messageId});
  }

  void sendForward(int messageId, Set<int> users, Set<int> groups) {
    send({
      "action": "forward",
      "message_id": messageId,
      "targets": {
        "users": users.toList(),
        "groups": groups.toList(),
      }
    });
  }

  void sendPing() => send({"action": "ping"});
  void requestOnlineUsers() => send({"action": "online_users"});
  void sendSeen(int messageId) =>
      send({"action": "seen", "message_id": messageId});

  Stream<Map<String, dynamic>> get stream {
    if (_broadcastStream == null) {
      throw Exception('WebSocket not connected yet');
    }
    return _broadcastStream!;
  }

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
    _broadcastStream = null;
  }
}
