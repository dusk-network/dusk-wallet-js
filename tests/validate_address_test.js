import { validateAddress } from "../dist/wallet.js";
import { assertEquals } from "../deps.js";

Deno.test("valid addresses pass", () => {
  const validAddresses = [
    "47jNTgAhzn9KCKF3msCfvKg3k1P1QpPCLZ3HG3AoNp87sQ5WNS3QyjckYHWeuXqW7uvLmbKgejpP8Xkcip89vnMM",
    "4xwKPC9UMvketmoNkDvyaJufcTZWmNn8giB8xWTf3Qk8nFkRW81nTVwSdGPcbomzHThPuoXsdFzrzwiMar6BEfdw",
    "5kB6VBePF8eFhFVjLwM1xrEL6yGBm1uDsoWyRjdqDQ2nNz8nECAsRh3MZiM6uEo6WmukqyKzzCK9B5rcPTnjZQgt",
    "4LaS4bWzFQtvxZ7frUaXbfm3xsbnHHYwNkGnLqqpmWPYQeSfbAPy7N4Md8gk5gHn9f4wxNSNyFJuyxcnXPSWTRMd",
    "gMxrVEH5aW7XuQiXN2Pm2YRLHyCNmokmBb1VzjcmcQg7gzmxstPnozdt7SvvMKLP71BadPsa5jmoWFc2WzWDYPo",
  ];

  for (const address of validAddresses) {
    const result = validateAddress(address);
    assertEquals(result.isValid, true, `Expected address to be valid: ${address}`);
  }
});

Deno.test("invalid addresses fail", () => {
  const invalidAddresses = [
    "InvalidKey12345", // Invalid Base58
    "4LaS4bWzFQtvxZ7frUaXbfm3xsbnHHYwNkGnLqqpmWPY", // Too short
    "5kB6VBePF8eFhFVjLwM1xrEL6yGBm1uDsoWyRjdqDQ2nNz8nECAsRh3MZiM6uEo6WmukqyKzzCK9B5rcPTnjZQgtXXXXXXXX", // Too long
    "", // Empty string
    "47jNTgAhzn9KCKF3msCfvKg3k1P1QpPCLZ3HG3AoNp87sQ5WNS3QyjckYHWeuXqW7uvLmbKgejpP8Xkcip89vnM!", // Contains an invalid character
  ];

  for (const address of invalidAddresses) {
    const result = validateAddress(address);
    assertEquals(result.isValid, false, `Expected address to be invalid: ${address}`);
  }
});
