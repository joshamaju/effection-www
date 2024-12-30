import {
  all,
  call,
  type Operation,
  resource,
  type Task,
  useScope,
} from "effection";
import { basename } from "jsr:@std/path@1.0.8";
import { evaluate } from "npm:@mdx-js/mdx@3.1.0";
import rehypePrismPlus from "npm:rehype-prism-plus@2.0.0";
import remarkGfm from "npm:remark-gfm@4.0.0";
import { Fragment, jsx, jsxs } from "revolution/jsx-runtime";

import structure from "./structure.json" with { type: "json" };

export interface DocModule {
  default: () => JSX.Element;
  frontmatter: {
    id: string;
    title: string;
  };
}

export interface Docs {
  all(): Operation<Doc[]>;
  getDoc(id?: string): Operation<Doc | undefined>;
}

export interface Topic {
  name: string;
  items: DocMeta[];
}

export interface DocMeta {
  id: string;
  title: string;
  filename: string;
  topics: Topic[];
  next?: DocMeta;
  prev?: DocMeta;
}

export interface Doc extends DocMeta {
  MDXContent: () => JSX.Element;
  markdown: string;
}

export function loadDocs(): Operation<Docs> {
  return resource(function* (provide) {
    let loaders: Map<string, Task<Doc>> | undefined = undefined;

    let scope = yield* useScope();

    function* load() {
      let tasks = new Map<string, Task<Doc>>();
      let entries = Object.entries(structure);

      let topics: Topic[] = [];

      for (let [name, contents] of entries) {
        let topic: Topic = { name, items: [] };
        topics.push(topic);

        let current: DocMeta | undefined = void (0);
        for (let i = 0; i < contents.length; i++) {
          let prev: DocMeta | undefined = current;
          let [filename, title] = contents[i];
          let meta: DocMeta = current = {
            id: basename(filename, ".mdx"),
            title,
            filename,
            topics,
            prev,
          };
          if (prev) {
            prev.next = current;
          }
          topic.items.push(current);

          tasks.set(
            meta.id,
            scope.run(function* () {
              let location = new URL(filename, import.meta.url);
              let source = yield* call(Deno.readTextFile(location));
              let mod = yield* call(evaluate(source, {
                jsx,
                jsxs,
                jsxDEV: jsx,
                Fragment,
                remarkPlugins: [
                  remarkGfm,
                ],
                rehypePlugins: [
                  [rehypePrismPlus, { showLineNumbers: true }],
                ],
              }));

              return {
                ...meta,
                markdown: source,
                MDXContent: () => mod.default({}),
              } as Doc;
            }),
          );
        }
      }
      return tasks;
    }

    yield* provide({
      *all() {
        if (!loaders) {
          loaders = yield* load();
        }
        return yield* all([...loaders.values()]);
      },
      *getDoc(id) {
        if (id) {
          if (!loaders) {
            loaders = yield* load();
          }
          let task = loaders.get(id);
          if (task) {
            return yield* task;
          }
        }
      },
    });
  });
}
