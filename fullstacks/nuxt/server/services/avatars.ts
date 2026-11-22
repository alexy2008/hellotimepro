import catalog from "@spec/avatars/v2/catalog.json";

const avatars = catalog.avatars.map(({ id, name, primaryColor, svgUrl }) => ({ id, name, primaryColor, svgUrl }));
const allowed = new Set(avatars.map(({ id }) => id));

export function listAvatars() {
  return avatars;
}

export function allowedAvatarIds() {
  return allowed;
}
