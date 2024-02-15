// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Copyright (c) DUSK NETWORK. All rights reserved.

import { clean, compare } from "https://deno.land/x/semver/mod.ts";

const decoder = new TextDecoder();
const decode = decoder.decode.bind(decoder);

const parseOutput = ({ success, stdout, stderr }) =>
  success ? Promise.resolve(decode(stdout)) : Promise.reject(decode(stderr));

const callable = (cmd) => {
  const handler = {
    get(target, prop, receiver) {
      return callable([...cmd, prop]);
    },
  };

  return cmd.length
    ? new Proxy(Function.prototype, {
        ...handler,
        apply(target, thisArg, params) {
          const commands = cmd.map((c) =>
            c.replace(/[A-Z]/g, (a) => `-${a.toLowerCase()}`),
          );
          const [command, ...args] = [...commands, ...params];
          return new Deno.Command(command, { args }).output().then(parseOutput);
        },
      })
    : new Proxy(Object.create(null), handler);
};

export const cmd = callable([]);
export const git = callable(["git"]);

export const tagVersions = () =>
  git
    .tag()
    .then((stdout) => stdout.match(/[^\n]+/g))
    .then((tags) => tags.filter(clean).sort(compare));
