// lib/features/notes/presentation/screens/view_note_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/features/notes/data/models/note_model.dart';
import 'package:whisper_space_flutter/features/notes/presentation/providers/notes_provider.dart';
import 'package:whisper_space_flutter/features/notes/presentation/screens/edit_note_screen.dart';
import 'package:whisper_space_flutter/features/notes/presentation/screens/share_note_screen.dart';

class ViewNoteScreen extends StatelessWidget {
  final NoteModel note;

  const ViewNoteScreen({super.key, required this.note});

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMMM d, yyyy • h:mm a');
    final created = dateFormat.format(note.createdAt);
    final updated = note.updatedAt != null 
        ? dateFormat.format(note.updatedAt!)
        : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(note.title),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: () => _showShareOptions(context),
          ),
          Consumer<NotesProvider>(
            builder: (context, provider, child) {
              final isOwner = provider.isOwner(note);
              
              if (!isOwner) return const SizedBox();
              
              return PopupMenuButton<String>(
                onSelected: (value) async {
                  switch (value) {
                    case 'pin':
                      await provider.togglePin(note.id);
                      break;
                    case 'archive':
                      await provider.toggleArchive(note.id);
                      Navigator.pop(context);
                      break;
                    case 'delete':
                      _confirmDelete(context, provider);
                      break;
                  }
                },
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'pin',
                    child: Row(
                      children: [
                        Icon(
                          note.isPinned
                              ? Icons.push_pin
                              : Icons.push_pin_outlined,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(note.isPinned ? 'Unpin' : 'Pin'),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'archive',
                    child: Row(
                      children: [
                        Icon(
                          note.isArchived
                              ? Icons.unarchive_outlined
                              : Icons.archive_outlined,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(note.isArchived ? 'Unarchive' : 'Archive'),
                      ],
                    ),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        Icon(Icons.delete_outline, color: Colors.red, size: 20),
                        SizedBox(width: 8),
                        Text('Delete', style: TextStyle(color: Colors.red)),
                      ],
                    ),
                  ),
                ],
              );
            },
          ),
        ],
      ),
      body: Container(
        color: note.color,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Author info
              Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: const Color(0xFF6C63FF),
                    backgroundImage: note.user.avatarUrl != null
                        ? NetworkImage(note.user.avatarUrl!)
                        : null,
                    child: note.user.avatarUrl == null
                        ? Text(
                            note.user.username[0].toUpperCase(),
                            style: const TextStyle(color: Colors.white),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          note.user.username,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          _getShareTypeText(note.shareType),
                          style: TextStyle(
                            fontSize: 12,
                            color: _getShareTypeColor(note.shareType),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              
              const SizedBox(height: 24),
              
              // Title
              Text(
                note.title,
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                ),
              ),
              
              const SizedBox(height: 16),
              
              // Timestamps
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Created: $created',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.grey[700],
                      ),
                    ),
                    if (updated != null)
                      Text(
                        'Updated: $updated',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey[700],
                        ),
                      ),
                  ],
                ),
              ),
              
              const SizedBox(height: 24),
              
              // Content
              if (note.content != null && note.content!.isNotEmpty)
                Text(
                  note.content!,
                  style: const TextStyle(
                    fontSize: 16,
                    height: 1.5,
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.03),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(
                    child: Text(
                      'No content',
                      style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
      floatingActionButton: Consumer<NotesProvider>(
        builder: (context, provider, child) {
          if (!provider.canEdit(note)) return const SizedBox();
          
          return FloatingActionButton.extended(
            onPressed: () => _editNote(context),
            icon: const Icon(Icons.edit),
            label: const Text('Edit'),
          );
        },
      ),
    );
  }

  void _showShareOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.link),
              title: const Text('Copy share link'),
              onTap: () async {
                Navigator.pop(context);
                await _copyShareLink(context);
              },
            ),
            if (note.shareType == ShareType.shared)
              ListTile(
                leading: const Icon(Icons.people),
                title: const Text('Manage shared with'),
                onTap: () {
                  Navigator.pop(context);
                  _manageSharedWith(context);
                },
              ),
            ListTile(
              leading: const Icon(Icons.share),
              title: const Text('Share via...'),
              onTap: () {
                Navigator.pop(context);
                _shareVia(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _copyShareLink(BuildContext context) async {
    try {
      final provider = Provider.of<NotesProvider>(context, listen: false);
      final link = await provider.getShareLink(note.id);
      
      // Copy to clipboard
      await Clipboard.setData(ClipboardData(text: link));
      
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Share link copied to clipboard'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to get share link: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _manageSharedWith(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ShareNoteScreen(note: note),
      ),
    );
  }

  void _shareVia(BuildContext context) {
    // Implement sharing via system share sheet
  }

  void _editNote(BuildContext context) async {
    final result = await Navigator.push<NoteModel?>(
      context,
      MaterialPageRoute(
        builder: (context) => EditNoteScreen(note: note),
      ),
    );
    
    if (result != null && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Note updated'),
          backgroundColor: Colors.green,
        ),
      );
    }
  }

  void _confirmDelete(BuildContext context, NotesProvider provider) async {
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
    
    if (confirmed == true) {
      try {
        await provider.deleteNote(note.id);
        if (context.mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Note deleted'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to delete: $e'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
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
        return 'Public note';
      case ShareType.shared:
        return 'Shared with friends';
      case ShareType.private:
        return 'Private note';
    }
  }
}