// lib/features/notes/presentation/providers/notes_provider.dart
import 'package:flutter/material.dart';
import 'package:whisper_space_flutter/features/notes/data/datasources/notes_api_service.dart';
import 'package:whisper_space_flutter/features/notes/data/models/note_model.dart';


class NotesProvider extends ChangeNotifier {
  final NotesApiService _apiService;
  
  List<NoteModel> _notes = [];
  List<NoteModel> _sharedNotes = [];
  List<NoteModel> _archivedNotes = [];
  bool _isLoading = false;
  String? _error;
  int? _currentUserId;

  NotesProvider(this._apiService);

  List<NoteModel> get notes => _notes;
  List<NoteModel> get sharedNotes => _sharedNotes;
  List<NoteModel> get archivedNotes => _archivedNotes;
  bool get isLoading => _isLoading;
  String? get error => _error;

  void setCurrentUserId(int userId) {
    _currentUserId = userId;
  }

  bool isOwner(NoteModel note) {
    return note.user.id == _currentUserId;
  }

  bool canEdit(NoteModel note) {
    return isOwner(note) || (note.canEdit && note.sharedWith.contains(_currentUserId));
  }

  // Load all notes (active and archived)
  Future<void> loadNotes() async {
    _setLoading(true);
    _clearError();
    
    try {
      final allNotes = await _apiService.getUserNotes(archived: false);
      _notes = allNotes;
      
      final archived = await _apiService.getUserNotes(archived: true);
      _archivedNotes = archived;
      
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _setLoading(false);
    }
  }

  // Load notes shared with me
  Future<void> loadSharedNotes() async {
    try {
      final notes = await _apiService.getSharedWithMe();
      _sharedNotes = notes;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
    }
  }

  // Create a new note
  Future<NoteModel> createNote({
    required String title,
    String? content,
    Color color = const Color(0xFFFFFFFF),
    ShareType shareType = ShareType.private,
    List<int> sharedWith = const [],
    bool canEdit = false,
  }) async {
    _setLoading(true);
    _clearError();
    
    try {
      // Convert Color to hex string without using deprecated value property
      final colorHex = '#${color.value.toRadixString(16).substring(2)}';
      
      final note = await _apiService.createNote(
        NoteCreate(
          title: title,
          content: content,
          color: colorHex,
          shareType: shareType,
          sharedWith: sharedWith,
          canEdit: canEdit,
        ),
      );
      
      _notes.insert(0, note);
      _error = null;
      notifyListeners();
      return note;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  // Update a note
  Future<NoteModel> updateNote({
    required int noteId,
    String? title,
    String? content,
    bool? isPinned,
    bool? isArchived,
    Color? color,
    ShareType? shareType,
    List<int>? sharedWith,
    bool? canEdit,
  }) async {
    _setLoading(true);
    _clearError();
    
    try {
      String? colorHex;
      if (color != null) {
        colorHex = '#${color.value.toRadixString(16).substring(2)}';
      }
      
      final noteUpdate = NoteUpdate(
        title: title,
        content: content,
        isPinned: isPinned,
        isArchived: isArchived,
        color: colorHex,
        shareType: shareType,
        sharedWith: sharedWith,
        canEdit: canEdit,
      );
      
      final updatedNote = await _apiService.updateNote(noteId, noteUpdate);
      
      // Update in lists
      _updateNoteInList(_notes, updatedNote);
      _updateNoteInList(_archivedNotes, updatedNote);
      _updateNoteInList(_sharedNotes, updatedNote);
      
      _error = null;
      notifyListeners();
      return updatedNote;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  // Delete a note
  Future<void> deleteNote(int noteId) async {
    _setLoading(true);
    _clearError();
    
    try {
      await _apiService.deleteNote(noteId);
      
      _notes.removeWhere((n) => n.id == noteId);
      _archivedNotes.removeWhere((n) => n.id == noteId);
      _sharedNotes.removeWhere((n) => n.id == noteId);
      
      _error = null;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  // Toggle pin status
  Future<void> togglePin(int noteId) async {
    try {
      await _apiService.togglePin(noteId);
      
      // Find and update the note locally
      final noteIndex = _notes.indexWhere((n) => n.id == noteId);
      if (noteIndex != -1) {
        final note = _notes[noteIndex];
        _notes[noteIndex] = note.copyWith(isPinned: !note.isPinned);
        
        // Reorder notes (pinned first)
        _notes.sort((a, b) {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.updatedAt?.compareTo(a.updatedAt ?? a.createdAt) ?? 0;
        });
        
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      rethrow;
    }
  }

  // Toggle archive status
  Future<void> toggleArchive(int noteId) async {
    try {
      await _apiService.toggleArchive(noteId);
      
      // Find note in active notes
      final noteIndex = _notes.indexWhere((n) => n.id == noteId);
      if (noteIndex != -1) {
        final note = _notes[noteIndex];
        final updatedNote = note.copyWith(isArchived: !note.isArchived);
        
        if (updatedNote.isArchived) {
          // Move to archived
          _notes.removeAt(noteIndex);
          _archivedNotes.insert(0, updatedNote);
        } else {
          // Move to active
          _notes[noteIndex] = updatedNote;
        }
        
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      rethrow;
    }
  }

  // Share a note
  Future<NoteModel> shareNote({
    required int noteId,
    required ShareType shareType,
    List<int>? friendIds,
    bool canEdit = false,
    int? expiresInHours,
  }) async {
    _setLoading(true);
    _clearError();
    
    try {
      final shareRequest = ShareNoteRequest(
        shareType: shareType,
        friendIds: friendIds,
        canEdit: canEdit,
        expiresInHours: expiresInHours,
      );
      
      final updatedNote = await _apiService.shareNote(noteId, shareRequest);
      
      _updateNoteInList(_notes, updatedNote);
      _updateNoteInList(_archivedNotes, updatedNote);
      _updateNoteInList(_sharedNotes, updatedNote);
      
      _error = null;
      notifyListeners();
      return updatedNote;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  // Stop sharing a note
  Future<NoteModel> stopSharing(int noteId) async {
    _setLoading(true);
    _clearError();
    
    try {
      final updatedNote = await _apiService.stopSharing(noteId);
      
      _updateNoteInList(_notes, updatedNote);
      _updateNoteInList(_archivedNotes, updatedNote);
      
      _error = null;
      notifyListeners();
      return updatedNote;
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  // Leave a shared note
  Future<void> leaveSharedNote(int noteId) async {
    _setLoading(true);
    _clearError();
    
    try {
      await _apiService.leaveSharedNote(noteId);
      
      _sharedNotes.removeWhere((n) => n.id == noteId);
      
      _error = null;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _setLoading(false);
    }
  }

  // Get share link
  Future<String> getShareLink(int noteId) async {
    try {
      return await _apiService.getShareLink(noteId);
    } catch (e) {
      _error = e.toString();
      rethrow;
    }
  }

  // Helper methods
  void _updateNoteInList(List<NoteModel> list, NoteModel updatedNote) {
    final index = list.indexWhere((n) => n.id == updatedNote.id);
    if (index != -1) {
      list[index] = updatedNote;
    }
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}