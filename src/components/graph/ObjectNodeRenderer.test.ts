import { describe, expect, it } from "vitest";
import { isPrimaryPointerButton } from "./ObjectNodeRenderer";

describe("ObjectNodeRenderer interaction guards", () => {
  it("starts value drags only from the primary pointer button", () => {
    expect(isPrimaryPointerButton(0)).toBe(true);
    expect(isPrimaryPointerButton(1)).toBe(false);
    expect(isPrimaryPointerButton(2)).toBe(false);
  });
});
