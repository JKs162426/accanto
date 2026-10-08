import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/email";

describe("renderTemplate", () => {
  it("escapes user-provided values", () => {
    expect(renderTemplate("<p>{{name}}</p>", { name: '<script>alert("x")</script>' })).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>",
    );
  });

  it("renders optional sections only when the value is set", () => {
    const tpl = "A{{#notes}} — {{notes}}{{/notes}}";
    expect(renderTemplate(tpl, { notes: "Sin gluten" })).toBe("A — Sin gluten");
    expect(renderTemplate(tpl, { notes: "" })).toBe("A");
  });
});
