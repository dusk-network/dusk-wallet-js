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
    if (this.owned) {
      return this;
    }

    // const addresses = await wallet.addresses;
    // const availableAddresses = await wallet.availableAddresses;

    // this.#index = [...addresses, ...availableAddresses].findIndex(
    //   (addr) => addr.toString() === this.toString()
    // );

    // return this;
    this.#index = await wallet.findAddress(this);

    return this;
  }

  get owned() {
    return this.#index > -1;
  }

  get index() {
    return this.#index;
  }
}
