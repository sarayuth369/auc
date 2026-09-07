import 'package:flutter/material.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('About')),
      body: const Padding(
        padding: EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'AI Universal Converter',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 8),
            Text('Version 1.0.0'),
            SizedBox(height: 16),
            Text(
              'Type a natural-language conversion request (e.g. "10 km to miles") '
              'and get an instant, offline result. Understanding your request and '
              'computing the answer are kept separate: intent parsing never '
              'produces the final number - only the deterministic conversion '
              'engine does.',
            ),
          ],
        ),
      ),
    );
  }
}
