import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:whisper_space_flutter/features/chat/voice_player.dart';
import 'package:whisper_space_flutter/features/chat/video_player.dart';

class MessageBubble extends StatelessWidget {
  final dynamic msg;
  final bool isMe;
  final bool isSeen;

  const MessageBubble({
    super.key,
    required this.msg,
    required this.isMe,
    required this.isSeen,
  });

  bool get isUploading => msg.id == -1;

  @override
  Widget build(BuildContext context) {
    return Align(
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
            if (msg.type == "image" && msg.fileUrl != null)
              _buildImage(context),
            if (msg.type == "video" && msg.fileUrl != null)
              _buildVideo(context),
            if (msg.type == "file" && msg.fileUrl != null) _buildFile(context),
            if (msg.type == "voice" && msg.voiceUrl != null)
              _buildVoice(context),
            if (msg.type == "text" && msg.content != null) _buildText(context),
            if (msg.voiceUrl == null && msg.fileUrl == null)
              _buildTime(context),
          ],
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
    return Positioned(
      bottom: 4,
      right: 6,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
        decoration: BoxDecoration(
          color: Colors.black.withOpacity(0.5),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          _formatTime(msg.createdAt),
          style: const TextStyle(fontSize: 11, color: Colors.white),
        ),
      ),
    );
  }

  String _formatTime(DateTime date) {
    return "${date.hour}:${date.minute.toString().padLeft(2, '0')}";
  }
}
