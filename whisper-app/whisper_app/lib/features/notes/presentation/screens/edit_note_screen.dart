// lib/features/notes/presentation/screens/edit_note_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/features/notes/data/models/note_model.dart';
import 'package:whisper_space_flutter/features/notes/presentation/providers/notes_provider.dart';

class EditNoteScreen extends StatefulWidget {
  final NoteModel note;

  const EditNoteScreen({super.key, required this.note});

  @override
  State<EditNoteScreen> createState() => _EditNoteScreenState();
}

class _EditNoteScreenState extends State<EditNoteScreen> {
  late final TextEditingController _titleController;
  late final TextEditingController _contentController;
  
  late Color _selectedColor;
  bool _isLoading = false;

  final List<Color> _colorOptions = [
    Colors.white,
    const Color(0xFFFFF3E0),
    const Color(0xFFE8F5E9),
    const Color(0xFFE3F2FD),
    const Color(0xFFF3E5F5),
    const Color(0xFFFFF0F0),
    const Color(0xFFFFF8E1),
  ];

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.note.title);
    _contentController = TextEditingController(text: widget.note.content);
    _selectedColor = widget.note.color;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDarkMode ? Colors.white : Colors.black;
    final labelColor = isDarkMode ? Colors.white70 : Colors.black87;
    final backgroundColor = isDarkMode ? const Color(0xFF1E1E1E) : Colors.white;
    final inputFillColor = isDarkMode ? const Color(0xFF2C2C2C) : Colors.white;

    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: AppBar(
        title: Text(
          'Edit Note',
          style: TextStyle(color: textColor),
        ),
        elevation: 0,
        backgroundColor: isDarkMode ? const Color(0xFF1E1E1E) : null,
        actions: [
          TextButton(
            onPressed: _isLoading ? null : _updateNote,
            child: _isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(
                    'Save',
                    style: TextStyle(color: Theme.of(context).primaryColor),
                  ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Title field
          TextField(
            controller: _titleController,
            style: TextStyle(color: textColor),
            decoration: InputDecoration(
              labelText: 'Title',
              labelStyle: TextStyle(color: labelColor),
              border: const OutlineInputBorder(),
              filled: true,
              fillColor: inputFillColor,
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Content field
          TextField(
            controller: _contentController,
            style: TextStyle(color: textColor),
            decoration: InputDecoration(
              labelText: 'Content',
              labelStyle: TextStyle(color: labelColor),
              border: const OutlineInputBorder(),
              alignLabelWithHint: true,
              filled: true,
              fillColor: inputFillColor,
            ),
            maxLines: 10,
            keyboardType: TextInputType.multiline,
          ),
          
          const SizedBox(height: 24),
          
          // Color selection
          Text(
            'Note Color',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 50,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _colorOptions.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final color = _colorOptions[index];
                return GestureDetector(
                  onTap: () => setState(() => _selectedColor = color),
                  child: Container(
                    width: 50,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: _selectedColor == color
                            ? Theme.of(context).primaryColor
                            : (isDarkMode ? Colors.white24 : Colors.grey.shade300),
                        width: _selectedColor == color ? 3 : 1,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _updateNote() async {
    if (_titleController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Title cannot be empty'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      final notesProvider = Provider.of<NotesProvider>(context, listen: false);
      
      final updatedNote = await notesProvider.updateNote(
        noteId: widget.note.id,
        title: _titleController.text.trim(),
        content: _contentController.text.trim().isEmpty
            ? null
            : _contentController.text.trim(),
        color: _selectedColor,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Note updated successfully'),
            backgroundColor: Colors.green,
          ),
        );
        
        Navigator.pop(context, updatedNote);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update note: $e'),
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