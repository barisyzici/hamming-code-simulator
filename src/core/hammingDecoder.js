/**
 * hammingDecoder.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Hamming Code hata enjeksiyonu, sendrom hesaplama ve hata düzeltme modülü.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  getParityBitCount,
  getParityPositions,
  getCoveredPositions,
  xorAtPositions,
} from './bitUtils.js';

/**
 * Codeword'ün belirtilen pozisyonundaki biti flip eder (0→1 veya 1→0).
 * Belleğe yazma sırasında oluşabilecek tek bitlik hatayı simüle eder.
 *
 * @param {string} codeword    - Orijinal Hamming codeword (binary string)
 * @param {number} bitPosition - Flip edilecek pozisyon (1-indexed)
 * @param {boolean} [verbose=false]
 * @returns {{
 *   corrupted:   string,  // Hatalı codeword
 *   position:    number,  // Hata pozisyonu
 *   originalBit: number,  // Orijinal bit değeri
 *   flippedBit:  number,  // Flip sonrası bit değeri
 * }}
 */
export function injectError(codeword, bitPosition, verbose = false) {
  if (bitPosition < 1 || bitPosition > codeword.length) {
    throw new RangeError(
      `Geçersiz bit pozisyonu: ${bitPosition}. Geçerli aralık: 1–${codeword.length}`
    );
  }

  const bits       = codeword.split('');
  const idx        = bitPosition - 1; // 0-indexed dönüşüm
  const originalBit = parseInt(bits[idx], 10);
  const flippedBit  = originalBit ^ 1; // XOR ile flip: 0→1, 1→0

  bits[idx] = String(flippedBit);
  const corrupted = bits.join('');

  if (verbose) {
    console.log('\n' + '─'.repeat(60));
    console.log(`  HATA ENJEKSİYONU  |  Pozisyon: ${bitPosition}`);
    console.log('─'.repeat(60));
    console.log(`  Orijinal  : "${codeword}"`);
    console.log(`  Pozisyon  : ${bitPosition} (0-indexed: ${idx})`);
    console.log(`  Bit değişimi: ${originalBit} → ${flippedBit}  (XOR 1)`);
    console.log(`  Hatalı    : "${corrupted}"`);
    // Farkı görsel olarak göster
    const diffArr = codeword.split('').map((b, i) =>
      i === idx ? `[${flippedBit}]` : ` ${b} `
    ).join('');
    console.log(`  Fark      :  ${diffArr}`);
  }

  return { corrupted, position: bitPosition, originalBit, flippedBit };
}

/**
 * Alınan (muhtemelen hatalı) codeword üzerinde sendrom hesaplar.
 *
 * Algoritma:
 *  Her parity pozisyonu P_k için:
 *    S_k = XOR { alınan_bit[j] | (j & k) !== 0 }   (kendi pozisyonu dahil)
 *  Eğer S_k = 1 → bu parity kontrolü başarısız.
 *
 *  Sendrom = S_r...S_4 S_2 S_1  (binary sayı → decimal = hatalı bit pozisyonu)
 *
 *  Özel durumlar:
 *    sendrom = 0  → Hata yok
 *    sendrom ≠ 0  → sendrom değeri hatalı bit pozisyonunu gösterir
 *
 * @param {string} receivedWord  - Alınan codeword (binary string)
 * @param {number} dataLength    - Orijinal veri uzunluğu (8, 16, 32)
 * @param {boolean} [verbose=false]
 * @returns {{
 *   syndrome:          number,           // Sendrom değeri (decimal)
 *   syndromeBinary:    string,           // Sendrom (binary string)
 *   errorPosition:     number | null,    // Hatalı bit pozisyonu (null = hata yok)
 *   parityCheckResults: Record<number, number>, // { 1: 0, 2: 1, ... }
 * }}
 */
