import 'package:flutter/material.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Privacy')),
      body: ListView(
        children: const [
          ListTile(title: Text('Private Account')),
          ListTile(title: Text('Blocked Users')),
          ListTile(title: Text('Data Permissions')),
        ],
      ),
    );
  }
}