import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:http/http.dart' as http;

import '../../features/auth/data/models/token_model.dart';
import '../../features/auth/data/models/user_model.dart';
import '../constants/api_constants.dart';
import 'storage_service.dart';

class AuthService {
  final StorageService storageService;
  final String baseUrl;
  final Dio _dio;

  AuthService({
    required this.storageService,
    String? baseUrl,
  })  : baseUrl = baseUrl ?? ApiConstants.baseUrl,
        _dio = Dio(BaseOptions(
          baseUrl: baseUrl ?? ApiConstants.baseUrl,
          headers: ApiConstants.defaultHeaders,
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
        )) {
    // Add token interceptor
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storageService.getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
    ));
  }

  Dio get dio => _dio;

  // ========== REST OF YOUR EXISTING METHODS (unchanged) ==========
  Future<LoginResponse> login(String email, String password) async {
    try {
      final url = Uri.parse('$baseUrl${ApiConstants.login}');
      final response = await http.post(
        url,
        headers: ApiConstants.formLoginHeaders,
        body:
            'username=${Uri.encodeComponent(email)}&password=${Uri.encodeComponent(password)}',
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = Token.fromJson(data);
        await storageService.saveToken(token.accessToken);
        await storageService.saveRefreshToken(token.refreshToken);
        await storageService.setLoggedIn(true);
        final user = await getCurrentUser(token.accessToken);
        await storageService.saveUserData(user.toJson());
        await storageService.saveUserEmail(user.email);
        return LoginResponse.success(user: user, token: token);
      } else {
        return _handleLoginError(response);
      }
    } catch (e) {
      return LoginResponse.error(
        message: 'Network error. Please check your internet connection.',
      );
    }
  }

  LoginResponse _handleLoginError(http.Response response) {
    try {
      final error = jsonDecode(response.body);
      String errorMessage;
      if (response.statusCode == 401) {
        return LoginResponse.error(
            message: 'Invalid email or password. Please try again.');
      } else if (response.statusCode == 404) {
        return LoginResponse.error(
            message: 'User not found. Please check your email.');
      } else if (response.statusCode == 403) {
        return LoginResponse.error(
            message: 'Account not verified. Please verify your email first.');
      } else if (response.statusCode == 422) {
        return LoginResponse.error(
            message: 'Invalid input format. Please check your information.');
      }
      if (error is Map<String, dynamic>) {
        if (error.containsKey('detail')) {
          final detail = error['detail'];
          if (detail is String) {
            errorMessage = detail;
          } else if (detail is List && detail.isNotEmpty) {
            errorMessage = detail.map((e) => e['msg'] ?? '').join(', ');
          } else {
            errorMessage = 'Login failed. Please try again.';
          }
        } else {
          errorMessage = 'Login failed. Please try again.';
        }
      } else {
        errorMessage = 'Login failed with status ${response.statusCode}';
      }
      return LoginResponse.error(message: errorMessage);
    } catch (e) {
      return LoginResponse.error(
        message: 'Login failed. Please check your credentials and try again.',
      );
    }
  }

  Future<RegisterResponse> register(
      String username, String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl${ApiConstants.register}'),
        headers: ApiConstants.defaultHeaders,
        body: jsonEncode({
          'username': username,
          'email': email,
          'password': password,
        }),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        await storageService.saveUserEmail(email);
        return RegisterResponse.success(
          message: data['msg'] ??
              'Registration successful! Please check your email for verification code.',
          email: email,
        );
      } else if (response.statusCode == 409) {
        return RegisterResponse.error(
            message: 'Email or username already exists.');
      } else {
        return RegisterResponse.error(
            message: 'Registration failed. Please try again.');
      }
    } catch (e) {
      return RegisterResponse.error(
          message: 'Network error. Please check your internet connection.');
    }
  }

  Future<VerifyResponse> verifyEmail(String email, String code) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl${ApiConstants.verifyCode}'),
        headers: ApiConstants.defaultHeaders,
        body: jsonEncode({'email': email, 'code': code}),
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = Token.fromJson(data);
        await storageService.saveToken(token.accessToken);
        await storageService.saveRefreshToken(token.refreshToken);
        await storageService.setLoggedIn(true);
        return VerifyResponse.success(token: token);
      } else {
        return VerifyResponse.error(
            message: 'Invalid or expired verification code.');
      }
    } catch (e) {
      return VerifyResponse.error(
          message: 'Network error. Please check your internet connection.');
    }
  }

  Future<ForgotPasswordResponse> forgotPassword(String email) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl${ApiConstants.forgotPassword}'),
        headers: ApiConstants.defaultHeaders,
        body: jsonEncode({'email': email}),
      );
      if (response.statusCode == 200) {
        return ForgotPasswordResponse.success(
            message: 'If the email is registered, a reset code has been sent.');
      } else {
        return ForgotPasswordResponse.error(
            message: 'Failed to process request. Please try again.');
      }
    } catch (e) {
      return ForgotPasswordResponse.error(
          message: 'Network error. Please check your internet connection.');
    }
  }

  Future<User> getCurrentUser(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl${ApiConstants.getUserProfile}'),
        headers: {
          ...ApiConstants.defaultHeaders,
          'Authorization': 'Bearer $token',
        },
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return User.fromJson(data);
      } else {
        throw Exception('Failed to load user profile');
      }
    } catch (e) {
      throw Exception('Failed to load user: $e');
    }
  }

  Future<void> logout() async {
    await storageService.clearAll();
  }

  Future<ResendVerificationResponse> resendVerification(String email) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl${ApiConstants.resendVerification}'),
        headers: ApiConstants.defaultHeaders,
        body: jsonEncode({'email': email}),
      );
      if (response.statusCode == 200) {
        return ResendVerificationResponse.success(
            message: 'Verification code sent successfully.');
      } else {
        return ResendVerificationResponse.error(
            message: 'Failed to resend verification code.');
      }
    } catch (e) {
      return ResendVerificationResponse.error(
          message: 'Network error. Please check your internet connection.');
    }
  }

  Future<void> updateUsername(String newUsername) async {
    final response = await dio.put(
      '/api/v1/users/me',
      data: {'username': newUsername},
    );
    if (response.statusCode != 200)
      throw Exception('Failed to update username');
  }
}

