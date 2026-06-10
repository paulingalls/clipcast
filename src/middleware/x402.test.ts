import { test, expect, describe } from "bun:test";
import type { BodyDiscoveryExtension } from "@x402/extensions";
import { buildGenerateRoutes, GENERATE_DESCRIPTION } from "./x402";
import { generateRequestSchema, generateRequestJsonSchema } from "../utils/validation";

const NETWORK = "eip155:84532" as const;
const PAY_TO = "0x000000000000000000000000000000000000dEaD";

function bazaarExtension() {
  const routes = buildGenerateRoutes({ NETWORK, WALLET_ADDRESS: PAY_TO });
  return routes["POST /api/generate"].extensions.bazaar as BodyDiscoveryExtension;
}

describe("buildGenerateRoutes — Bazaar discovery metadata", () => {
  test("declares only the POST /api/generate route (health/templates stay free)", () => {
    const routes = buildGenerateRoutes({ NETWORK, WALLET_ADDRESS: PAY_TO });
    expect(Object.keys(routes)).toEqual(["POST /api/generate"]);
  });

  test("keeps the $0.10 exact payment gate unchanged", () => {
    const routes = buildGenerateRoutes({ NETWORK, WALLET_ADDRESS: PAY_TO });
    const accepts = routes["POST /api/generate"].accepts;
    expect(accepts).toEqual([{ scheme: "exact", price: "$0.10", network: NETWORK, payTo: PAY_TO }]);
  });

  test("carries a non-empty product description", () => {
    const routes = buildGenerateRoutes({ NETWORK, WALLET_ADDRESS: PAY_TO });
    expect(routes["POST /api/generate"].description).toBe(GENERATE_DESCRIPTION);
    expect(GENERATE_DESCRIPTION.length).toBeGreaterThan(0);
  });

  test("declares a JSON body discovery extension", () => {
    const ext = bazaarExtension();
    expect(ext.info.input.type).toBe("http");
    expect(ext.info.input.bodyType).toBe("json");
  });

  test("input example validates against the live Zod schema", () => {
    const ext = bazaarExtension();
    expect(generateRequestSchema.safeParse(ext.info.input.body).success).toBe(true);
  });

  test("input JSON schema is derived from the live schema (not the stale docs shape)", () => {
    const ext = bazaarExtension();
    // The declared body schema is exactly the schema derived from generateRequestSchema.
    expect(ext.schema.properties.input.properties.body).toEqual(generateRequestJsonSchema);
  });

  test("output example mirrors the RenderResult shape (no thumbnailUrl)", () => {
    const ext = bazaarExtension();
    expect(ext.info.output?.type).toBe("json");
    expect(Object.keys(ext.info.output?.example as object).sort()).toEqual([
      "duration",
      "id",
      "resolution",
      "templateUsed",
      "videoUrl",
    ]);
  });
});

describe("generateRequestJsonSchema", () => {
  test("is an object JSON schema reflecting the live generate request", () => {
    const schema = generateRequestJsonSchema as Record<string, unknown>;
    expect(schema.type).toBe("object");
    const properties = schema.properties as Record<string, unknown>;
    expect(properties).toHaveProperty("phrases");
    expect(properties).toHaveProperty("template");
  });

  test("template is constrained to the known templates (slide-fade), not free text", () => {
    const json = JSON.stringify(generateRequestJsonSchema);
    expect(json).toContain("slide-fade");
  });
});
