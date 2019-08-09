declare module '@stratumn/canonicaljson' {
  export function stringify(obj: any): string;
}

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

      publicKey: () => SigningPublicKey;
    }

    class SigningPublicKey {
      constructor(opts: { pemPublicKey?: string });
      verify: (sig: { signature: Uint8Array; message: Uint8Array }) => any;
    }
  }

  export namespace aes {
    class SymmetricKey {
      constructor(raw?: string);
      export: () => { key: string };
      encrypt: (data: any, encoding?: string) => string;
      decrypt: (data: any, encoding?: string) => string;
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

    const b64StringToString: (s: string) => string;

    const signatureFromJson: (sig: {
      public_key: string;
      signature: string;
      message: string;
    }) => {
      public_key: Uint8Array;
      signature: Uint8Array;
      message: Uint8Array;
    };
  }
}

declare module 'promise-file-reader' {
  export const readAsArrayBuffer: (file: File) => Promise<ArrayBuffer>;
  export const readAsText: (file: File) => Promise<string>;
}
