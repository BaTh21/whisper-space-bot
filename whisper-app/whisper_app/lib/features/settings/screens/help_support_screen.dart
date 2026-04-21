import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  final _problemController = TextEditingController();
  final _emailController = TextEditingController();
  bool _isSubmitting = false;

  // Sample FAQ data – replace with API call
  final List<FaqItem> _faqItems = [
    FaqItem(
      question: 'How do I reset my password?',
      answer: 'Go to Login screen → Forgot Password → Follow the instructions sent to your email.',
    ),
    FaqItem(
      question: 'How can I change my email address?',
      answer: 'Navigate to Settings → Privacy & Security → Change Email. You will need to verify the new email.',
    ),
    FaqItem(
      question: 'What is Two-Factor Authentication?',
      answer: '2FA adds an extra layer of security. After enabling, you will need a TOTP code from an authenticator app to log in.',
    ),
    FaqItem(
      question: 'How do I delete my account?',
      answer: 'Go to Settings → Privacy & Security → Deactivate Account. This action is irreversible.',
    ),
    FaqItem(
      question: 'My messages are not sending. What should I do?',
      answer: 'Check your internet connection. If the problem persists, contact support using the form below.',
    ),
  ];

  @override
  void dispose() {
    _problemController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _contactSupport() async {
    final email = Uri.parse('mailto:support@whisper-space.com?subject=Support Request&body=Describe your issue...');
    if (await canLaunchUrl(email)) {
      await launchUrl(email);
    } else {
      _showSnackBar('Could not open email client');
    }
  }

  Future<void> _reportProblem() async {
    if (_problemController.text.trim().isEmpty) {
      _showSnackBar('Please describe the problem');
      return;
    }

    setState(() => _isSubmitting = true);

    // Simulate API call – replace with actual backend endpoint
    await Future.delayed(const Duration(seconds: 1));

    // In a real app, send data to your backend: 
    // await yourApi.reportProblem(problem: _problemController.text, email: _emailController.text);

    setState(() => _isSubmitting = false);
    _showSnackBar('Thank you! Our team will review your report.');

    // Clear form
    _problemController.clear();
    _emailController.clear();
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Help & Support')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // FAQ Section
          Card(
            elevation: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Frequently Asked Questions',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                const Divider(height: 0),
                ..._faqItems.map((item) => _buildFaqTile(item)).toList(),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Contact Support Button
          Card(
            elevation: 2,
            child: ListTile(
              leading: const Icon(Icons.email, color: Colors.blue),
              title: const Text('Contact Support via Email'),
              subtitle: const Text('Send an email to our support team'),
              onTap: _contactSupport,
            ),
          ),
          const SizedBox(height: 16),

          // Report a Problem Form
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Report a Problem',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _emailController,
                    decoration: const InputDecoration(
                      labelText: 'Your Email (optional)',
                      hintText: 'We may contact you for updates',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _problemController,
                    decoration: const InputDecoration(
                      labelText: 'Describe the problem *',
                      hintText: 'What went wrong?',
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 4,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _isSubmitting ? null : _reportProblem,
                      icon: _isSubmitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.send),
                      label: Text(_isSubmitting ? 'Submitting...' : 'Submit Report'),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFaqTile(FaqItem item) {
    return ExpansionTile(
      title: Text(item.question, style: const TextStyle(fontWeight: FontWeight.w500)),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Text(item.answer, style: const TextStyle(fontSize: 14)),
        ),
      ],
    );
  }
}

class FaqItem {
  final String question;
  final String answer;
  FaqItem({required this.question, required this.answer});
}