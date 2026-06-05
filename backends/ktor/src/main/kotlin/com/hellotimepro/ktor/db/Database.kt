package com.hellotimepro.ktor.db

import com.hellotimepro.ktor.config.AppConfig
import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import kotlinx.coroutines.Dispatchers
import org.jetbrains.exposed.sql.Database
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.io.File

/** JDBC 连接信息：从 hello 注入的 `DB_URL` 解析为 HikariCP 配置。 */
private data class JdbcSettings(
    val jdbcUrl: String,
    val username: String?,
    val password: String?,
    val driverClassName: String,
)

object Db {
    lateinit var database: Database
        private set

    fun init(config: AppConfig) {
        val settings = resolve(config)
        val hikari = HikariConfig().apply {
            jdbcUrl = settings.jdbcUrl
            driverClassName = settings.driverClassName
            settings.username?.let { username = it }
            settings.password?.let { password = it }
            // SQLite 单写：连接池大小为 1，避免 "database is locked"。
            maximumPoolSize = if (config.isSqlite) 1 else 10
        }
        database = Database.connect(HikariDataSource(hikari))
    }

    private fun resolve(config: AppConfig): JdbcSettings {
        val raw = config.dbUrl?.takeIf { it.isNotBlank() }
        val sqlite = config.isSqlite || raw?.startsWith("sqlite:///") == true
        if (sqlite) {
            val path = raw?.removePrefix("sqlite:///")
                ?: "${absRepoRoot(config)}/data/sqlite/hellotime-ktor.db"
            File(path).parentFile?.mkdirs()
            return JdbcSettings("jdbc:sqlite:$path", null, null, "org.sqlite.JDBC")
        }
        if (raw == null) {
            return JdbcSettings(
                "jdbc:postgresql://127.0.0.1:5432/hellotime_pro",
                "hellotime", "hellotime", "org.postgresql.Driver",
            )
        }
        // postgresql://user:pass@host:port/db  (也接受 postgres:// 前缀)
        val rest = raw.substringAfter("://")
        val hasCreds = rest.contains("@")
        val creds = if (hasCreds) rest.substringBeforeLast("@") else ""
        val hostPart = if (hasCreds) rest.substringAfterLast("@") else rest
        val user = creds.substringBefore(":", "").ifEmpty { null }
        val pass = if (creds.contains(":")) creds.substringAfter(":") else null
        val hostPort = hostPart.substringBefore("/")
        val dbName = hostPart.substringAfter("/")
        return JdbcSettings("jdbc:postgresql://$hostPort/$dbName", user, pass, "org.postgresql.Driver")
    }

    private fun absRepoRoot(config: AppConfig): String =
        File(config.repoRoot).absoluteFile.normalize().path
}

/** 在 IO 调度器上开启一个挂起事务。每个 service 公共方法应只调用一次，保证多步操作原子。 */
suspend fun <T> dbQuery(block: () -> T): T =
    newSuspendedTransaction(Dispatchers.IO, Db.database) { block() }
