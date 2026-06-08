/**
 * Hamming Code algoritması için bit manipülasyonları içeren yardımcı fonksiyonlar.
 *
 * @param {number} dataLength - Veri biti sayısı
 * @returns {number} Parity bit sayısı r
 */
export function getParityBitCount(dataLength) {
  let r = 0;
  while ((1 << r) < dataLength + r + 1) {
    r++;
  }
  return r;
}

/**
 * Toplam codeword uzunluğunu döndürür: n = m + r
 *
 * @param {number} dataLength - Veri biti sayısı
 * @returns {number} Toplam codeword uzunluğu
 */
export function getCodewordLength(dataLength) {
  const r = getParityBitCount(dataLength);
  return dataLength + r;
}

/**
 * Bir sayının 2'nin kuvveti olup olmadığını kontrol eder.
 * Parity bit pozisyonları her zaman 2'nin kuvvetleridir: 1, 2, 4, 8, 16, 32…
 *
 * Bit trick: n & (n-1) === 0 ↔ n is power of 2
 *
 * @param {number} n
 * @returns {boolean}
 */
export function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * r adet parity bit pozisyonunu döndürür.
 * Pozisyonlar 2'nin kuvvetleri: [1, 2, 4, 8, …]
 *
 * @param {number} r - Parity bit sayısı
 * @returns {number[]} Parity pozisyonları dizisi
 */
export function getParityPositions(r) {
  return Array.from({ length: r }, (_, i) => 1 << i);
}

/**
 * n uzunluğundaki codeword içindeki veri bit pozisyonlarını döndürür.
 * Parity pozisyonları (2'nin kuvvetleri) hariç tüm pozisyonlar.
 *
 * @param {number} n - Toplam codeword uzunluğu
 * @param {number} r - Parity bit sayısı
 * @returns {number[]} Veri bit pozisyonları dizisi (1-indexed)
 */
export function getDataPositions(n, r) {
  const paritySet = new Set(getParityPositions(r));
  return Array.from({ length: n }, (_, i) => i + 1).filter(pos => !paritySet.has(pos));
}

/**
 * p parity bitinin kapsadığı tüm pozisyonları döndürür.
 * Kural: pozisyon j, P_p'nin kapsamındaysa → (j & p) !== 0
 *
 * @param {number} p  - Parity bit pozisyonu (1, 2, 4, 8, …)
 * @param {number} n  - Toplam codeword uzunluğu
 * @param {boolean} [includeSelf=true] - Parity pozisyonunun kendisi dahil mi?
 * @returns {number[]} Kapsanan pozisyonlar
 */
export function getCoveredPositions(p, n, includeSelf = true) {
  const positions = [];
  for (let j = 1; j <= n; j++) {
    if ((j & p) !== 0) {
      if (!includeSelf && j === p) continue;
      positions.push(j);
    }
  }
  return positions;
}

/**
 * Bir bit dizisinin belirli pozisyonlarındaki bitlerin XOR'unu hesaplar.
 *
 * @param {number[]} bits - 1-indexed bit dizisi (bits[0] kullanılmaz)
 * @param {number[]} positions - XOR'lanacak pozisyonlar
 * @returns {number} 0 veya 1
 */
export function xorAtPositions(bits, positions) {
  return positions.reduce((acc, pos) => acc ^ bits[pos], 0);
}

/**
 * Binary string'i 0-padded olarak belirtilen uzunluğa getirir.
 *
 * @param {string} binStr - Binary string
 * @param {number} length - İstenen uzunluk
 * @returns {string}
 */
export function padBinary(binStr, length) {
  return binStr.padStart(length, '0');
}

/**
 * Decimal sayıyı binary string'e çevirir.
 *
 * @param {number} n
 * @returns {string}
 */
export function decToBin(n) {
  return n.toString(2);
}
