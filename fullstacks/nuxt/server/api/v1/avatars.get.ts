import { defineEventHandler } from "h3";
import { withApi } from "~/server/lib/envelope";
import { listAvatars } from "~/server/services/avatars";
import type { Avatar } from "~/types";

export default defineEventHandler((event) => withApi<Avatar[]>(event, () => listAvatars()));
