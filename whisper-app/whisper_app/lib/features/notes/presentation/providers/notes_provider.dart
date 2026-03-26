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

  Future<void> loadNotes() async {
    _setLoading(true);
    _clearError();
    
    try {
      final allNotes = await _apiService.getUserNotes(archived: false);
      _notes = allNotes;
      _sortNotes(_notes);
      
      final archived = await _apiService.getUserNotes(archived: true);
      _archivedNotes = archived;
      _sortNotes(_archivedNotes);
      
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _setLoading(false);
    }
  }

  Future<void> loadSharedNotes() async {
    try {
      final notes = await _apiService.getSharedWithMe();
      _sharedNotes = notes;
      _sortNotes(_sharedNotes);
      notifyListeners();
    } catch (e) {
      _error = e.toString();
    }
  }

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
      _sortNotes(_notes);
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
      
      _updateNoteInList(_notes, updatedNote);
      _updateNoteInList(_archivedNotes, updatedNote);
      _updateNoteInList(_sharedNotes, updatedNote);
      
      _sortNotes(_notes);
      _sortNotes(_archivedNotes);
      _sortNotes(_sharedNotes);
      
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

  Future<void> togglePin(int noteId) async {
    try {
      await _apiService.togglePin(noteId);
      
      final noteIndex = _notes.indexWhere((n) => n.id == noteId);
      if (noteIndex != -1) {
        final note = _notes[noteIndex];
        _notes[noteIndex] = note.copyWith(isPinned: !note.isPinned);
        _sortNotes(_notes);
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      rethrow;
    }
  }

  Future<void> toggleArchive(int noteId) async {
    try {
      await _apiService.toggleArchive(noteId);
      
      final noteIndex = _notes.indexWhere((n) => n.id == noteId);
      if (noteIndex != -1) {
        final note = _notes[noteIndex];
        final updatedNote = note.copyWith(isArchived: !note.isArchived);
        
        if (updatedNote.isArchived) {
          _notes.removeAt(noteIndex);
          _archivedNotes.insert(0, updatedNote);
          _sortNotes(_archivedNotes);
        } else {
          _notes[noteIndex] = updatedNote;
          _sortNotes(_notes);
        }
        
        notifyListeners();
      }
    } catch (e) {
      _error = e.toString();
      rethrow;
    }
  }

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
      
      _sortNotes(_notes);
      _sortNotes(_archivedNotes);
      _sortNotes(_sharedNotes);
      
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

  Future<NoteModel> stopSharing(int noteId) async {
    _setLoading(true);
    _clearError();
    
    try {
      final updatedNote = await _apiService.stopSharing(noteId);
      
      _updateNoteInList(_notes, updatedNote);
      _updateNoteInList(_archivedNotes, updatedNote);
      
      _sortNotes(_notes);
      _sortNotes(_archivedNotes);
      
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

  Future<String> getShareLink(int noteId) async {
    try {
      return await _apiService.getShareLink(noteId);
    } catch (e) {
      _error = e.toString();
      rethrow;
    }
  }

  void _updateNoteInList(List<NoteModel> list, NoteModel updatedNote) {
    final index = list.indexWhere((n) => n.id == updatedNote.id);
    if (index != -1) {
      list[index] = updatedNote;
    }
  }

  void _sortNotes(List<NoteModel> list) {
    list.sort((a, b) {
      if (a.isPinned != b.isPinned) {
        return b.isPinned ? 1 : -1; // pinned first
      }
      final aDate = a.updatedAt ?? a.createdAt;
      final bDate = b.updatedAt ?? b.createdAt;
      return bDate.compareTo(aDate);
    });
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