export function calculateSyndrome(receivedWord, dataLength, verbose = false) {
  const r = getParityBitCount(dataLength);
  const n = receivedWord.length;

  if (verbose) {
    console.log('\n' + '─'.repeat(60));
    console.log(`  SENDROM HESAPLAMA  |  veri=${dataLength} bit, n=${n}`);
    console.log('─'.repeat(60));
    console.log(`  Alınan kelime: "${receivedWord}"`);
    console.log('\n  Parity kontrol adımları:');
  }

  // 1-indexed bit dizisi (index 0 boş bırakılır)
  const received = [0, ...receivedWord.split('').map(Number)];

  const parityPositions   = getParityPositions(r);
  const parityCheckResults = {};
  let syndrome = 0;

  for (const p of parityPositions) {
    // Kendi pozisyonu DAHİL tüm kapsanan pozisyonları XOR'la
    const covered = getCoveredPositions(p, n, /*includeSelf=*/true);
    const sVal    = xorAtPositions(received, covered);
    parityCheckResults[p] = sVal;

    // Sendroma katkı: eğer S_k = 1, syndrome'ye p eklenir
    if (sVal === 1) {
      syndrome += p;
    }

    if (verbose) {
      const covStr = covered.map(c => `b[${c}]=${received[c]}`).join(' ⊕ ');
      const status = sVal === 0 ? '✓ OK' : '✗ HATA';
      console.log(`    S${String(p).padEnd(2)} = XOR(${covered.join(',')}) = ${sVal}  ${status}`);
      if (verbose) {
        console.log(`         ${covStr}`);
      }
    }
  }

  // Sendrom binary gösterimi (MSB → LSB: en büyük parity biti solda)
  const syndromeBinary = syndrome.toString(2).padStart(r, '0');
  const errorPosition  = syndrome === 0 ? null : syndrome;

  if (verbose) {
    console.log(`\n  Sendrom bitleri : [${parityPositions.map(p => parityCheckResults[p]).join(', ')}]`);
    console.log(`  Sendrom (binary): ${syndromeFormatBinary(parityPositions, parityCheckResults)}`);
    console.log(`  Sendrom (decimal): ${syndrome}`);
    if (syndrome === 0) {
      console.log('  ✓ Hata YOK — codeword sağlıklı');
    } else {
      console.log(`  ✗ Hata TESPİT EDİLDİ → Bit pozisyonu: ${syndrome}`);
    }
  }

  return { syndrome, syndromeBinary, errorPosition, parityCheckResults };
}

/**
 * Sendrom değerine göre hatalı biti düzeltir.
 *
 * sendrom = hatalı bit pozisyonu (1-indexed)
 * Düzeltme: o pozisyondaki biti flip et.
 *
 * @param {string} receivedWord  - Hatalı codeword (binary string)
 * @param {number} syndrome      - calculateSyndrome'den gelen sendrom değeri
 * @param {boolean} [verbose=false]
 * @returns {{
 *   corrected:      string,        // Düzeltilmiş codeword
 *   errorPosition:  number | null, // Düzeltilen pozisyon (null = hata yoktu)
 *   correctedBit:   number | null, // Düzeltme sonrası bit değeri
 * }}
 */
export function correctError(receivedWord, syndrome, verbose = false) {
  if (verbose) {
    console.log('\n' + '─'.repeat(60));
    console.log('  HATA DÜZELTMESİ');
    console.log('─'.repeat(60));
  }

  if (syndrome === 0) {
    if (verbose) {
      console.log('  Sendrom = 0 → Düzeltme gerekmiyor.');
      console.log(`  Sonuç: "${receivedWord}"`);
    }
    return { corrected: receivedWord, errorPosition: null, correctedBit: null };
  }

  if (syndrome > receivedWord.length) {
    if (verbose) {
      console.log(`  ⚠ Sendrom ${syndrome} > codeword uzunluğu ${receivedWord.length}`);
      console.log('  Parity bitindeki hata düzeltilemez (veri kaybı yok).');
    }
    return { corrected: receivedWord, errorPosition: syndrome, correctedBit: null };
  }

  const bits        = receivedWord.split('');
  const idx         = syndrome - 1; // 0-indexed
  const before      = parseInt(bits[idx], 10);
  bits[idx]         = String(before ^ 1); // XOR ile flip
  const after       = parseInt(bits[idx], 10);
  const corrected   = bits.join('');

  if (verbose) {
    console.log(`  Hatalı bit pozisyonu (sendrom): ${syndrome}`);
    console.log(`  Bit değeri: ${before} → ${after}  (flip)`);
    console.log(`  Hatalı   : "${receivedWord}"`);
    console.log(`  Düzeltilmiş: "${corrected}"`);
    const diffArr = receivedWord.split('').map((b, i) =>
      i === idx ? `[${after}]` : ` ${b} `
    ).join('');
    console.log(`  Fark     :  ${diffArr}`);
  }

  return { corrected, errorPosition: syndrome, correctedBit: after };
}

// ── İç yardımcı ─────────────────────────────────────────────────────────────

/**
 * Parity check sonuçlarını okunabilir binary format'a çevirir.
 * Örn: { 1:0, 2:1, 4:0, 8:0 } → "S8=0 S4=0 S2=1 S1=0"
 */
function syndromeFormatBinary(parityPositions, results) {
  return [...parityPositions]
    .reverse()
    .map(p => `S${p}=${results[p]}`)
    .join(' ');
}
