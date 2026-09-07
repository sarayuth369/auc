import 'package:flutter/material.dart';

import '../../models/saved_conversion.dart';
import '../../services/history_service.dart';

class HistoryScreen extends StatefulWidget {
  final HistoryService historyService;

  const HistoryScreen({super.key, required this.historyService});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  late Future<List<SavedConversion>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.historyService.getAll();
  }

  void _reload() {
    setState(() => _future = widget.historyService.getAll());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('History'),
        actions: [
          IconButton(
            tooltip: 'Clear all',
            icon: const Icon(Icons.delete_sweep),
            onPressed: () async {
              await widget.historyService.clear();
              _reload();
            },
          ),
        ],
      ),
      body: FutureBuilder<List<SavedConversion>>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final entries = snapshot.data!;
          if (entries.isEmpty) {
            return const Center(child: Text('No history yet.'));
          }
          return ListView.builder(
            itemCount: entries.length,
            itemBuilder: (context, index) {
              final e = entries[index];
              return ListTile(
                title: Text(e.inputText),
                subtitle: Text(e.resultText),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () async {
                    await widget.historyService.remove(e.id);
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
