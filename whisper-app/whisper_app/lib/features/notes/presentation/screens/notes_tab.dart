// lib/features/notes/presentation/screens/notes_tab.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/features/auth/presentation/screens/providers/auth_provider.dart';
import 'package:whisper_space_flutter/features/notes/presentation/providers/notes_provider.dart';
import 'package:whisper_space_flutter/features/notes/presentation/screens/create_note_screen.dart';
import 'package:whisper_space_flutter/features/notes/presentation/screens/share_note_screen.dart';
import 'package:whisper_space_flutter/features/notes/presentation/widgets/note_card.dart';

class NotesTab extends StatefulWidget {
  const NotesTab({super.key});

  @override
  State<NotesTab> createState() => _NotesTabState();
}

class _NotesTabState extends State<NotesTab> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  bool _isInitialized = false;
  int? _currentUserId;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadCurrentUser();
      _initializeNotes();
    });
  }

  void _loadCurrentUser() {
    if (!mounted) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final user = authProvider.currentUser;
    if (user != null) {
      setState(() {
        _currentUserId = user.id;
      });
      
      final notesProvider = Provider.of<NotesProvider>(context, listen: false);
      notesProvider.setCurrentUserId(user.id);
    }
  }

  Future<void> _initializeNotes() async {
    if (!mounted) return;
    
    try {
      final notesProvider = Provider.of<NotesProvider>(context, listen: false);
      await Future.wait([
        notesProvider.loadNotes(),
        notesProvider.loadSharedNotes(),
      ]);
      if (mounted) {
        setState(() => _isInitialized = true);
      }
    } catch (e) {
      print('Failed to initialize notes: $e');
      if (mounted) {
        setState(() => _isInitialized = true);
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Notes'),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          labelColor: Colors.white, // Set active tab text color to white
          unselectedLabelColor: Colors.white.withOpacity(0.7), // Set inactive tab text color to white with opacity
          indicatorColor: Colors.white, // Optional: make indicator white too
          tabs: const [
            Tab(text: 'All Notes'),
            Tab(text: 'Shared'),
            Tab(text: 'Archived'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refreshNotes,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isInitialized
          ? TabBarView(
              controller: _tabController,
              children: [
                _AllNotesTab(),
                _SharedNotesTab(),
                _ArchivedNotesTab(),
              ],
            )
          : const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Loading notes...'),
                ],
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _createNewNote,
        child: const Icon(Icons.add),
      ),
    );
  }

  Future<void> _refreshNotes() async {
    final provider = Provider.of<NotesProvider>(context, listen: false);
    await provider.loadNotes();
    await provider.loadSharedNotes();
  }

  void _createNewNote() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreateNoteScreen(
          onNoteCreated: () {
            _refreshNotes();
          },
        ),
      ),
    );
  }
}

class _AllNotesTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<NotesProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                Text(
                  provider.error!,
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    provider.clearError();
                    provider.loadNotes();
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        final notes = provider.notes.where((note) => !note.isArchived).toList();
        
        if (notes.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.note_outlined, size: 80, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'No notes yet',
                  style: TextStyle(fontSize: 20, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Create your first note',
                  style: TextStyle(color: Colors.grey),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => CreateNoteScreen(
                          onNoteCreated: () {
                            provider.loadNotes();
                          },
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('Create Note'),
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => provider.loadNotes(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: notes.length,
            itemBuilder: (context, index) {
              final note = notes[index];
              final isOwner = provider.isOwner(note);
              final canEdit = provider.canEdit(note);
              
              return NoteCard(
                note: note,
                isOwner: isOwner,
                canEdit: canEdit,
                onPinToggle: () => provider.togglePin(note.id),
                onArchiveToggle: () => provider.toggleArchive(note.id),
                onDelete: () async {
                  try {
                    await provider.deleteNote(note.id);
                    if (context.mounted) {
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
                },
                onShare: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => ShareNoteScreen(note: note),
                    ),
                  ).then((_) => provider.loadNotes());
                },
              );
            },
          ),
        );
      },
    );
  }
}

class _SharedNotesTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<NotesProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                Text(
                  provider.error!,
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    provider.clearError();
                    provider.loadSharedNotes();
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        if (provider.sharedNotes.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.people_outline, size: 80, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'No shared notes',
                  style: TextStyle(fontSize: 20, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Notes shared with you will appear here',
                  style: TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => provider.loadSharedNotes(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: provider.sharedNotes.length,
            itemBuilder: (context, index) {
              final note = provider.sharedNotes[index];
              final canEdit = provider.canEdit(note);
              
              return NoteCard(
                note: note,
                isOwner: false,
                canEdit: canEdit,
                onLeave: () async {
                  try {
                    await provider.leaveSharedNote(note.id);
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Left shared note'),
                          backgroundColor: Colors.green,
                        ),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Failed to leave: $e'),
                          backgroundColor: Colors.red,
                        ),
                      );
                    }
                  }
                },
              );
            },
          ),
        );
      },
    );
  }
}

class _ArchivedNotesTab extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Consumer<NotesProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.error != null) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                Text(
                  provider.error!,
                  style: const TextStyle(color: Colors.red),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () {
                    provider.clearError();
                    provider.loadNotes();
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        if (provider.archivedNotes.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.archive_outlined, size: 80, color: Colors.grey),
                const SizedBox(height: 16),
                const Text(
                  'No archived notes',
                  style: TextStyle(fontSize: 20, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Archived notes will appear here',
                  style: TextStyle(color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => provider.loadNotes(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: provider.archivedNotes.length,
            itemBuilder: (context, index) {
              final note = provider.archivedNotes[index];
              final isOwner = provider.isOwner(note);
              final canEdit = provider.canEdit(note);
              
              return NoteCard(
                note: note,
                isOwner: isOwner,
                canEdit: canEdit,
                onPinToggle: () => provider.togglePin(note.id),
                onArchiveToggle: () => provider.toggleArchive(note.id),
                onDelete: () async {
                  try {
                    await provider.deleteNote(note.id);
                    if (context.mounted) {
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
                },
              );
            },
          ),
        );
      },
    );
  }
}