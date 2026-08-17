/**
 * TEXT-UTILS.js
 * ------------------------------------------------------------------
 * Türkçe kelimelerde büyük harfe çevirme (ı/İ, ş/Ş, ğ/Ğ, ü/Ü, ö/Ö, ç/Ç)
 * İngilizce'den farklı davranır (örn. "i".toUpperCase() normalde "I"
 * verir ama Türkçe kurallarında "İ" olması gerekir — ve tam tersi
 * İngilizce kelimede "i" harfini "İ" yapmak hataya yol açar).
 * Bu yüzden hangi dilde işlem yaptığımızı bilerek doğru locale'i seçiyoruz.
 */

const TextUtils = {
  /**
   * @param {string} str
   * @param {"tr"|"en"} lang
   */
  upper(str, lang) {
    if (!str) return "";
    return lang === "tr"
      ? str.toLocaleUpperCase("tr-TR")
      : str.toUpperCase();
  }
};
