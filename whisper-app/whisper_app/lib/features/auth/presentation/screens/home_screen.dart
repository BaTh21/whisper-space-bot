import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/core/providers/theme_provider.dart';
import 'package:whisper_space_flutter/core/services/image_upload_service.dart';
import 'package:whisper_space_flutter/core/services/storage_service.dart';
import 'package:whisper_space_flutter/features/auth/data/models/diary_model.dart';
import 'package:whisper_space_flutter/features/chat/chat_screen.dart';
import 'package:whisper_space_flutter/features/feed/data/datasources/feed_api_service.dart';
import 'package:whisper_space_flutter/features/feed/presentation/providers/feed_provider.dart';
import 'package:whisper_space_flutter/features/feed/presentation/screens/create_diary_screen.dart';
import 'package:whisper_space_flutter/features/feed/presentation/screens/edit_diary_full_screen.dart';
import 'package:whisper_space_flutter/features/friend/presentation/screens/friend_screen.dart';
import 'package:whisper_space_flutter/features/inbox/inbox_api_service.dart';
import 'package:whisper_space_flutter/features/inbox/inbox_screen.dart';
import 'package:whisper_space_flutter/features/notes/presentation/providers/notes_provider.dart';
import 'package:whisper_space_flutter/features/notes/presentation/screens/notes_tab.dart'
    as notes;
import 'package:whisper_space_flutter/features/settings/screens/settings_screen.dart';
import 'package:whisper_space_flutter/shared/widgets/diary_card.dart';

import 'login_screen.dart';
import 'providers/auth_provider.dart';

// ===================== REUSABLE PROFILE IMAGE PICKER =====================
class ProfileImagePicker extends StatefulWidget {
  final String? currentImageUrl;
  final String? username;
  final Function(String?) onImageChanged;
  final bool isUploading;

  const ProfileImagePicker({
    super.key,
    this.currentImageUrl,
    this.username,
    required this.onImageChanged,
    this.isUploading = false,
  });

  @override
  State<ProfileImagePicker> createState() => _ProfileImagePickerState();
}

class _ProfileImagePickerState extends State<ProfileImagePicker> {
  final ImagePicker _picker = ImagePicker();

