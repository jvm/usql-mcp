/**
 * MCP Resources implementation
 * Exposes database metadata as readable resources
 */

export { parseResourceUri, buildResourceUri, ResourceUriError, type ParsedResourceUri } from "./uri-parser.js";
export { readResource, type ResourceContent } from "./read-resource.js";
export { listResources, listResourceTemplates, type ResourceListItem, type ResourceTemplate } from "./list-resources.js";
