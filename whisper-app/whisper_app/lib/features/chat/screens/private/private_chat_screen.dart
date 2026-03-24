// lib/features/chat/screens/private/private_chat_screen.dart
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

class PrivateChatScreen extends StatefulWidget {
  final int userId;
  final String userName;

  const PrivateChatScreen({
    super.key,
    required this.userId,
    required this.userName,
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
  String? _error;
  User? _userDetails;
  
  final ImagePicker _imagePicker = ImagePicker();
  final AudioPlayer _audioPlayer = AudioPlayer();
  final AudioRecorder _audioRecorder = AudioRecorder();
  String? _currentlyPlayingId;
  
  int _currentUserId = 0;

  @override
  void initState() {
    super.initState();
    _messageController = TextEditingController();
    _scrollController = ScrollController();
    _initServices();
    
    _audioPlayer.playerStateStream.listen((playerState) {
      if (mounted && playerState.processingState == ProcessingState.completed) {
        setState(() {
          _currentlyPlayingId = null;
        });
      }
    });
  }

Future<void> _initServices() async {
  storageService = StorageService();
  await storageService.init();
  
  try {
    _currentUserId = await storageService.getUserId() ?? 0;
  } catch (e) {
    _currentUserId = 0;
  }
  
  chatApi = ChatAPISource(storageService: storageService);
  await _loadUserDetails();
  await _loadMessages();
}

  Future<void> _loadUserDetails() async {
    try {
      final userDetails = await chatApi.getUserDetails(widget.userId);
      if (mounted) {
        setState(() {
          _userDetails = userDetails;
        });
      }
    } catch (e) {
      // Silently fail - user details not critical
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
    if (mounted) {
      setState(() {
        _messages = [];
        _isLoading = false;
        _error = null; 
      });
    }
  }
}

  Future<void> _markMessagesAsRead() async {
    try {
      await chatApi.markPrivateMessagesAsRead(widget.userId);
    } catch (e) {
      // Silently fail
    }
  }

  Future<void> _sendMessage({String? content, File? file, String? fileType}) async {
    if ((content == null || content.trim().isEmpty) && file == null) return;
    
    setState(() => _isSending = true);
    
    final tempId = DateTime.now().millisecondsSinceEpoch.toString();
    
    try {
      PrivateMessageModel? message;
      
      if (file != null) {
        if (fileType == 'audio') {
          message = await chatApi.uploadPrivateVoice(
            receiverId: widget.userId,
            file: file,
            tempId: tempId,
          );
        } else {
          message = await chatApi.uploadPrivateFile(
            receiverId: widget.userId,
            file: file,
            tempId: tempId,
          );
        }
      } else if (content != null && content.trim().isNotEmpty) {
        message = await chatApi.sendPrivateMessage(
          receiverId: widget.userId,
          content: content.trim(),
          tempId: tempId,
        );
      }
      
      if (message != null && mounted) {
        setState(() {
          _messages.add(message!);
          _messageController.clear();
        });
        _scrollToBottom();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send message: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSending = false);
      }
    }
  }

  Future<void> _pickImage() async {
    final permission = await Permission.photos.request();
    if (!permission.isGranted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Permission denied to pick images')),
        );
      }
      return;
    }

