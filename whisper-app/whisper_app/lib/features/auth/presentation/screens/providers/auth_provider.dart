import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../../../../../core/services/auth_service.dart';
import '../../../../../core/services/storage_service.dart';
import '../../../data/models/user_model.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService authService;
  final StorageService storageService;
  
  User? _currentUser;
  bool _isLoading = false;
  String? _error;
  
  AuthProvider({
    required this.authService,
    required this.storageService,
  }) {
    _loadUserFromStorage();
  }
  
  User? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get savedEmail => storageService.getUserEmail();
  
  // Guaranteed non-null because authService.dio is final and initialized
  Dio get dio => authService.dio;
  
  Future<void> _loadUserFromStorage() async {
    if (storageService.isLoggedIn()) {
      final userData = storageService.getUserData();
      if (userData != null) {
        try {
          _currentUser = User.fromJson(userData);
          notifyListeners();
        } catch (e) {
          await storageService.clearAll();
        }
      }
    }
  }
  
  Future<LoginResponse> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await authService.login(email, password);
      if (result.success) {
        _currentUser = result.user;
        _error = null;
      } else {
        _error = result.message;
      }
      return result;
    } catch (e) {
      _error = 'An unexpected error occurred';
      return LoginResponse.error(message: _error!);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<RegisterResponse> register(String username, String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await authService.register(username, email, password);
      if (!result.success) {
        _error = result.message;
      }
      return result;
    } catch (e) {
      _error = 'An unexpected error occurred';
      return RegisterResponse.error(message: _error!);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<VerifyResponse> verifyEmail(String email, String code) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await authService.verifyEmail(email, code);
      if (result.success) {
        final user = await authService.getCurrentUser(result.token!.accessToken);
        _currentUser = user;
        await storageService.saveUserData(user.toJson());
      } else {
        _error = result.message;
      }
      return result;
    } catch (e) {
      _error = 'An unexpected error occurred';
      return VerifyResponse.error(message: _error!);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<ForgotPasswordResponse> forgotPassword(String email) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await authService.forgotPassword(email);
      if (!result.success) {
        _error = result.message;
      }
      return result;
    } catch (e) {
      _error = 'An unexpected error occurred';
      return ForgotPasswordResponse.error(message: _error!);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<ResendVerificationResponse> resendVerification(String email) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await authService.resendVerification(email);
      if (!result.success) {
        _error = result.message;
      }
      return result;
    } catch (e) {
      _error = 'An unexpected error occurred';
      return ResendVerificationResponse.error(message: _error!);
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();
    try {
      await authService.logout();
      _currentUser = null;
      _error = null;
    } catch (e) {
      _error = 'Logout failed';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
  
  Future<void> updateProfileImage(String imageUrl) async {
    if (_currentUser != null) {
      _currentUser = _currentUser!.copyWith(avatarUrl: imageUrl);
      await storageService.saveUserData(_currentUser!.toJson());
      notifyListeners();
    }
  }

  Future<void> removeProfileImage() async {
    if (_currentUser != null) {
      _currentUser = _currentUser!.copyWith(avatarUrl: null);
      await storageService.saveUserData(_currentUser!.toJson());
      notifyListeners();
    }
  }
}