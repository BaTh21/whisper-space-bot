import 'package:flutter/material.dart';
import 'package:whisper_space_flutter/core/services/storage_service.dart';
import 'package:whisper_space_flutter/utils/snack_bar.dart';

import '../datasources/friend_api_source.dart';

enum FriendshipStatus {
  none,
  pending,
  accepted,
  blocked,
}

class AddFriendScreen extends StatefulWidget {
  const AddFriendScreen({super.key});

  @override
  State<AddFriendScreen> createState() => _AddFriendScreenState();
}

class _AddFriendScreenState extends State<AddFriendScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocusNode = FocusNode();
  final ScrollController _scrollController = ScrollController();
  
  late FriendAPISource friendApi;
  
  List<Map<String, dynamic>> suggestions = [];
  List<Map<String, dynamic>> searchResults = [];
  bool isLoading = true;
  bool isSearching = false;
  bool hasSearched = false;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    _initializeApi();
    
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _searchFocusNode.requestFocus();
    });
  }

  Future<void> _initializeApi() async {
    final storageService = StorageService();
    await storageService.init();

    friendApi = FriendAPISource(storageService: storageService);
    await _loadSuggestions();
  }

  Future<void> _loadSuggestions() async {
    if (!mounted) return;
    
    setState(() {
      isLoading = true;
      errorMessage = null;
      isSearching = false;
      hasSearched = false;
    });

    try {
      final results = await friendApi.getFriendSuggestions(limit: 20);
      if (mounted) {
        setState(() {
          suggestions = List<Map<String, dynamic>>.from(results);
          isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading suggestions: $e');
      if (mounted) {
        setState(() {
          isLoading = false;
          errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  Future<void> _performSearch() async {
    final query = _searchController.text.trim();
    if (query.isEmpty) {
      setState(() {
        hasSearched = false;
        searchResults.clear();
        isSearching = false;
      });
      return;
    }

    setState(() {
      isSearching = true;
      hasSearched = true;
      errorMessage = null;
    });

    try {
      final results = await friendApi.searchUsers(query);
      if (mounted) {
        setState(() {
          searchResults = List<Map<String, dynamic>>.from(results);
          isSearching = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          isSearching = false;
          errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  Future<void> _handleAddFriend(int userId, String username) async {
    try {
      final response = await friendApi.addFriend(userId);
      
      if (mounted) {
        showTopSnackBar(
          context, 
          response['msg'] ?? 'Friend request sent to $username',
          backgroundColor: Colors.green,
        );
        
        // Remove from suggestions or search results
        setState(() {
          suggestions.removeWhere((user) => user['id'] == userId);
          searchResults.removeWhere((user) => user['id'] == userId);
        });
      }
    } catch (e) {
      if (mounted) {
        showTopSnackBar(
          context, 
          e.toString().replaceAll('Exception: ', ''),
          backgroundColor: Colors.red,
        );
      }
    }
  }

  String _getFriendshipStatusText(String? status) {
    if (status == null) return 'Add';
    
    switch (status.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Friends';
      case 'blocked':
        return 'Blocked';
      default:
        return 'Add';
    }
  }

  Color _getStatusButtonColor(String? status) {
    if (status == null) return Colors.blue;
    
    switch (status.toLowerCase()) {
      case 'pending':
        return Colors.orange;
      case 'accepted':
        return Colors.green;
      case 'blocked':
        return Colors.grey;
      default:
        return Colors.blue;
    }
  }

  Widget _buildMutualFriendsChip(int count) {
    if (count == 0) return const SizedBox.shrink();
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.grey.shade200,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.people, size: 12, color: Colors.grey),
          const SizedBox(width: 4),
          Text(
            '$count mutual ${count == 1 ? 'friend' : 'friends'}',
            style: const TextStyle(fontSize: 10, color: Colors.grey),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Friends'),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(80),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              focusNode: _searchFocusNode,
              decoration: InputDecoration(
                hintText: 'Search by username or email...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          setState(() {
                            hasSearched = false;
                            searchResults.clear();
                          });
                          _searchFocusNode.requestFocus();
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                filled: true,
                fillColor: Colors.grey.shade100,
              ),
              onSubmitted: (_) => _performSearch(),
              textInputAction: TextInputAction.search,
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadSuggestions,
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: isSearching ? null : _performSearch,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: isSearching
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Search'),
              ),
            ),
          ),
          
          Expanded(
            child: hasSearched ? _buildSearchResults() : _buildSuggestions(),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchResults() {
    if (isSearching) {
      return const Center(child: CircularProgressIndicator());
    }

    if (errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.red.shade300),
            const SizedBox(height: 16),
            Text(
              errorMessage!,
              style: const TextStyle(color: Colors.red),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _performSearch,
              child: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    if (searchResults.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.person_search, size: 80, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              'No users found for "${_searchController.text}"',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Try a different search term',
              style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.all(16),
      itemCount: searchResults.length,
      itemBuilder: (context, index) {
        final user = searchResults[index];
        final status = user['friendship_status'];
        final isOnline = user['is_online'] ?? false;
        final mutualCount = user['mutual_friends_count'] ?? 0;
        
        // Skip if already friends
        if (status == 'accepted') return const SizedBox.shrink();
        
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: ListTile(
            contentPadding: const EdgeInsets.all(12),
            leading: Stack(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.blueGrey,
                  backgroundImage: user['avatar_url'] != null && 
                      user['avatar_url'].toString().isNotEmpty
                      ? NetworkImage(user['avatar_url'])
                      : null,
                  child: user['avatar_url'] == null || 
                      user['avatar_url'].toString().isEmpty
                      ? Text(
                          user['username'][0].toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                        )
                      : null,
                ),
                if (isOnline)
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            title: Row(
              children: [
                Expanded(
                  child: Text(
                    user['username'],
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ),
                _buildMutualFriendsChip(mutualCount),
              ],
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user['email'],
                  style: const TextStyle(fontSize: 13),
                ),
                if (mutualCount > 0)
                  const SizedBox(height: 4),
              ],
            ),
            trailing: status == 'pending'
                ? Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.orange.shade100,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'Pending',
                      style: TextStyle(
                        color: Colors.orange.shade800,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                  )
                : status == 'blocked'
                    ? Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'Blocked',
                          style: TextStyle(
                            color: Colors.grey.shade700,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      )
                    : SizedBox(
                        width: 70,
                        child: ElevatedButton(
                          onPressed: status == 'pending' || status == 'blocked'
                              ? null
                              : () => _handleAddFriend(
                                  user['id'], 
                                  user['username'],
                                ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _getStatusButtonColor(status),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                            ),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 8,
                            ),
                          ),
                          child: Text(
                            _getFriendshipStatusText(status),
                            style: const TextStyle(fontSize: 12),
                          ),
                        ),
                      ),
          ),
        );
      },
    );
  }

  Widget _buildSuggestions() {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (errorMessage != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.error_outline,
              size: 64,
              color: Colors.red.shade300,
            ),
            const SizedBox(height: 16),
            Text(
              errorMessage!,
              style: const TextStyle(color: Colors.red),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _loadSuggestions,
              child: const Text('Try Again'),
            ),
          ],
        ),
      );
    }

    if (suggestions.isEmpty) {
      return RefreshIndicator(
        onRefresh: _loadSuggestions,
        child: ListView(
          children: [
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.3,
            ),
            Center(
              child: Column(
                children: [
                  Icon(
                    Icons.people_outline,
                    size: 80,
                    color: Colors.grey.shade400,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'No suggestions available',
                    style: TextStyle(
                      color: Colors.grey.shade600,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Try searching for friends by name or email',
                    style: TextStyle(
                      color: Colors.grey.shade500,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadSuggestions,
      child: ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.all(16),
        itemCount: suggestions.length,
        itemBuilder: (context, index) {
          final user = suggestions[index];
          final status = user['friendship_status'];
          final isOnline = user['is_online'] ?? false;
          final mutualCount = user['mutual_friends_count'] ?? 0;
          final mutualFriends = user['mutual_friends'] ?? [];
          
          // Skip if already friends
          if (status == 'accepted') return const SizedBox.shrink();
          
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.all(12),
              leading: Stack(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: Colors.blueGrey,
                    backgroundImage: user['avatar_url'] != null && 
                        user['avatar_url'].toString().isNotEmpty
                        ? NetworkImage(user['avatar_url'])
                        : null,
                    child: user['avatar_url'] == null || 
                        user['avatar_url'].toString().isEmpty
                        ? Text(
                            user['username'][0].toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                            ),
                          )
                        : null,
                  ),
                  if (isOnline)
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        width: 12,
                        height: 12,
                        decoration: BoxDecoration(
                          color: Colors.green,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white,
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              title: Row(
                children: [
                  Expanded(
                    child: Text(
                      user['username'],
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  _buildMutualFriendsChip(mutualCount),
                ],
              ),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user['email'] ?? '',
                    style: const TextStyle(fontSize: 13),
                  ),
                  if (mutualCount > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: _buildMutualFriendsList(
                        mutualFriends, 
                        mutualCount,
                      ),
                    ),
                ],
              ),
              trailing: status == 'pending'
                  ? Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade100,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        'Pending',
                        style: TextStyle(
                          color: Colors.orange.shade800,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    )
                  : status == 'blocked'
                      ? Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            'Blocked',
                            style: TextStyle(
                              color: Colors.grey.shade700,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        )
                      : SizedBox(
                          width: 70,
                          child: ElevatedButton(
                            onPressed: status == 'pending' || 
                                    status == 'blocked'
                                ? null
                                : () => _handleAddFriend(
                                    user['id'], 
                                    user['username'],
                                  ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: 
                                  _getStatusButtonColor(status),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: 
                                    BorderRadius.circular(20),
                              ),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 8,
                              ),
                            ),
                            child: Text(
                              _getFriendshipStatusText(status),
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildMutualFriendsList(List<dynamic> mutualFriends, int totalCount) {
    if (mutualFriends.isEmpty) {
      return Text(
        '$totalCount mutual ${totalCount == 1 ? 'friend' : 'friends'}',
        style: TextStyle(
          fontSize: 12,
          color: Colors.grey.shade600,
        ),
      );
    }

    final names = mutualFriends.map((f) => f['username']).take(2).join(', ');
    
    String text;
    if (mutualFriends.length == 1) {
      text = 'Mutual friend: ${mutualFriends[0]['username']}';
    } else if (mutualFriends.length == 2) {
      text = 'Mutual friends: $names';
    } else {
      final remaining = totalCount - mutualFriends.length;
      text = 'Mutual friends: $names and ${remaining + (mutualFriends.length - 2)} others';
    }
    
    return Row(
      children: [
        const Icon(Icons.people, size: 14, color: Colors.grey),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 12,
              color: Colors.grey.shade600,
              fontStyle: FontStyle.italic,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    _searchFocusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }
}