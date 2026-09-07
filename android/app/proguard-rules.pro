# AndroidX WorkManager/Room: Flutter's release build runs R8 shrinking by
# default. Without these rules R8 strips the Room-generated database
# implementation (e.g. WorkDatabase_Impl), which is only looked up via
# reflection at runtime - this crashes the app on launch with
# "Failed to create an instance of androidx.work.impl.WorkDatabase" before
# Flutter's own code ever runs. WorkManager is pulled in transitively (e.g.
# by google_mobile_ads), not used directly by this app, but must still be
# left intact.
-keep class androidx.work.** { *; }
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Database class *
-dontwarn androidx.work.**

# AndroidX Startup initializers (androidx.startup.InitializationProvider and
# its registered Initializer classes) are discovered via manifest metadata +
# reflection at app startup - keep them so shrinking can't break that lookup.
-keep class * extends androidx.startup.Initializer
