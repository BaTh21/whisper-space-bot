import 'dart:async'; // Add this import
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../shared/widgets/custom_button.dart';
import '../../../../shared/widgets/loading_overlay.dart';
import 'login_screen.dart';
import 'providers/auth_provider.dart';

class VerificationScreen extends StatefulWidget {
  final String email;

  const VerificationScreen({super.key, required this.email});

  @override
  VerificationScreenState createState() => VerificationScreenState();
}

class VerificationScreenState extends State<VerificationScreen> {
  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());
  bool _isLoading = false;
  bool _isResending = false;
  int _resendCountdown = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startResendTimer();

    // Setup focus node listeners
    for (int i = 0; i < _controllers.length; i++) {
      _controllers[i].addListener(() {
        if (_controllers[i].text.isNotEmpty && i < _controllers.length - 1) {
          _focusNodes[i + 1].requestFocus();
        }
        if (_controllers[i].text.isEmpty && i > 0) {
          _focusNodes[i - 1].requestFocus();
        }
      });
    }
  }

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.dispose();
    }
    for (var focusNode in _focusNodes) {
      focusNode.dispose();
    }
    _timer?.cancel();
    super.dispose();
  }

  void _startResendTimer() {
    _resendCountdown = 60;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_resendCountdown > 0) {
          _resendCountdown--;
        } else {
          timer.cancel();
        }
      });
    });
  }

  Future<void> _verify() async {
    FocusScope.of(context).unfocus();

    final code = _controllers.map((c) => c.text).join();
    if (code.length != 6) {
      _showErrorDialog('Please enter all 6 digits');
      return;
    }

    setState(() => _isLoading = true);

    final authProvider = context.read<AuthProvider>();
    final result = await authProvider.verifyEmail(widget.email, code);

    setState(() => _isLoading = false);

    if (!mounted) return;

    if (result.success) {
      // Show success dialog
      _showSuccessDialog();
    } else {
      _showErrorDialog(result.message ?? 'Verification failed');
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.verified_user, color: Colors.green),
            SizedBox(width: 10),
            Text('Email Verified!'),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Your email has been successfully verified.',
              textAlign: TextAlign.center,
            ),
            SizedBox(height: 10),
            Text(
              'You can now login to your account.',
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context); // Close dialog
              // Navigate to login
              Navigator.pushReplacement(
                context,
                MaterialPageRoute(
                  builder: (context) => const LoginScreen(),
                ),
              );
            },
            child: const Text('Go to Login'),
          ),
        ],
      ),
    );
  }

  Future<void> _resendCode() async {
    if (_resendCountdown > 0) return;

    setState(() => _isResending = true);

    final authProvider = context.read<AuthProvider>();
    final result = await authProvider.resendVerification(widget.email);

    setState(() => _isResending = false);

    if (!mounted) return;

    if (result.success) {
      _startResendTimer();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('New verification code sent'),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 3),
        ),
      );
    } else {
      _showErrorDialog(result.message ?? 'Failed to resend code');
    }
  }

  void _showErrorDialog(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Verification Failed'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return LoadingOverlay(
      isLoading: _isLoading,
      child: Scaffold(
        body: Stack(
          children: [
            // 🌈 Gradient Background
            Container(
              width: double.infinity,
              height: double.infinity,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF6A11CB), Color(0xFF2575FC)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
            ),

            SafeArea(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                child: Column(
                  children: [
                    const Icon(
                      Icons.verified_user,
                      size: 90,
                      color: Colors.white,
                    ),
                    const SizedBox(height: 20),

                    // Title
                    Text(
                      'Verify Your Email',
                      style:
                          Theme.of(context).textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                    ),

                    const SizedBox(height: 10),

                    Text(
                      'Enter the 6-digit code sent to',
                      style: TextStyle(color: Colors.white70),
                    ),

                    const SizedBox(height: 5),

                    Text(
                      widget.email,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),

                    const SizedBox(height: 30),

                    // 📦 White Card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(25),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.15),
                            blurRadius: 30,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          // Info box
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.blue[50],
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Row(
                              children: [
                                Icon(Icons.info, color: Colors.blue, size: 20),
                                SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Check inbox & spam folder for the code',
                                    style: TextStyle(fontSize: 14),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 25),

                          // Code input
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: List.generate(6, (index) {
                              return SizedBox(
                                width: 45,
                                child: TextFormField(
                                  controller: _controllers[index],
                                  focusNode: _focusNodes[index],
                                  textAlign: TextAlign.center,
                                  keyboardType: TextInputType.number,
                                  maxLength: 1,
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  decoration: InputDecoration(
                                    counterText: '',
                                    filled: true,
                                    fillColor: Colors.grey[100],
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(10),
                                      borderSide: BorderSide.none,
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(10),
                                      borderSide: const BorderSide(
                                          color: Color(0xFF6A11CB), width: 2),
                                    ),
                                  ),
                                  onChanged: (value) {
                                    if (value.isNotEmpty && index < 5) {
                                      _focusNodes[index + 1].requestFocus();
                                    }
                                    if (value.isEmpty && index > 0) {
                                      _focusNodes[index - 1].requestFocus();
                                    }
                                  },
                                ),
                              );
                            }),
                          ),

                          const SizedBox(height: 30),

                          // Verify button
                          CustomButton(
                            text: 'Verify Email',
                            onPressed: _verify,
                            fullWidth: true,
                            icon: Icons.verified,
                            color: const Color(0xFF6A11CB),
                          ),

                          const SizedBox(height: 20),

                          // Resend
                          Column(
                            children: [
                              const Text(
                                "Didn't receive the code?",
                                style: TextStyle(fontSize: 15),
                              ),
                              const SizedBox(height: 6),
                              if (_resendCountdown > 0)
                                Text(
                                  'Resend in $_resendCountdown s',
                                  style: const TextStyle(color: Colors.grey),
                                )
                              else
                                TextButton(
                                  onPressed: _isResending ? null : _resendCode,
                                  child: _isResending
                                      ? const SizedBox(
                                          width: 20,
                                          height: 20,
                                          child: CircularProgressIndicator(
                                              strokeWidth: 2),
                                        )
                                      : const Text(
                                          'Resend Code',
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            color: Color(0xFF6A11CB),
                                          ),
                                        ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Back
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text(
                        'Use different email',
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
