# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Add the `Gas` class
- Add tests for the gas class
- Add address.js file
- Add `addressses` in `Wallet` class
- Add tests for new address class

### Changed
- Acclimate existing code to change with the `address` field in the `Wallet` class

### Removed

- Remove `has_staked` check when withdrawing reward

### [0.4.2]

### Changed
- Change MAX_KEYS to 3 in wallet-core
- Update version of wallet-core to 0.21.9

### Added
- Add signal to sync to make it abortable

### [0.4.1]

### Removed
- stake-allow tx removed

### Added
- Integrate `exu` library for supporting web-workers
- Add `WALLET_CORE_PATH` env variable for building
- Add tests for npm.js

### Changed
- Update CI to build and link with wallet-core on actions with the `WALLET_CORE_PATH` env variable

### [0.3.2]

### Changed
- Ship the web assembly embedded in the library itself
- During sync only, remove json from web assembly calls and send raw buffers

### Removed
- Remove mnemonic helper functions
