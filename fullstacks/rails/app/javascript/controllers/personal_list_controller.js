import { Controller } from "@hotwired/stimulus";
import { api, confirmDialog, fragment, toast } from "lib/ui";

export default class extends Controller {
  static values = { url: String, pageSize: Number };

  disconnect() { this.load?.abort(); }

  get count() { return this.element.querySelectorAll("[data-personal-list-row]").length; }

  more() { this.refresh(this.count + this.pageSizeValue); }

  async remove({ currentTarget }) {
    if (this.deleting) return;
    const { id, title, code } = currentTarget.dataset;
    const confirmed = await confirmDialog({
      title: "删除这枚胶囊？",
      body: `《${title}》会被永久删除。持有胶囊码 ${code} 的人将无法再打开它，它也会从所有收藏过它的人的列表里消失。`,
      ok: "删除", cancel: "再想想", danger: true
    });
    if (!confirmed || !this.element.isConnected || this.deleting) return;

    this.deleting = true;
    try {
      await api(`/me/capsules/${id}`, { method: "DELETE" });
      if (!this.element.isConnected) return;
      const visible = this.count;
      this.element.querySelector(`[data-personal-list-row][data-code="${code}"]`)?.remove();
      await this.refresh(Math.max(visible - 1, 1));
      if (this.element.isConnected) toast(`已删除《${title}》`);
    } catch {
      if (this.element.isConnected) toast("删除失败，请稍后再试", "error");
    } finally {
      this.deleting = false;
    }
  }

  favoriteChanged(event) {
    if (!event.detail.removed) return;
    const visible = this.count;
    event.target.closest("[data-personal-list-row]")?.remove();
    this.refresh(Math.max(visible - 1, 1));
  }

  async refresh(visible) {
    this.load?.abort();
    const load = new AbortController();
    this.load = load;
    this.element.setAttribute("aria-busy", "true");
    try {
      const html = await fragment(`${this.urlValue}?visible=${visible}`, load.signal);
      this.element.replaceChildren(html);
    } catch {
      if (!load.signal.aborted) toast("列表刷新失败，请稍后再试", "error");
    } finally {
      if (!load.signal.aborted) this.element.removeAttribute("aria-busy");
    }
  }
}
