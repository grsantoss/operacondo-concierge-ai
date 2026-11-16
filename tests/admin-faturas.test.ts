import { expect, test } from "bun:test";
import { statusFatura } from "../src/lib/admin.functions";

const hoje = "2026-11-16";

test("open com vencimento passado é vencida", () => {
  expect(statusFatura("open", 0, "2026-11-10", hoje)).toBe("past_due");
  expect(statusFatura("open", 0, "2026-11-20", hoje)).toBe("open");
  expect(statusFatura("open", 0, "", hoje)).toBe("open");
});

test("estorno prevalece; demais status do Stripe", () => {
  expect(statusFatura("paid", 699, "2026-05-10", hoje)).toBe("refunded");
  expect(statusFatura("paid", 0, "2026-05-10", hoje)).toBe("paid");
  expect(statusFatura("draft", 0, "", hoje)).toBe("open");
  expect(statusFatura("uncollectible", 0, "2026-01-10", hoje)).toBe("void");
});
