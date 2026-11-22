// Hopeful Lever — Fast drop-in replacement for make.fun csv-reader 1.0.0
// Pure dependency-free ES module. Deterministic, stateless across calls.
// Exact parity with csv-reader 1.0.0 broken-row policy:
//   - Drops a single leading U+FEFF at index 0
//   - LF and CRLF end records; empty lines produce no records
//   - Lone CR outside quotes is dropped and emits stray_cr
//   - Quoted fields decode "" -> ", normalize CRLF and lone CR -> LF (counting lines),
//     append trailing characters up to comma/EOL (quote_junk if non-empty),
//     and rewind as literal '"' + unquoted on EOF (unterminated_quote)
//   - First non-empty record fixes width (and columns when header === true)
//   - Short rows pad with '' (short_row); long rows truncate (long_row)

function readUnquotedSlow(text, len, pos, segStart, initAcc, hasInitAcc, recordLine, recordRow, errors, state) {
  let acc = hasInitAcc ? initAcc : '';
  let hasAcc = hasInitAcc;
  let added = 0;
  let line = state.line;
  let ended = 2;

  while (pos < len) {
    const c = text.charCodeAt(pos);
    if (c <= 44) {
      if (c === 44) {
        if (pos > segStart) {
          acc = hasAcc ? acc + text.slice(segStart, pos) : text.slice(segStart, pos);
          added += pos - segStart;
        }
        pos++;
        ended = 0;
        break;
      }
      if (c === 10) {
        if (pos > segStart) {
          acc = hasAcc ? acc + text.slice(segStart, pos) : text.slice(segStart, pos);
          added += pos - segStart;
        }
        pos++;
        line++;
        ended = 1;
        break;
      }
      if (c === 13) {
        if (pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
          if (pos > segStart) {
            acc = hasAcc ? acc + text.slice(segStart, pos) : text.slice(segStart, pos);
            added += pos - segStart;
          }
          pos += 2;
          line++;
          ended = 1;
          break;
        }
        if (pos > segStart) {
          acc = hasAcc ? acc + text.slice(segStart, pos) : text.slice(segStart, pos);
          hasAcc = true;
          added += pos - segStart;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos++;
        segStart = pos;
        continue;
      }
    }
    pos++;
  }

  if (ended === 2 && pos > segStart) {
    acc = hasAcc ? acc + text.slice(segStart, pos) : text.slice(segStart, pos);
    added += pos - segStart;
  }

  state.pos = pos;
  state.line = line;
  state.ended = ended;
  state.added = added;
  return acc;
}

function processQuotedSpan(text, segStart, end, line, acc, hasAcc, spanOut) {
  let cr = text.indexOf('\r', segStart);
  if (cr === -1 || cr >= end) {
    let lf = text.indexOf('\n', segStart);
    while (lf !== -1 && lf < end) {
      line++;
      lf = text.indexOf('\n', lf + 1);
    }
    spanOut.line = line;
    spanOut.acc = hasAcc ? acc + text.slice(segStart, end) : (end === segStart ? '' : text.slice(segStart, end));
    return;
  }

  let p = segStart;
  while (p < end) {
    let lf = text.indexOf('\n', p);
    if (lf === -1 || lf >= end) lf = end;
    if (cr === -1 || cr >= end) cr = end;

    if (cr < lf) {
      acc = hasAcc ? acc + text.slice(p, cr) + '\n' : text.slice(p, cr) + '\n';
      hasAcc = true;
      line++;
      p = (cr + 1 < end && text.charCodeAt(cr + 1) === 10) ? cr + 2 : cr + 1;
      cr = text.indexOf('\r', p);
    } else if (lf < end) {
      line++;
      let nextLf = text.indexOf('\n', lf + 1);
      while (nextLf !== -1 && nextLf < cr && nextLf < end) {
        line++;
        nextLf = text.indexOf('\n', nextLf + 1);
      }
      if (cr < end) {
        acc = hasAcc ? acc + text.slice(p, cr) + '\n' : text.slice(p, cr) + '\n';
        hasAcc = true;
        line++;
        p = (cr + 1 < end && text.charCodeAt(cr + 1) === 10) ? cr + 2 : cr + 1;
        cr = text.indexOf('\r', p);
      } else {
        acc = hasAcc ? acc + text.slice(p, end) : text.slice(p, end);
        hasAcc = true;
        break;
      }
    } else {
      acc = hasAcc ? acc + text.slice(p, end) : text.slice(p, end);
      hasAcc = true;
      break;
    }
  }
  spanOut.line = line;
  spanOut.acc = acc;
}

function readQuotedSlow(text, len, open, openLine, lineEnd, recordLine, recordRow, errors, state, spanOut) {
  let pos = open + 1;
  let line = openLine;
  let segStart = pos;
  let acc = '';
  let hasAcc = false;
  let value = '';

  while (true) {
    const q = text.indexOf('"', pos);
    if (q === -1) {
      state.line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      return readUnquotedSlow(text, len, open + 1, open + 1, '"', true, recordLine, recordRow, errors, state);
    }
    const isDoubled = q + 1 < len && text.charCodeAt(q + 1) === 34;
    if (lineEnd > 0 && q < lineEnd) {
      if (isDoubled) {
        acc = hasAcc ? acc + text.slice(segStart, q + 1) : text.slice(segStart, q + 1);
        hasAcc = true;
        pos = q + 2;
        segStart = pos;
        continue;
      }
      value = hasAcc ? acc + text.slice(segStart, q) : (q === segStart ? '' : text.slice(segStart, q));
      pos = q + 1;
      break;
    }
    if (isDoubled) {
      processQuotedSpan(text, segStart, q, line, acc, hasAcc, spanOut);
      line = spanOut.line;
      acc = spanOut.acc + '"';
      hasAcc = true;
      pos = q + 2;
      segStart = pos;
      lineEnd = -1;
      continue;
    }
    processQuotedSpan(text, segStart, q, line, acc, hasAcc, spanOut);
    line = spanOut.line;
    value = spanOut.acc;
    pos = q + 1;
    break;
  }

  state.line = line;
  if (pos >= len) {
    state.pos = pos;
    state.ended = 2;
    return value;
  }
  const c = text.charCodeAt(pos);
  if (c === 44) {
    state.pos = pos + 1;
    state.ended = 0;
    return value;
  }
  if (c === 10) {
    state.pos = pos + 1;
    state.line = line + 1;
    state.ended = 1;
    return value;
  }
  if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
    state.pos = pos + 2;
    state.line = line + 1;
    state.ended = 1;
    return value;
  }
  const out = readUnquotedSlow(text, len, pos, pos, value, true, recordLine, recordRow, errors, state);
  if (state.added > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  return out;
}

function readRestOfRowSlow(text, len, pos, line, buf, col, recordLine, recordRow, errors, state, spanOut) {
  let endedByComma = true;
  while (endedByComma) {
    endedByComma = false;
    let val;
    if (pos < len && text.charCodeAt(pos) === 34) {
      state.line = line;
      val = readQuotedSlow(text, len, pos, line, -1, recordLine, recordRow, errors, state, spanOut);
      pos = state.pos;
      line = state.line;
      endedByComma = state.ended === 0;
    } else {
      state.line = line;
      val = readUnquotedSlow(text, len, pos, pos, '', false, recordLine, recordRow, errors, state);
      pos = state.pos;
      line = state.line;
      endedByComma = state.ended === 0;
    }
    buf[col++] = val;
  }
  state.pos = pos;
  state.line = line;
  state.col = col;
}

function readGeneralRow(text, len, pos, line, buf, recordLine, recordRow, errors, state, spanOut) {
  let col = 0;
  let firstQuoted = false;
  let endedByComma = false;
  do {
    endedByComma = false;
    let val;
    if (pos < len && text.charCodeAt(pos) === 34) {
      if (col === 0) firstQuoted = true;
      state.line = line;
      val = readQuotedSlow(text, len, pos, line, -1, recordLine, recordRow, errors, state, spanOut);
      pos = state.pos;
      line = state.line;
      endedByComma = state.ended === 0;
    } else {
      state.line = line;
      val = readUnquotedSlow(text, len, pos, pos, '', false, recordLine, recordRow, errors, state);
      pos = state.pos;
      line = state.line;
      endedByComma = state.ended === 0;
    }
    buf[col++] = val;
  } while (endedByComma);
  state.pos = pos;
  state.line = line;
  state.col = col;
  state.firstQuoted = firstQuoted;
}

// Monomorphic PACKED_ELEMENTS row allocation avoids HOLEY_ELEMENTS slow path in JSON.stringify
function packRow(b, w) {
  switch (w) {
    case 1: return [b[0]];
    case 2: return [b[0], b[1]];
    case 3: return [b[0], b[1], b[2]];
    case 4: return [b[0], b[1], b[2], b[3]];
    case 5: return [b[0], b[1], b[2], b[3], b[4]];
    case 6: return [b[0], b[1], b[2], b[3], b[4], b[5]];
    case 7: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6]];
    case 8: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]];
    case 9: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8]];
    case 10: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9]];
    case 11: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10]];
    case 12: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11]];
    case 13: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12]];
    case 14: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13]];
    case 15: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14]];
    case 16: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]];
    case 17: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15], b[16]];
    case 18: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15], b[16], b[17]];
    case 19: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15], b[16], b[17], b[18]];
    case 20: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15], b[16], b[17], b[18], b[19]];
    case 21: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15], b[16], b[17], b[18], b[19], b[20]];
    case 22: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15], b[16], b[17], b[18], b[19], b[20], b[21]];
    case 23: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15], b[16], b[17], b[18], b[19], b[20], b[21], b[22]];
    case 24: return [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15], b[16], b[17], b[18], b[19], b[20], b[21], b[22], b[23]];
    default: return b.slice(0, w);
  }
}

