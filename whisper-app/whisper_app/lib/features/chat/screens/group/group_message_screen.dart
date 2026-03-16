import 'dart:async';
import 'package:flutter/material.dart';
import 'package:whisper_space_flutter/core/services/storage_service.dart';
import 'package:whisper_space_flutter/features/websocket/group_websocket.dart';
import 'package:whisper_space_flutter/features/chat/model/group_message_model/group_message_model.dart';
import '../../chat_api_service.dart';
import 'package:whisper_space_flutter/features/chat/voice_player.dart';

String _formatTime(DateTime dateTime) {
  final diff = DateTime.now().difference(dateTime);
  if (diff.inMinutes < 60) {
    return "${diff.inMinutes}m";
  } else if (diff.inHours < 24) {
    return "${diff.inHours}h";
  } else {
    return "${diff.inDays}d";
  }
}

class GroupMessageScreen extends StatefulWidget {
  final int groupId;
  final int currentUserId;
  final GroupWebsocket groupWebsocket;
  final StorageService storageService;
  final ChatAPISource chatApi;

  const GroupMessageScreen(
      {super.key,
      required this.groupId,
      required this.currentUserId,
      required this.groupWebsocket,
      required this.storageService,
      required this.chatApi});

  @override
  State<GroupMessageScreen> createState() => _GroupMessageScreenState();
}

class _GroupMessageScreenState extends State<GroupMessageScreen> {
  List<GroupMessageModel> _messages = [];
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  late final StreamSubscription _wsSubscription;

  bool _isLoading = true;
  bool _isLoadingMore = false;
  int _offset = 0;
  final int _limit = 30;

