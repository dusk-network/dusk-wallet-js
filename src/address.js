export class Address extends String {
  #index = -1;

  constructor(value) {
    if (!value) {
      return;
    }

    super(value);
  }

  /**
   *
   * @param {Wallet} wallet
   * @returns
   */
  async claim(wallet) {
    if (this.claimed) {
      return true;
    }

    // const addresses = await wallet.addresses;
    // const availableAddresses = await wallet.availableAddresses;

    // this.#index = [...addresses, ...availableAddresses].findIndex(
    //   (addr) => addr.toString() === this.toString()
    // );

    // return this;
    this.#index = await wallet.findAddress(this);
  }

  get claimed() {
    return this.#index > -1;
  }

  get index() {
    return this.#index;
  }
}
