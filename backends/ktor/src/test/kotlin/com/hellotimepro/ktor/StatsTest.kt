package com.hellotimepro.ktor

import com.hellotimepro.ktor.config.AppConfig
import com.hellotimepro.ktor.db.Db
import com.hellotimepro.ktor.dto.CreateCapsuleRequest
import com.hellotimepro.ktor.dto.MyStats
import com.hellotimepro.ktor.dto.PlazaCounts
import com.hellotimepro.ktor.dto.PlazaStats
import com.hellotimepro.ktor.dto.RegisterRequest
import com.hellotimepro.ktor.service.Validation
import com.hellotimepro.ktor.service.isoInstant
import com.hellotimepro.ktor.service.nowUtc
import com.hellotimepro.ktor.web.ApiException
import com.hellotimepro.ktor.web.ErrorCode
import kotlinx.coroutines.runBlocking
import org.jetbrains.exposed.sql.transactions.TransactionManager
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import java.time.OffsetDateTime
import kotlin.io.path.readText
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class StatsTest {
    @TempDir
    lateinit var tempDir: Path

    @Test
    fun `plaza list and stats share literal search`() = withDatabase { app ->
        assertEquals(PlazaStats(PlazaCounts(0, 0, 0), null, null), app.plazaService.plazaStats(null))
        val alice = register(app, "Writer_One")
        val bob = register(app, "WriterXOne")
        val next = nowUtc().withNano(0).plusHours(1)
        val farthest = next.plusHours(1)
        app.capsuleService.create(alice, CreateCapsuleRequest("Report%_\\", "test", isoInstant(next), true))
        app.capsuleService.create(bob, CreateCapsuleRequest("ReportXYZ", "test", isoInstant(farthest), true))
        app.capsuleService.create(alice, CreateCapsuleRequest("Report%_\\", "test", isoInstant(farthest.plusHours(1)), false))

        for (search in listOf("  REPORT%_\\  ", "\\", "%", "_", "WRITER_ONE")) {
            val stats = app.plazaService.plazaStats(search)
            assertEquals(PlazaStats(PlazaCounts(1, 0, 1), isoInstant(farthest), isoInstant(next)), stats)
            for ((filter, expected) in mapOf("all" to 1L, "opened" to 0L, "unopened" to 1L)) {
                val page = app.plazaService.plazaList("new", filter, search, 1, 20, null)
                assertEquals(expected, page.pagination.total)
                assertEquals(expected.toInt(), page.items.size)
            }
        }
        assertEquals(
            ErrorCode.VALIDATION_ERROR,
            assertFailsWith<ApiException> { app.plazaService.plazaStats("字".repeat(51)) }.code,
        )
    }

    @Test
    fun `favorite private capsule and delete without relying on cascade`() = withDatabase { app ->
        val alice = register(app, "Alice")
        val bob = register(app, "Bob")
        val created = app.capsuleService.create(
            alice, CreateCapsuleRequest("Private", "test", isoInstant(nowUtc().plusHours(1)), false),
        )
        assertEquals(
            ErrorCode.VALIDATION_ERROR,
            assertFailsWith<ApiException> { app.favoriteService.addFavorite(alice, "not-a-uuid") }.code,
        )
        val first = app.favoriteService.addFavorite(alice, created.id)
        assertEquals(1, first.favoriteCount)
        assertEquals(first, app.favoriteService.addFavorite(alice, created.id))
        app.favoriteService.addFavorite(bob, created.id)

        val owned = app.plazaService.myCapsules(alice, 1, 20).items.single()
        assertTrue(owned.favoritedByMe)
        assertNull(owned.favoritedAt)
        assertEquals(MyStats(1, 0, 1, 0, 2, 1), app.plazaService.myStats(alice))
        val favorited = app.plazaService.myFavorites(bob, 1, 20).items.single()
        assertFalse(favorited.inPlaza)
        assertNotNull(favorited.favoritedAt)

        app.capsuleService.deleteOwn(alice, created.id)
        for (user in listOf(alice, bob)) {
            assertEquals(MyStats(0, 0, 0, 0, 0, 0), app.plazaService.myStats(user))
        }
        assertTrue(app.plazaService.myFavorites(bob, 1, 20).items.isEmpty())
    }

    @Test
    fun `openAt uses UTC calendar years and clamps leap day`() {
        val now = OffsetDateTime.parse("2028-03-01T01:30:45.123+08:00")
        val limit = OffsetDateTime.parse("2038-02-28T17:30:45.123Z")
        assertFailsWith<ApiException> { Validation.openAt(now.plusSeconds(60).toString(), now) }
        val justAfterMinimum = now.plusSeconds(60).plusNanos(1)
        assertEquals(justAfterMinimum.toInstant(), Validation.openAt(justAfterMinimum.toString(), now).toInstant())
        assertEquals(limit, Validation.openAt(limit.toString(), now))
        assertFailsWith<ApiException> { Validation.openAt(limit.plusNanos(1).toString(), now) }
    }

    private suspend fun register(app: AppComponents, nickname: String) =
        app.authContext.required("Bearer " + app.authService.register(
            RegisterRequest("${nickname.lowercase()}@example.test", "password123", nickname, "neo"),
        ).accessToken)

    private fun withDatabase(block: suspend (AppComponents) -> Unit) {
        val config = AppConfig(dbDriver = "sqlite", dbUrl = "sqlite:///${tempDir.resolve("test.db")}")
        val schema = Path.of(config.repoRoot, "spec/db/schema.sqlite.sql").readText()
        Db.init(config).use { source ->
            try {
                source.connection.use { connection ->
                    connection.createStatement().use { statement ->
                        schema.split(';').map(String::trim).filter(String::isNotEmpty)
                            .forEach { statement.execute(it) }
                        statement.execute("PRAGMA foreign_keys = OFF")
                    }
                }
                runBlocking { block(AppComponents(config)) }
            } finally {
                TransactionManager.closeAndUnregister(Db.database)
            }
        }
    }
}
