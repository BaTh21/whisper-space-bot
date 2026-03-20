// lib/features/feed/presentation/screens/feed_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/core/providers/theme_provider.dart';
import 'package:whisper_space_flutter/features/auth/data/models/diary_model.dart';
import 'package:whisper_space_flutter/features/feed/data/datasources/feed_api_service.dart';
import 'package:whisper_space_flutter/features/feed/presentation/providers/feed_provider.dart';
import 'package:whisper_space_flutter/features/feed/presentation/screens/create_diary_screen.dart';
import 'package:whisper_space_flutter/features/feed/presentation/screens/edit_diary_full_screen.dart';
import 'package:whisper_space_flutter/shared/widgets/diary_card.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final ScrollController _scrollController = ScrollController();
  int? _currentUserId;

  @override
  void initState() {
    super.initState();
    _loadCurrentUser();
  }

  void _loadCurrentUser() {
    // Load current user ID from your AuthProvider
    // Replace this with your actual user ID retrieval
    _currentUserId = 1; // Temporary - replace with actual user ID
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _toggleTheme() {
    final themeProvider = Provider.of<ThemeProvider>(context, listen: false);
    themeProvider.toggleTheme(!themeProvider.isDarkMode);
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;
    final primaryColor = Theme.of(context).primaryColor;

    return Consumer<FeedProvider>(
      builder: (context, provider, child) {
        if (provider.isLoading && provider.diaries.isEmpty) {
          return const Center(child: CircularProgressIndicator());
        }

        if (provider.error != null && provider.diaries.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, 
                  size: 64, 
                  color: isDarkMode ? Colors.red[300] : Colors.red
                ),
                const SizedBox(height: 20),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: Text(
                    provider.error!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: isDarkMode ? Colors.red[300] : Colors.red,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () => provider.refreshFeed(),
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }

        return Scaffold(
          appBar: AppBar(
            title: const Text('Whisper Space'),
            elevation: 0,
            actions: [
              // Theme Toggle Button
              IconButton(
                tooltip: isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
                icon: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  transitionBuilder: (Widget child, Animation<double> animation) {
                    return RotationTransition(
                      turns: animation,
                      child: child,
                    );
                  },
                  child: Icon(
                    isDarkMode ? Icons.light_mode : Icons.dark_mode,
                    key: ValueKey<bool>(isDarkMode),
                    color: isDarkMode ? Colors.yellow : Colors.white,
                  ),
                ),
                onPressed: _toggleTheme,
              ),
              IconButton(
                icon: const Icon(Icons.refresh),
                tooltip: 'Refresh feed',
                onPressed: () => provider.refreshFeed(),
              ),
              IconButton(
                icon: const Icon(Icons.add),
                tooltip: 'Create New Diary',
                onPressed: () => _createNewPost(context, provider),
              ),
            ],
          ),
          body: RefreshIndicator(
            onRefresh: () => provider.refreshFeed(),
            child: _buildFeedContent(provider, isDarkMode),
          ),
          floatingActionButton: FloatingActionButton(
            onPressed: () => _createNewPost(context, provider),
            tooltip: 'Create New Diary',
            backgroundColor: primaryColor,
            child: const Icon(Icons.add),
          ),
        );
      },
    );
  }

  Widget _buildFeedContent(FeedProvider provider, bool isDarkMode) {
    if (provider.diaries.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.feed, 
              size: 64, 
              color: isDarkMode ? Colors.grey[600] : Colors.grey
            ),
            const SizedBox(height: 20),
            Text(
              'No posts yet',
              style: TextStyle(
                fontSize: 18, 
                color: isDarkMode ? Colors.grey[400] : Colors.grey
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Be the first to share something!',
              style: TextStyle(
                color: isDarkMode ? Colors.grey[500] : Colors.grey
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => _createNewPost(context, provider),
              child: const Text('Create First Diary'),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.all(16),
      itemCount: provider.diaries.length,
      itemBuilder: (context, index) {
        final diary = provider.diaries[index];
        final isOwner = diary.author.id == _currentUserId;

        return DiaryCard(
          diary: diary,
          onLike: () => _handleLike(provider, diary.id),
          onFavorite: () => _handleFavorite(provider, diary.id, isOwner),
          onComment: (diaryId, content, parentId, replyToUserId) =>
              _handleComment(
                  provider, diaryId, content, parentId, replyToUserId),
          onEdit: (diaryToEdit) =>
              _handleEditDiary(context, provider, diaryToEdit),
          onDelete: (diaryId) => _handleDeleteDiary(context, provider, diaryId),
          isOwner: isOwner,
        );
      },
    );
  }

  void _handleLike(FeedProvider provider, int diaryId) async {
    try {
      await provider.likeDiary(diaryId);
    } catch (e) {
      _showErrorSnackBar('Failed to like diary: $e');
    }
  }

  void _handleFavorite(FeedProvider provider, int diaryId, bool isOwner) async {
    try {
      final diary = provider.diaries.firstWhere((d) => d.id == diaryId);
      final isCurrentlyFavorited =
          diary.favoritedUserIds.contains(_currentUserId);

      if (isCurrentlyFavorited) {
        await provider.removeFromFavorites(diaryId);
        _showSuccessSnackBar('Removed from favorites');
      } else {
        await provider.saveToFavorites(diaryId);
        _showSuccessSnackBar('Added to favorites');
      }
    } catch (e) {
      _showErrorSnackBar('Failed to update favorites: $e');
    }
  }

  void _handleComment(FeedProvider feedProvider, int diaryId, String content,
      int? parentId, int? replyToUserId) async {
    try {
      await feedProvider.createComment(
        diaryId: diaryId,
        content: content,
        parentId: parentId,
        replyToUserId: replyToUserId,
      );
      _showSuccessSnackBar('Comment posted!');
    } catch (e) {
      _showErrorSnackBar('Failed to post comment: $e');
    }
  }

  void _handleEditDiary(
      BuildContext context, FeedProvider provider, DiaryModel diary) async {
    final feedApiService = Provider.of<FeedApiService>(context, listen: false);
    final themeProvider = Provider.of<ThemeProvider>(context, listen: false);

    final updatedDiary = await Navigator.push<DiaryModel>(
      context,
      MaterialPageRoute<DiaryModel>(
        builder: (context) => EditDiaryFullScreen(
          diary: diary,
          feedApiService: feedApiService,
          onUpdate: (updatedDiary) async {
            try {
              final result = await provider.updateDiary(
                diaryId: updatedDiary.id,
                title: updatedDiary.title,
                content: updatedDiary.content,
                shareType: updatedDiary.shareType,
                groupIds: updatedDiary.groups.map((g) => g.id).toList(),
                imageUrls: updatedDiary.images,
                videoUrls: updatedDiary.videos,
              );
              return result;
            } catch (e) {
              rethrow;
            }
          },
          onDelete: (deletedDiaryId) async {
            try {
              await provider.deleteDiary(deletedDiaryId);
              _showSuccessSnackBar('Diary deleted successfully!');
            } catch (e) {
              _showErrorSnackBar('Failed to delete diary: $e');
              rethrow;
            }
          },
        ),
      ),
    );

    if (updatedDiary != null) {
      _showSuccessSnackBar('Diary updated successfully!');
    }
  }

  void _handleDeleteDiary(
      BuildContext context, FeedProvider feedProvider, int diaryId) async {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Delete Diary'),
            content: const Text('Are you sure you want to delete this diary? '
                'This action cannot be undone.'),
            backgroundColor: isDarkMode ? const Color(0xFF1E1E1E) : null,
            titleTextStyle: TextStyle(
              color: isDarkMode ? Colors.white : null,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
            contentTextStyle: TextStyle(
              color: isDarkMode ? Colors.white70 : null,
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(
                  'Cancel',
                  style: TextStyle(
                    color: isDarkMode ? Colors.white70 : null,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text(
                  'Delete',
                  style: TextStyle(color: Colors.red),
                ),
              ),
            ],
          ),
        ) ??
        false;

    if (confirmed) {
      try {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Deleting diary...'),
              backgroundColor: isDarkMode ? Colors.grey[800] : null,
              duration: const Duration(seconds: 1),
            ),
          );
        }

        await feedProvider.deleteDiary(diaryId);

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Diary deleted successfully'),
              backgroundColor: isDarkMode ? Colors.green[800] : Colors.green,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to delete diary: $e'),
              backgroundColor: isDarkMode ? Colors.red[800] : Colors.red,
              duration: const Duration(seconds: 3),
            ),
          );
        }
      }
    }
  }

  void _createNewPost(BuildContext context, FeedProvider provider) {
    final feedApiService = Provider.of<FeedApiService>(context, listen: false);

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreateDiaryScreen(
          feedApiService: feedApiService,
          onDiaryCreated: (DiaryModel diary) {
            provider.diaries.insert(0, diary);
            _showSuccessSnackBar('Diary created successfully!');
          },
        ),
      ),
    );
  }

  void _showErrorSnackBar(String message) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isDarkMode ? Colors.red[800] : Colors.red,
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _showSuccessSnackBar(String message) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isDarkMode ? Colors.green[800] : Colors.green,
        duration: const Duration(seconds: 3),
      ),
    );
  }
}