  Future<void> _showImagePickerOptions() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.camera_alt, color: Color(0xFF6C63FF)),
              title: const Text('Take a Photo'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library, color: Color(0xFF6C63FF)),
              title: const Text('Choose from Gallery'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
            if (widget.currentImageUrl != null && widget.currentImageUrl!.isNotEmpty) ...[
              const Divider(),
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('Remove Current Photo'),
                onTap: () {
                  Navigator.pop(context);
                  widget.onImageChanged(null);
                },
              ),
            ],
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _pickImage(ImageSource source) async {
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );
      if (pickedFile != null) {
        widget.onImageChanged(pickedFile.path);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error picking image: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.isUploading ? null : _showImagePickerOptions,
      child: Stack(
        children: [
          CircleAvatar(
            radius: 50,
            backgroundColor: const Color(0xFF6C63FF),
            backgroundImage: widget.currentImageUrl != null && widget.currentImageUrl!.isNotEmpty
                ? (widget.currentImageUrl!.startsWith('http')
                    ? NetworkImage(widget.currentImageUrl!)
                    : FileImage(File(widget.currentImageUrl!)) as ImageProvider)
                : null,
            child: widget.currentImageUrl == null || widget.currentImageUrl!.isEmpty
                ? Text(
                    widget.username?.isNotEmpty == true
                        ? widget.username![0].toUpperCase()
                        : 'U',
                    style: const TextStyle(
                      fontSize: 40,
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  )
                : null,
          ),
          if (!widget.isUploading)
            Positioned(
              bottom: 0,
              right: 0,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF6C63FF),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white,
                    width: 2,
                  ),
                ),
                child: const Padding(
                  padding: EdgeInsets.all(6),
                  child: Icon(
                    Icons.camera_alt,
                    size: 18,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          if (widget.isUploading)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: CircularProgressIndicator(
                    color: Colors.white,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ===================== HOME SCREEN =====================
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  int? _currentUserId;
  late final InboxAPISource inboxApi;

  bool isLoading = true;
  String? error;
  int _unreadCount = 0;

  late List<Widget> _screens;

  final List<String> _appBarTitles = [
    'Whisper Space',
    'Messages',
    'Friends',
    'Notes',
    'Profile',
  ];

  @override
  void initState() {
    super.initState();
    _loadCurrentUser();
    _initServicesAndLoad();
  }

  void _initializeScreens() {
    _screens = [
      const FeedTab(),
      const MessagesTab(),
      const FriendsTab(),
      const notes.NotesTab(),
      ProfileTab(
        userId: _currentUserId,
        onEditProfile: () => _navigateToEditProfile(),
      ),
    ];
  }

  void _loadCurrentUser() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final user = authProvider.currentUser;
      if (user != null) {
        setState(() {
          _currentUserId = user.id;
        });
        _initializeScreens();
        final feedProvider = Provider.of<FeedProvider>(context, listen: false);
        feedProvider.setCurrentUserId(user.id);
      }
    });
  }

  Future<void> _initServicesAndLoad() async {
    final storageService = StorageService();
    await storageService.init();
    inboxApi = InboxAPISource(storageService: storageService);
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final count = await inboxApi.getUnreadActivityCount();
      if (mounted) {
        setState(() {
          _unreadCount = count;
          isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          isLoading = false;
          error = e.toString();
        });
      }
    }
  }

  Future<void> _refreshNotes() async {
    final provider = Provider.of<NotesProvider>(context, listen: false);
    await provider.loadNotes();
    await provider.loadSharedNotes();
  }

  void _navigateToEditProfile() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Edit profile feature coming soon'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_screens.isEmpty) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_appBarTitles[_selectedIndex]),
        centerTitle: true,
        elevation: 0,
        actions: [
          IconButton(
            tooltip: 'Inbox',
            onPressed: () async {
              await showInboxDialog(context);
              _loadData();
            },
            icon: Badge(
              isLabelVisible: _unreadCount > 0,
              label: Text(_unreadCount > 99 ? '99+' : '$_unreadCount'),
              child: const Icon(Icons.mail_outline),
            ),
          ),
          if (_selectedIndex == 3)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _refreshNotes,
              tooltip: 'Refresh',
            )
        ],
      ),
      body: _screens[_selectedIndex],
      bottomNavigationBar: _buildBottomNavBar(),
      floatingActionButton:
          _selectedIndex == 0 ? _buildFloatingActionButton(context) : null,
    );
  }

  Widget _buildFloatingActionButton(BuildContext context) {
    return FloatingActionButton(
      onPressed: () => _createNewDiaryFromHome(context),
      heroTag: 'home_fab',
      child: const Icon(Icons.add),
    );
  }

  Future<void> showInboxDialog(BuildContext context) {
    return Navigator.of(context).push(
      _RightSlidePageRoute(
        widget: InboxDialog(
          unreadCounts: _unreadCount,
        ),
      ),
    );
  }

  void _createNewDiaryFromHome(BuildContext context) {
    final feedProvider = Provider.of<FeedProvider>(context, listen: false);
    final feedApiService = Provider.of<FeedApiService>(context, listen: false);

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreateDiaryScreen(
          feedApiService: feedApiService,
          onDiaryCreated: (DiaryModel diary) {
            feedProvider.diaries.insert(0, diary);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Created: "${diary.title}"'),
                backgroundColor: Colors.green,
                duration: const Duration(seconds: 2),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildBottomNavBar() {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;
    final primaryColor = isDarkMode ? const Color(0xFF00BCD4) : const Color(0xFF6A11CB);

    return Padding(
      padding: const EdgeInsets.all(12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(25),
        child: Theme(
          data: Theme.of(context).copyWith(
            navigationBarTheme: NavigationBarThemeData(
              labelTextStyle: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return TextStyle(
                    color: primaryColor,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  );
                }
                return TextStyle(
                  color: isDarkMode ? Colors.white70 : Colors.grey[600],
                  fontSize: 12,
                );
              }),
            ),
          ),
          child: NavigationBar(
            height: 70,
            backgroundColor: isDarkMode ? const Color(0xFF1E1E1E) : Colors.white,
            elevation: 10,
            selectedIndex: _selectedIndex,
            indicatorColor: primaryColor.withValues(alpha: 0.15),
            labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
            onDestinationSelected: (index) {
              setState(() {
                _selectedIndex = index;
              });
            },
            destinations: [
              NavigationDestination(
                icon: Icon(Icons.home_outlined, color: isDarkMode ? Colors.white70 : Colors.grey),
                selectedIcon: Icon(Icons.home, color: primaryColor),
                label: 'Feed',
              ),
              NavigationDestination(
                icon: Icon(Icons.chat_bubble_outline, color: isDarkMode ? Colors.white70 : Colors.grey),
                selectedIcon: Icon(Icons.chat_bubble, color: primaryColor),
                label: 'Messages',
              ),
              NavigationDestination(
                icon: Icon(Icons.group_outlined, color: isDarkMode ? Colors.white70 : Colors.grey),
                selectedIcon: Icon(Icons.group, color: primaryColor),
                label: 'Friends',
              ),
              NavigationDestination(
                icon: Icon(Icons.note_outlined, color: isDarkMode ? Colors.white70 : Colors.grey),
                selectedIcon: Icon(Icons.note, color: primaryColor),
                label: 'Notes',
              ),
              NavigationDestination(
                icon: Icon(Icons.person_outlined, color: isDarkMode ? Colors.white70 : Colors.grey),
                selectedIcon: Icon(Icons.person, color: primaryColor),
                label: 'Profile',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ============ FEED TAB ============
class FeedTab extends StatefulWidget {
  const FeedTab({super.key});

  @override
  State<FeedTab> createState() => _FeedTabState();
}

class _FeedTabState extends State<FeedTab> {
  final ScrollController _scrollController = ScrollController();
  bool _isInitialized = false;
  bool _showCreateButton = true;
  int? _currentUserId;
  List<Group> _availableGroups = [];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadCurrentUser();
      _loadUserGroups();
      _initializeFeed();
    });
  }

  void _loadCurrentUser() {
    if (!mounted) return;
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final user = authProvider.currentUser;
    if (user != null) {
      setState(() => _currentUserId = user.id);
      final feedProvider = Provider.of<FeedProvider>(context, listen: false);
      feedProvider.setCurrentUserId(user.id);
    }
  }

  Future<void> _loadUserGroups() async {
    if (!mounted) return;
    try {
      final feedApiService = Provider.of<FeedApiService>(context, listen: false);
      final groups = await feedApiService.getUserGroups();
      if (mounted) setState(() => _availableGroups = groups);
    } catch (e) {
      debugPrint('Failed to load groups: $e');
    }
  }

  Future<void> _initializeFeed() async {
    if (!mounted) return;
    try {
      final feedProvider = Provider.of<FeedProvider>(context, listen: false);
      await feedProvider.loadInitialFeed();
      if (mounted) setState(() => _isInitialized = true);
    } catch (e) {
      debugPrint('Failed to initialize feed: $e');
      if (mounted) setState(() => _isInitialized = true);
    }
  }

  void _onScroll() {
    if (!mounted) return;
    final currentScroll = _scrollController.position.pixels;
    if (currentScroll > 100 && _showCreateButton) {
      setState(() => _showCreateButton = false);
    } else if (currentScroll <= 100 && !_showCreateButton) {
      setState(() => _showCreateButton = true);
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<FeedProvider>(
      builder: (context, feedProvider, child) {
        if (!_isInitialized) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('Loading feed...'),
              ],
            ),
          );
        }
        if (feedProvider.error != null && feedProvider.diaries.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 20),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: Text(
                    feedProvider.error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: () {
                    feedProvider.clearError();
                    feedProvider.refreshFeed();
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          );
        }
        return Stack(
          children: [
            RefreshIndicator(
              onRefresh: () => feedProvider.refreshFeed(),
              child: feedProvider.diaries.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.feed, size: 64, color: Colors.grey),
                          const SizedBox(height: 20),
                          const Text(
                            'No diaries yet',
                            style: TextStyle(fontSize: 18, color: Colors.grey),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Be the first to share something!',
                            style: TextStyle(color: Colors.grey),
                          ),
                          const SizedBox(height: 20),
                          ElevatedButton(
                            onPressed: () => _navigateToCreateDiary(feedProvider),
                            child: const Text('Create First Diary'),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(16),
                      itemCount: feedProvider.diaries.length,
                      itemBuilder: (context, index) {
                        final diary = feedProvider.diaries[index];
                        final isOwner = diary.author.id == _currentUserId;
                        return DiaryCard(
                          diary: diary,
                          onLike: () => _handleLike(feedProvider, diary.id),
                          onFavorite: () => _handleFavorite(feedProvider, diary.id),
                          onComment: (diaryId, content, parentId, replyToUserId) =>
                              _handleComment(feedProvider, diaryId, content, parentId, replyToUserId),
                          onEdit: (diaryToEdit) => _handleEditDiary(context, feedProvider, diaryToEdit),
                          onDelete: (diaryId) => _handleDeleteDiary(context, feedProvider, diaryId),
                          isOwner: isOwner,
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }

  void _handleLike(FeedProvider feedProvider, int diaryId) async {
    try {
      await feedProvider.likeDiary(diaryId);
    } catch (e) {
      _showErrorSnackBar('Failed to like diary: $e');
    }
  }

  void _handleFavorite(FeedProvider feedProvider, int diaryId) async {
    try {
      final diary = feedProvider.diaries.firstWhere((d) => d.id == diaryId);
      final isCurrentlyFavorited = diary.favoritedUserIds.contains(_currentUserId);
      if (isCurrentlyFavorited) {
        await feedProvider.removeFromFavorites(diaryId);
        _showSuccessSnackBar('Removed from favorites');
      } else {
        await feedProvider.saveToFavorites(diaryId);
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

  void _handleEditDiary(BuildContext context, FeedProvider provider, DiaryModel diary) async {
    try {
      final result = await Navigator.push<DiaryModel?>(
        context,
        MaterialPageRoute<DiaryModel?>(
          builder: (context) => EditDiaryFullScreen(
            diary: diary,
            onUpdate: (updatedDiary) async {
              try {
                return await provider.updateDiary(
                  diaryId: updatedDiary.id,
                  title: updatedDiary.title,
                  content: updatedDiary.content,
                  shareType: updatedDiary.shareType,
                  groupIds: updatedDiary.groups.map((g) => g.id).toList(),
                  imageUrls: updatedDiary.images,
                  videoUrls: updatedDiary.videos,
                );
              } catch (e) {
                rethrow;
              }
            },
            availableGroups: _availableGroups,
          ),
        ),
      );
      if (result != null && mounted) _showSuccessSnackBar('Diary updated successfully!');
    } catch (e) {
      _showErrorSnackBar('Failed to edit diary: $e');
    }
  }

  void _handleDeleteDiary(BuildContext context, FeedProvider feedProvider, int diaryId) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Delete Diary'),
            content: const Text('Are you sure you want to delete this diary? This action cannot be undone.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
              TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
            ],
          ),
        ) ??
        false;
    if (confirmed) {
      try {
        await feedProvider.deleteDiary(diaryId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Diary deleted successfully'), backgroundColor: Colors.green),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete diary: $e'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  void _navigateToCreateDiary(FeedProvider feedProvider) {
    final feedApiService = Provider.of<FeedApiService>(context, listen: false);
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CreateDiaryScreen(
          feedApiService: feedApiService,
          onDiaryCreated: (DiaryModel diary) {
            feedProvider.diaries.insert(0, diary);
            _showSuccessSnackBar('Created: "${diary.title}"');
            if (_scrollController.hasClients) {
              _scrollController.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
            }
          },
        ),
      ),
    );
  }

  void _showSuccessSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: Colors.green, duration: const Duration(seconds: 2)),
      );
    }
  }

  void _showErrorSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message), backgroundColor: Colors.red, duration: const Duration(seconds: 3)),
      );
    }
  }
}

class _RightSlidePageRoute extends PageRouteBuilder {
  final Widget widget;
  _RightSlidePageRoute({required this.widget})
      : super(
          pageBuilder: (context, animation, secondaryAnimation) => widget,
          transitionDuration: const Duration(milliseconds: 300),
          reverseTransitionDuration: const Duration(milliseconds: 300),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final begin = const Offset(1.0, 0.0);
            final end = Offset.zero;
            final curve = Curves.easeInOut;
            final tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
            return SlideTransition(position: animation.drive(tween), child: child);
          },
        );
}

