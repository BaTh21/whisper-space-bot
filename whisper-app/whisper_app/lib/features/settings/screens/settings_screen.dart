// In lib/screens/settings/settings_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/core/providers/theme_provider.dart';

import 'help_support_screen.dart';
import 'notification_settings_screen.dart';
import 'security_settings_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          SwitchListTile(
            secondary: const Icon(Icons.dark_mode),
            title: const Text('Dark Mode'),
            value: isDarkMode,
            onChanged: themeProvider.toggleTheme,
          ),
          const Divider(),
          // NEW: Security entry
          ListTile(
            leading: const Icon(Icons.security),
            title: const Text('Security & Privacy'),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SecuritySettingsScreen()),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.notifications),
            title: const Text('Notifications'),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const NotificationSettingsScreen()),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.help),
            title: const Text('Help & Support'),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const HelpSupportScreen()),
              );
            },
          ),
        ],
      ),
    );
  }
}