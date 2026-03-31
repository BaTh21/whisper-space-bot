import 'package:flutter/material.dart';

class HelpSupportScreen extends StatelessWidget {
  const HelpSupportScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: ListView(
        children: [
          ListTile(
            title: const Text('FAQ'),
            onTap: () {},
          ),
          ListTile(
            title: const Text('Contact Support'),
            onTap: () {},
          ),
          ListTile(
            title: const Text('Report a Problem'),
            onTap: () {},
          ),
        ],
      ),
    );
  }
}