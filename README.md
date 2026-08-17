# Çengel Bulmaca — Co-op

Linkle katılınan, birden fazla oyuncunun aynı çengel bulmacayı birlikte
çözdüğü, puan tablolu web tabanlı bulmaca oyunu.

## Klasör yapısı

```
cengel-bulmaca/
  index.html              -> tüm sayfa iskeleti
  style.css                -> kağıt/mürekkep temalı görünüm
  js/
    firebase-config.js     -> Firebase bağlantı ayarları (SEN DOLDURACAKSIN)
    room.js                 -> oda oluşturma, parola/kapasite kontrolü, bağlantı durumu
    text-utils.js            -> TR/EN'e duyarlı büyük harf dönüşümü
    crossword-builder.js      -> kelime listesinden otomatik kesişimli grid üretir
    puzzle-library.js          -> seviye (A1-C2) + yön (tr_en/en_tr) bazlı 20'şer slotluk kütüphane
    puzzle-content.js           -> GERÇEK KELİME LİSTELERİNİ BURAYA EKLEYECEKSİN
    scoring.js                   -> puanlama mantığı
    puzzle-render.js               -> grid'i ekrana çizer
    game.js                         -> Firebase senkronizasyonu, kelime doğrulama
    app.js                           -> giriş noktası, oda kurulumu, popover, skor tablosu
```

## Akış

1. **Link `?room` parametresi olmadan açılırsa** → Oda Kurulum Ekranı:
   çeviri yönü (Türkçe→İngilizce / İngilizce→Türkçe), seviye (A1-C2),
   maksimum oyuncu sayısı, opsiyonel parola seçilir. "Oda Oluştur"a
   basınca o seviye+yön için kayıtlı 20 bulmacadan biri **rastgele**
   seçilir, oda Firebase'e yazılır, kurucu isim ekranına geçer ve
   linki kopyalayabileceği bir banner görür.

2. **Link `?room=XXXXXX` ile açılırsa** → oda ayarları Firebase'den
   okunur, ilgili bulmaca verisi `puzzle-library.js` üzerinden bulunur.
   Oda bulunamazsa hata, doluysa/parolası yanlışsa katılım reddedilir.

3. İsim (+ gerekirse parola) girilip "Bulmacaya Katıl" ile onaylanınca
   oyun ekranına geçilir.

Sağ üstteki küçük gösterge (● Bağlı / ● Bağlantı yok) Firebase
bağlantısının o an çalışıp çalışmadığını gösterir.

## Kelime listesi ekleme — SIRADAKİ ADIM

`js/puzzle-content.js` dosyasını aç. İçinde bir örnek (`A1`, `tr_en`,
slot `0`) zaten kayıtlı, mekanizmanın çalıştığını göstermek için.
Aynı formatta devam et:

```js
registerPuzzle("A1", "tr_en", 1, [
  { clue: "Kırmızı meyve", answer: "APPLE" },
  { clue: "Gökyüzünün rengi", answer: "BLUE" },
  // ...
], "A1 — Temel Kelimeler #2");
```

- `level`: `"A1" | "A2" | "B1" | "B2" | "C1" | "C2"`
- `direction`: `"tr_en"` (ipucu Türkçe, cevap İngilizce) veya `"en_tr"` (tersi)
- `index`: `0`-`19` arası (her seviye+yön için 20 slot var)
- `answer`: **boşluksuz tek kelime** olmalı (grid mantığı gereği).
  Boşluklu/numaralı girişler otomatik atlanır, konsolda uyarı basılır.

Grid'i elle tasarlaman gerekmiyor — `crossword-builder.js` kelimeleri
ortak harflerden kesişerek (bazısı sağa, bazısı aşağı) otomatik
yerleştiriyor, kesişim bulamadığı kelimeleri bağımsız bir satıra koyuyor.

Bir (seviye, yön) kombinasyonunda hiç slot doldurulmamışsa, oda
kurulum ekranında o kombinasyon seçildiğinde "Bu seviye için henüz
bulmaca eklenmedi" uyarısı gösterilir, site çökmez.