  @override
  void initState() {
    super.initState();
    _loadOldMessages();

    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
          _scrollController.position.maxScrollExtent - 50) {
        _loadOldMessages(loadMore: true);
      }
    });

    _wsSubscription = widget.groupWebsocket.stream.listen(
      (jsonData) => _handleWsEvent(jsonData),
      onError: (error) => debugPrint('WebSocket stream error: $error'),
      onDone: () => debugPrint('WebSocket stream closed'),
    );
  }

  @override
  void dispose() {
    _wsSubscription.cancel();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _handleWsEvent(Map<String, dynamic> data) {
    final action = data['action'];

    switch (action) {
      case 'pong':
      case 'online_users':
        return;

      case 'delete':
        setState(() {
          _messages.removeWhere((m) => m.id == data['message_id']);
        });
        return;

      case 'edit':
        setState(() {
          final index = _messages.indexWhere(
            (m) => m.id == data['message_id'],
          );
          if (index != -1) {
            _messages[index] =
                _messages[index].copyWith(content: data['new_content']);
          }
        });
        return;

      default:
        final message = GroupMessageModel.fromJson(data);
        setState(() => _messages.insert(0, message));
        _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0, // scroll to top when reverse:true
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _loadOldMessages({bool loadMore = false}) async {
    if (_isLoadingMore) return;
    _isLoadingMore = true;

    try {
      final messages = await widget.chatApi.getGroupMessages(
        groupId: widget.groupId,
        limit: _limit,
        offset: _offset,
      );

      setState(() {
        if (loadMore) {
          _messages = [...messages, ..._messages];
        } else {
          _messages = messages;
        }
        _offset += messages.length;
        _isLoading = false;
      });

      if (!loadMore) _scrollToBottom();
    } catch (e) {
      debugPrint('Failed to load messages: $e');
      setState(() => _isLoading = false);
    }

    _isLoadingMore = false;
  }

  void _sendMessage() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    widget.groupWebsocket.sendMessage(text);
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            reverse: true,
            controller: _scrollController,
            itemCount: _messages.length + (_isLoadingMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (_isLoadingMore && index == _messages.length) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                );
              }

              final msg = _messages[index];
              final isMe = msg.sender.id == widget.currentUserId;
              final isSeen = msg.seenBy?.isNotEmpty ?? false;

              return Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: Align(
                  alignment:
                      isMe ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    padding:
                        EdgeInsets.symmetric(horizontal: (msg.fileUrl != null) ? 0:8, vertical: (msg.fileUrl != null) ? 0:6),
                    decoration: BoxDecoration(
                      color: (msg.fileUrl != null)
                          ? Colors.transparent
                          : isMe
                              ? Theme.of(context).primaryColor
                              : Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: isMe
                          ? CrossAxisAlignment.end
                          : CrossAxisAlignment.start,
                      children: [
                        if (msg.fileUrl != null) ...[
                          Stack(
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(12),
                                child: Image.network(
                                  msg.fileUrl!,
                                  width: 200,
                                  height: 200,
                                  fit: BoxFit.cover,
                                  errorBuilder: (context, error, stackTrace) {
                                    return Container(
                                      width: 200,
                                      height: 200,
                                      color: Colors.grey.shade300,
                                      child: const Center(
                                        child: Column(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.broken_image, size: 40, color: Colors.grey),
                                            SizedBox(height: 4),
                                            Text(
                                              'Failed to load image',
                                              style: TextStyle(
                                                fontSize: 14,
                                                color: Colors.grey,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ),

                              Positioned(
                                bottom: 4,
                                right: 6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 4, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withOpacity(0.5),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        _formatTime(msg.createdAt),
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Colors.white,
                                        ),
                                      ),
                                      if (isMe) ...[
                                        const SizedBox(width: 4),
                                        Icon(
                                          isSeen ? Icons.done_all : Icons.check,
                                          size: 14,
                                          color: Colors.white,
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                        ],

                        if (msg.callContent != null) ...[
                          Container(
                            padding: const EdgeInsets.all(8),
                            margin: const EdgeInsets.only(top: 6),
                            decoration: BoxDecoration(
                              // color: Colors.blue.shade50,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Column(
                              crossAxisAlignment:
                              isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                              children: [
                                Text(
                                  msg.callContent!,
                                  style: const TextStyle(fontSize: 16, color: Colors.black87),
                                ),
                                const SizedBox(height: 6),
                                ElevatedButton(
                                  onPressed: msg.updatedAt == null
                                      ? () {
                                    debugPrint('Joining call: ${msg.id}');
                                  }
                                      : null,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: msg.updatedAt == null
                                        ? Theme.of(context).primaryColor
                                        : Colors.grey,
                                  ),
                                  child: Text(
                                    msg.updatedAt == null ? 'Join Now' : 'Call End',
                                    style: const TextStyle(color: Colors.white),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 6),
                        ],

                        if (msg.voiceUrl != null) ...[
                          Stack(
                            children: [
                              VoiceMessagePlayer(url: msg.voiceUrl!, isOwn: isMe,),
                              Positioned(
                                bottom: 0,
                                right: 0,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 4, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withOpacity(0.5),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        _formatTime(msg.createdAt),
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Colors.white,
                                        ),
                                      ),
                                      if (isMe) ...[
                                        const SizedBox(width: 4),
                                        Icon(
                                          isSeen ? Icons.done_all : Icons.check,
                                          size: 14,
                                          color: Colors.white,
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                        ],
                        if (msg.content != null) ...[
                          Text(
                            msg.content ?? msg.callContent ?? '',
                            style: TextStyle(
                              fontSize: 16,
                              color: isMe ? Colors.white : Colors.black,
                            ),
                          ),
                        ],

                        if (msg.voiceUrl == null && msg.fileUrl == null) ...[
                          const SizedBox(height: 2),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                _formatTime(msg.createdAt),
                                style: TextStyle(
                                  fontSize: 11,
                                  color: isMe ? Colors.white : Colors.black,
                                ),
                              ),
                              if (isMe) ...[
                                const SizedBox(width: 4),
                                Icon(
                                  isSeen ? Icons.done_all : Icons.check,
                                  size: 14,
                                  color: isSeen ? Colors.white : Colors.grey,
                                ),
                              ],
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        SafeArea(
            child: Padding(
          padding: const EdgeInsets.all(8),
          child: Row(
            children: [
              Expanded(
                  child: TextField(
                controller: _controller,
                decoration: const InputDecoration(
                    hintText: 'Aa...', border: OutlineInputBorder()),
              )),
              const SizedBox(
                width: 8,
              ),
              IconButton(
                icon: const Icon(Icons.send),
                onPressed: _sendMessage,
              )
            ],
          ),
        ))
      ],
    );
  }
}