    final pickedFile = await _imagePicker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null && mounted) {
      await _sendMessage(file: File(pickedFile.path), fileType: 'image');
    }
  }

  Future<void> _takePhoto() async {
    final permission = await Permission.camera.request();
    if (!permission.isGranted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Permission denied to use camera')),
        );
      }
      return;
    }

    final pickedFile = await _imagePicker.pickImage(source: ImageSource.camera);
    if (pickedFile != null && mounted) {
      await _sendMessage(file: File(pickedFile.path), fileType: 'image');
    }
  }

  Future<void> _pickVideo() async {
    final permission = await Permission.photos.request();
    if (!permission.isGranted) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Permission denied to pick videos')),
        );
      }
      return;
    }

    final pickedFile = await _imagePicker.pickVideo(source: ImageSource.gallery);
    if (pickedFile != null && mounted) {
      await _sendMessage(file: File(pickedFile.path), fileType: 'video');
    }
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

  void _playAudio(String url, String messageId) async {
    if (_currentlyPlayingId == messageId) {
      await _audioPlayer.stop();
      if (mounted) {
        setState(() => _currentlyPlayingId = null);
      }
    } else {
      await _audioPlayer.stop();
      await _audioPlayer.setAudioSource(AudioSource.uri(Uri.parse(url)));
      await _audioPlayer.play();
      if (mounted) {
        setState(() => _currentlyPlayingId = messageId);
      }
    }
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _audioPlayer.dispose();
    _audioRecorder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final backgroundColor = isDarkMode ? const Color(0xFF121212) : Colors.grey[100]!;
    
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.userName),
            if (_userDetails != null)
              Text(
                _userDetails!.isOnline ? 'Online' : 'Offline',
                style: TextStyle(
                  fontSize: 12,
                  color: _userDetails!.isOnline ? Colors.green : Colors.grey,
                ),
              ),
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _error!,
                        style: const TextStyle(color: Colors.red),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadMessages,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 12,
                        ),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final message = _messages[index];
                          final isMe = message.senderId == _currentUserId;
                          
                          return MessageBubble(
                            message: message,
                            isMe: isMe,
                            onPlayAudio: () => _playAudio(
                              message.fileUrl ?? '',
                              message.id.toString(),
                            ),
                            isPlaying: _currentlyPlayingId == message.id.toString(),
                          );
                        },
                      ),
                    ),
                    _buildMessageInput(isDarkMode, backgroundColor),
                  ],
                ),
    );
  }

  Widget _buildMessageInput(bool isDarkMode, Color backgroundColor) {
    final primaryColor = Theme.of(context).primaryColor;
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: isDarkMode ? const Color(0xFF1E1E1E) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 4,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          PopupMenuButton<String>(
            icon: Icon(
              Icons.attach_file,
              color: isDarkMode ? Colors.white70 : Colors.grey[600],
            ),
            onSelected: (value) {
              switch (value) {
                case 'image_gallery':
                  _pickImage();
                  break;
                case 'image_camera':
                  _takePhoto();
                  break;
                case 'video':
                  _pickVideo();
                  break;
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'image_gallery',
                child: Row(
                  children: [
                    Icon(Icons.photo_library, size: 20),
                    SizedBox(width: 12),
                    Text('Gallery'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'image_camera',
                child: Row(
                  children: [
                    Icon(Icons.camera_alt, size: 20),
                    SizedBox(width: 12),
                    Text('Camera'),
                  ],
                ),
              ),
              const PopupMenuItem(
                value: 'video',
                child: Row(
                  children: [
                    Icon(Icons.videocam, size: 20),
                    SizedBox(width: 12),
                    Text('Video'),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(width: 4),
          VoiceRecorderWidget(
            onRecordingComplete: (file) async {
              await _sendMessage(file: file, fileType: 'audio');
            },
          ),
          const SizedBox(width: 4),
          Expanded(
            child: TextField(
              controller: _messageController,
              maxLines: null,
              style: TextStyle(
                color: isDarkMode ? Colors.white : Colors.black,
              ),
              decoration: InputDecoration(
                hintText: 'Type a message...',
                hintStyle: TextStyle(
                  color: isDarkMode ? Colors.white54 : Colors.grey[400],
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
                filled: true,
                fillColor: backgroundColor,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            child: IconButton(
              onPressed: _isSending
                  ? null
                  : () => _sendMessage(content: _messageController.text),
              icon: _isSending
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      Icons.send,
                      color: _messageController.text.trim().isEmpty
                          ? (isDarkMode ? Colors.white38 : Colors.grey[400])
                          : primaryColor,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}