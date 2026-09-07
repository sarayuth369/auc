import 'package:flutter/material.dart';

import '../../models/saved_conversion.dart';
import '../../services/favorites_service.dart';

class FavoritesScreen extends StatefulWidget {
  final FavoritesService favoritesService;

  const FavoritesScreen({super.key, required this.favoritesService});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  late Future<List<SavedConversion>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.favoritesService.getAll();
  }

  void _reload() {
    setState(() => _future = widget.favoritesService.getAll());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Favorites')),
      body: FutureBuilder<List<SavedConversion>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final entries = snapshot.data!;
          if (entries.isEmpty) {
            return const Center(child: Text('No favorites yet.'));
          }
          return ListView.builder(
            itemCount: entries.length,
            itemBuilder: (context, index) {
              final e = entries[index];
              return ListTile(
                title: Text(e.inputText),
                subtitle: Text(e.resultText),
                trailing: IconButton(
                  icon: const Icon(Icons.star),
                  onPressed: () async {
                    await widget.favoritesService.remove(e.id);
                    _reload();
                  },
                ),
                onTap: () => Navigator.of(context).pop(e),
              );
            },
          );
        },
      ),
    );
  }
}
