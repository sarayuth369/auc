/// A persisted record of a past conversion, used for both history and
/// favorites (they share the same shape, just different storage keys).
class SavedConversion {
  final String id;
  final String inputText;
  final String resultText;
  final DateTime timestamp;

  SavedConversion({
    required this.id,
    required this.inputText,
    required this.resultText,
    required this.timestamp,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'inputText': inputText,
    'resultText': resultText,
    'timestamp': timestamp.toIso8601String(),
  };

  factory SavedConversion.fromJson(Map<String, dynamic> json) {
    return SavedConversion(
      id: json['id'] as String,
      inputText: json['inputText'] as String,
      resultText: json['resultText'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
    );
  }
}
