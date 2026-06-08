/**
 * hammingEncoder.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hamming Code enkodlama modülü.
 *
 * Desteklenen veri boyutları:
 *   8-bit  →  4 parity bit →  12-bit codeword
 *   16-bit →  5 parity bit →  21-bit codeword
 *   32-bit →  6 parity bit →  38-bit codeword
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  getParityBitCount,
  getCodewordLength,
  getParityPositions,
  getDataPositions,
  getCoveredPositions,
  xorAtPositions,
} from './bitUtils.js';

/**
 * Veri bitlerini Hamming Code'a dönüştürür.
 *
 * Algoritma adımları:
 *  1. r = parity bit sayısını hesapla (2^r >= m + r + 1)
 *  2. n = m + r toplam codeword uzunluğunu belirle
 *  3. Codeword dizisini sıfırla (1-indexed)
 *  4. Veri bitlerini parity-olmayan pozisyonlara yerleştir
 *  5. Her P_k için: kapsadığı pozisyonların XOR'u = parity değeri
 *  6. Codeword string olarak döndür
 *
 * @param {string} dataBits   - Binary veri string'i ("10110100" gibi)
 * @param {number} bitLength  - 8, 16 veya 32
 * @param {boolean} [verbose=false] - true ise adım adım console.log yazar
 * @returns {{
 *   codeword:        string,   // Hamming code (binary string)
 *   parityPositions: number[], // Parity bit pozisyonları [1,2,4,...]
 *   dataPositions:   number[], // Veri bit pozisyonları [3,5,6,7,...]
 *   parityValues:    Object,   // { 1: 0, 2: 1, 4: 0, ... }
 *   n: number,                 // Toplam codeword uzunluğu
 *   r: number,                 // Parity bit sayısı
 * }}
 */
export function hammingEncode(dataBits, bitLength, verbose = false) {
  const m = bitLength;
  const r = getParityBitCount(m);
  const n = getCodewordLength(m);

  if (verbose) {
    console.log('\n' + '═'.repeat(60));
    console.log(`  HAMMING ENCODE  |  ${m}-bit veri`);
    console.log('═'.repeat(60));
    console.log(`  Giriş verisi  : "${dataBits}"`);
    console.log(`  Veri biti (m) : ${m}`);
    console.log(`  Parity bit (r): ${r}  [2^${r}=${1 << r} >= ${m}+${r}+1=${m + r + 1}]`);
    console.log(`  Codeword (n)  : ${n}  [n = m+r = ${m}+${r}]`);
  }

  // ── Adım 1: 1-indexed codeword dizisi (index 0 kullanılmaz) ──────────────
  const codeword = new Array(n + 1).fill(0);

  // ── Adım 2: Parity ve veri pozisyonlarını belirle ─────────────────────────
  const parityPositions = getParityPositions(r);  // [1, 2, 4, 8, ...]
  const dataPositions   = getDataPositions(n, r); // [3, 5, 6, 7, ...]

  if (verbose) {
    console.log(`\n  Parity pozisyonları : [${parityPositions.join(', ')}]`);
    console.log(`  Veri   pozisyonları : [${dataPositions.join(', ')}]`);
    console.log('\n  ── Veri bitleri yerleştirme ──');
  }

  // ── Adım 3: Veri bitlerini yerleştir ──────────────────────────────────────
  for (let i = 0; i < dataPositions.length; i++) {
    const pos  = dataPositions[i];
    const bit  = parseInt(dataBits[i], 10);
    codeword[pos] = bit;
    if (verbose) {
      console.log(`    Pozisyon [${String(pos).padStart(2)}] = D${i + 1} = ${bit}  (veri[${i}])`);
    }
  }

  // ── Adım 4: Her parity bitini XOR ile hesapla ─────────────────────────────
  if (verbose) {
    console.log('\n  ── Parity bit hesaplama (even parity) ──');
  }

  const parityValues = {};

  for (const p of parityPositions) {
    // P_p, pozisyon j'nin binary gösteriminde p biti SET olan tüm pozisyonları kapsar.
    // Kendi pozisyonu (p) hariç: XOR'dan çıkar, sonuç parity değeri olur.
    const covered = getCoveredPositions(p, n, /*includeSelf=*/false);
    const pVal    = xorAtPositions(codeword, covered);
    codeword[p]   = pVal;
    parityValues[p] = pVal;

    if (verbose) {
      const covStr = covered.map(c => `[${c}]=${codeword[c]}`).join(' ⊕ ');
      console.log(`    P${String(p).padEnd(2)} = XOR(${covered.join(',')}) = ${covStr} = ${pVal}`);
    }
  }

  // ── Adım 5: Sonuç ─────────────────────────────────────────────────────────
  const result = codeword.slice(1).join('');

  if (verbose) {
    console.log('\n  ── Codeword pozisyon haritası ──');
    const header = Array.from({ length: n }, (_, i) => String(i + 1).padStart(3)).join('');
    const bits   = codeword.slice(1).map((b, i) => {
      const pos = i + 1;
      const label = parityPositions.includes(pos) ? 'P' : 'D';
      return `${label}${b}`.padStart(3);
    }).join('');
    console.log(`    Pos: ${header}`);
    console.log(`    Bit: ${bits}`);
    console.log(`\n  ✓ CODEWORD: "${result}"`);
  }

  return {
    codeword: result,
    parityPositions,
    dataPositions,
    parityValues,
    n,
    r,
  };
}

/**
 * Hamming codeword'dan orijinal veri bitlerini çıkarır.
 * Parity pozisyonları (2'nin kuvvetleri) atlanır.
 *
 * @param {string} codeword    - Hamming codeword (binary string)
 * @param {number} bitLength   - Orijinal veri uzunluğu (8, 16, 32)
 * @returns {string}           - Orijinal veri bitleri
 */
export function extractDataBits(codeword, bitLength) {
  const r = getParityBitCount(bitLength);
  const paritySet = new Set(getParityPositions(r));
  let dataBits = '';
  for (let i = 1; i <= codeword.length; i++) {
    if (!paritySet.has(i)) {
      dataBits += codeword[i - 1];
    }
  }
  return dataBits;
}
