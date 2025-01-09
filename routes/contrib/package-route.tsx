import { type JSXElement, useParams } from "revolution";

import { API } from "../../components/api.tsx";
import { PackageExports } from "../../components/package/exports.tsx";
import { PackageHeader } from "../../components/package/header.tsx";
import { ScoreCard } from "../../components/score-card.tsx";
import { DocPageContext } from "../../context/doc-page.ts";
import { Dependency, DocsPages } from "../../hooks/use-deno-doc.tsx";
import { useMarkdown } from "../../hooks/use-markdown.tsx";
import { major, minor } from "../../lib/semver.ts";
import type { RoutePath, SitemapRoute } from "../../plugins/sitemap.ts";
import { Repository } from "../../resources/repository.ts";
import { useAppHtml } from "../app.html.tsx";


interface ContribPackageRouteParams {
  contrib: Repository,
  library: Repository,
}

export function contribPackageRoute({
  contrib,
  library,
}: ContribPackageRouteParams
): SitemapRoute<JSXElement> {
  return {
    *routemap(pathname) {
      let paths: RoutePath[] = [];

      const main = yield* contrib.loadRef();
      const { workspace = [] } = yield* main.loadDenoJson();

      for (let workspacePath of workspace) {
        paths.push({
          pathname: pathname({
            workspacePath: workspacePath.replace(/^\.\//, ""),
          }),
        });
      }

      return paths;
    },
    *handler() {
      const params = yield* useParams<{ workspacePath: string }>();

      try {
        const main = yield* contrib.loadRef();
        const pkg = yield* main.loadWorkspace(`./${params.workspacePath}`);
        const docs = yield* pkg.docs();

        const AppHTML = yield* useAppHtml({
          title: `${pkg.packageName} | Contrib | Effection`,
          description: yield* pkg.description(),
        });

        const linkResolver = function* (
          symbol: string,
          connector?: string,
          method?: string,
        ) {
          const internal = `#${symbol}_${method}`;
          if (connector === "_") {
            return internal;
          }
          const page = docs["."].find((page) => page.name === symbol);

          let effectionDocs: DocsPages | undefined;
          let effection: Dependency | undefined;
          if (page) {
            // get internal link
            return `[${symbol}](#${page.kind}_${page.name})`;
          } else {
            // get external link
            if (!effectionDocs) {
              const page = yield* DocPageContext.expect();
              effection = page.dependencies.find(dep => ["effection", "@effection/effection"].includes(dep.name));
              if (effection) {
                const ref = yield* library.loadRef(`tags/effection-v${effection.version}`)
                const pkg = yield* ref.loadRootPackage();
                if (pkg) {
                  effectionDocs = yield* pkg?.docs();
                }
              }
            }
            if (effection && effectionDocs) {
              const page = effectionDocs["."].find((page) => page.name === symbol);
              if (page) {
                return `[${symbol}](/api/${major(effection?.version)}.${minor(effection?.version)}/${symbol})`
              }  
            }
          }

          return symbol;
        };

        return (
          <AppHTML>
            <>
              <div class="grid grid-cols-1 lg:grid-cols-10 gap-8 lg:gap-12">
                <article class="min-w-0 lg:col-span-7 lg:row-start-1">
                  {yield* PackageHeader(pkg)}
                  <div class="prose max-w-full">
                    <div class="mb-5">
                      {
                        yield* PackageExports({
                          packageName: pkg.packageName,
                          docs,
                          linkResolver,
                        })
                      }
                    </div>
                    {yield* useMarkdown(yield* pkg.readme(), { linkResolver })}
                    <h2 class="mb-0">API Reference</h2>
                    {yield* API({ pkg, linkResolver })}
                  </div>
                </article>
                <aside class="lg:col-[span_3/_-1] lg:top-0 lg:sticky lg:max-h-screen flex flex-col box-border gap-y-4 -mt-4 pt-4">
                  {yield* ScoreCard(pkg)}
                </aside>
              </div>
            </>
          </AppHTML>
        );
      } catch (e) {
        console.error(e);
        const AppHTML = yield* useAppHtml({
          title: `${params.workspacePath} not found`,
          description: `Failed to load ${params.workspacePath} due to error.`,
        });
        return (
          <AppHTML>
            <p>Failed to load {params.workspacePath} due to error.</p>
          </AppHTML>
        );
      }
    },
  };
}