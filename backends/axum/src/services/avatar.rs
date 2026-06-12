use std::collections::HashSet;

use serde_json::{json, Value};

use crate::config::AppConfig;

/// 从 spec/avatars/catalog.json 加载内置头像目录（启动时一次）。
pub struct AvatarService {
    list: Value,
    ids: HashSet<String>,
}

impl AvatarService {
    pub fn load(config: &AppConfig) -> Result<AvatarService, String> {
        let path = format!("{}/spec/avatars/catalog.json", config.abs_repo_root());
        let raw = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取头像目录失败 {path}: {e}"))?;
        let catalog: Value =
            serde_json::from_str(&raw).map_err(|e| format!("解析头像目录失败: {e}"))?;
        let avatars = catalog
            .get("avatars")
            .and_then(|v| v.as_array())
            .ok_or("头像目录缺少 avatars 数组")?;

        let mut ids = HashSet::new();
        let mut items = Vec::new();
        for a in avatars {
            let id = a.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            ids.insert(id.clone());
            // svgUrl 可缺省 → 显式输出 null。
            items.push(json!({
                "id": id,
                "name": a.get("name").cloned().unwrap_or(Value::Null),
                "primaryColor": a.get("primaryColor").cloned().unwrap_or(Value::Null),
                "svgUrl": a.get("svgUrl").cloned().unwrap_or(Value::Null),
            }));
        }
        Ok(AvatarService { list: Value::Array(items), ids })
    }

    pub fn list(&self) -> Value {
        self.list.clone()
    }

    pub fn exists(&self, id: &str) -> bool {
        self.ids.contains(id)
    }
}
