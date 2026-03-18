// lib/features/auth/presentation/screens/home_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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
import 'package:whisper_space_flutter/features/notes/presentation/screens/notes_tab.dart' as notes; // Import with alias
import 'package:whisper_space_flutter/shared/widgets/diary_card.dart';

import 'login_screen.dart';
import 'providers/auth_provider.dart';

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

  final List<Widget> _screens = [
    const FeedTab(),
    const MessagesTab(),
    const FriendsTab(),
    const NotesTab(), // This now uses the dynamic NotesTab
    const ProfileTab(),
  ];

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

  void _loadCurrentUser() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final user = authProvider.currentUser;
      if (user != null) {
        setState(() {
          _currentUserId = user.id;
        });

        // Set current user ID in FeedProvider
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

  @override
  Widget build(BuildContext context) {
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
          if (_selectedIndex == 4)
            IconButton(
              icon: const Icon(Icons.logout),
              tooltip: 'Logout',
              onPressed: _showLogoutDialog,
            )
          else if (_selectedIndex == 0)
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: 'Create New Diary',
              onPressed: () => _createNewDiaryFromHome(context),
            ),
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
            // Add to provider
            feedProvider.diaries.insert(0, diary);

            // Show success message
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
    const primaryColor = Color(0xFF6A11CB);

    return Padding(
      padding: const EdgeInsets.all(12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(25),
        child: NavigationBar(
          height: 70,
          backgroundColor: Colors.white,
          elevation: 10,
          selectedIndex: _selectedIndex,
          indicatorColor: primaryColor.withOpacity(0.15),
          labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
          onDestinationSelected: (index) {
            setState(() {
              _selectedIndex = index;
            });
          },
          destinations: [
            NavigationDestination(
              icon: const Icon(Icons.home_outlined, color: Colors.grey),
              selectedIcon: Icon(Icons.home, color: primaryColor),
              label: 'Feed',
            ),
            NavigationDestination(
              icon: const Icon(Icons.chat_bubble_outline, color: Colors.grey),
              selectedIcon: Icon(Icons.chat_bubble, color: primaryColor),
              label: 'Messages',
            ),
            NavigationDestination(
              icon: const Icon(Icons.group_outlined, color: Colors.grey),
              selectedIcon: Icon(Icons.group, color: primaryColor),
              label: 'Friends',
            ),
            NavigationDestination(
              icon: const Icon(Icons.note_outlined, color: Colors.grey),
              selectedIcon: Icon(Icons.note, color: primaryColor),
              label: 'Notes',
            ),
            NavigationDestination(
              icon: const Icon(Icons.person_outlined, color: Colors.grey),
              selectedIcon: Icon(Icons.person, color: primaryColor),
              label: 'Profile',
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showLogoutDialog() async {
    final shouldLogout = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Logout'),
            content: const Text('Are you sure you want to logout?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text(
                  'Logout',
                  style: TextStyle(color: Colors.red),
                ),
              ),
            ],
          ),
        ) ??
        false;

    if (shouldLogout && mounted) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      await authProvider.logout();

      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => const LoginScreen(),
          ),
        );
      }
    }
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

    // Use post frame callback to ensure context is ready
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
      setState(() {
        _currentUserId = user.id;
      });

      // Set current user ID in FeedProvider
      final feedProvider = Provider.of<FeedProvider>(context, listen: false);
      feedProvider.setCurrentUserId(user.id);
    }
  }

  Future<void> _loadUserGroups() async {
    if (!mounted) return;

    try {
      // Get FeedApiService from provider
      final feedApiService =
          Provider.of<FeedApiService>(context, listen: false);
      final groups = await feedApiService.getUserGroups();
      if (mounted) {
        setState(() {
          _availableGroups = groups;
        });
      }
    } catch (e) {
      print('Failed to load groups: $e');
      // Don't show error to user, just log it
    }
  }

  Future<void> _initializeFeed() async {
    if (!mounted) return;

    try {
      final feedProvider = Provider.of<FeedProvider>(context, listen: false);
      await feedProvider.loadInitialFeed();
      if (mounted) {
        setState(() => _isInitialized = true);
      }
    } catch (e) {
      print('Failed to initialize feed: $e');
      if (mounted) {
        setState(() =>
            _isInitialized = true); // Still set initialized to show error state
      }
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
                            onPressed: () =>
                                _navigateToCreateDiary(feedProvider),
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
                          onFavorite: () =>
                              _handleFavorite(feedProvider, diary.id),
                          onComment:
                              (diaryId, content, parentId, replyToUserId) =>
                                  _handleComment(feedProvider, diaryId, content,
                                      parentId, replyToUserId),
                          onEdit: (diaryToEdit) => _handleEditDiary(
                              context, feedProvider, diaryToEdit),
                          onDelete: (diaryId) => _handleDeleteDiary(
                              context, feedProvider, diaryId),
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

  // ============ EVENT HANDLERS ============

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
      final isCurrentlyFavorited =
          diary.favoritedUserIds.contains(_currentUserId);

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

  void _handleEditDiary(
      BuildContext context, FeedProvider provider, DiaryModel diary) async {
    try {
      final result = await Navigator.push<DiaryModel?>(
        context,
        MaterialPageRoute<DiaryModel?>(
          builder: (context) => EditDiaryFullScreen(
            diary: diary,
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
            availableGroups: _availableGroups,
          ),
        ),
      );

      if (result != null && mounted) {
        _showSuccessSnackBar('Diary updated successfully!');
      }
    } catch (e) {
      _showErrorSnackBar('Failed to edit diary: $e');
    }
  }

  void _handleDeleteDiary(
      BuildContext context, FeedProvider feedProvider, int diaryId) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Delete Diary'),
            content: const Text('Are you sure you want to delete this diary? '
                'This action cannot be undone.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
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
        await feedProvider.deleteDiary(diaryId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Diary deleted successfully'),
              backgroundColor: Colors.green,
              duration: Duration(seconds: 2),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Failed to delete diary: $e'),
              backgroundColor: Colors.red,
              duration: Duration(seconds: 3),
            ),
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
              _scrollController.animateTo(
                0,
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
              );
            }
          },
        ),
      ),
    );
  }

  void _showSuccessSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 2),
        ),
      );
    }
  }

  void _showErrorSnackBar(String message) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Colors.red,
          duration: const Duration(seconds: 3),
        ),
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
            final tween =
                Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
            return SlideTransition(
              position: animation.drive(tween),
              child: child,
            );
          },
        );
}

