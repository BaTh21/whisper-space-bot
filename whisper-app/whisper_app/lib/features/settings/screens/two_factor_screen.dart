import 'package:flutter/material.dart';
import 'package:whisper_space_flutter/services/security_api.dart';

class TwoFactorScreen extends StatefulWidget {
  final SecurityApi securityApi;
  final bool is2FAEnabled;
  final bool isEmail2SAEnabled;
  const TwoFactorScreen({
    super.key,
    required this.securityApi,
    required this.is2FAEnabled,
    required this.isEmail2SAEnabled,
  });

  @override
  State<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends State<TwoFactorScreen> {
  late bool _is2FAEnabled;
  late bool _isEmail2SAEnabled;
  bool _loading = false;
  String? _error;
  String? _success;

  // TOTP setup
  String? _qrUri;
  String? _secret;
  String _totpCode = '';

  // Disable 2FA flow
  bool _showDisable2FA = false;

  @override
  void initState() {
    super.initState();
    _is2FAEnabled = widget.is2FAEnabled;
    _isEmail2SAEnabled = widget.isEmail2SAEnabled;
  }

  Future<void> _setup2FA() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await widget.securityApi.setup2FA();
      setState(() {
        _qrUri = data['qr_uri'];
        _secret = data['secret'];
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _enable2FA() async {
    if (_totpCode.length != 6) {
      setState(() => _error = 'Enter 6-digit code');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await widget.securityApi.enable2FA(_totpCode);
      setState(() {
        _is2FAEnabled = true;
        _success = 'Two-factor authentication enabled';
        _qrUri = null;
        _secret = null;
        _totpCode = '';
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _disable2FA() async {
    if (_totpCode.length != 6) {
      setState(() => _error = 'Enter 6-digit code');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await widget.securityApi.disable2FA(_totpCode);
      setState(() {
        _is2FAEnabled = false;
        _success = 'Two-factor authentication disabled';
        _showDisable2FA = false;
        _totpCode = '';
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _enableEmail2SA() async {
    setState(() { _loading = true; _error = null; });
    try {
      await widget.securityApi.enableEmail2SA();
      setState(() {
        _isEmail2SAEnabled = true;
        _success = 'Email two-step authentication enabled';
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _disableEmail2SA() async {
    setState(() { _loading = true; _error = null; });
    try {
      await widget.securityApi.disableEmail2SA();
      setState(() {
        _isEmail2SAEnabled = false;
        _success = 'Email two-step authentication disabled';
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Two-Factor Authentication')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // TOTP 2FA section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.qr_code, color: Theme.of(context).primaryColor),
                      const SizedBox(width: 12),
                      const Text('Authentication with QR Code',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text('Use QR Code to verify two factor authentication'),
                  const SizedBox(height: 12),
                  if (_qrUri == null && !_is2FAEnabled && !_showDisable2FA)
                    ElevatedButton(
                      onPressed: _loading ? null : _setup2FA,
                      child: _loading ? const CircularProgressIndicator() : const Text('Enable'),
                    ),
                  if (_qrUri != null) ...[
                    Image.network(
                      'https://api.qrserver.com/v1/create-qr-code/?data=${Uri.encodeComponent(_qrUri!)}&size=200x200',
                      height: 200,
                    ),
                    const SizedBox(height: 8),
                    Text('Manual key: $_secret', style: const TextStyle(fontSize: 12)),
                    const SizedBox(height: 12),
                    _buildCodeInput((code) => _totpCode = code),
                    ElevatedButton(
                      onPressed: _loading ? null : _enable2FA,
                      child: _loading ? const CircularProgressIndicator() : const Text('Confirm & Enable'),
                    ),
                  ],
                  if (_is2FAEnabled && !_showDisable2FA)
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                      onPressed: () => setState(() => _showDisable2FA = true),
                      child: const Text('Disable'),
                    ),
                  if (_showDisable2FA) ...[
                    const SizedBox(height: 12),
                    const Text('Enter Verify Code to Confirm Disable 2FA'),
                    _buildCodeInput((code) => _totpCode = code),
                    ElevatedButton(
                      onPressed: _loading ? null : _disable2FA,
                      child: _loading ? const CircularProgressIndicator() : const Text('Disable 2FA'),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Email 2SA section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.email, color: Theme.of(context).primaryColor),
                      const SizedBox(width: 12),
                      const Text('Authentication with Email',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text('Receive a verification code by email when logging in'),
                  const SizedBox(height: 12),
                  if (!_isEmail2SAEnabled)
                    ElevatedButton(
                      onPressed: _loading ? null : _enableEmail2SA,
                      child: _loading ? const CircularProgressIndicator() : const Text('Enable'),
                    )
                  else
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                      onPressed: _loading ? null : _disableEmail2SA,
                      child: _loading ? const CircularProgressIndicator() : const Text('Disable'),
                    ),
                ],
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
          if (_success != null) ...[
            const SizedBox(height: 16),
            Text(_success!, style: const TextStyle(color: Colors.green)),
          ],
        ],
      ),
    );
  }

  Widget _buildCodeInput(Function(String) onChanged) {
    final controllers = List.generate(6, (_) => TextEditingController());
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(6, (i) => Container(
        width: 50,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        child: TextField(
          controller: controllers[i],
          textAlign: TextAlign.center,
          maxLength: 1,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(counterText: ''),
          onChanged: (v) {
            if (v.length == 1 && i < 5) FocusScope.of(context).nextFocus();
            final code = controllers.map((c) => c.text).join();
            onChanged(code);
          },
        ),
      )),
    );
  }
}