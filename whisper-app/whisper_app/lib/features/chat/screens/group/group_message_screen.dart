import 'dart:async';
import 'dart:core';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:whisper_space_flutter/core/services/storage_service.dart';
import 'package:whisper_space_flutter/features/websocket/group_websocket.dart';
import 'package:whisper_space_flutter/features/chat/model/group_message_model/group_message_model.dart';
import '../../chat_api_service.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:file_picker/file_picker.dart';
import './message_bubble_screen.dart';
import 'package:awesome_emoji_picker/awesome_emoji_picker.dart';
import './group_dialog//forward_dialog.dart';

String _formatTime(DateTime dateTime) {
  final diff = DateTime.now().difference(dateTime);
  if (diff.inMinutes < 1) {
    return "Just now";
  }
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
  final ImagePicker _picker = ImagePicker();
  String? editingMessageId;
  String? replyingToMessageId;
  ParentMessageModel? replyingToMessage;

  final _recorder = AudioRecorder();
  bool _isRecording = false;
  String? _recordedFilePath;
  bool _showEmojiPicker = false;

  late final StreamSubscription _wsSubscription;

  bool _isLoading = true;
  bool _isLoadingMore = false;
  int _offset = 0;
  final int _limit = 30;

  final FocusNode _textFieldFocus = FocusNode();

  final allowedExtensions = {
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".webp": "image",
    ".gif": "image",
    ".pdf": "file",
    ".txt": "file",
    ".doc": "file",
    ".docx": "file",
    ".zip": "file",
    ".mp4": "video",
    ".mov": "video",
    ".mkv": "video",
  };

  String _getFileType(File file) {
    final ext = '.${file.path.split('.').last.toLowerCase()}';
    return allowedExtensions[ext] ?? 'file';
  }

  Future<void> _pickImage() async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery);

    if (image == null) return;

    _uploadImage(File(image.path));
  }

  Future<void> _pickFiles() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: allowedExtensions.keys
          .map((ext) => ext.replaceFirst('.', ''))
          .toList(),
    );

    if (result == null || result.files.isEmpty) return;

    final file = File(result.files.single.path!);
    final ext = '.${file.path.split('.').last.toLowerCase()}';

    if (!allowedExtensions.containsKey(ext)) return;

    _uploadFile(file, allowedExtensions[ext]!);
  }

  Future<void> _startRecording() async {
    if (await _recorder.hasPermission(request: true)) {
      final dir = await getTemporaryDirectory();
      final filePath =
          '${dir.path}/${DateTime.now().millisecondsSinceEpoch}.m4a';

      final config = RecordConfig(
        encoder: AudioEncoder.aacLc,
        sampleRate: 44100,
        bitRate: 128000,
      );

      await _recorder.start(
        config,
        path: filePath,
      );

      setState(() {
        _isRecording = true;
        _recordedFilePath = filePath;
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Microphone permission denied')),
      );
    }
  }

  Future<void> _stopRecording() async {
    final path = await _recorder.stop();
    setState(() => _isRecording = false);

    if (path != null) {
      _uploadVoice(File(path));
    }
  }

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
    _recorder.dispose();
    super.dispose();
  }

  void _handleWsEvent(Map<String, dynamic> data) {
    print('Websocket received data: $data');

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
            _messages[index] = _messages[index].copyWith(
              content: data['new_content'],
              updatedAt: DateTime.parse(data['updated_at']),
            );
          }
        });
        return;

      case 'file_upload':
        final index = _messages.indexWhere(
          (m) => m.tempId == data['temp_id'],
        );

        if (index != -1) {
          setState(() {
            _messages[index] = GroupMessageModel.fromJson(data);
          });
        } else {
          setState(() {
            _messages.insert(0, GroupMessageModel.fromJson(data));
          });
        }
        return;

      case 'file_update':
        final index = _messages.indexWhere(
          (m) => m.id == data['message_id'] || m.tempId == data['temp_id'],
        );

        setState(() {
          _messages[index] = _messages[index].copyWith(
            fileUrl: data['file_url'],
            type: data['message_type'],
            updatedAt: DateTime.parse(data['updated_at']),
            tempId: data['temp_id'],
            isUploading: false,
            sender: _messages[index].sender,
          );
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

    if (editingMessageId != null) {
      final index =
          _messages.indexWhere((m) => m.id.toString() == editingMessageId);

      if (index != -1) {
        final oldMessage = _messages[index];
        final editedMessage = oldMessage.copyWith(content: text);

        setState(() {
          _messages[index] = editedMessage;
          editingMessageId = null;
        });

        widget.groupWebsocket.sendEditMessage(oldMessage.id, text);
      }
    } else {
      widget.groupWebsocket.sendMessage(
        text,
        replyingToMessageId,
      );

      setState(() {
        replyingToMessageId = null;
        replyingToMessage = null;
      });
    }
    _controller.clear();
  }

  Future<void> _uploadImage(File file) async {
    final tempId = DateTime.now().microsecondsSinceEpoch.toString();
    final type = _getFileType(file);

    final tempMessage = GroupMessageModel(
        id: -1,
        tempId: tempId,
        sender: AuthorModel(
          id: widget.currentUserId,
          username: "me",
          avatar: null,
        ),
        groupId: widget.groupId,
        createdAt: DateTime.now(),
        fileUrl: file.path,
        type: type);

    setState(() {
      _messages.insert(0, tempMessage);
    });

    try {
      final message = await widget.chatApi.uploadFile(
        widget.groupId,
        file,
        tempId,
      );

      final index = _messages.indexWhere((m) => m.tempId == tempId);

      if (index != -1) {
        setState(() {
          _messages[index] = _messages[index].copyWith(
              id: message.id,
              fileUrl: message.fileUrl,
              content: message.content,
              createdAt: message.createdAt,
              seenBy: message.seenBy,
              type: message.type);
        });
      }
    } catch (e) {
      setState(() {
        _messages.removeWhere((m) => m.tempId == tempId);
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Upload failed")),
      );
    }
  }

  Future<void> _uploadVoice(File file) async {
    final tempId = DateTime.now().microsecondsSinceEpoch.toString();

    final tempMessage = GroupMessageModel(
        id: -1,
        tempId: tempId,
        sender: AuthorModel(
          id: widget.currentUserId,
          username: "me",
          avatar: null,
        ),
        groupId: widget.groupId,
        createdAt: DateTime.now(),
        voiceUrl: file.path,
        type: "voice");

    setState(() {
      _messages.insert(0, tempMessage);
    });

    try {
      final message = await widget.chatApi.uploadVoice(
        widget.groupId,
        file,
        tempId,
      );

      final index = _messages.indexWhere((m) => m.tempId == tempId);

      if (index != -1) {
        setState(() {
          _messages[index] = _messages[index].copyWith(
              id: message.id,
              voiceUrl: message.voiceUrl,
              content: message.content,
              createdAt: message.createdAt,
              seenBy: message.seenBy,
              type: message.type);
        });
      }
    } catch (e) {
      setState(() {
        _messages.removeWhere((m) => m.tempId == tempId);
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Upload failed")),
      );
    }
  }

  Future<void> _uploadFile(File file, String type) async {
    final tempId = DateTime.now().microsecondsSinceEpoch.toString();

    final tempMessage = GroupMessageModel(
      id: -1,
      tempId: tempId,
      sender: AuthorModel(
        id: widget.currentUserId,
        username: "me",
        avatar: null,
      ),
      groupId: widget.groupId,
      createdAt: DateTime.now(),
      fileUrl: file.path,
      type: type,
    );

    setState(() => _messages.insert(0, tempMessage));

    try {
      final message = await widget.chatApi.uploadFile(
        widget.groupId,
        file,
        tempId,
      );

      final index = _messages.indexWhere((m) => m.tempId == tempId);
      if (index != -1) {
        setState(() {
          _messages[index] = _messages[index].copyWith(
              id: message.id,
              fileUrl: message.fileUrl,
              content: message.content,
              createdAt: message.createdAt,
              seenBy: message.seenBy,
              type: message.type);
        });
      }
    } catch (e) {
      setState(() => _messages.removeWhere((m) => m.tempId == tempId));

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Upload failed")),
      );
    }
  }

  Future<void> _handleReplaceFile(dynamic msg) async {
    final tempId = DateTime.now().microsecondsSinceEpoch.toString();

    final result = await FilePicker.platform.pickFiles();
    if (result == null || result.files.single.path == null) return;

    final file = File(result.files.single.path!);
    final type = _getFileType(file);

    final index = _messages.indexWhere((m) => m.id == msg.id);
    if (index == -1) return;

    final oldMessage = _messages[index];

    try {
      setState(() {
        _messages[index] = oldMessage.copyWith(
            tempId: tempId, fileUrl: file.path, type: type, isUploading: true);
      });

      final updatedMessage = await widget.chatApi.updateFileMessage(
        msg.id,
        file,
        tempId,
      );

      setState(() {
        _messages[index] = updatedMessage.copyWith(
          sender: _messages[index].sender,
          isUploading: false,
        );
      });
    } catch (e) {
      final rollbackIndex = _messages.indexWhere(
        (m) => m.id == msg.id || m.tempId == tempId,
      );

      if (rollbackIndex != -1) {
        setState(() {
          _messages[rollbackIndex] = oldMessage;
        });
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Replace failed")),
      );
    }
  }

  void _handleBubbleAction(String action, dynamic msg) {
    switch (action) {
      case 'edit':
        _controller.text = msg.content ?? '';
        _controller.selection = TextSelection.fromPosition(
          TextPosition(offset: _controller.text.length),
        );

        setState(() {
          editingMessageId = msg.id.toString();
        });
        break;

      case 'delete':
        widget.groupWebsocket.sendDeleteMessage(msg.id);
        setState(() {
          _messages.removeWhere((m) => m.id == msg.id);
        });
        break;

      case 'reply':
        setState(() {
          replyingToMessageId = msg.id.toString();
          replyingToMessage = ParentMessageModel(
            id: msg.id,
            sender: msg.sender,
            content: msg.content,
            callContent: msg.callContent,
            fileUrl: msg.fileUrl,
            voiceUrl: msg.voiceUrl,
            type: msg.type,
          );
        });
        break;
      case 'forward':
        _showForwardDialog(msg);
        break;
      case 'replace':
        _handleReplaceFile(msg);
        break;
      case 'pin':
      case 'react':
      case 'save':
      case 'preview':
        break;
    }
  }

  void _showAttachmentOptions() {
    showModalBottomSheet(
      context: context,
      builder: (context) {
        return SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.image),
                title: const Text('Image'),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage();
                },
              ),
              ListTile(
                leading: const Icon(Icons.insert_drive_file),
                title: const Text('File'),
                onTap: () {
                  Navigator.pop(context);
                  _pickFiles();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showForwardDialog(GroupMessageModel msg) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) {
        return ForwardDialog(
          currentGroupId: widget.groupId,
          message: msg,
          getChats: widget.chatApi.getChats,
          onSend: (msgId, users, groups) {
            widget.groupWebsocket.sendForward(msgId, users, groups);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text("Message forwarded")),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final isDark = Theme.of(context).brightness == Brightness.dark;

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
                child: MessageBubble(
                  msg: msg,
                  isMe: isMe,
                  currentUserId: widget.currentUserId,
                  isSeen: isSeen,
                  repliedMessage: msg.parentMessage,
                  onAction: _handleBubbleAction,
                ),
              );
            },
          ),
        ),
        SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (replyingToMessage != null)
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Reply icon
                      const Icon(Icons.reply, size: 20, color: Colors.green),
                      const SizedBox(width: 8),

                      // Message preview
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Replying to:',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: Colors.black54,
                              ),
                            ),
                            const SizedBox(height: 2),

                            // Dynamic preview based on type
                            if (replyingToMessage!.type == 'text' &&
                                replyingToMessage!.content != null)
                              Text(
                                replyingToMessage!.content!,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Colors.black87,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              )
                            else if (replyingToMessage!.type == 'file' &&
                                replyingToMessage!.fileUrl != null)
                              Row(
                                children: const [
                                  Icon(Icons.insert_drive_file,
                                      size: 16, color: Colors.grey),
                                  SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      'File',
                                      style: TextStyle(
                                          fontSize: 13, color: Colors.black87),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              )
                            else if (replyingToMessage!.type == 'voice' &&
                                replyingToMessage!.voiceUrl != null)
                              Row(
                                children: const [
                                  Icon(Icons.mic, size: 16, color: Colors.grey),
                                  SizedBox(width: 4),
                                  Text(
                                    'Voice Message',
                                    style: TextStyle(
                                        fontSize: 13, color: Colors.black87),
                                  ),
                                ],
                              )
                            else if (replyingToMessage!.type == 'image' &&
                                replyingToMessage!.fileUrl != null)
                              Row(
                                children: const [
                                  Icon(Icons.image,
                                      size: 16, color: Colors.grey),
                                  SizedBox(width: 4),
                                  Text(
                                    'Image',
                                    style: TextStyle(
                                        fontSize: 13, color: Colors.black87),
                                  ),
                                ],
                              )
                            else if (replyingToMessage!.type == 'video' &&
                                replyingToMessage!.fileUrl != null)
                              Row(
                                children: const [
                                  Icon(Icons.videocam,
                                      size: 16, color: Colors.grey),
                                  SizedBox(width: 4),
                                  Text(
                                    'Video',
                                    style: TextStyle(
                                        fontSize: 13, color: Colors.black87),
                                  ),
                                ],
                              )
                            else
                              const Text(
                                'Attachment',
                                style: TextStyle(
                                    fontSize: 13, color: Colors.black87),
                              ),
                          ],
                        ),
                      ),

                      // Close button
                      GestureDetector(
                        onTap: () {
                          setState(() {
                            replyingToMessageId = null;
                            replyingToMessage = null;
                          });
                        },
                        child: const Padding(
                          padding: EdgeInsets.only(left: 8.0),
                          child: Icon(Icons.close, color: Colors.red, size: 18),
                        ),
                      ),
                    ],
                  ),
                ),
              if (editingMessageId != null)
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  color: Colors.grey.shade200,
                  child: Row(
                    children: [
                      const Icon(Icons.edit, size: 16, color: Colors.blue),
                      const SizedBox(width: 6),
                      const Expanded(
                        child: Text(
                          'Editing message',
                          style: TextStyle(fontSize: 13),
                        ),
                      ),
                      GestureDetector(
                        onTap: () {
                          setState(() => editingMessageId = null);
                          _controller.clear();
                        },
                        child: const Icon(Icons.close,
                            color: Colors.red, size: 18),
                      )
                    ],
                  ),
                ),
              Container(
                color: isDark
                    ? const Color(0xFF1E1E1E)
                    : Colors.grey[100]!, // solid background
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    // Image Picker Button
                    IconButton(
                      icon: Icon(Icons.attach_file,
                          color: isDark ? Colors.white : Colors.grey[700]),
                      onPressed: _showAttachmentOptions,
                    ),

                    const SizedBox(width: 8),

                    // Voice Record Button
                    GestureDetector(
                      onLongPressStart: (_) => _startRecording(),
                      onLongPressEnd: (_) => _stopRecording(),
                      child: Icon(
                        _isRecording ? Icons.mic : Icons.mic_none,
                        color: _isRecording
                            ? Colors.red
                            : (isDark ? Colors.white : Colors.grey[700]),
                        size: 28,
                      ),
                    ),

                    const SizedBox(width: 8),

                    // Text Input
                    Expanded(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: isDark ? Color(0xFF121212) : Colors.grey[300],
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(color: Colors.grey[300]!),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _controller,
                                decoration: InputDecoration(
                                  hintText: editingMessageId != null
                                      ? 'Edit message...'
                                      : 'Type a message...',
                                  border: InputBorder.none,
                                ),
                                minLines: 1,
                                maxLines: 5,
                              ),
                            ),

                            // Emoji Button
                            IconButton(
                              icon: Icon(
                                Icons.emoji_emotions_outlined,
                                color: editingMessageId != null
                                    ? Colors.blue
                                    : (isDark ? Colors.white70 : Colors.grey),
                              ),
                              onPressed: () {
                                setState(() {
                                  _showEmojiPicker = !_showEmojiPicker;
                                });
                              },
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(width: 8),

                    // Send Button
                    IconButton(
                      icon: Icon(
                        Icons.send,
                        color: _controller.text.trim().isEmpty
                            ? (isDark ? Colors.white38 : Colors.grey[400])
                            : Theme.of(context).primaryColor,
                      ),
                      onPressed:
                          _controller.text.trim().isEmpty ? null : _sendMessage,
                    ),
                  ],
                ),
              ),

              // Emoji Picker
              if (_showEmojiPicker)
                SizedBox(
                  height: 250,
                  child: AwesomeEmojiPicker(
                    onEmojiSelected: (emoji) {
                      _controller.text += emoji.char;
                      _controller.selection = TextSelection.fromPosition(
                        TextPosition(offset: _controller.text.length),
                      );
                    },
                    emojiSize: 32.0,
                    cellSize: 48.0,
                    categoryBarPadding: const EdgeInsets.symmetric(vertical: 8),
                    categoryBarHeight: 30.0,
                    iconSize: 30.0,
                  ),
                ),
            ],
          ),
        )
      ],
    );
  }
}
