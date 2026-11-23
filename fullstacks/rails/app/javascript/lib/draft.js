// Turbo 导航保留浏览器进程里的草稿。每次服务器渲染外壳时同步账号边界。
let owner;
let draft;

export function syncDraftOwner(user) {
  if (user !== owner) {
    owner = user;
    draft = null;
  }
}

export function readDraft(user) { return owner === user ? draft : null; }

export function writeDraft(user, snapshot) {
  if (owner === user) draft = snapshot;
}

export function discardDraft(user, snapshot) {
  if (owner === user && draft === snapshot) draft = null;
}
