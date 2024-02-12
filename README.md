# dusk-wallet-js
JavaScript library for rusk-wallet

This will be later grafted into js-utils repo

# Guide to use

## Bundling
```
➜ deno task build
```
This will create a `dist/wallet.js` which can be used on the frontend side

## Usage

[`example/index.html`](https://github.com/dusk-network/dusk-wallet-js/tree/main/example)

```html
<script type="module">
  import { Wallet } from "../dist/wallet.js";
  const initWasm = async () => {
    // load a wallet wasm
    const { instance } = await WebAssembly.instantiateStreaming(
      fetch("../assets/dusk-wallet-core-0.21.0.wasm"),
    );

    let wasm = instance.exports;
    // Default wallet seed
    let seed = [
      153, 16, 102, 99, 133, 196, 55, 237, 42, 2, 163, 116, 233, 89, 10, 115,
      19, 81, 140, 31, 38, 81, 10, 46, 118, 112, 151, 244, 145, 90, 145, 168,
      214, 242, 68, 123, 116, 76, 223, 56, 200, 60, 188, 217, 34, 113, 55, 172,
      27, 255, 184, 55, 143, 233, 109, 20, 137, 34, 20, 196, 252, 117, 221, 221,
    ];
    let wallet = new Wallet(wasm, seed);
    // get the 21 psks that belongs to the wallet
    let psks = wallet.getPsks();
    // sync the wallet using IndexedDB, everything is managed internally
    let sync = await wallet.sync();
    // get balance for the first public spend key
    let balance = await wallet.getBalance(psks[0]);
  };

  document.addEventListener("DOMContentLoaded", function (event) {
    initWasm().catch((e) => console.error(e));
  });
</script>
```

# Running the example

```
➜ deno task buildServe
```
Then go to [`127.0.0.1:8000/example/index.html`](http://127.0.0.1:8000/example/index.html)

### __NOTE__: **if you go to `localhost/example/index.html` then you will get a CORS error**

# Usage Documentation
[Check the wiki on detailed usage guide](https://github.com/dusk-network/dusk-wallet-js/wiki)

@ API Documentation
[Check the github pages generated jsdoc](https://dusk-network.github.io/dusk-wallet-js/)

# Testing

## Docker

```
docker run --name rusk -p 9000:9000/udp -p 8080:8080/tcp -v ./genesis.toml:/opt/rusk/state.toml dusknetwork/node:latest
```

Make sure you have the node running with the following genesis.toml file for  `deno task test`

```toml
[acl.stake]
owners = [
    'oCqYsUMRqpRn2kSabH52Gt6FQCwH5JXj5MtRdYVtjMSJ73AFvdbPf98p3gz98fQwNy9ZBiDem6m9BivzURKFSKLYWP3N9JahSPZs9PnZ996P18rTGAjQTNFsxtbrKx79yWu',
]
allowlist = [
    'oCqYsUMRqpRn2kSabH52Gt6FQCwH5JXj5MtRdYVtjMSJ73AFvdbPf98p3gz98fQwNy9ZBiDem6m9BivzURKFSKLYWP3N9JahSPZs9PnZ996P18rTGAjQTNFsxtbrKx79yWu',
    'ocXXBAafr7xFqQTpC1vfdSYdHMXerbPCED2apyUVpLjkuycsizDxwA6b9D7UW91kG58PFKqm9U9NmY9VSwufUFL5rVRSnFSYxbiKK658TF6XjHsHGBzavFJcxAzjjBRM4eF'
]

[[balance]]
address = '4ZH3oyfTuMHyWD1Rp4e7QKp5yK6wLrWvxHneufAiYBAjvereFvfjtDvTbBcZN5ZCsaoMo49s1LKPTwGpowik6QJG'
seed = 0xdead_beef
notes = [100_000_000_000_000]

[[stake]]
address = 'oCqYsUMRqpRn2kSabH52Gt6FQCwH5JXj5MtRdYVtjMSJ73AFvdbPf98p3gz98fQwNy9ZBiDem6m9BivzURKFSKLYWP3N9JahSPZs9PnZ996P18rTGAjQTNFsxtbrKx79yWu'
amount = 1_000_000_000_000
```

And then run

```
deno task test
```
