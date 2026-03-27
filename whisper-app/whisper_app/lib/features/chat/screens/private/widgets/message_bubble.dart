import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../../../model/private_message_model/private_message_model.dart';
import 'image_viewer.dart';

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
    final alignment = widget.isMe ? Alignment.centerRight : Alignment.centerLeft;
    final color = widget.isMe
        ? Theme.of(context).primaryColor
        : Theme.of(context).brightness == Brightness.dark
            ? Colors.grey[800]
            : Colors.grey[200];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      child: Align(
        alignment: alignment,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75,
          ),
          child: Column(
            crossAxisAlignment: widget.isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: _buildContent(),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 4, left: 8, right: 8),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _formatTime(widget.message.createdAt),
                      style: TextStyle(
                        fontSize: 10,
                        color: Theme.of(context).brightness == Brightness.dark
                            ? Colors.white54
                            : Colors.grey[600],
                      ),
                    ),
                    if (widget.showStatus && widget.isMe) _buildStatusIcon(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusIcon() {
    switch (widget.message.status) {
      case MessageStatus.sending:
        return const Padding(
          padding: EdgeInsets.only(left: 4),
          child: SizedBox(
            width: 12,
            height: 12,
            child: CircularProgressIndicator(strokeWidth: 1.5),
          ),
        );
      case MessageStatus.failed:
        return Padding(
          padding: const EdgeInsets.only(left: 4),
          child: GestureDetector(
            onTap: widget.onRetry,
            child: const Icon(Icons.error_outline, size: 12, color: Colors.red),
          ),
        );
      case MessageStatus.sent:
        return const Padding(
          padding: EdgeInsets.only(left: 4),
          child: Icon(Icons.done, size: 12, color: Colors.grey),
        );
    }
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

    if (widget.message.hasFile) {
      if (widget.message.isImage) return _buildImageContent();
      if (widget.message.isVideo) return _buildVideoContent();
      if (widget.message.isAudio) return _buildAudioContent();
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

  Widget _buildVideoContent() {
    if (widget.message.status == MessageStatus.sending) {
      return Container(
        width: 200,
        height: 200,
        color: Colors.grey[300],
        child: const Center(child: CircularProgressIndicator()),
      );
    }
    if (!_isVideoInitialized) {
      return Container(
        width: 200,
        height: 200,
        color: Colors.grey[300],
        child: const Center(child: CircularProgressIndicator()),
      );
    }
    return GestureDetector(
      onTap: () {
        if (_videoController!.value.isPlaying) {
          _videoController!.pause();
        } else {
          _videoController!.play();
        }
        setState(() {});
      },
      child: Stack(
        alignment: Alignment.center,
        children: [
          AspectRatio(
            aspectRatio: _videoController!.value.aspectRatio,
            child: VideoPlayer(_videoController!),
          ),
          if (!_videoController!.value.isPlaying)
            Container(
              decoration: const BoxDecoration(
                color: Colors.black54,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.play_arrow, color: Colors.white, size: 48),
            ),
        ],
      ),
    );
  }

  Widget _buildAudioContent() {
    final duration = widget.message.voiceDuration ?? 0;
    final progress = widget.playingProgress ?? 0.0;

    return GestureDetector(
      onTap: widget.onPlayAudio,
      child: Container(
        width: 200,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  widget.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
                  color: widget.isMe ? Colors.white : Colors.blue,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    duration > 0
                        ? _formatDuration(Duration(seconds: duration.toInt()))
                        : 'Voice Message',
                    style: TextStyle(color: widget.isMe ? Colors.white : null, fontSize: 12),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            LinearProgressIndicator(
              value: widget.isPlaying ? progress : 0,
              backgroundColor: Colors.grey[300],
              valueColor: AlwaysStoppedAnimation<Color>(
                widget.isMe ? Colors.white : Colors.blue,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  String _formatTime(DateTime dateTime) {
    final diff = DateTime.now().difference(dateTime);
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
    return 'Just now';
  }
}