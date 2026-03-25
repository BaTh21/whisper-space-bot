// main.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/core/providers/theme_provider.dart';
import 'package:whisper_space_flutter/features/notes/data/datasources/notes_api_service.dart';
import 'package:whisper_space_flutter/features/notes/presentation/providers/friend_provider.dart';
import 'package:whisper_space_flutter/features/notes/presentation/providers/notes_provider.dart';
import 'package:whisper_space_flutter/shared/widgets/theme/app_theme.dart';

import 'core/services/auth_service.dart';
import 'core/services/storage_service.dart';
import 'features/auth/presentation/screens/home_screen.dart';
import 'features/auth/presentation/screens/login_screen.dart';
import 'features/auth/presentation/screens/providers/auth_provider.dart';
import 'features/feed/data/datasources/feed_api_service.dart';
import 'features/feed/presentation/providers/feed_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    final storageService = StorageService();
    await storageService.init();

    final authService = AuthService(storageService: storageService);
    final feedApiService = FeedApiService(storageService: storageService);

    runApp(
      MultiProvider(
        providers: [
          Provider<StorageService>(create: (_) => storageService),
          Provider<AuthService>(create: (_) => authService),
          Provider<FeedApiService>(create: (_) => feedApiService),
          ChangeNotifierProvider(create: (_) => ThemeProvider()),
          ChangeNotifierProvider(
            create: (context) => AuthProvider(
              authService: authService,
              storageService: storageService,
            ),
          ),
          ChangeNotifierProvider(
            create: (context) => FeedProvider(
              feedApiService: context.read<FeedApiService>(),
            ),
          ),
          ChangeNotifierProvider(
            create: (context) => NotesProvider(
              NotesApiService(storageService: storageService),
            ),
          ),
          ChangeNotifierProvider(
            create: (context) => FriendProvider(
              storageService: storageService,
            ),
          ),
        ],
        child: const MyApp(),
      ),
    );
  } catch (e) {
    runApp(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: Text('App failed to start: $e'),
          ),
        ),
      ),
    );
  }
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<ThemeProvider>(
      builder: (context, themeProvider, child) {
        return MaterialApp(
          title: 'Whisper Space',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: themeProvider.themeMode,
          home: Consumer<AuthProvider>(
            builder: (context, authProvider, child) {
              if (authProvider.currentUser != null) {
                return const HomeScreen();
              }
              return const LoginScreen();
            },
          ),
        );
      },
    );
  }
}