class MessagesTab extends StatelessWidget {
  const MessagesTab({super.key});
  @override
  Widget build(BuildContext context) => const ChatScreen();
}

class FriendsTab extends StatelessWidget {
  const FriendsTab({super.key});
  @override
  Widget build(BuildContext context) => const FriendScreen();
}

// ============ PROFILE TAB (PERFECT VERSION) ============
class ProfileTab extends StatefulWidget {
  final int? userId;
  final VoidCallback? onEditProfile;
  const ProfileTab({super.key, this.userId, this.onEditProfile});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  int _postsCount = 0;
  int _friendsCount = 0;
  int _notesCount = 0;
  int _likesCount = 0;
  bool _isLoadingStats = true;
  bool _isUploadingImage = false;
  bool _isUpdatingUsername = false;
  late ImageUploadService _imageUploadService;

  @override
  void initState() {
    super.initState();
    _initServices();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadUserStats();
    });
  }

  Future<void> _initServices() async {
    final storageService = StorageService();
    await storageService.init();
    const String baseUrl = 'http://10.0.2.2:8000/api/v1/avatars';
    _imageUploadService = ImageUploadService(baseUrl: baseUrl);
  }

  Future<void> _loadUserStats() async {
    setState(() => _isLoadingStats = true);
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final feedProvider = Provider.of<FeedProvider>(context, listen: false);
      final notesProvider = Provider.of<NotesProvider>(context, listen: false);
      final currentUser = authProvider.currentUser;
      if (currentUser != null) {
        final userPosts = feedProvider.diaries.where((diary) => diary.author.id == currentUser.id).length;
        final userNotes = notesProvider.notes.length;
        int totalLikes = 0;
        final userDiaries = feedProvider.diaries.where((diary) => diary.author.id == currentUser.id);
        for (var diary in userDiaries) {
          totalLikes += diary.likes.length;
        }
        if (mounted) {
          setState(() {
            _postsCount = userPosts;
            _notesCount = userNotes;
            _likesCount = totalLikes;
            _isLoadingStats = false;
          });
        }
      }
    } catch (e) {
      debugPrint('Error loading user stats: $e');
      if (mounted) setState(() => _isLoadingStats = false);
    }
  }

  Future<void> _handleImageChange(String? imagePath) async {
    if (imagePath == null) {
      await _removeProfileImage();
    } else {
      await _uploadProfileImage(File(imagePath));
    }
  }

  Future<void> _uploadProfileImage(File imageFile) async {
    setState(() => _isUploadingImage = true);
    try {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final token = await _getToken();
      final avatarUrl = await _imageUploadService.uploadProfileImage(imageFile, token);
      if (avatarUrl != null && mounted) {
        await authProvider.updateProfileImage(avatarUrl);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile picture updated successfully!'), backgroundColor: Colors.green),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to upload image: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploadingImage = false);
    }
  }

  Future<void> _removeProfileImage() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final user = authProvider.currentUser;

    if (user?.avatarUrl == null || user!.avatarUrl!.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No profile picture to remove'), backgroundColor: Colors.orange),
        );
      }
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove Profile Picture'),
        content: const Text('Are you sure you want to remove your profile picture?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Remove', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm != true || !mounted) return;

    setState(() => _isUploadingImage = true);
    try {
      final token = await _getToken();
      if (token.isEmpty) throw Exception('No authentication token');

      final success = await _imageUploadService.deleteProfileImage(token);
      if (success && mounted) {
        await authProvider.removeProfileImage();
        setState(() {}); // Force immediate UI rebuild
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile picture removed'), backgroundColor: Colors.orange),
        );
      } else {
        throw Exception('Deletion failed');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to remove image: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploadingImage = false);
    }
  }

  Future<String> _getToken() async {
    final storageService = StorageService();
    await storageService.init();
    return storageService.getToken() ?? '';
  }

  Future<void> _editUsername() async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final currentUsername = authProvider.currentUser?.username ?? '';
    final controller = TextEditingController(text: currentUsername);
    final newUsername = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit Username'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Username',
            hintText: 'Enter new username',
            helperText: 'Only letters, numbers, and underscores',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    if (newUsername == null || newUsername.isEmpty || newUsername == currentUsername) return;

    setState(() => _isUpdatingUsername = true);

    try {
      await authProvider.updateUsername(newUsername);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Username updated successfully'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (!mounted) return;
      final errorString = e.toString();
      if (errorString.contains('409') ||
          errorString.contains('already taken') ||
          errorString.contains('Username is already taken')) {
        await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 28),
                SizedBox(width: 8),
                Text('Username Unavailable'),
              ],
            ),
            content: const Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'The username you entered is already taken.',
                  style: TextStyle(fontSize: 16),
                ),
                SizedBox(height: 12),
                Text(
                  'Please choose a different username.',
                  style: TextStyle(fontSize: 14, color: Colors.grey),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Try Again'),
              ),
            ],
          ),
        );
      } else {
        await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.error_outline, color: Colors.red, size: 28),
                SizedBox(width: 8),
                Text('Update Failed'),
              ],
            ),
            content: Text(
              'An error occurred while updating your username.\n\nError: $e',
              style: const TextStyle(fontSize: 14),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isUpdatingUsername = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, authProvider, child) {
        final user = authProvider.currentUser;
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Card(
                elevation: 2,
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      ProfileImagePicker(
                        currentImageUrl: user?.avatarUrl,
                        username: user?.username,
                        onImageChanged: _handleImageChange,
                        isUploading: _isUploadingImage,
                      ),
                      const SizedBox(height: 16),
                      GestureDetector(
                        onTap: _isUpdatingUsername ? null : _editUsername,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              user?.username ?? 'User',
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (_isUpdatingUsername)
                              const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            else
                              const Icon(Icons.edit, size: 18, color: Colors.grey),
                          ],
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.email ?? '',
                        style: const TextStyle(fontSize: 16, color: Colors.grey),
                      ),
                      if (user?.bio != null && user!.bio!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.grey[100],
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            user.bio!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              fontSize: 14,
                              color: Colors.black87,
                              fontStyle: FontStyle.italic,
                            ),
                          ),
                        ),
                      ],
                      if (user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: TextButton.icon(
                            onPressed: _isUploadingImage ? null : _removeProfileImage,
                            icon: const Icon(Icons.delete_outline, size: 18, color: Colors.red),
                            label: const Text('Remove Photo', style: TextStyle(color: Colors.red)),
                            style: TextButton.styleFrom(
                              minimumSize: Size.zero,
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Card(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: _isLoadingStats
                      ? const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _StatItem(value: _postsCount.toString(), label: 'Posts'),
                            _StatItem(value: _friendsCount.toString(), label: 'Friends'),
                            _StatItem(value: _notesCount.toString(), label: 'Notes'),
                            _StatItem(value: _likesCount.toString(), label: 'Likes'),
                          ],
                        ),
                ),
              ),
              const SizedBox(height: 20),
              Card(
                child: Column(
                  children: [
                    _buildMenuItem(Icons.settings, 'Settings', () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const SettingsScreen()));
                    }),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    final authProvider = Provider.of<AuthProvider>(context, listen: false);
                    await authProvider.logout();
                    if (mounted) {
                      Navigator.pushReplacement(context, MaterialPageRoute(builder: (context) => const LoginScreen()));
                    }
                  },
                  icon: const Icon(Icons.logout),
                  label: const Text('Logout'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFEBEE),
                    foregroundColor: Colors.red,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMenuItem(IconData icon, String title, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: const Color(0xFF6C63FF)),
      title: Text(title),
      trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      onTap: onTap,
    );
  }
}

class _StatItem extends StatelessWidget {
  final String value;
  final String label;
  const _StatItem({required this.value, required this.label});
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF6C63FF))),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.grey)),
      ],
    );
  }
}