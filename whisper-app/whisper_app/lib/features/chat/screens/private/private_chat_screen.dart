import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:just_audio/just_audio.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';
import 'package:whisper_space_flutter/core/services/storage_service.dart';
import 'package:whisper_space_flutter/features/auth/data/models/user_model.dart';

import '../../chat_api_service.dart';
import '../../model/private_message_model/private_message_model.dart';
import 'widgets/message_bubble.dart';
import 'widgets/voice_recorder_widget.dart';
import '../private/user_profile_screen.dart';
import 'package:whisper_space_flutter/features/auth/presentation/screens/providers/auth_provider.dart';
import 'package:provider/provider.dart';
import 'package:awesome_emoji_picker/awesome_emoji_picker.dart';

import 'package:whisper_space_flutter/features/websocket/private_websocket.dart';

class PrivateChatScreen extends StatefulWidget {
  final int userId;
  final String userName;
  final String? avatarUrl;
  final VoidCallback? onChatUpdated;

  const PrivateChatScreen({
    super.key,
    required this.userId,
    required this.userName,
    this.avatarUrl,
    this.onChatUpdated,
  });

  @override
  State<PrivateChatScreen> createState() => _PrivateChatScreenState();
}

class _PrivateChatScreenState extends State<PrivateChatScreen> {
  late ChatAPISource chatApi;
  late StorageService storageService;
  late TextEditingController _messageController;
  late ScrollController _scrollController;

  List<PrivateMessageModel> _messages = [];
  bool _isLoading = true;
  bool _isSending = false;
  User? _userDetails;
  int? _currentUserId;

  final ImagePicker _imagePicker = ImagePicker();
  final AudioPlayer _audioPlayer = AudioPlayer();
  final AudioRecorder _audioRecorder = AudioRecorder();
  String? _currentlyPlayingId;
  double _currentPlayingProgress = 0.0;
  Timer? _playbackTimer;

  final Set<String> _failedTempIds = {};
  bool _showEmojiPicker = false;

  late PrivateWebsocket _ws;

