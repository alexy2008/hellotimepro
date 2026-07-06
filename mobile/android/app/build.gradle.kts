plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "pro.hellotime.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "pro.hellotime.android"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        // 后端地址注入：模拟器里 127.0.0.1 是模拟器自身，宿主要走 10.0.2.2（emulator 固定别名）。
        // 真机调试需 BACKEND_PROXY=http://<局域网IP>:9080 ./build 重打包。
        buildConfigField(
            "String", "API_BASE",
            "\"${System.getenv("BACKEND_PROXY") ?: "http://10.0.2.2:9080"}\"",
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material.icons.extended)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.navigation.compose)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.coil.svg)
    implementation(libs.datastore.preferences)
}
