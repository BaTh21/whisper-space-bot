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

  final _recorder = AudioRecorder();
  bool _isRecording = false;
  String? _recordedFilePath;

  late final StreamSubscription _wsSubscription;

  bool _isLoading = true;
  bool _isLoadingMore = false;
  int _offset = 0;
  final int _limit = 30;

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
            _messages[index] =
                _messages[index].copyWith(content: data['new_content']);
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
            type: message.type
          );
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
      voiceUrl: file.path,
      type: "voice"
    );

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
              type: message.type
          );
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
            type: message.type
          );
        });
      }
    } catch (e) {
      setState(() => _messages.removeWhere((m) => m.tempId == tempId));

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Upload failed")),
      );
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
              bool isUploading = msg.id == -1;

              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: MessageBubble(
                  msg: msg,
                  isMe: isMe,
                  isSeen: isSeen,
                ),
              );
            },
          ),
        ),
        SafeArea(
          child: Container(
            color: Theme.of(context).primaryColor, // solid background
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              children: [
                // Image Picker Button
                IconButton(
                  icon: const Icon(Icons.attach_file, color: Colors.white),
                  onPressed: _showAttachmentOptions,
                ),

                const SizedBox(width: 8),

                // Voice Record Button
                GestureDetector(
                  onLongPressStart: (_) => _startRecording(),
                  onLongPressEnd: (_) => _stopRecording(),
                  child: Icon(
                    _isRecording ? Icons.mic : Icons.mic_none,
                    color: _isRecording ? Colors.red : Colors.white,
                    size: 28,
                  ),
                ),

                const SizedBox(width: 8),

                // Text Input
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: Colors.grey[100],
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.grey[300]!),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _controller,
                            decoration: const InputDecoration(
                              hintText: 'Type a message...',
                              border: InputBorder.none,
                            ),
                            minLines: 1,
                            maxLines: 5,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.emoji_emotions_outlined,
                              color: Colors.grey),
                          onPressed: () {},
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                // Send Button
                IconButton(
                  icon: const Icon(Icons.send, color: Colors.white),
                  onPressed: _sendMessage,
                ),
              ],
            ),
          ),
        )
      ],
    );
  }
}
