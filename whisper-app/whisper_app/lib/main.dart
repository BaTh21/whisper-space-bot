import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

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
    return MaterialApp(
      title: 'Whisper Space',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primaryColor: const Color(0xFF6A11CB),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6A11CB),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF6A11CB),
          foregroundColor: Colors.white,
          elevation: 0,
        ),
      ),
      home: Consumer<AuthProvider>(
        builder: (context, authProvider, child) {
          if (authProvider.currentUser != null) {
            return const HomeScreen();
          }
          return const LoginScreen();
        },
      ),
    );
  }
}