## 1) Firebase kurulumu

1. https://console.firebase.google.com adresinden yeni proje oluştur
   (ya da CityHive'da kullandığın projeyi kullan).
2. **Build > Realtime Database > Create Database** ile bir Realtime
   Database oluştur.
3. Test aşamasında kuralları geçici olarak aç:
   ```json
   { "rules": { ".read": true, ".write": true } }
   ```
4. **Project settings > General > Your apps** kısmından bir Web App
   ekle, sana verilen config objesini `js/firebase-config.js` dosyasındaki
   `FIREBASE_CONFIG` içine yapıştır.

## 2) Yerelde test etme

Statik dosyalar olduğu için basit bir local server yeterli:

```bash
cd cengel-bulmaca
npx serve .
# veya
python3 -m http.server 5500
```

Tarayıcıda `http://localhost:5500` adresini aç. İkinci bir sekmede
aynı adrese `?room=xxxx` parametresiyle (ilk sekmenin URL'sini kopyalayarak)
girip iki oyuncuyla test edebilirsin.

## 3) GitHub Pages'e yayınlama

```bash
git init
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin <repo-url>
git push -u origin main
```

Sonra GitHub repo ayarlarında **Settings > Pages > Source: main branch /
(root)** seçeneğini işaretle. Birkaç dakika içinde
`https://<kullanici-adin>.github.io/<repo-adi>/` adresinden erişilebilir olur.

## 4) Bulmaca verisini değiştirme

Bkz. yukarıdaki "Kelime listesi ekleme" bölümü — `js/puzzle-content.js`
içine `registerPuzzle(...)` çağrıları ekleyerek yapılıyor.

## Şu ana kadar çalışan mekanikler

- Oda kurulum ekranı: çeviri yönü / seviye / max oyuncu / parola seçimi
- Seviye+yön başına 20 bulmacalık havuzdan rastgele seçim
- Otomatik kesişimli (sağa + aşağı karışık) grid üretimi
- Link ile katılım, lobi yok (`?room=xxxx` URL parametresi)
- Parola korumalı ve/veya kapasiteli odalar
- İsim girişi ve oyuncu kimliğinin cihazda kalıcı tutulması
- İpucuna tıklayınca kelime giriş kutusunun açılması
- Kesişen hücrelerin, çözülmüş başka bir kelimeden otomatik dolu gelmesi
- Doğru/yanlış kontrolü (yanlışta kutu boş kalır, tekrar denenebilir)
- Kesişimden zaten dolu olan harfleri hariç tutan puanlama
- Gerçek zamanlı skor tablosu ve ilerleme çubuğu
- Bağlantı durumu göstergesi + Firebase isteklerinde 8 saniyelik timeout

## Sırada ne var

- `js/puzzle-content.js` içine gerçek kelime listelerinin eklenmesi
  (her seviye+yön için 20'şer, toplam 240 bulmaca)
- Bulmaca bitince ("tüm kelimeler çözüldü") bir final ekranı
- Oyuncu sayısı / aktif olma göstergesi (kim şu an bağlı)
- Parolanın düz metin yerine hash'lenmesi (şu an basit karşılaştırma,
  arkadaş grubu kullanımı için yeterli ama güvenli şifreleme değil)

## Grid üretimi (güncellendi)

`crossword-builder.js` gazete eki tarzı dörtgen, kesişimli grid üretir:

- Birden fazla kelime sırası dener, en yoğun + en bağlantılı sonucu seçer
- Her kelime için tüm kesişim adaylarını skorlar (örtüşme, alan, en-boy oranı)
- Kesişmeyen kelimeleri izole satıra atmaz — yoğunluğu korumak için atlar
- Boş hücreler `block` olarak işaretlenir (dörtgen dolgu)

**İyi bulmaca için ipuçları** (`puzzle-content.js`):
- 10–16 kelime ideal (80 kelimelik listeler grid’i seyreltir)
- Ortak harfleri bol kelimeler seç (A, E, R, T, S, N, L…)
- `answer` boşluksuz tek kelime olmalı
