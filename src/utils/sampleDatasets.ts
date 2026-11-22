export interface CsvPreset {
  id: string;
  label: string;
  summary: string;
  header: boolean;
  text: string;
}

export const CSV_PRESETS: CsvPreset[] = [
  {
    id: 'broken-mix',
    label: 'All 5 Error Types',
    summary: 'BOM, stray CR, quote junk, unterminated quote, short & long rows',
    header: true,
    text:
      '\uFEFFid,account,region,note\r\n' +
      '101,"North, West",US-CA,"Quoted ""ok""\r\nline two"\r\n' +
      '102,Stray\rCR,EU-DE,"trailing"junk\r\n' +
      '103,ShortRow\r\n' +
      '104,LongRow,AP-JP,extra1,extra2\r\n' +
      '105,"Never closes,still,row\r\n',
  },
  {
    id: 'stray-cr',
    label: 'Stray CR Edge Cases',
    summary: 'Lone CR before quote, standalone CR-only lines, trailing CR at EOF',
    header: true,
    text:
      'col_a,col_b,col_c\n' +
      '\r\r\n' +
      '\r"literal_quote",mid\rval,ok\n' +
      '"quoted"\r\r\n' +
      '"quoted"\rjunk,2,3\n' +
      'last,row,eof\r',
  },
  {
    id: 'multiline-quotes',
    label: 'Multiline & Escaped Quotes',
    summary: 'CRLF/CR/LF normalization inside quotes with line-number tracking',
    header: true,
    text:
      'sku,title,description\r\n' +
      'A-1,"Widget ""Pro""","Line 1\r\nLine 2\rLine 3\nLine 4"\r\n' +
      'A-2,"""Empty""",\r\n' +
      'A-3,ShortAfterMultiline\r\n',
  },
  {
    id: 'unterminated',
    label: 'Unterminated Quote Rewind',
    summary: 'EOF rewind restores literal quote and parses remainder unquoted',
    header: true,
    text:
      'k,v,meta\n' +
      '1,"good",ok\n' +
      '2,"re""wound,comma\n3,4,5',
  },
  {
    id: 'no-header-utf16',
    label: 'Headerless + UTF-16',
    summary: 'header: false with emoji, CJK, and unquoted literal quotes',
    header: false,
    text:
      'Café ☕,東京,foo"bar,42\n' +
      '"🚀, launch",大阪,"a""b""c",99\n' +
      'only_two,fields\n',
  },
];

export type WorkloadProfile = 'mixed' | 'crlf' | 'quoted';

export function generateBenchmarkCsv(rowsCount: number, profile: WorkloadProfile): { text: string; header: boolean } {
  let seed = profile === 'mixed' ? 0x1a2b3c4d : profile === 'crlf' ? 0x5e6f7a8b : 0x9c0d1e2f;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const eol = profile === 'crlf' ? '\r\n' : '\n';
  const regions = ['US-East', 'EU-West', 'AP-Tokyo', 'SA-East', 'CA-Central', 'Café-Nord'];
  const statuses = ['active', 'pending', 'settled', 'flagged', 'archived'];
  const parts: string[] = [];

  parts.push('\uFEFFid,timestamp,account,region,status,amount,currency,category,note,owner,tag,checksum' + eol);

  for (let i = 0; i < rowsCount; i++) {
    const r = rand();
    const id = String(100000 + i);
    const ts = `2026-11-21T0${i % 9}:${String(i % 60).padStart(2, '0')}:00Z`;
    const acct = `ACCT-${(i * 7919) % 99991}`;
    const reg = regions[i % regions.length];
    const st = statuses[i % statuses.length];
    const amt = ((i * 137.43) % 50000).toFixed(2);
    const cur = i % 3 === 0 ? 'USD' : i % 3 === 1 ? 'EUR' : 'JPY';
    const cat = i % 4 === 0 ? 'compute' : i % 4 === 1 ? 'storage' : i % 4 === 2 ? 'network' : 'transfer';
    const owner = `team-${i % 17}`;
    const tag = `batch-${i % 23}`;
    const chk = ((i * 2654435761) >>> 0).toString(16).padStart(8, '0');

    const quoteProb = profile === 'quoted' ? 0.85 : profile === 'mixed' ? 0.65 : 0.35;
    let note = `clean_entry_${i}`;
    if (r < quoteProb) {
      if (r < quoteProb * 0.35) {
        note = `"note, with ""quotes"", #${i}"`;
      } else if (r < quoteProb * 0.5) {
        note = `"multiline #${i}${eol}detail line two"`;
      } else {
        note = `"standard quoted ${i}"`;
      }
    }

    // Inject realistic broken CSV defects (~2.5% of rows)
    if (i % 197 === 11) {
      // short_row
      parts.push(`${id},${ts},${acct},${reg},${st},${amt}${eol}`);
    } else if (i % 211 === 17) {
      // long_row
      parts.push(`${id},${ts},${acct},${reg},${st},${amt},${cur},${cat},${note},${owner},${tag},${chk},extra_a,extra_b${eol}`);
    } else if (i % 257 === 23) {
      // stray_cr
      parts.push(`${id},${ts},${acct}\r,${reg},${st},${amt},${cur},${cat},${note},${owner},${tag},${chk}${eol}`);
    } else if (i % 307 === 29) {
      // quote_junk
      parts.push(`${id},${ts},${acct},${reg},${st},${amt},${cur},${cat},"quoted"junk,${owner},${tag},${chk}${eol}`);
    } else {
      parts.push(`${id},${ts},${acct},${reg},${st},${amt},${cur},${cat},${note},${owner},${tag},${chk}${eol}`);
    }
  }

  return { text: parts.join(''), header: true };
}
