import { Controller } from "@hotwired/stimulus";
import { toast } from "lib/ui";

export default class extends Controller {
  static values = { code: String };

  copyCode() { this.write(this.codeValue, "胶囊码"); }

  copyLink() { this.write(new URL(`/capsules/${this.codeValue}`, location.origin).href, "链接"); }

  async write(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`已复制${label}`);
    } catch {
      toast(`暂时无法复制${label}`, "error");
    }
  }
}