function emitBadWidth(buf, col, width, recordLine, recordRow, errors, rows) {
  if (col < width) {
    errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: col });
    for (let i = col; i < width; i++) buf[i] = '';
    rows.push(packRow(buf, width));
  } else {
    errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: buf.slice(width, col) });
    rows.push(packRow(buf, width));
  }
}

function fixSplitWidth(fields, width, recordLine, recordRow, errors) {
  const col = fields.length;
  if (col < width) {
    errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: col });
    while (fields.length < width) fields.push('');
  } else {
    errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
  }
}

export function run(input) {
  const text = String(input.text);
  const len = text.length;
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = len > 0 && text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let line = 1;

  const state = { pos: 0, line: 1, ended: 0, added: 0, col: 0, firstQuoted: false };
  const spanOut = { line: 1, acc: '' };
  const buf = [];

  // Read first non-empty record to establish column width (and header if enabled)
  while (pos < len) {
    const c = text.charCodeAt(pos);
    if (c === 10) {
      pos++;
      line++;
      continue;
    }
    if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line++;
      continue;
    }
    const recordLine = line;
    const recordRow = header ? null : 0;
    readGeneralRow(text, len, pos, line, buf, recordLine, recordRow, errors, state, spanOut);
    pos = state.pos;
    line = state.line;
    if (state.col === 1 && buf[0] === '' && !state.firstQuoted) continue;
    width = state.col;
    const first = buf.slice(0, width);
    if (header) columns = first;
    else rows.push(first);
    break;
  }

  if (pos >= len) {
    return { columns: header ? (columns ?? []) : null, rows, errors };
  }

  let nextLF = text.indexOf('\n', pos);
  if (nextLF === -1) nextLF = len;
  let nextCR = text.indexOf('\r', pos);
  if (nextCR === -1) nextCR = len;
  let nextQuote = text.indexOf('"', pos);
  if (nextQuote === -1) nextQuote = len;

  while (pos < len) {
    if (nextLF < pos) {
      nextLF = text.indexOf('\n', pos);
      if (nextLF === -1) nextLF = len;
    }
    if (nextCR < pos) {
      nextCR = text.indexOf('\r', pos);
      if (nextCR === -1) nextCR = len;
    }

    if (pos === nextLF) {
      pos++;
      line++;
      continue;
    }
    if (pos === nextCR && nextLF < len && nextCR + 1 === nextLF) {
      pos += 2;
      line++;
      continue;
    }

    const recordLine = line;
    const recordRow = rows.length;
    const isCRLF = nextLF < len && nextCR + 1 === nextLF;

    // Fast path: line has no stray CR before its line terminator
    if (nextLF < nextCR || isCRLF || (nextLF === len && nextCR === len)) {
      const lineEnd = isCRLF ? nextCR : nextLF;
      const afterEOL = nextLF < len ? nextLF + 1 : len;

      if (nextQuote < pos) {
        nextQuote = text.indexOf('"', pos);
        if (nextQuote === -1) nextQuote = len;
      }

      // Ultra-fast path: quote-free, stray-CR-free line split directly in C++
      if (nextQuote >= lineEnd) {
        const fields = text.slice(pos, lineEnd).split(',');
        pos = afterEOL;
        if (nextLF < len) line++;
        if (fields.length !== width) fixSplitWidth(fields, width, recordLine, recordRow, errors);
        rows.push(fields);
        continue;
      }

      // Fast path for clean lines containing quotes
      let col = 0;
      let p = pos;
      let firstQuoted = false;
      let fellBack = false;

      while (true) {
        if (text.charCodeAt(p) === 34) {
          if (col === 0) firstQuoted = true;
          const q = text.indexOf('"', p + 1);
          if ((q >>> 0) < lineEnd) {
            const after = q + 1;
            if (after === lineEnd) {
              buf[col++] = q === p + 1 ? '' : text.slice(p + 1, q);
              p = afterEOL;
              if (nextLF < len) line++;
              break;
            }
            if (text.charCodeAt(after) === 44) {
              buf[col++] = q === p + 1 ? '' : text.slice(p + 1, q);
              p = after + 1;
              continue;
            }
          }
          state.line = line;
          buf[col++] = readQuotedSlow(text, len, p, line, lineEnd, recordLine, recordRow, errors, state, spanOut);
          p = state.pos;
          line = state.line;
          if (state.ended !== 0) {
            pos = p;
            fellBack = true;
            break;
          }
          if (p > lineEnd) {
            readRestOfRowSlow(text, len, p, line, buf, col, recordLine, recordRow, errors, state, spanOut);
            pos = state.pos;
            line = state.line;
            col = state.col;
            fellBack = true;
            break;
          }
        } else {
          const comma = text.indexOf(',', p);
          if ((comma >>> 0) < lineEnd) {
            buf[col++] = comma === p ? '' : text.slice(p, comma);
            p = comma + 1;
          } else {
            buf[col++] = lineEnd === p ? '' : text.slice(p, lineEnd);
            p = afterEOL;
            if (nextLF < len) line++;
            break;
          }
        }
      }

      if (!fellBack) pos = p;
      if (col === 1 && buf[0] === '' && !firstQuoted) continue;
      if (col === width) rows.push(packRow(buf, width));
      else emitBadWidth(buf, col, width, recordLine, recordRow, errors, rows);
      continue;
    }

    // General path for lines containing stray CRs before LF/EOF
    readGeneralRow(text, len, pos, line, buf, recordLine, recordRow, errors, state, spanOut);
    pos = state.pos;
    line = state.line;
    const col = state.col;
    if (col === 1 && buf[0] === '' && !state.firstQuoted) continue;
    if (col === width) rows.push(packRow(buf, width));
    else emitBadWidth(buf, col, width, recordLine, recordRow, errors, rows);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
