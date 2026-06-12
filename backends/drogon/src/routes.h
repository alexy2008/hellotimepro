#pragma once

#include <memory>

#include "app_state.h"

// 路由注册：presentation 层只做参数提取 + 调 service + 包 Envelope。
void registerRoutes(std::shared_ptr<AppState> state);
