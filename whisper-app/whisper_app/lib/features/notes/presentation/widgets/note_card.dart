// lib/features/notes/presentation/widgets/note_card.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:whisper_space_flutter/features/notes/data/models/note_model.dart';
import 'package:whisper_space_flutter/features/notes/presentation/screens/edit_note_screen.dart';
import 'package:whisper_space_flutter/features/notes/presentation/screens/share_note_screen.dart';
import 'package:whisper_space_flutter/features/notes/presentation/screens/view_note_screen.dart';

class NoteCard extends StatelessWidget {
  final NoteModel note;
  final bool isOwner;
  final bool canEdit;
  final VoidCallback? onTap;
  final VoidCallback? onPinToggle;
  final VoidCallback? onArchiveToggle;
  final VoidCallback? onDelete;
  final VoidCallback? onShare;
  final VoidCallback? onLeave;

  const NoteCard({
    super.key,
    required this.note,
    required this.isOwner,
    required this.canEdit,
    this.onTap,
    this.onPinToggle,
    this.onArchiveToggle,
    this.onDelete,
    this.onShare,
    this.onLeave,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, yyyy • h:mm a');
    final lastUpdated = note.updatedAt ?? note.createdAt;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      color: note.color,
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: note.isPinned
            ? const BorderSide(color: Color(0xFF6C63FF), width: 2)
            : BorderSide.none,
      ),
      child: InkWell(
        onTap: onTap ?? () => _viewNote(context),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with author and share type
              Row(
                children: [
                  // Author info
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: const Color(0xFF6C63FF).withOpacity(0.1),
                    backgroundImage: note.user.avatarUrl != null
                        ? NetworkImage(note.user.avatarUrl!)
                        : null,
                    child: note.user.avatarUrl == null
                        ? Text(
                            note.user.username[0].toUpperCase(),
                            style: const TextStyle(
                              color: Color(0xFF6C63FF),
                              fontWeight: FontWeight.bold,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          note.user.username,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          dateFormat.format(lastUpdated),
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
                  ),
                  
                  // Share type indicator
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: _getShareTypeColor(note.shareType).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _getShareTypeIcon(note.shareType),
                          size: 12,
                          color: _getShareTypeColor(note.shareType),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _getShareTypeText(note.shareType),
                          style: TextStyle(
                            fontSize: 10,
                            color: _getShareTypeColor(note.shareType),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 12),
              
              // Title and content preview
              Text(
                note.title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (note.content != null && note.content!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  note.content!,
                  style: TextStyle(
                    fontSize: 14,
                    color: Colors.grey[800],
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              
              const SizedBox(height: 16),
              
              // Action buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  if (isOwner || canEdit) ...[
                    _buildActionButton(
                      icon: Icons.edit_outlined,
                      label: 'Edit',
                      onTap: () => _editNote(context),
                    ),
                  ],
                  
                  if (isOwner) ...[
                    _buildActionButton(
                      icon: note.isPinned
                          ? Icons.push_pin
                          : Icons.push_pin_outlined,
                      label: note.isPinned ? 'Pinned' : 'Pin',
                      onTap: onPinToggle,
                    ),
                    _buildActionButton(
                      icon: note.isArchived
                          ? Icons.unarchive_outlined
                          : Icons.archive_outlined,
                      label: note.isArchived ? 'Unarchive' : 'Archive',
                      onTap: onArchiveToggle,
                    ),
                    _buildActionButton(
                      icon: Icons.share_outlined,
                      label: 'Share',
                      onTap: onShare ?? () => _shareNote(context),
                    ),
                    _buildActionButton(
                      icon: Icons.delete_outline,
                      label: 'Delete',
                      color: Colors.red,
                      onTap: onDelete ?? () => _confirmDelete(context),
                    ),
                  ] else if (note.shareType == ShareType.shared) ...[
                    _buildActionButton(
                      icon: Icons.exit_to_app,
                      label: 'Leave',
                      color: Colors.orange,
                      onTap: onLeave,
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback? onTap,
    Color? color,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 18,
              color: color ?? Colors.grey[700],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                color: color ?? Colors.grey[700],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _viewNote(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ViewNoteScreen(note: note),
      ),
    );
  }

  void _editNote(BuildContext context) async {
    final result = await Navigator.push<NoteModel?>(
      context,
      MaterialPageRoute(
        builder: (context) => EditNoteScreen(note: note),
      ),
    );
    
    // The provider will handle the update
  }

  void _shareNote(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ShareNoteScreen(note: note),
      ),
    );
  }

  void _confirmDelete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Note'),
        content: Text('Are you sure you want to delete "${note.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    
    if (confirmed == true && onDelete != null) {
      onDelete!();
    }
  }

  IconData _getShareTypeIcon(ShareType type) {
    switch (type) {
      case ShareType.public:
        return Icons.public;
      case ShareType.shared:
        return Icons.people;
      case ShareType.private:
        return Icons.lock;
    }
  }

  Color _getShareTypeColor(ShareType type) {
    switch (type) {
      case ShareType.public:
        return Colors.green;
      case ShareType.shared:
        return Colors.blue;
      case ShareType.private:
        return Colors.grey;
    }
  }

  String _getShareTypeText(ShareType type) {
    switch (type) {
      case ShareType.public:
        return 'Public';
      case ShareType.shared:
        return 'Shared';
      case ShareType.private:
        return 'Private';
    }
  }
}