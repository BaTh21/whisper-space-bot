import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:whisper_space_flutter/features/chat/model/group_message_model/group_message_model.dart';
import 'package:whisper_space_flutter/features/chat/voice_player.dart';
import 'package:whisper_space_flutter/features/chat/video_player.dart';

class MessageBubble extends StatelessWidget {
  final dynamic msg;
  final bool isMe;
  final bool isSeen;
  final Function(String action, dynamic msg)? onAction;
  final ParentMessageModel? repliedMessage;

  const MessageBubble({
    super.key,
    required this.msg,
    required this.isMe,
    required this.isSeen,
    this.onAction,
    this.repliedMessage,
  });

  bool get isUploading => msg.id == -1;

  void _showBottomMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) {
        bool showMore = false;

        return StatefulBuilder(builder: (context, setState) {
          List<Map<String, dynamic>> mainActions = [
            {'icon': Icons.push_pin, 'label': 'Pin', 'value': 'pin'},
            {'icon': Icons.reply, 'label': 'Reply', 'value': 'reply'},
            {'icon': Icons.emoji_emotions, 'label': 'React', 'value': 'react'},
            {'icon': Icons.forward, 'label': 'Forward', 'value': 'forward'},
          ];

          List<Map<String, dynamic>> moreActions = [
            if (msg.type != 'text')
              {'icon': Icons.save_alt, 'label': 'Save', 'value': 'save'},
            if (msg.type != 'text')
              {
                'icon': Icons.visibility,
                'label': 'Preview',
                'value': 'preview'
              },
            if (msg.type != 'text' && msg.type != 'voice')
              {'icon': Icons.autorenew, 'label': 'Replace', 'value': 'replace'},
            if (isMe) {'icon': Icons.edit, 'label': 'Edit', 'value': 'edit'},
            if (isMe)
              {'icon': Icons.delete, 'label': 'Delete', 'value': 'delete'},
          ];

          final actionsToShow =
              showMore ? [...mainActions, ...moreActions] : mainActions;

          return Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Wrap(
                  spacing: 24,
                  runSpacing: 12,
                  alignment: WrapAlignment.start,
                  children: actionsToShow.map((action) {
                    return GestureDetector(
                      onTap: () {
                        Navigator.pop(context);
                        onAction?.call(action['value'].toString(), msg);
                      },
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: Colors.grey.shade200,
                            child: Icon(
                              action['icon'] as IconData,
                              size: 28,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(action['label'].toString(),
                              style: const TextStyle(fontSize: 12)),
                        ],
                      ),
                    );
                  }).toList(),
                ),
                if (!showMore && moreActions.isNotEmpty)
                  TextButton(
                    onPressed: () => setState(() => showMore = true),
                    child: const Text('More'),
                  ),
              ],
            ),
          );
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: () => _showBottomMenu(context),
      child: Align(
        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: (msg.fileUrl != null) ? 0 : 8,
            vertical: (msg.fileUrl != null) ? 0 : 6,
          ),
          decoration: BoxDecoration(
            color: (msg.fileUrl != null)
                ? Colors.transparent
                : isMe
                    ? Theme.of(context).primaryColor
                    : Colors.grey.shade300,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            crossAxisAlignment:
                isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              if (msg.parentMessage != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 4),
                  padding: const EdgeInsets.all(6),
                  constraints: BoxConstraints(
                    maxWidth: 200,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.reply, size: 16, color: Colors.green),
                      const SizedBox(width: 4),

                      Expanded(
                        child: () {
                          final parent = msg.parentMessage!;
                          switch (parent.type) {
                            case 'text':
                              return Text(
                                parent.content ?? '',
                                style: const TextStyle(
                                    fontSize: 12, color: Colors.grey),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              );
                            case 'file':
                              return Row(
                                children: const [
                                  Icon(Icons.insert_drive_file,
                                      size: 14, color: Colors.grey),
                                  SizedBox(width: 4),
                                  Text('File',
                                      style: TextStyle(
                                          fontSize: 12, color: Colors.grey)),
                                ],
                              );
                            case 'voice':
                              return Row(
                                children: const [
                                  Icon(Icons.mic, size: 14, color: Colors.grey),
                                  SizedBox(width: 4),
                                  Text('Voice Message',
                                      style: TextStyle(
                                          fontSize: 12, color: Colors.grey)),
                                ],
                              );
                            case 'image':
                              return Row(
                                children: const [
                                  Icon(Icons.image,
                                      size: 14, color: Colors.grey),
                                  SizedBox(width: 4),
                                  Text('Image',
                                      style: TextStyle(
                                          fontSize: 12, color: Colors.grey)),
                                ],
                              );
                            case 'video':
                              return Row(
                                children: const [
                                  Icon(Icons.videocam,
                                      size: 14, color: Colors.grey),
                                  SizedBox(width: 4),
                                  Text('Video',
                                      style: TextStyle(
                                          fontSize: 12, color: Colors.grey)),
                                ],
                              );
                            default:
                              return const Text(
                                'Attachment',
                                style:
                                    TextStyle(fontSize: 12, color: Colors.grey),
                              );
                          }
                        }(),
                      ),
                    ],
                  ),
                ),
              if (msg.type == "image" && msg.fileUrl != null)
                _buildImage(context),
              if (msg.type == "video" && msg.fileUrl != null)
                _buildVideo(context),
              if (msg.type == "file" && msg.fileUrl != null)
                _buildFile(context),
              if (msg.type == "voice" && msg.voiceUrl != null)
                _buildVoice(context),
              if (msg.type == "text" && msg.content != null)
                _buildText(context),
              if (msg.voiceUrl == null && msg.fileUrl == null)
                _buildTime(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImage(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: msg.fileUrl!.startsWith("http")
              ? CachedNetworkImage(
                  imageUrl: msg.fileUrl!,
                  width: 200,
                  height: 200,
                  fit: BoxFit.cover,
                )
              : Image.file(
                  File(msg.fileUrl!),
                  width: 200,
                  height: 200,
                  fit: BoxFit.cover,
                ),
        ),
        if (isUploading) _uploadOverlay(),
        _timeOverlay(),
      ],
    );
  }

  Widget _buildVideo(BuildContext context) {
    return Stack(
      children: [
        VideoMessagePlayer(
          url: msg.fileUrl!,
          isOwn: isMe,
          width: 250,
          height: 150,
        ),
        if (isUploading) _uploadOverlay(),
        _timeOverlay(),
      ],
    );
  }

  Widget _buildFile(BuildContext context) {
    final fileName = msg.fileUrl!.split('/').last;

    return Container(
      width: 220,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: isMe ? Colors.blue.shade400 : Colors.grey.shade200,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.insert_drive_file, size: 30),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              fileName,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVoice(BuildContext context) {
    return Column(
      crossAxisAlignment:
          isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Stack(
          children: [
            VoiceMessagePlayer(
              url: msg.voiceUrl!,
              isOwn: isMe,
            ),
            Positioned(
              bottom: 0,
              right: 0,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 4,
                  vertical: 2,
                ),
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
    );
  }

  Widget _buildText(BuildContext context) {
    return Text(
      msg.content ?? '',
      style: TextStyle(
        fontSize: 16,
        color: isMe ? Colors.white : Colors.black,
      ),
    );
  }

  Widget _buildTime(BuildContext context) {
    final isEdited = msg.updatedAt != null && msg.updatedAt != msg.createdAt;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          _formatTime(msg.createdAt),
          style: TextStyle(
            fontSize: 11,
            color: isMe ? Colors.white : Colors.black,
          ),
        ),

        // ✅ Edited label
        if (isEdited) ...[
          const SizedBox(width: 4),
          Text(
            'edited',
            style: TextStyle(
              fontSize: 10,
              fontStyle: FontStyle.italic,
              color: isMe ? Colors.white70 : Colors.grey,
            ),
          ),
        ],

        if (isMe) ...[
          const SizedBox(width: 4),
          Icon(
            isSeen ? Icons.done_all : Icons.check,
            size: 14,
            color: isSeen ? Colors.white : Colors.grey,
          ),
        ],
      ],
    );
  }

  Widget _uploadOverlay() {
    return Positioned.fill(
      child: Container(
        decoration: BoxDecoration(
          color: Colors.black45,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(
          child: CircularProgressIndicator(color: Colors.white),
        ),
      ),
    );
  }

  Widget _timeOverlay() {
    final isEdited = msg.updatedAt != null && msg.updatedAt != msg.createdAt;

    return Positioned(
      bottom: 4,
      right: 6,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.5),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _formatTime(msg.createdAt),
              style: const TextStyle(fontSize: 11, color: Colors.white),
            ),
            if (isEdited) ...[
              const SizedBox(width: 4),
              const Text(
                'edited',
                style: TextStyle(
                  fontSize: 10,
                  color: Colors.white70,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime date) {
    return "${date.hour}:${date.minute.toString().padLeft(2, '0')}";
  }
}
