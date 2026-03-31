import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/settings_provider.dart';

class NotificationSettingsScreen extends StatelessWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<SettingsProvider>(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text('Push Notifications'),
            value: provider.pushNotifications,
            onChanged: provider.togglePushNotifications,
          ),
          SwitchListTile(
            title: const Text('Email Notifications'),
            value: provider.emailNotifications,
            onChanged: provider.toggleEmailNotifications,
          ),
        ],
      ),
    );
  }
}