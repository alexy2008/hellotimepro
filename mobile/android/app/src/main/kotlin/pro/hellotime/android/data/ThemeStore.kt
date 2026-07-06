// 主题 store：暗/浅切换 + DataStore 持久化（默认暗色，= 各端）。
package pro.hellotime.android.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

private val KEY_THEME = stringPreferencesKey("theme.mode")

class ThemeStore(
    private val prefs: DataStore<Preferences>,
    private val scope: CoroutineScope,
) {
    val dark = MutableStateFlow(true)

    suspend fun hydrate() {
        prefs.data.first()[KEY_THEME]?.let { dark.value = it == "dark" }
    }

    fun toggle() {
        dark.value = !dark.value
        scope.launch { prefs.edit { it[KEY_THEME] = if (dark.value) "dark" else "light" } }
    }
}