  @override
  void initState() {
    super.initState();
    _messageController = TextEditingController();
    _scrollController = ScrollController();
    _loadCurrentUser();
    _initServices();

    _audioPlayer.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        _stopPlayback();
      }
    });
    _audioPlayer.positionStream.listen((position) {
      if (mounted &&
          _currentlyPlayingId != null &&
          _audioPlayer.duration != null) {
        final progress =
            position.inMilliseconds / _audioPlayer.duration!.inMilliseconds;
        setState(() => _currentPlayingProgress = progress);
      }
    });
  }

  Future<void> _initServices() async {
    storageService = StorageService();
    await storageService.init();
    chatApi = ChatAPISource(storageService: storageService);
    await _loadUserDetails();
    await _loadMessages();

    _ws = PrivateWebsocket(
        friendId: widget.userId, storageService: storageService);
    await _connectWebsocket();

    _markMessagesAsRead();
  }

  void _loadCurrentUser() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final user = authProvider.currentUser;
      if (user != null) {
        setState(() {
          _currentUserId = user.id;
        });
      }
    });
  }

  Future<void> _loadUserDetails() async {
    try {
      final user = await chatApi.getUserDetails(widget.userId);
      if (mounted) setState(() => _userDetails = user);
    } catch (e) {
      // ignore
    }
  }

  Future<void> _loadMessages() async {
    try {
      final messages = await chatApi.getPrivateMessages(
        userId: widget.userId,
        limit: 50,
      );
      if (mounted) {
        setState(() {
          _messages = messages.reversed.toList();
          _isLoading = false;
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _markMessagesAsRead() async {
    try {
      await chatApi.markPrivateMessagesAsRead(widget.userId);
    } catch (e) {
      // ignore
    }
  }

  void _stopPlayback() {
    setState(() {
      _currentlyPlayingId = null;
      _currentPlayingProgress = 0.0;
    });
    _playbackTimer?.cancel();
    _playbackTimer = null;
  }

  void _playAudio(String url, String messageId) async {
    if (_currentlyPlayingId == messageId) {
      await _audioPlayer.stop();
      _stopPlayback();
    } else {
      await _audioPlayer.stop();
      _stopPlayback();
      await _audioPlayer.setAudioSource(AudioSource.uri(Uri.parse(url)));
      await _audioPlayer.play();
      setState(() {
        _currentlyPlayingId = messageId;
        _currentPlayingProgress = 0.0;
      });
      _playbackTimer =
          Timer.periodic(const Duration(milliseconds: 100), (timer) {
        if (_audioPlayer.position >= _audioPlayer.duration!) {
          _stopPlayback();
          timer.cancel();
        }
      });
    }
  }

  Future<void> _sendMessage({
    String? content,
    File? file,
    String? fileType,
    Duration? voiceDuration,
  }) async {
    if ((content == null || content.trim().isEmpty) && file == null) return;

    setState(() => _isSending = true);

    final tempId = DateTime.now().millisecondsSinceEpoch.toString();

    final tempMessage = PrivateMessageModel(
      id: 0,
      senderId: _currentUserId ?? 0,
      receiverId: widget.userId,
      content: content?.trim(),
      fileUrl: null,
      messageType: fileType ?? (content != null ? 'text' : 'unknown'),
      createdAt: DateTime.now(),
      isRead: false,
      tempId: tempId,
      status: MessageStatus.sending,
    );

    setState(() => _messages.add(tempMessage));
    _scrollToBottom();

    try {
      if (file != null) {
        if (fileType == 'audio') {
          await chatApi.uploadPrivateVoice(
            receiverId: widget.userId,
            file: file,
            tempId: tempId,
            voiceDuration: voiceDuration?.inSeconds.toDouble() ?? 0.0,
            replyToId: null,
          );
        } else {
          await chatApi.uploadPrivateFile(
            receiverId: widget.userId,
            file: file,
            tempId: tempId,
          );
        }

        return;
      }

      if (content != null && content.trim().isNotEmpty) {
        _ws.sendText(
          content: content.trim(),
          tempId: tempId,
        );
      }
    } catch (e) {
      setState(() {
        final index = _messages.indexWhere((m) => m.tempId == tempId);
        if (index != -1) {
          _messages[index] =
              _messages[index].copyWith(status: MessageStatus.failed);
        }
        _failedTempIds.add(tempId);
      });
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Future<void> _retryMessage(PrivateMessageModel failedMessage) async {
    if (failedMessage.tempId == null) return;
    setState(() {
      _messages.removeWhere((m) => m.tempId == failedMessage.tempId);
      _failedTempIds.remove(failedMessage.tempId);
    });
    if (failedMessage.content != null) {
      await _sendMessage(content: failedMessage.content);
    } else if (failedMessage.hasFile && failedMessage.fileUrl != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cannot retry file upload at this time')),
      );
    }
  }

  Future<void> _pickImage() async {
    Permission permission;

    if (Platform.isAndroid) {
      permission = Permission.photos; // Android < 13
    } else {
      permission = Permission.photos; // iOS
    }

    final status = await permission.request();

    if (status.isGranted) {
      final picked = await _imagePicker.pickImage(source: ImageSource.gallery);
      if (picked != null) {
        await _sendMessage(file: File(picked.path), fileType: 'image');
      }
    } else {
      _showPermissionDeniedDialog('Photos');
    }
  }

  Future<void> _takePhoto() async {
    final status = await Permission.camera.request();

    if (status.isGranted) {
      final picked = await _imagePicker.pickImage(source: ImageSource.camera);
      if (picked != null) {
        await _sendMessage(file: File(picked.path), fileType: 'image');
      }
    } else if (status.isPermanentlyDenied) {
      openAppSettings();
    } else {
      _showPermissionDeniedDialog('Camera');
    }
  }

  Future<void> _pickVideo() async {
    if (await Permission.photos.request().isGranted) {
      final picked = await _imagePicker.pickVideo(source: ImageSource.gallery);
      if (picked != null) {
        await _sendMessage(file: File(picked.path), fileType: 'video');
      }
    } else {
      _showPermissionDeniedDialog('Photos');
    }
  }

  void _showPermissionDeniedDialog(String permission) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$permission permission needed'),
        content: Text('To share media, please grant $permission permission.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => openAppSettings(),
            child: const Text('Open Settings'),
          ),
        ],
      ),
    );
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _ws.disconnect();
    _messageController.dispose();
    _scrollController.dispose();
    _audioPlayer.dispose();
    _audioRecorder.dispose();
    _playbackTimer?.cancel();
    super.dispose();
  }

  Future<void> _connectWebsocket() async {
    try {
      await _ws.connect();

      _ws.messages.listen((data) {
        if (!mounted) return;

        final type = data['type'];

        if (type == 'message') {
          final message = PrivateMessageModel.fromJson(data);
          final incomingTempId = data['temp_id'];

          setState(() {
            if (incomingTempId != null) {
              final index =
                  _messages.indexWhere((m) => m.tempId == incomingTempId);
              if (index != -1) {
                _messages[index] = message.copyWith(
                  status: MessageStatus.sent,
                );
              } else {
                _messages.add(message);
              }
            } else {
              final exists = _messages.any((m) => m.id == message.id);
              if (!exists) {
                _messages.add(message);
              }
            }

            _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
          });

          _scrollToBottom();
        } else if (type == 'message_edited') {
          final messageId = data['message_id'];
          final newContent = data['new_content'];
          final editedAt = data['edited_at'];

          setState(() {
            final index = _messages.indexWhere((m) => m.id == messageId);

            if (index != -1) {
              _messages[index] = _messages[index].copyWith(
                content: newContent,
                updatedAt: editedAt != null ? DateTime.parse(editedAt) : null,
                isEdited: true,
              );
            }
          });
        }
      });
    } catch (e) {
      print("WS Connection error: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? const Color(0xFF121212) : Colors.grey[100]!;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        title: GestureDetector(
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => UserProfileScreen(
                  userId: widget.userId,
                  userName: widget.userName,
                  avatarUrl: widget.avatarUrl,
                ),
              ),
            );
          },
          child: Row(
            children: [
              Stack(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundImage: widget.avatarUrl != null
                        ? NetworkImage(widget.avatarUrl!)
                        : null,
                    backgroundColor: widget.avatarUrl == null
                        ? Colors.grey
                        : Colors.transparent,
                    child: widget.avatarUrl == null
                        ? Text(widget.userName[0].toUpperCase())
                        : null,
                  ),
                  if (_userDetails?.isOnline == true)
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        height: 10,
                        width: 10,
                        decoration: BoxDecoration(
                          color: Colors.green,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(widget.userName),
                  if (_userDetails != null)
                    Text(
                      _userDetails!.isOnline ? 'Online' : 'Offline',
                      style: TextStyle(
                        fontSize: 12,
                        color:
                            _userDetails!.isOnline ? Colors.green : Colors.grey,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    controller: _scrollController,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
                    itemCount: _messages.length,
                    itemBuilder: (_, index) {
                      final msg = _messages[index];
                      final isMe = msg.senderId == _currentUserId;
                      return MessageBubble(
                        message: msg,
                        isMe: isMe,
                        onPlayAudio: msg.isAudio
                            ? () =>
                                _playAudio(msg.fileUrl ?? '', msg.id.toString())
                            : null,
                        isPlaying: _currentlyPlayingId == msg.id.toString(),
                        playingProgress:
                            _currentlyPlayingId == msg.id.toString()
                                ? _currentPlayingProgress
                                : null,
                        onRetry: msg.status == MessageStatus.failed
                            ? () => _retryMessage(msg)
                            : null,
                      );
                    },
                  ),
                ),
                _buildInput(isDark, bg),
              ],
            ),
    );
  }

  Widget _buildInput(bool isDark, Color bg) {
    final primary = Theme.of(context).primaryColor;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 4,
                offset: const Offset(0, -2),
              )
            ],
          ),
          child: Row(
            children: [
              PopupMenuButton<String>(
                icon: Icon(Icons.attach_file,
                    color: isDark ? Colors.white70 : Colors.grey[600]),
                onSelected: (v) {
                  if (v == 'image_gallery') _pickImage();
                  if (v == 'image_camera') _takePhoto();
                  if (v == 'video') _pickVideo();
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(
                    value: 'image_gallery',
                    child: Row(children: [
                      Icon(Icons.photo_library, size: 20),
                      SizedBox(width: 12),
                      Text('Gallery')
                    ]),
                  ),
                  PopupMenuItem(
                    value: 'image_camera',
                    child: Row(children: [
                      Icon(Icons.camera_alt, size: 20),
                      SizedBox(width: 12),
                      Text('Camera')
                    ]),
                  ),
                  PopupMenuItem(
                    value: 'video',
                    child: Row(children: [
                      Icon(Icons.videocam, size: 20),
                      SizedBox(width: 12),
                      Text('Video')
                    ]),
                  ),
                ],
              ),
              const SizedBox(width: 4),
              VoiceRecorderWidget(
                onRecordingComplete: (file, dur) => _sendMessage(
                  file: file,
                  fileType: 'audio',
                  voiceDuration: dur,
                ),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: bg,
                    borderRadius: BorderRadius.circular(24),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      /// TEXT FIELD
                      Expanded(
                        child: TextField(
                          controller: _messageController,
                          maxLines: null,
                          onTap: () {
                            if (_showEmojiPicker) {
                              setState(() => _showEmojiPicker = false);
                            }
                          },
                          style: TextStyle(
                              color: isDark ? Colors.white : Colors.black),
                          decoration: InputDecoration(
                            hintText: 'Type a message...',
                            hintStyle: TextStyle(
                              color: isDark ? Colors.white54 : Colors.grey[400],
                            ),
                            border: InputBorder.none,
                          ),
                        ),
                      ),

                      IconButton(
                        icon: Icon(
                          Icons.emoji_emotions_outlined,
                          color: isDark ? Colors.white70 : Colors.grey,
                        ),
                        onPressed: () {
                          FocusScope.of(context).unfocus();
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
              IconButton(
                onPressed: _isSending || _messageController.text.trim().isEmpty
                    ? null
                    : () =>
                        _sendMessage(content: _messageController.text.trim()),
                icon: _isSending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(
                        Icons.send,
                        color: _messageController.text.trim().isEmpty
                            ? (isDark ? Colors.white38 : Colors.grey[400])
                            : primary,
                      ),
              ),
            ],
          ),
        ),
        AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          height: _showEmojiPicker ? 250 : 0,
          child: _showEmojiPicker
              ? AwesomeEmojiPicker(
                  onEmojiSelected: (emoji) {
                    final text = _messageController.text;
                    final selection = _messageController.selection;

                    final newText = text.replaceRange(
                      selection.start,
                      selection.end,
                      emoji.char,
                    );

                    _messageController.text = newText;
                    _messageController.selection = TextSelection.collapsed(
                      offset: selection.start + emoji.char.length,
                    );
                  },
                )
              : null,
        ),
      ],
    );
  }
}
