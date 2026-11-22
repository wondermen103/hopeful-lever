import type { CsvInput, CsvResult } from '../utils/referenceCsv';

declare module '../../solve.js' {
  export function run(input: CsvInput): CsvResult;
}