// ========== RESPONSE CLASSES (unchanged) ==========
class LoginResponse {
  final bool success;
  final String? message;
  final User? user;
  final Token? token;
  LoginResponse({required this.success, this.message, this.user, this.token});
  factory LoginResponse.success({required User user, required Token token}) =>
      LoginResponse(success: true, user: user, token: token);
  factory LoginResponse.error({required String message}) =>
      LoginResponse(success: false, message: message);
}

class RegisterResponse {
  final bool success;
  final String? message;
  final String? email;
  RegisterResponse({required this.success, this.message, this.email});
  factory RegisterResponse.success({String? message, String? email}) =>
      RegisterResponse(success: true, message: message, email: email);
  factory RegisterResponse.error({required String message}) =>
      RegisterResponse(success: false, message: message);
}

class VerifyResponse {
  final bool success;
  final String? message;
  final Token? token;
  VerifyResponse({required this.success, this.message, this.token});
  factory VerifyResponse.success({required Token token}) =>
      VerifyResponse(success: true, token: token);
  factory VerifyResponse.error({required String message}) =>
      VerifyResponse(success: false, message: message);
}

class ForgotPasswordResponse {
  final bool success;
  final String? message;
  ForgotPasswordResponse({required this.success, this.message});
  factory ForgotPasswordResponse.success({String? message}) =>
      ForgotPasswordResponse(success: true, message: message);
  factory ForgotPasswordResponse.error({required String message}) =>
      ForgotPasswordResponse(success: false, message: message);
}

class ResendVerificationResponse {
  final bool success;
  final String? message;
  ResendVerificationResponse({required this.success, this.message});
  factory ResendVerificationResponse.success({String? message}) =>
      ResendVerificationResponse(success: true, message: message);
  factory ResendVerificationResponse.error({required String message}) =>
      ResendVerificationResponse(success: false, message: message);
}
