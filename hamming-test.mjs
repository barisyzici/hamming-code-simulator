/**
 * hamming-test.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Hamming Code algoritma test senaryoları
 *
 * Çalıştırmak için:
 *   node hamming-test.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { hammingEncode, extractDataBits } from './src/core/hammingEncoder.js';
import { injectError, calculateSyndrome, correctError } from './src/core/hammingDecoder.js';
import { getParityBitCount, getCodewordLength } from './src/core/bitUtils.js';

// ════════════════════════════════════════════════════════════════════════════
// ANSI renk kodları (terminal çıktısı için)
// ════════════════════════════════════════════════════════════════════════════
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  cyan:    '\x1b[36m',
  yellow:  '\x1b[33m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  blue:    '\x1b[34m',
  dim:     '\x1b[2m',
};

function color(text, ...codes) {
  return codes.join('') + text + C.reset;
}

// ════════════════════════════════════════════════════════════════════════════
// Test senaryoları
// ════════════════════════════════════════════════════════════════════════════
const SCENARIOS = [
  { label: ' 8-bit', data: '10110100',                                 bitLength: 8,  errorAt: 5  },
  { label: '16-bit', data: '1010110100110101',                         bitLength: 16, errorAt: 11 },
  { label: '32-bit', data: '10110100101101001011010010110100',          bitLength: 32, errorAt: 20 },
];

// ════════════════════════════════════════════════════════════════════════════
// Yardımcı: bit string'i görsel blok olarak formatla
// ════════════════════════════════════════════════════════════════════════════
function formatBits(codeword, original, parityPositions, errorPos = null, syndromePos = null) {
  const paritySet = new Set(parityPositions);
  return codeword.split('').map((bit, i) => {
    const pos = i + 1;
    const isParity = paritySet.has(pos);
    const isError  = pos === errorPos;
    const isSyndrome = pos === syndromePos;

    if (isError && isSyndrome) return color(`[${bit}]`, C.red, C.bold);     // hata + sendrom uyuştu
    if (isError)               return color(`{${bit}}`, C.red, C.bold);     // hatalı bit (düzeltilmemiş)
    if (isSyndrome)            return color(`<${bit}>`, C.green, C.bold);   // sendrom tarafından işaret edilen
    if (isParity)              return color(` ${bit} `, C.yellow);          // parity biti
    return color(` ${bit} `, C.dim);                                         // veri biti
  }).join('');
}

// ════════════════════════════════════════════════════════════════════════════
// Sonuç tablosu için veriler topla
// ════════════════════════════════════════════════════════════════════════════
function runScenario(scenario, verbose) {
  const { label, data, bitLength, errorAt } = scenario;
  const r = getParityBitCount(bitLength);
  const n = getCodewordLength(bitLength);

  console.log('\n' + color('═'.repeat(70), C.cyan));
  console.log(color(`  SENARYO: ${label} Veri  |  r=${r} parity  |  n=${n} bit codeword`, C.cyan, C.bold));
  console.log(color('═'.repeat(70), C.cyan));

  // ── 1. Encode ──────────────────────────────────────────────────────────────
  const encResult = hammingEncode(data, bitLength, verbose);
  const { codeword, parityPositions } = encResult;

  // ── 2. Error Injection ──────────────────────────────────────────────────────
  const errResult = injectError(codeword, errorAt, verbose);
  const { corrupted } = errResult;

  // ── 3. Syndrome ─────────────────────────────────────────────────────────────
  const synResult = calculateSyndrome(corrupted, bitLength, verbose);
  const { syndrome, errorPosition, parityCheckResults } = synResult;

  // ── 4. Correct ──────────────────────────────────────────────────────────────
  const corResult = correctError(corrupted, syndrome, verbose);
  const { corrected } = corResult;

  // ── 5. Verify ───────────────────────────────────────────────────────────────
  const recoveredData = extractDataBits(corrected, bitLength);
  const isCorrect     = recoveredData === data && corrected === codeword;

  return {
    label, data, bitLength, r, n,
    codeword, corrupted, corrected,
    errorAt, syndrome, errorPosition,
    parityCheckResults,
    recoveredData,
    isCorrect,
    parityPositions,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Özet tablosu yazdır
// ════════════════════════════════════════════════════════════════════════════
function printSummaryTable(results) {
  console.log('\n\n' + color('╔' + '═'.repeat(68) + '╗', C.bold));
  console.log(color('║' + '  ÖZET SONUÇ TABLOSU'.padEnd(68) + '║', C.bold));
  console.log(color('╚' + '═'.repeat(68) + '╝', C.bold));

  const COL = {
    label:     8,
    data:     34,
    codeword: 40,
    errorAt:   8,
    syndrome: 10,
    result:   10,
  };

  const header = [
    'Boyut'.padEnd(COL.label),
    'Giriş Veri'.padEnd(COL.data),
    'Codeword'.padEnd(COL.codeword),
    'Hata @'.padEnd(COL.errorAt),
    'Sendrom'.padEnd(COL.syndrome),
    'Sonuç',
  ].join(' │ ');

  console.log('\n' + color(header, C.bold));
  console.log('─'.repeat(header.length));

  for (const r of results) {
    const statusIcon = r.isCorrect ? color('✓ DOĞRU', C.green) : color('✗ YANLIŞ', C.red);
    const row = [
      r.label.padEnd(COL.label),
      r.data.padEnd(COL.data),
      r.codeword.padEnd(COL.codeword),
      String(r.errorAt).padEnd(COL.errorAt),
      String(r.syndrome).padEnd(COL.syndrome),
      statusIcon,
    ].join(' │ ');
    console.log(row);
  }

  console.log('\n' + color('Detaylar:', C.bold));
  for (const r of results) {
    console.log(`\n  ${color(r.label, C.cyan, C.bold)}`);
    console.log(`    Orijinal codeword : ${color(r.codeword, C.dim)}`);
    console.log(`    Hatalı codeword   : ${formatBits(r.corrupted, r.codeword, r.parityPositions, r.errorAt)}`);
    console.log(`    Düzeltilmiş       : ${formatBits(r.corrected, r.codeword, r.parityPositions, null, r.syndrome)}`);
    console.log(`    Sendrom (decimal) : ${color(String(r.syndrome), C.yellow)} → bit ${color(String(r.errorAt), C.red)} düzeltildi`);
    console.log(`    Kurtarılan veri   : ${color(r.recoveredData, C.green)}  ${r.isCorrect ? color('(== orijinal ✓)', C.green) : color('(FARKLI ✗)', C.red)}`);

    // Parity check tablosu
    const parityEntries = Object.entries(r.parityCheckResults);
    const synRow = parityEntries.map(([p, v]) => `S${p}=${v}`).join('  ');
    const synBin = parityEntries.map(([, v]) => v).join('');
    const synDec = parseInt(synBin, 2);
    // Not: sendrom bitleri küçükten büyüğe → ters çevirmeden doğrudan toplama
    console.log(`    Parity kontrol    : ${color(synRow, C.magenta)}`);
    console.log(`    Sendrom bitleri   : ${color(synBin, C.magenta)} = ${color(String(r.syndrome), C.yellow)} (decimal)`);
  }

  console.log('\n' + '─'.repeat(70));
  console.log(color('\nLegend:', C.bold));
  console.log(`  ${color('[bit]', C.red, C.bold)} = Hata enjekte edilen ve sendrom tarafından işaret edilen bit`);
  console.log(`  ${color('{bit}', C.red, C.bold)} = Hata enjekte edilen bit`);
  console.log(`  ${color('<bit>', C.green, C.bold)} = Sendrom ile düzeltilen bit`);
  console.log(`  ${color(' bit ', C.yellow)} = Parity biti`);
  console.log(`  ${color(' bit ', C.dim)}  = Veri biti`);
}

// ════════════════════════════════════════════════════════════════════════════
// ANA ÇALIŞMA
// ════════════════════════════════════════════════════════════════════════════

console.log(color('\n▓▓▓  HAMMING ERROR-CORRECTING CODE TEST  ▓▓▓', C.cyan, C.bold));
console.log(color('     8-bit, 16-bit, 32-bit senaryolar\n', C.cyan));

// verbose = true → adım adım console.log
const VERBOSE = true;
const results = SCENARIOS.map(s => runScenario(s, VERBOSE));

printSummaryTable(results);
