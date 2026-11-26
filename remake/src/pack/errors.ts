import { PACK_SCHEMA, type PackIssue } from "./types.ts";

function plainIssue(issue: PackIssue): string {
  const { path, message } = issue;
  if (path === "schema") {
    return `This pack’s format is not supported. The remake needs ${PACK_SCHEMA}.`;
  }
  if (path === "$") return "The pack configuration file is not valid.";
  if (message.startsWith("file missing from pack:")) {
    const file = message.slice("file missing from pack:".length).trim();
    return `The pack is missing a picture it lists: ${file}.`;
  }
  if (message.includes("without '..'")) {
    return "The pack lists a picture path that is not allowed (it tries to leave the pack folder).";
  }
  if (message.startsWith("unknown image id") || message.startsWith("unknown map")) {
    return `The pack configuration points at something that is not in the pack (${path}: ${message}).`;
  }
  if (path === "license.name") return "The pack does not say what licence the pictures are under.";
  if (path === "coordinates") {
    return "The pack does not use the expected coordinate conventions (hotspot top,bottom,left,right and insetRect left,top,width,height).";
  }
  return `${path}: ${message}`;
}

export function formatPackIssues(issues: PackIssue[]): string {
  if (!issues.length) return "";
  if (issues.length === 1) return plainIssue(issues[0]);
  return "This zip could not be used as an image pack:\n" + issues.map((i) => `• ${plainIssue(i)}`).join("\n");
}

/** Turn a thrown pack / download error into a short message for the Image pack window. */
export function formatPackError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not an image pack/i.test(msg) || /missing pack\.yaml/i.test(msg)) {
    return "This file is not an image pack. A pack zip needs a pack.yaml or pack.json file, plus the pictures it lists.";
  }
  if (msg.startsWith("Invalid image pack:")) {
    const lines = msg.split("\n").slice(1).map((l) => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean);
    const issues = lines.map((line) => {
      const idx = line.indexOf(": ");
      if (idx === -1) return { path: "pack", message: line };
      return { path: line.slice(0, idx), message: line.slice(idx + 2) };
    });
    return formatPackIssues(issues);
  }
  if (/empty/i.test(msg) && /address/i.test(msg)) return "That pack address is empty.";
  if (/not a valid URL/i.test(msg)) return "That pack address is not a valid URL.";
  if (/must be an http/i.test(msg)) return "A pack address must be an http or https URL.";
  if (/Failed to fetch|NetworkError|Load failed|CORS/i.test(msg)) {
    return "The pack could not be downloaded from that address. The site may be blocking the request, or the address may be wrong.";
  }
  const http = msg.match(/HTTP (\d+)/);
  if (http) return `The pack could not be downloaded (the server responded with HTTP ${http[1]}).`;
  return msg;
}
