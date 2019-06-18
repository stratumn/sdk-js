declare module '@stratumn/js-crypto' {
  export namespace sig {
    class SigningPrivateKey {
      constructor(opts: { algo?: string; pemPrivateKey?: string });

      export: (password?: string) => Uint8Array;

      sign: (
        message: Uint8Array
      ) => {
        public_key: Uint8Array;
        signature: Uint8Array;
        message: Uint8Array;
      };
    }
  }

  export namespace utils {
    const stringToBytes: (s: string) => Uint8Array;

    const signatureToJson: (sig: {
      public_key: Uint8Array;
      signature: Uint8Array;
      message: Uint8Array;
    }) => {
      public_key: string;
      signature: string;
      message: string;
    };

    const stringToB64String: (s: string) => string;
  }
}
