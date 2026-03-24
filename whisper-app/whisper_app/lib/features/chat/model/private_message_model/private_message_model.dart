// lib/features/chat/model/private_message_model/private_message_model.dart
class PrivateMessageModel {
  final int id;
  final int senderId;
  final int receiverId;
  final String? content;
  final String? fileUrl;
  final String? messageType;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final bool isRead;
  final String? tempId;
  final String? senderUsername;
  final String? receiverUsername;
  final double? voiceDuration;
  final int? fileSize;

  PrivateMessageModel({
    required this.id,
    required this.senderId,
    required this.receiverId,
    this.content,
    this.fileUrl,
    this.messageType,
    required this.createdAt,
    this.updatedAt,
    required this.isRead,
    this.tempId,
    this.senderUsername,
    this.receiverUsername,
    this.voiceDuration,
    this.fileSize,
  });

  factory PrivateMessageModel.fromJson(Map<String, dynamic> json) {
    return PrivateMessageModel(
      id: json['id'],
      senderId: json['sender_id'],
      receiverId: json['receiver_id'],
      content: json['content'],
      fileUrl: json['content'],
      messageType: json['message_type'],
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: json['edited_at'] != null
          ? DateTime.parse(json['edited_at'])
          : null,
      isRead: json['is_read'] ?? false,
      tempId: json['temp_id'],
      senderUsername: json['sender_username'],
      receiverUsername: json['receiver_username'],
      voiceDuration: json['voice_duration']?.toDouble(),
      fileSize: json['file_size'],
    );
  }

  bool get isImage => messageType == 'image';
  bool get isVideo => messageType == 'video';
  bool get isAudio => messageType == 'voice';
  bool get isText => messageType == 'text';
  bool get hasFile => isImage || isVideo || isAudio;
}