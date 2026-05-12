import { useAuthStore, wireAuthApi } from "@/stores/auth";
import { useThemeStore } from "@/stores/theme";

export default defineNuxtPlugin(() => {
  wireAuthApi();

  const theme = useThemeStore();
  const auth = useAuthStore();

  theme.hydrate();
  auth.hydrate();

  if (auth.refreshToken) {
    void auth.refreshMe();
  }
});
