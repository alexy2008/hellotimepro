// 根构建：只声明插件版本，模块各自 apply。
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}

// 根工程 build/ 目录让位给仓库惯例的 ./build 脚本（gradle 根产物只有诊断报告；
// app 模块产物仍在 app/build/ 不受影响）。避免 flutter 那样的 build.sh 例外。
layout.buildDirectory = file(".gradle/root-build")
