import { all, call, type Operation } from "effection";
import { join, resolve } from "jsr:@std/path@1.0.6";
import type { VFile } from "npm:vfile@6.0.3";
import { z } from "npm:zod@3.23.8";
import type { JSXElement } from "revolution";
import { logPrettyZodError } from "npm:@nortex/pretty-zod-error@2.0.0";

import { PrivatePackageError } from "../errors.ts";
import { type DocNode, useDenoDoc } from "./use-deno-doc.tsx";
import { useMDX } from "./use-mdx.tsx";
import { useDescriptionParse } from "./use-description-parse.tsx";
import { REPOSITORY_DEFAULT_BRANCH_URL } from "../config.ts";

export interface Package {
  /**
   * Location of the package on the file system
   */
  path: string;
  /**
   * Name of the directory on the file system
   */
  workspace: string;
  /**
   * Name of the scope (without @) - should be effection-contrib
   */
  scope: string;
  /**
   * Name of the package without the scope 
   */
  name: string;
  /**
   * Full package name from deno.json#name
   */
  packageName: string;
  /**
   * Package version in the repository
   */
  version: string;
  /**
   * Source code URL 
   */
  source: URL;
  /**
   * URL of the package on JSR
   */
  jsr: URL;
  /**
   * URL of the package on JSR
   */
  jsrBadge: URL;
  /**
   * URL of package on npm
   */
  npm: URL;
  /**
   * URL of badge for version published on npm
   */
  npmVersionBadge: URL;
  /**
   * Contents of the README.md file
   */
  readme: string;
  /**
   * Normalized exports from deno.json file
   */
  exports: Record<string, string>;
  /**
   * Bundle size badge from bundlephobia
   */
  bundleSizeBadge: URL;
  /**
   * Bundlephobia URL
   */
  bundlephobia: URL;
  /**
   * Dependency Count Badge
   */
  dependencyCountBadge: URL;
  /**
   * Tree Shaking Support Badge URL
   */
  treeShakingSupportBadge: URL;
  /**
   * Generated docs
   */
  docs: Record<string, Array<RenderableDocNode>>;
  MDXContent: () => JSX.Element;
  MDXDescription: () => JSX.Element;
}

export type RenderableDocNode = DocNode & {
  id: string;
  MDXDoc?: () => JSXElement;
};

export const DenoJson = z.object({
  name: z.string(),
  version: z.string(),
  exports: z.union([z.record(z.string()), z.string()]),
  private: z.union([z.undefined(), z.literal(true)]),
  license: z.string(),
});

export const DEFAULT_MODULE_KEY = ".";

export function* usePackage(workspace: string): Operation<Package> {
  const workspacePath = resolve(Deno.cwd(), workspace);

  const denoJsonPath = `${workspace}/deno.json`;

  const config: { private?: boolean } = yield* call(
    async () => JSON.parse(await Deno.readTextFile(denoJsonPath)),
  );

  if (config.private === true) {
    throw new PrivatePackageError(workspace);
  }

  let denoJson: z.infer<typeof DenoJson> | undefined;

  try {
    denoJson = DenoJson.parse(config);
  } catch (e) {
    if (e instanceof z.ZodError) {
      logPrettyZodError(e);
      throw new Error(`${denoJsonPath} failed validation`);
    } else {
      throw e;
    }
  }

  const readme = yield* call(async () => {
    try {
      return await Deno.readTextFile(join(workspacePath, "README.md"));
    } catch {
      return "Could not find a README.md file";
    }
  });

  let mod = yield* useMDX(readme);

  const content = mod.default({});

  let file: VFile = yield* useDescriptionParse(readme);

  const exports = typeof denoJson.exports === "string"
    ? {
      [DEFAULT_MODULE_KEY]: denoJson.exports,
    }
    : denoJson.exports;

  const [, scope, name] = denoJson.name.match(/@(.*)\/(.*)/) ?? [];

  if (!scope) throw new Error(`Expected a scope but got ${scope}`);
  if (!name) throw new Error(`Expected a package name but got ${name}`);
  
  const entrypoints: Record<string, URL> = {};
  for (const key of Object.keys(exports)) {
    entrypoints[key] = new URL(join(workspacePath, exports[key]), "file://");
  }

  let docs: Package["docs"] = {};
  for (const key of Object.keys(entrypoints)) {
    const docNodes = yield* useDenoDoc(String(entrypoints[key]));
    docs[key] = yield* all(docNodes.map(function* (node) {
      if (node.jsDoc && node.jsDoc.doc) {
        try {
          const mod = yield* useMDX(node.jsDoc.doc);
          return {
            id: exportHash(key, node),
            ...node,
            MDXDoc: () => mod.default({}),
          };
        } catch (e) {
          console.error(
            `Could not parse doc string for ${node.name} at ${node.location}`,
            e,
          );
        }
      }
      return {
        id: exportHash(key, node),
        ...node,
      };
    }));
  }

  return {
    workspace: workspace.replace("./", ""),
    jsr: new URL(`./${denoJson.name}`, 'https://jsr.io/'),
    jsrBadge: new URL(`./${denoJson.name}`, 'https://jsr.io/badges/'),
    npm: new URL(`./${denoJson.name}`, 'https://www.npmjs.com/package/'),
    bundleSizeBadge: new URL(`./${denoJson.name}/${denoJson.version}`, 'https://img.shields.io/bundlephobia/minzip/'),
    npmVersionBadge: new URL(`./${denoJson.name}`, 'https://img.shields.io/npm/v/'),
    bundlephobia: new URL(`./${denoJson.name}/${denoJson.version}`, 'https://bundlephobia.com/package/'),
    dependencyCountBadge: new URL(`./${denoJson.name}`, 'https://badgen.net/bundlephobia/dependency-count/'),
    treeShakingSupportBadge: new URL(`./${denoJson.name}`, 'https://badgen.net/bundlephobia/tree-shaking/'),
    path: workspacePath,
    packageName: denoJson.name,
    scope,
    source: new URL(workspace, REPOSITORY_DEFAULT_BRANCH_URL),
    name,
    exports,
    readme,
    docs,
    version: denoJson.version,
    MDXContent: () => content,
    MDXDescription: () => <>{file.data?.meta?.description}</>,
  };
}

function exportHash(exportName: string, doc: DocNode): string {
  if (exportName === DEFAULT_MODULE_KEY) {
    return doc.name;
  } else {
    return `${exportName}__${doc.name}`;
  }
}
