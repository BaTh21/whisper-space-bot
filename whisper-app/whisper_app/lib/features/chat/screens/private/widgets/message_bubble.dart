import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../../model/private_message_model/private_message_model.dart';
import 'image_viewer.dart';
import 'package:whisper_space_flutter/features/chat/video_player.dart';
import 'package:whisper_space_flutter/features/chat/voice_player.dart';

class MessageBubble extends StatefulWidget {
  final PrivateMessageModel message;
  final bool isMe;
  final VoidCallback? onPlayAudio;
  final bool isPlaying;
  final double? playingProgress;
  final VoidCallback? onRetry;
  final bool showStatus;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    this.onPlayAudio,
    this.isPlaying = false,
    this.playingProgress,
    this.onRetry,
    this.showStatus = true,
  });

  @override
  State<MessageBubble> createState() => _MessageBubbleState();
}

class _MessageBubbleState extends State<MessageBubble> {
  VideoPlayerController? _videoController;
  bool _isVideoInitialized = false;

  @override
  void initState() {
    super.initState();
    if (widget.message.isVideo && widget.message.fileUrl != null) {
      _initializeVideo();
    }
  }

  Future<void> _initializeVideo() async {
    _videoController = VideoPlayerController.networkUrl(
      Uri.parse(widget.message.fileUrl!),
    );
    try {
      await _videoController!.initialize();
      if (mounted) setState(() => _isVideoInitialized = true);
    } catch (e) {
      debugPrint('Video init failed: $e');
    }
  }

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alignment =
        widget.isMe ? Alignment.centerRight : Alignment.centerLeft;
    final color = widget.isMe
        ? Theme.of(context).primaryColor
        : Theme.of(context).brightness == Brightness.dark
            ? Colors.grey[800]
            : Colors.grey[200];
    final isMedia = widget.message.hasFile &&
        (widget.message.isImage || widget.message.isVideo);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      child: Align(
        alignment: alignment,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75,
          ),
          child: Column(
            crossAxisAlignment:
                widget.isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              if (isMedia)
                // Media: Stack with absolute time/status
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    _buildContent(), // image/video widget
                    Positioned(
                      bottom: 6,
                      right: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              _formatTime(widget.message.createdAt),
                              style: const TextStyle(
                                fontSize: 10,
                                color: Colors.white,
                              ),
                            ),
                            if (widget.isMe && widget.showStatus) ...[
                              const SizedBox(width: 4),
                              _buildStatusIconInline(),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                )
              else
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  constraints: const BoxConstraints(minHeight: 40),
                  child: Column(
                    crossAxisAlignment: widget.isMe
                        ? CrossAxisAlignment.end
                        : CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildContent(),
                      const SizedBox(height: 6),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _formatTime(widget.message.createdAt),
                            style: TextStyle(
                              fontSize: 10,
                              color:
                                  widget.isMe ? Colors.white : Colors.black54,
                            ),
                          ),
                          if (widget.isMe && widget.showStatus) ...[
                            const SizedBox(width: 4),
                            _buildStatusIconInline(),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (widget.message.status == MessageStatus.failed &&
        widget.message.content?.isNotEmpty == true) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Expanded(
            child: Text(
              widget.message.content!,
              style: TextStyle(color: widget.isMe ? Colors.white : null),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: widget.onRetry,
            child: const Icon(Icons.refresh, size: 16),
          ),
        ],
      );
    }

    if (widget.message.hasFile &&
        widget.message.status == MessageStatus.sending) {
      return Container(
        width: 200,
        height: 120,
        decoration: BoxDecoration(
          color: Colors.grey[300],
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    if (widget.message.hasFile) {
      if (widget.message.isImage) {
        return _buildImageContent();
      }

      if (widget.message.isVideo && widget.message.fileUrl != null) {
        return VideoMessagePlayer(
          url: widget.message.fileUrl!,
          isOwn: widget.isMe,
        );
      }

      if (widget.message.isAudio && widget.message.fileUrl != null) {
        return VoiceMessagePlayer(
          url: widget.message.fileUrl!,
          isOwn: widget.isMe,
        );
      }

      return _buildFile();
    }

    return Text(
      widget.message.content ?? '',
      style: TextStyle(color: widget.isMe ? Colors.white : null),
    );
  }

  Widget _buildImageContent() {
    if (widget.message.status == MessageStatus.sending) {
      return Container(
        width: 200,
        height: 200,
        color: Colors.grey[300],
        child: const Center(child: CircularProgressIndicator()),
      );
    }
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => ImageViewer(imageUrl: widget.message.fileUrl!),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: CachedNetworkImage(
          imageUrl: widget.message.fileUrl!,
          placeholder: (_, __) => Container(
            width: 200,
            height: 200,
            color: Colors.grey[300],
            child: const Center(child: CircularProgressIndicator()),
          ),
          errorWidget: (_, __, ___) => Container(
            width: 200,
            height: 200,
            color: Colors.grey[300],
            child: const Icon(Icons.error),
          ),
          width: 200,
          height: 200,
          fit: BoxFit.cover,
        ),
      ),
    );
  }

  Widget _buildFile() {
    final fileName = widget.message.fileUrl?.split('/').last ?? 'File';

    return Container(
      width: 220,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color:
            widget.isMe ? Theme.of(context).primaryColor : Colors.grey.shade200,
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
              style: TextStyle(
                color: widget.isMe ? Colors.white : Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusIconInline() {
    switch (widget.message.status) {
      case MessageStatus.sending:
        return const SizedBox(
          width: 10,
          height: 10,
          child: CircularProgressIndicator(strokeWidth: 1.5),
        );

      case MessageStatus.failed:
        return GestureDetector(
          onTap: widget.onRetry,
          child: const Icon(Icons.error, size: 12, color: Colors.red),
        );

      case MessageStatus.sent:
        return Icon(
          Icons.done,
          size: 12,
          color: widget.isMe ? Colors.white70 : Colors.grey,
        );
    }
  }

  String _formatTime(DateTime dateTime) {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
    return 'Just now';
  }
}
