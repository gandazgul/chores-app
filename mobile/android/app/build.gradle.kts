import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

if (file("src/production/google-services.json").exists() || file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
    // The offline demo has no Firebase app and must remain buildable without one.
    tasks.matching { it.name.startsWith("processDemo") && it.name.endsWith("GoogleServices") }
        .configureEach { enabled = false }
}

val signingProperties = Properties()
val signingFile = rootProject.file("key.properties")
if (signingFile.exists()) signingFile.inputStream().use { signingProperties.load(it) }

android {
    namespace = "uk.dumbhome.tow"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "uk.dumbhome.tow"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 24
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (signingFile.exists()) {
            create("release") {
                keyAlias = signingProperties.getProperty("keyAlias")
                keyPassword = signingProperties.getProperty("keyPassword")
                storeFile = file(signingProperties.getProperty("storeFile"))
                storePassword = signingProperties.getProperty("storePassword")
            }
        }
    }

    flavorDimensions += "environment"
    productFlavors {
        create("production") {
            dimension = "environment"
            manifestPlaceholders["appLabel"] = "Tow"
            signingConfig = if (signingFile.exists()) signingConfigs.getByName("release") else null
        }
        create("demo") {
            dimension = "environment"
            applicationIdSuffix = ".demo"
            versionNameSuffix = "-demo"
            manifestPlaceholders["appLabel"] = "Tow Demo"
            // Distributable preview only; production still requires its own key.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

dependencies { coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5") }

flutter {
    source = "../.."
}
