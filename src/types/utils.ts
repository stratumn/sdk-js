/**
 * Transform all T1 in D to T2.
 *
 * Example:
 *
 * interface MyData {
 *  a: string;
 *  b: number;
 *  c: {
 *    d: string;
 *    e: number;
 *  }
 * }
 *
 * type NewData = Transform<string,boolean,MyData>;
 * MyData === {
 *  a: boolean;
 *  b: number;
 *  c: {
 *    d: boolean;
 *    e: number;
 *  }
 * }
 */

export type Transform<T1, T2, D> = {
  [P in keyof D]: D[P] extends T1 ? T2 : Transform<T1, T2, D[P]>;
};
