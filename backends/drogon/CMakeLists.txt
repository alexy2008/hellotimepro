# HelloTime Pro · Drogon 后端
#
# drogon 经 FetchContent 拉取并静态链接（沿用 v1 项目验证过的 v1.9.12）；
# 本次开启 ORM（PostgreSQL + SQLite3 双驱动），关闭其余可选组件。
# bcrypt 来自本仓库 nest 后端 node_modules/bcrypt 的 OpenBSD 派生实现（见 third_party/）。
cmake_minimum_required(VERSION 3.25)

project(hellotime-drogon LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# macOS Homebrew 的 libpq 是 keg-only，不在默认搜索路径。
if(EXISTS "/opt/homebrew/opt/libpq")
  list(APPEND CMAKE_PREFIX_PATH "/opt/homebrew/opt/libpq")
endif()

include(FetchContent)

set(BUILD_CTL OFF CACHE BOOL "" FORCE)
set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BUILD_ORM ON CACHE BOOL "" FORCE)
set(BUILD_POSTGRESQL ON CACHE BOOL "" FORCE)
set(BUILD_SQLITE ON CACHE BOOL "" FORCE)
set(BUILD_MYSQL OFF CACHE BOOL "" FORCE)
set(BUILD_REDIS OFF CACHE BOOL "" FORCE)
set(BUILD_BROTLI OFF CACHE BOOL "" FORCE)
set(BUILD_YAML_CONFIG OFF CACHE BOOL "" FORCE)
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)

FetchContent_Declare(
  drogon
  GIT_REPOSITORY https://github.com/drogonframework/drogon.git
  GIT_TAG v1.9.12
)
FetchContent_MakeAvailable(drogon)

find_package(OpenSSL REQUIRED)

# ── OpenBSD bcrypt（自 backends/nest/node_modules/bcrypt 复制，ISC/BSD 许可） ──
add_library(openbsd_bcrypt STATIC
  third_party/openbsd_bcrypt/bcrypt.cc
  third_party/openbsd_bcrypt/blowfish.cc
)
target_include_directories(openbsd_bcrypt PUBLIC third_party/openbsd_bcrypt)
# 第三方代码按原样编译，不挑剔告警。
target_compile_options(openbsd_bcrypt PRIVATE -w)

# ── 业务库 ───────────────────────────────────────────────────────────────────
add_library(hellotime_lib STATIC
  src/config.cc
  src/iso_date.cc
  src/json_util.cc
  src/db.cc
  src/repos.cc
  src/security.cc
  src/validation.cc
  src/mapper.cc
  src/avatar_service.cc
  src/llm_client.cc
  src/suggestion_service.cc
  src/recommendation_service.cc
  src/services.cc
  src/routes.cc
)
target_include_directories(hellotime_lib PUBLIC src)
target_link_libraries(hellotime_lib PUBLIC drogon openbsd_bcrypt OpenSSL::Crypto)

add_executable(hellotime-drogon src/main.cc)
target_link_libraries(hellotime-drogon PRIVATE hellotime_lib)

add_executable(hellotime-drogon-tests tests/unit_tests.cc)
target_link_libraries(hellotime-drogon-tests PRIVATE hellotime_lib)

enable_testing()
add_test(NAME hellotime-drogon-tests COMMAND hellotime-drogon-tests)
