export class Address extends String {
  #index = -1;

  constructor(value) {
    if (!value) {
      return;
    }

    super(value);
  }

  async claim(wallet) {
    if (this.owned) {
      return true;
    }

    const addresses = await wallet.addresses;
    const availableAddresses = await wallet.availableAddresses;

    this.#index = [...addresses, ...availableAddresses].findIndex(
      (addr) => addr.toString() === this.toString()
    );

    return this.#index > -1;
  }

  get owned() {
    return this.#index > -1;
  }

  get index() {
    return this.#index;
  }
}
