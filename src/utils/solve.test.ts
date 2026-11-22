import test from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../solve.js';
import { readCsvReference, type CsvInput } from './referenceCsv.ts';

function assertParity(input: CsvInput, label?: string) {
  const actual = run(input);
  const expected = readCsvReference(input);
  assert.deepStrictEqual(actual, expected, label ? `Mismatch on: ${label}` : undefined);
}

test('empty, whitespace, and BOM edge cases', () => {
  const cases: Array<[string, CsvInput]> = [
    ['empty header=false', { text: '', header: false }],
    ['empty header=true', { text: '', header: true }],
    ['BOM only header=false', { text: '\uFEFF', header: false }],
    ['BOM only header=true', { text: '\uFEFF', header: true }],
    ['double BOM keeps second BOM', { text: '\uFEFF\uFEFFa,b\n1,2', header: true }],
    ['BOM mid-file is kept', { text: 'a,b\n\uFEFF1,2', header: true }],
    ['blank lines LF and CRLF only', { text: '\n\r\n\n\r\n', header: true }],
    ['leading and trailing blank lines', { text: '\n\r\na,b\n\n1,2\r\n\r\n', header: true }],
    ['header only', { text: 'col1,col2,col3\n', header: true }],
    ['header only no newline', { text: 'col1,col2', header: true }],
    ['spaces are never trimmed', { text: ' a , b \n 1 , 2 ', header: true }],
    ['empty quoted line is a real record', { text: '""\n""\n', header: true }],
    ['empty quoted first field + trailing comma', { text: '"",\n"",\n', header: false }],
  ];
  for (const [label, input] of cases) {
    assertParity(input, label);
  }
});

test('stray CR outside quotes and interactions with quotes', () => {
  const cases: Array<[string, CsvInput]> = [
    ['standalone stray CR line produces error, no record', { text: 'a,b\n\r\n\r\r\n1,2', header: true }],
    ['only stray CRs in file', { text: '\r\r\r', header: true }],
    ['only stray CRs header=false', { text: '\r\r\n\r', header: false }],
    ['stray CR before quote treats quote as literal', { text: 'a,b\n\r"hello",world', header: true }],
    ['stray CR inside unquoted field', { text: 'a,b\nhe\rllo,wo\rrld', header: true }],
    ['stray CR at EOF after unquoted field', { text: 'a,b\n1,2\r', header: true }],
    ['stray CR before CRLF', { text: 'a,b\r\n1,2\r\r\n3,4\r\n', header: true }],
    ['stray CR inside header', { text: 'a\r,b\n1,2', header: true }],
    ['stray CR after closing quote before CRLF (no junk)', { text: 'a,b\n"x"\r\r\n1,2', header: true }],
    ['stray CR after closing quote with junk', { text: 'a,b\n"x"\rjunk,2', header: true }],
    ['stray CR after closing quote with junk before comma', { text: 'a,b\n"x"j\ru\rnk,2', header: true }],
    ['stray CR after closing quote right before LF', { text: 'a,b\n"x"\r\n1,2', header: true }],
    ['stray CR after closing quote at EOF', { text: 'a,b\n1,"x"\r', header: true }],
  ];
  for (const [label, input] of cases) {
    assertParity(input, label);
  }
});

test('quoted fields, escaped quotes, multiline line counting, quote_junk, and unterminated_quote', () => {
  const cases: Array<[string, CsvInput]> = [
    ['doubled quotes single line', { text: 'a,b\n"he""llo","""world"""', header: true }],
    ['quadruple quotes', { text: 'a\n""""\n""""""', header: true }],
    ['commas inside quotes', { text: 'a,b\n"1,2,3","4,5"', header: true }],
    ['multiline LF inside quotes', { text: 'a,b\n"line1\nline2",ok\n"x",y', header: true }],
    ['multiline CRLF and lone CR inside quotes', { text: 'a,b\n"l1\r\nl2\rl3\nl4",ok\nshort', header: true }],
    ['CR immediately before closing quote', { text: 'a,b\n"endcr\r",ok\n1,2', header: true }],
    ['CRLF immediately before closing quote', { text: 'a,b\n"endcrlf\r\n",ok\n1,2', header: true }],
    ['mixed CR/CRLF/LF around escaped quotes', { text: 'a,b\n"x\r""y\r\n""z\n""\r",ok\n1,2', header: true }],
    ['quote_junk single line', { text: 'a,b\n"hello"junk,2\n"ok",3', header: true }],
    ['quote_junk at end of line', { text: 'a,b\n1,"hello"tail\n2,3', header: true }],
    ['quote_junk at EOF', { text: 'a,b\n1,"hello"tail', header: true }],
    ['quote_junk after multiline quote', { text: 'a,b\n"hello\nworld"tail,2\n3,4', header: true }],
    ['unterminated quote at EOF', { text: 'a,b\n1,"never closes', header: true }],
    ['unterminated quote mid-file with commas and newlines', { text: 'a,b\n1,"oops,still,here\n2,3', header: true }],
    ['unterminated quote with doubled quotes inside', { text: 'a,b\n"a""b""c,d\ne,f', header: true }],
    ['unterminated quote with stray CR after rewind', { text: 'a,b\n"a\rb\r\nc,d', header: true }],
    ['unterminated quote in header', { text: '"h1,h2\n1,2', header: true }],
    ['literal quote inside unquoted field', { text: 'a,b\nfoo"bar,baz"qux', header: true }],
    ['single quote character at EOF', { text: '"', header: false }],
    ['quoted field followed by trailing comma at line end', { text: 'a,b\n"x",\n"y""z",', header: true }],
  ];
  for (const [label, input] of cases) {
    assertParity(input, label);
  }
});

test('short_row, long_row, wide tables (widths 1..30), and UTF-16 surrogates', () => {
  for (const w of [1, 2, 5, 12, 18, 19, 24, 25, 30]) {
    const hdr = Array.from({ length: w }, (_, i) => `c${i}`).join(',');
    const good = Array.from({ length: w }, (_, i) => (i % 3 === 0 ? `"v${i}"` : `v${i}`)).join(',');
    const short = w > 1 ? Array.from({ length: w - 1 }, (_, i) => `s${i}`).join(',') : '';
    const long = Array.from({ length: w + 2 }, (_, i) => `l${i}`).join(',');
    const csv = `${hdr}\n${good}\n${short}\n${long}\n`;
    assertParity({ text: csv, header: true }, `width=${w} header=true`);
    assertParity({ text: csv, header: false }, `width=${w} header=false`);
  }

  assertParity(
    {
      text: '\uFEFFid,name,note\r\n1,"Café ☕","line1\r\n🚀 ""rocket"" 🎉"\r\n2,日本語,plain\r\n',
      header: true,
    },
    'UTF-16 emoji and CJK'
  );
});

test('differential fuzzer: 1,500 adversarial broken CSVs match csv-reader 1.0.0 identically', () => {
  // Deterministic PRNG (Mulberry32)
  let seed = 0x20261121;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const alphabet = ['a', 'b', 'é', '🚀', ',', '"', '""', '\n', '\r', '\r\n', ' ', 'x', ''];

  for (let i = 0; i < 1500; i++) {
    const tokens = Math.floor(rand() * 90);
    let text = rand() < 0.25 ? '\uFEFF' : '';
    for (let j = 0; j < tokens; j++) {
      text += alphabet[Math.floor(rand() * alphabet.length)];
    }
    const header = (i & 1) === 0;
    assertParity({ text, header }, `fuzz #${i}`);
  }
});
