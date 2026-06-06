# 记录进程启动时刻，供 /api/v1/health 计算 uptimeSeconds。
Rails.application.config.x.boot_time = Time.now
