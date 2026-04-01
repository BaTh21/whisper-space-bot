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
  final void Function(String, PrivateMessageModel message)? onAction;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isMe,
    this.onPlayAudio,
    this.isPlaying = false,
    this.playingProgress,
    this.onRetry,
    this.showStatus = true,
    this.onAction
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

  void _handleAction(String action) {
    switch (action) {
      case 'pin':
        _pinMessage();
        break;
      case 'react':
        _showReactions();
        break;
      case 'forward':
        _forwardMessage();
        break;
      case 'reply':
        _replyMessage();
        break;
      case 'save':
        _saveMessage();
        break;
      case 'preview':
        _previewMessage();
        break;
      case 'edit':
        _editMessage();
        break;
      case 'delete':
        _deleteMessage();
        break;
    }
  }

  void _pinMessage() => ScaffoldMessenger.of(context)
      .showSnackBar(const SnackBar(content: Text('Message pinned')));

  void _showReactions() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        content: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: ['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) {
            return GestureDetector(
              onTap: () {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Reacted with $emoji')));
                // TODO: save reaction in backend
              },
              child: Text(emoji, style: const TextStyle(fontSize: 28)),
            );
          }).toList(),
        ),
      ),
    );
  }

  void _forwardMessage() => ScaffoldMessenger.of(context)
      .showSnackBar(const SnackBar(content: Text('Forward message')));

  void _replyMessage() => ScaffoldMessenger.of(context)
      .showSnackBar(const SnackBar(content: Text('Reply to message')));

  void _saveMessage() => ScaffoldMessenger.of(context)
      .showSnackBar(const SnackBar(content: Text('Message saved')));

  void _previewMessage() {
    if (widget.message.isImage && widget.message.fileUrl != null) {
      Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) => ImageViewer(imageUrl: widget.message.fileUrl!)));
    } else if (widget.message.isVideo && widget.message.fileUrl != null) {
      Navigator.push(
          context,
          MaterialPageRoute(
              builder: (_) => VideoMessagePlayer(
                  url: widget.message.fileUrl!, isOwn: widget.isMe)));
    }
  }

  void _editMessage() => ScaffoldMessenger.of(context)
      .showSnackBar(const SnackBar(content: Text('Edit message')));

  void _deleteMessage() => ScaffoldMessenger.of(context)
      .showSnackBar(const SnackBar(content: Text('Message deleted')));

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
                            widget.message.isEdited
                                ? "${_formatTime(widget.message.createdAt)} (edited)"
                                : _formatTime(widget.message.createdAt),
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
    Widget content;

    if (widget.message.status == MessageStatus.failed &&
        widget.message.content?.isNotEmpty == true) {
      content = Row(
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
    } else if (widget.message.hasFile &&
        widget.message.status == MessageStatus.sending) {
      content = Container(
        width: 200,
        height: 120,
        decoration: BoxDecoration(
          color: Colors.grey[300],
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Center(child: CircularProgressIndicator()),
      );
    } else if (widget.message.hasFile) {
      if (widget.message.isImage)
        content = _buildImageContent();
      else if (widget.message.isVideo && widget.message.fileUrl != null) {
        content = VideoMessagePlayer(
            url: widget.message.fileUrl!, isOwn: widget.isMe);
      } else if (widget.message.isAudio && widget.message.fileUrl != null) {
        content = VoiceMessagePlayer(
            url: widget.message.fileUrl!, isOwn: widget.isMe);
      } else {
        content = _buildFile();
      }
    } else {
      content = Text(
        widget.message.content ?? '',
        style: TextStyle(color: widget.isMe ? Colors.white : null),
      );
    }

    return GestureDetector(
      onLongPress: _showMessageOptions,
      child: content,
    );
  }

  void _showMessageOptions() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).brightness == Brightness.dark
          ? Colors.grey[900]
          : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
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
            if (widget.message.hasFile ||
                (widget.message.content?.isNotEmpty ?? false))
              {'icon': Icons.save_alt, 'label': 'Save', 'value': 'save'},
            if (widget.message.hasFile)
              {
                'icon': Icons.visibility,
                'label': 'Preview',
                'value': 'preview'
              },
            if (widget.isMe)
              {'icon': Icons.edit, 'label': 'Edit', 'value': 'edit'},
            if (widget.isMe)
              {'icon': Icons.delete, 'label': 'Delete', 'value': 'delete'},
          ];

          final actionsToShow =
              showMore ? [...mainActions, ...moreActions] : mainActions;

          return Container(
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
                        _handleAction(action['value'].toString());
                      },
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor:
                                Theme.of(context).brightness == Brightness.dark
                                    ? Colors.grey[800]
                                    : Colors.grey.shade200,
                            child: Icon(
                              action['icon'] as IconData,
                              size: 28,
                              color: Theme.of(context).brightness ==
                                      Brightness.dark
                                  ? Colors.white
                                  : Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            action['label'].toString(),
                            style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context).brightness ==
                                      Brightness.dark
                                  ? Colors.white
                                  : Colors.black87,
                            ),
                          ),
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
