// lib/features/notes/presentation/screens/share_note_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/features/notes/data/models/note_model.dart';
import 'package:whisper_space_flutter/features/notes/presentation/providers/friend_provider.dart';
import 'package:whisper_space_flutter/features/notes/presentation/providers/notes_provider.dart';

class ShareNoteScreen extends StatefulWidget {
  final NoteModel note;

  const ShareNoteScreen({super.key, required this.note});

  @override
  State<ShareNoteScreen> createState() => _ShareNoteScreenState();
}

class _ShareNoteScreenState extends State<ShareNoteScreen> {
  late ShareType _shareType;
  late bool _canEdit;
  List<int> _selectedFriendIds = [];
  int? _expiresInHours;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _shareType = widget.note.shareType;
    _canEdit = widget.note.canEdit;
    _selectedFriendIds = List.from(widget.note.sharedWith);
    _loadFriends();
  }

  Future<void> _loadFriends() async {
    if (!mounted) return;
    
    final friendProvider = Provider.of<FriendProvider>(context, listen: false);
    await friendProvider.loadFriends();
  }

  @override
  Widget build(BuildContext context) {
    final isOwner = Provider.of<NotesProvider>(context).isOwner(widget.note);
    
    if (!isOwner) {
      return Scaffold(
        appBar: AppBar(title: const Text('Share Settings')),
        body: const Center(
          child: Text('Only the owner can change share settings'),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Share Note'),
        elevation: 0,
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _updateSharing,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Current sharing status
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Current Status',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(
                        _getShareTypeIcon(widget.note.shareType),
                        color: _getShareTypeColor(widget.note.shareType),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _getShareTypeDescription(widget.note.shareType),
                        style: const TextStyle(fontSize: 14),
                      ),
                    ],
                  ),
                  if (widget.note.shareToken != null) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.link, size: 16, color: Colors.grey),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Share link available',
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.copy, size: 16),
                          onPressed: () => _copyShareLink(),
                          constraints: const BoxConstraints(),
                          padding: const EdgeInsets.all(4),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Share type selector
          const Text(
            'Share Type',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          SegmentedButton<ShareType>(
            segments: const [
              ButtonSegment(
                value: ShareType.private,
                label: Text('Private'),
                icon: Icon(Icons.lock_outline),
              ),
              ButtonSegment(
                value: ShareType.shared,
                label: Text('Shared'),
                icon: Icon(Icons.people_outline),
              ),
              ButtonSegment(
                value: ShareType.public,
                label: Text('Public'),
                icon: Icon(Icons.public),
              ),
            ],
            selected: {_shareType},
            onSelectionChanged: (Set<ShareType> selected) {
              setState(() {
                _shareType = selected.first;
                if (_shareType != ShareType.shared) {
                  _selectedFriendIds.clear();
                }
              });
            },
          ),
          
          const SizedBox(height: 24),
          
          // Shared with friends section
          if (_shareType == ShareType.shared) ...[
            // Edit permission
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Permissions',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 8),
                    CheckboxListTile(
                      title: const Text('Allow friends to edit'),
                      value: _canEdit,
                      onChanged: (value) {
                        setState(() {
                          _canEdit = value ?? false;
                        });
                      },
                      secondary: const Icon(Icons.edit),
                    ),
                  ],
                ),
              ),
            ),
            
            const SizedBox(height: 16),
            
            // Friend selection
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Share with friends',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 16),
                    Consumer<FriendProvider>(
                      builder: (context, friendProvider, child) {
                        if (friendProvider.isLoading) {
                          return const Center(
                            child: Padding(
                              padding: EdgeInsets.all(16),
                              child: CircularProgressIndicator(),
                            ),
                          );
                        }
                        
                        if (friendProvider.friends.isEmpty) {
                          return Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Column(
                              children: [
                                Icon(Icons.people_outline, color: Colors.grey),
                                SizedBox(height: 8),
                                Text(
                                  'No friends yet',
                                  style: TextStyle(color: Colors.grey),
                                ),
                              ],
                            ),
                          );
                        }
                        
                        return Column(
                          children: friendProvider.friends.map((friend) {
                            final isSelected = _selectedFriendIds.contains(friend.id);
                            return CheckboxListTile(
                              title: Text(friend.username),
                              subtitle: Text(friend.email),
                              value: isSelected,
                              onChanged: (selected) {
                                setState(() {
                                  if (selected == true) {
                                    _selectedFriendIds.add(friend.id);
                                  } else {
                                    _selectedFriendIds.remove(friend.id);
                                  }
                                });
                              },
                              secondary: CircleAvatar(
                                backgroundColor: const Color(0xFF6C63FF),
                                backgroundImage: friend.avatarUrl != null
                                    ? NetworkImage(friend.avatarUrl!)
                                    : null,
                                child: friend.avatarUrl == null
                                    ? Text(friend.username[0].toUpperCase())
                                    : null,
                              ),
                            );
                          }).toList(),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
          
          // Public note settings
          if (_shareType == ShareType.public) ...[
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Public Link Settings',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<int?>(
                      value: _expiresInHours,
                      decoration: const InputDecoration(
                        labelText: 'Link expiration',
                        border: OutlineInputBorder(),
                      ),
                      items: [
                        const DropdownMenuItem(
                          value: null,
                          child: Text('Never expires'),
                        ),
                        ...List.generate(7, (index) {
                          final hours = (index + 1) * 24;
                          return DropdownMenuItem(
                            value: hours,
                            child: Text('$hours hours (${(hours / 24).round()} days)'),
                          );
                        }),
                      ],
                      onChanged: (value) {
                        setState(() {
                          _expiresInHours = value;
                        });
                      },
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Anyone with the link can view this note',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
          ],
          
          const SizedBox(height: 24),
          
          // Stop sharing button (if currently shared)
          if (widget.note.shareType != ShareType.private)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: OutlinedButton.icon(
                onPressed: _isLoading ? null : _confirmStopSharing,
                icon: const Icon(Icons.stop, color: Colors.red),
                label: const Text('Stop Sharing', style: TextStyle(color: Colors.red)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red,
                  side: const BorderSide(color: Colors.red),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _copyShareLink() async {
    try {
      final provider = Provider.of<NotesProvider>(context, listen: false);
      final link = await provider.getShareLink(widget.note.id);
      
      await Clipboard.setData(ClipboardData(text: link));
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Share link copied to clipboard'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to copy link: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _updateSharing() async {
    setState(() => _isLoading = true);
    
    try {
      final provider = Provider.of<NotesProvider>(context, listen: false);
      
      await provider.shareNote(
        noteId: widget.note.id,
        shareType: _shareType,
        friendIds: _shareType == ShareType.shared ? _selectedFriendIds : null,
        canEdit: _canEdit,
        expiresInHours: _expiresInHours,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Share settings updated'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _confirmStopSharing() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Stop Sharing'),
        content: const Text('This note will become private. Continue?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Stop Sharing'),
          ),
        ],
      ),
    );
    
    if (confirmed == true) {
      setState(() => _isLoading = true);
      
      try {
        final provider = Provider.of<NotesProvider>(context, listen: false);
        await provider.stopSharing(widget.note.id);
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Sharing stopped'),
              backgroundColor: Colors.green,
            ),
          );
          Navigator.pop(context);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to stop sharing: $e'),
              backgroundColor: Colors.red,
            ),
          );
        }
      } finally {
        if (mounted) {
          setState(() => _isLoading = false);
        }
      }
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

  String _getShareTypeDescription(ShareType type) {
    switch (type) {
      case ShareType.public:
        return 'Public - Anyone with link can view';
      case ShareType.shared:
        return 'Shared with ${widget.note.sharedWith.length} friend(s)';
      case ShareType.private:
        return 'Private - Only you can view';
    }
  }
}