class MessagesTab extends StatelessWidget {
  const MessagesTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const ChatScreen();
  }
}

class FriendsTab extends StatelessWidget {
  const FriendsTab({super.key});

  @override
  Widget build(BuildContext context) {
    return const FriendScreen();
  }
}

// ============ DYNAMIC NOTES TAB ============
// This now uses the actual Notes implementation
class NotesTab extends StatelessWidget {
  const NotesTab({super.key});

  @override
  Widget build(BuildContext context) {
    // Use the imported NotesTab with alias to avoid naming conflict
    return const notes.NotesTab();
  }
}

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

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
                      CircleAvatar(
                        radius: 50,
                        backgroundColor: const Color(0xFF6C63FF),
                        backgroundImage: user?.avatarUrl != null
                            ? NetworkImage(user!.avatarUrl!)
                            : null,
                        child: user?.avatarUrl == null
                            ? const Icon(
                                Icons.person,
                                size: 60,
                                color: Colors.white,
                              )
                            : null,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        user?.username ?? 'User',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.email ?? '',
                        style: const TextStyle(
                          fontSize: 16,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Card(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _StatItem(value: '24', label: 'Posts'),
                      _StatItem(value: '128', label: 'Friends'),
                      _StatItem(value: '15', label: 'Notes'),
                      _StatItem(value: '42', label: 'Likes'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Card(
                child: Column(
                  children: [
                    _buildMenuItem(
                      Icons.settings,
                      'Settings',
                      () {},
                    ),
                    const Divider(height: 0),
                    _buildMenuItem(
                      Icons.notifications,
                      'Notifications',
                      () {},
                    ),
                    const Divider(height: 0),
                    _buildMenuItem(
                      Icons.privacy_tip,
                      'Privacy',
                      () {},
                    ),
                    const Divider(height: 0),
                    _buildMenuItem(
                      Icons.help,
                      'Help & Support',
                      () {},
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    final homeState =
                        context.findAncestorStateOfType<_HomeScreenState>();
                    homeState?._showLogoutDialog();
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
        Text(
          value,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: Color(0xFF6C63FF),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Colors.grey,
          ),
        ),
      ],
    );
  }
}