import { describe, expect, it } from "vitest";
import { ApiError } from "@/types";
import { NICK_RE, emailOk, fieldErrors, nickState, pwdValid } from "./account";
import { addCalendarYears } from "./fmt";
import { pageNumbers } from "@/primitives/plazaHome";

describe("昵称按 Unicode 码点校验（字母、数字、下划线、连字符，2–20 位）", () => {
  it("合法昵称为 valid，含空格等字符为 invalid", () => {
    expect(nickState("𠮷的草稿").state).toBe("valid");
    expect(nickState("ab_c-1").state).toBe("valid");
    expect(nickState("有 空格").state).toBe("invalid");
    expect(nickState("a!b").state).toBe("invalid");
  });
  it("长度按码点计数：两个增补平面字符就够 2 位，21 位超长", () => {
    expect(NICK_RE.test("𠮷𠮷")).toBe(true);
    expect(nickState("𠮷").state).toBe("");
    expect(NICK_RE.test("a".repeat(20))).toBe(true);
    expect(NICK_RE.test("a".repeat(21))).toBe(false);
  });
  it("只有服务端明确返回冲突（409）才显示 taken", () => {
    const conflict = new ApiError("昵称已被占用", 409, "CONFLICT", [{ field: "nickname", message: "昵称已被占用" }]);
    expect(nickState("taken1", fieldErrors(conflict)).state).toBe("taken");
    const invalid = new ApiError("参数不合法", 422, "VALIDATION_ERROR", [{ field: "nickname", message: "格式不对" }]);
    expect(nickState("x", fieldErrors(invalid)).state).toBe("invalid");
  });
  it("提交期间昵称又改过：丢掉昵称那条错误", () => {
    const conflict = new ApiError("昵称已被占用", 409, "CONFLICT", [{ field: "nickname", message: "昵称已被占用" }]);
    expect(fieldErrors(conflict, true).nickname).toBeUndefined();
  });
});

describe("邮箱与密码规则", () => {
  it("邮箱格式", () => {
    expect(emailOk("a@b.co")).toBe(true);
    expect(emailOk("a@b")).toBe(false);
  });
  it("密码至少 8 位且同时含字母和数字", () => {
    expect(pwdValid("abc12345")).toBe(true);
    expect(pwdValid("abcdefgh")).toBe(false);
    expect(pwdValid("a1")).toBe(false);
  });
});

describe("addCalendarYears：开启时间上限是 10 个日历年", () => {
  it("同月同日同一时刻", () => {
    const t = Date.UTC(2026, 10, 21, 8, 30);
    expect(new Date(addCalendarYears(t, 10)).toISOString()).toBe("2036-11-21T08:30:00.000Z");
  });
  it("2 月 29 日落到平年取 2 月 28 日", () => {
    const t = Date.UTC(2028, 1, 29, 12);
    expect(new Date(addCalendarYears(t, 1)).toISOString()).toBe("2029-02-28T12:00:00.000Z");
  });
});

describe("pageNumbers", () => {
  it("首尾两页 + 当前页前后各一页，中间用省略号", () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(5, 10)).toEqual([1, "…", 4, 5, 6, "…", 10]);
  });
});
