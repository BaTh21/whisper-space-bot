import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:whisper_space_flutter/features/auth/presentation/screens/providers/auth_provider.dart';

import '../../../services/security_api.dart';
import '../../../widgets/section_tile.dart';
import 'change_password_screen.dart';
import 'login_details_screen.dart';
import 'recovery_email_screen.dart';
import 'two_factor_screen.dart';

class SecuritySettingsScreen extends StatelessWidget {
  const SecuritySettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.currentUser;
    final dio = authProvider.dio;
    final securityApi = SecurityApi(dio);

    // If user is not loaded yet, show loading indicator
    if (user == null) {
      return Scaffold( 
        appBar: AppBar(title: const Text('Security & Privacy')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Security & Privacy')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Account Details', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          const SizedBox(height: 8),
          SectionTile(
            icon: Icons.security,
            title: 'Login Information',
            subtitle: 'View recent login activity and devices',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => LoginDetailsScreen(securityApi: securityApi)),
            ),
          ),
          SectionTile(
            icon: Icons.lock,
            title: 'Update Password',
            subtitle: 'Change your account password',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => ChangePasswordScreen(securityApi: securityApi)),
            ),
          ),
          const Divider(height: 32),

          const Text('Recovery Settings', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          const SizedBox(height: 8),
          SectionTile(
            icon: Icons.email,
            title: 'Recovery Email',
            subtitle: 'Update recovery email for account recovery',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => RecoveryEmailScreen(
                securityApi: securityApi,
                currentEmail: user.email,
              )),
            ),
          ),
          const Divider(height: 32),

          const Text('Two-Factor Authentication', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
          const SizedBox(height: 8),
          SectionTile(
            icon: Icons.verified_user,
            title: 'Two-Factor Authentication',
            subtitle: 'Add an extra layer of security to your account',
            onTap: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => TwoFactorScreen(
                  securityApi: securityApi,
                  is2FAEnabled: user.is2faEnabled,
                  isEmail2SAEnabled: user.isEmail2saEnabled,
                ),
              ),
            ),
          ),
          const Divider(height: 32),

          const Text('Danger Zone', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: Colors.red)),
          const SizedBox(height: 8),
          SectionTile(
            icon: Icons.block,
            title: 'Deactivate Account',
            subtitle: 'Temporarily disable your account. You can reactivate by signing in.',
            onTap: () => _showDeactivateDialog(context, securityApi),
            iconColor: Colors.red,
            textColor: Colors.red,
          ),
        ],
      ),
    );
  }

  void _showDeactivateDialog(BuildContext context, SecurityApi api) {
    final TextEditingController passwordController = TextEditingController();
    String error = '';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setState) => AlertDialog(
          title: const Text('Deactivate Account', style: TextStyle(color: Colors.red)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('This will immediately deactivate your account and log you out.'),
              const SizedBox(height: 16),
              TextField(
                controller: passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Confirm Password',
                  border: OutlineInputBorder(),
                ),
              ),
              if (error.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(error, style: const TextStyle(color: Colors.red)),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              onPressed: () async {
                final password = passwordController.text.trim();
                if (password.isEmpty) {
                  setState(() => error = 'Password is required');
                  return;
                }
                try {
                  await api.deactivateAccount(password);
                  // Use the dialog's context 'ctx' to get authProvider, not the outer 'context'
                  final authProvider = Provider.of<AuthProvider>(ctx, listen: false);
                  await authProvider.logout();
                  if (ctx.mounted) {
                    Navigator.pushNamedAndRemoveUntil(ctx, '/login', (route) => false);
                  }
                } catch (e) {
                  if (ctx.mounted) {
                    setState(() => error = e.toString());
                  }
                }
              },
              child: const Text('Deactivate'),
            ),
          ],
        ),
      ),
    );
  }
}