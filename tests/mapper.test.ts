import { describe, expect, it } from "vitest";
import { conceptLabel, painForm, swellingForm } from "../src/knowledge.ts";
import { mapperContext, mapperHref } from "../src/model.ts";

const forms = [painForm, swellingForm];

describe("suggest-mapping links", () => {
  it("sends a severity value to the OpenGALEN browser with its descriptor", () => {
    const ctx = mapperContext("mild", forms, conceptLabel("mild"));
    expect(ctx.kind).toBe("value");
    expect(ctx.feature).toBe("AbsoluteSeverity");
    expect(ctx.siblings).toEqual(expect.arrayContaining(["moderate", "severe"]));
    const href = new URL(mapperHref("mild", ctx));
    expect(href.origin + href.pathname).toBe("https://erik-sundvalls-bots.github.io/opengalen-browser/");
    expect(href.searchParams.get("map")).toBe("value/mild");
    expect(href.searchParams.get("feature")).toBe("AbsoluteSeverity");
    expect(href.searchParams.get("display")).toBe("mild");
  });

  it("treats a form feature as a descriptor and a form topic as a topic", () => {
    expect(mapperContext("AbsoluteSeverity", forms, "Severity").kind).toBe("descriptor");
    expect(mapperContext("ThumbPainSymptom", forms, "thumb pain").kind).toBe("formTopic");
    expect(new URL(mapperHref("ThumbPainSymptom", mapperContext("ThumbPainSymptom", forms, "thumb pain"))).searchParams.get("map"))
      .toBe("formTopic/ThumbPainSymptom");
  });
});
