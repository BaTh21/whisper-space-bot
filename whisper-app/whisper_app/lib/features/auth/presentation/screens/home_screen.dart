import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/core/providers/theme_provider.dart';
import 'package:whisper_space_flutter/core/services/storage_service.dart';
import 'package:whisper_space_flutter/features/auth/data/models/diary_model.dart';
import 'package:whisper_space_flutter/features/auth/presentation/screens/providers/auth_provider.dart';
import 'package:whisper_space_flutter/features/feed/data/datasources/feed_api_service.dart';
import 'package:whisper_space_flutter/features/feed/presentation/providers/feed_provider.dart';
import 'package:whisper_space_flutter/features/feed/presentation/screens/create_diary_screen.dart';
import 'package:whisper_space_flutter/features/home/presentation/tabs/feed_tab.dart';
import 'package:whisper_space_flutter/features/home/presentation/tabs/friends_tab.dart';
import 'package:whisper_space_flutter/features/home/presentation/tabs/messages_tab.dart';
import 'package:whisper_space_flutter/features/home/presentation/tabs/profile_tab.dart';
import 'package:whisper_space_flutter/features/home/presentation/widgets/right_slide_page_route.dart';
import 'package:whisper_space_flutter/features/inbox/inbox_api_service.dart';
import 'package:whisper_space_flutter/features/inbox/inbox_screen.dart';
import 'package:whisper_space_flutter/features/notes/presentation/providers/notes_provider.dart';
import 'package:whisper_space_flutter/features/notes/presentation/screens/notes_tab.dart'; 

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
      const NotesTab(),
      ProfileTab(userId: _currentUserId),
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
    final storageService = context.read<StorageService>();
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
        body: Center(child: CircularProgressIndicator()),
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
            ),
        ],
      ),
      body: _screens[_selectedIndex],
      bottomNavigationBar: _buildBottomNavBar(),
      floatingActionButton: _selectedIndex == 0 ? _buildFloatingActionButton(context) : null,
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
      RightSlidePageRoute(
        widget: InboxDialog(unreadCounts: _unreadCount),
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
                  return TextStyle(color: primaryColor, fontWeight: FontWeight.w600, fontSize: 12);
                }
                return TextStyle(color: isDarkMode ? Colors.white70 : Colors.grey[600], fontSize: 12);
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