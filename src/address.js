export class Address extends String {
  #index = -1;

  constructor(value) {
    if (!value) {
      return;
    }

    super(value);
  }

  /**
   * Claim the index of the address
   * @param {Wallet} wallet
   * @returns {Address} with index set to the index where the address belongs
   */
  async claim(wallet) {
    if (this.owned) {
      return this;
    }

    this.#index = await wallet.findAddress(this);

    return this;
  }

  /**
   * Check if address is owned or not
   * @returns {boolean}
   */
  get owned() {
    return this.#index > -1;
  }

  /**
   * Return index
   * @returns {Number}
   */
  get index() {
    return this.#index;
  }
}
