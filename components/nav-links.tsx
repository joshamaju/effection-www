import { css } from "npm:@twind/core@1.1.3";

import {
  ContribRepositoryContext,
  LibraryRepositoryContext,
} from "../context/repository.ts";
import { IconDiscord } from "./icons/discord.tsx";
import { IconGithub } from "./icons/github.tsx";
import { SearchIcon } from "./icons/search.tsx";
import { StarIcon } from "./icons/star.tsx";

const colorful = css`
  background-image: linear-gradient(
    45deg,
    #f74d7b -20%,
    #8c7db3 95%
  );
  &:hover {
    background-image: linear-gradient(
    45deg,
    #8c7db3 -20%,
    #f74d7b 95%
    );
  }
`;

export function* NavLinks() {
  let library = yield* LibraryRepositoryContext.expect();
  let contrib = yield* ContribRepositoryContext.expect();
  let contribMain = yield* contrib.loadRef();
  let workspaces = yield* contribMain.loadWorkspaces();

  return (
    <>
      <ul class="grid grid-flow-col auto-col-auto float-right place-items-end items-center gap-3 md:gap-7 lg:gap-12 md:ml-5">
        <li>
          <a href="/docs/installation">Guides</a>
        </li>
        <li>
          <a href="/api">API</a>
        </li>
        <li class="hidden md:flex">
          <a class="flex flex-row space-x-1" href="/contrib">
            <span>Contrib</span>
            <span>({workspaces.length})</span>
          </a>
        </li>
        <li class="hidden md:flex">
          <a
            class={`flex flex-row ${colorful} p-1 rounded`}
            href="https://github.com/thefrontside/effection"
          >
            <span class="flex items-center">
              <IconGithub />
            </span>
            <span class={`flex flex-row items-center pl-1 text-white`}>
              <StarIcon class="pr-0.5" />
              <span>{yield* library.starCount()}</span>
              <span class="font-black">+</span>
            </span>
          </a>
        </li>
        <li class="hidden md:flex">
          <a
            class="flex flex-row items-center space-x-1"
            href="https://discord.gg/r6AvtnU"
          >
            <IconDiscord />
            <span>Discord</span>
          </a>
        </li>
        <li class="hidden md:flex">
          <form method="get" action="search">
            <label class="h-9 w-[90px] relative block hover:cursor-pointer">
              <input
                id="search"
                type="search"
                name="q"
                class="relative block h-full w-full bg-slate-100 rounded-full text-slate-800 focus:outline-none focus:bg-white focus:border-slate-500 focus:ring-slate-500 focus:ring-2 pl-3 focus:w-[250px] focus:-ml-[160px] focus:z-1 transition-all text-lg"
                placeholder="⌘K"
              />
              <span class="absolute inset-y-0 right-0 flex items-center pr-2">
                <SearchIcon class="w-6 mr-2 text-slate-400" />
              </span>
            </label>
          </form>
          <style>
            {`
            input[type="search"]::-webkit-search-cancel-button {
              -webkit-appearance: none;
              appearance: none;
            }
          `}
          </style>
        </li>
      </ul>
    </>
  );
}
