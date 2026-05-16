# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# S1 — Capacitor + plugin reflection keep-rules.
#
# R8 cannot see the JS-side bridge edges, so Capacitor and any
# @CapacitorPlugin annotated class must be kept intact. The
# bridge uses reflection to dispatch JS calls to @PluginMethod
# annotated methods; stripping them would silently break every
# native plugin call from the WebView.

# Capacitor core bridge.
-keep class com.getcapacitor.** { *; }
-keep class com.capacitorjs.** { *; }

# Any plugin annotated @CapacitorPlugin.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.PluginMethod *;
    @com.getcapacitor.annotation.Permission *;
}

# @capacitor-community/sqlite — used for E9 / STO1b run-history.
-keep class com.getcapacitor.community.database.sqlite.** { *; }

# Cordova bridge fallbacks Capacitor still loads.
-keep class org.apache.cordova.** { *; }

# Suppress R8 warnings for JSR-305 annotations the AndroidX libs
# pull in transitively (not actually used at runtime).
-dontwarn javax.annotation.**
