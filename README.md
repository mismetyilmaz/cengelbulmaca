# Çengel Bulmaca — Co-op

Linkle katılınan, birden fazla oyuncunun aynı çengel bulmacayı birlikte
çözdüğü, puan tablolu web tabanlı bulmaca oyunu.

## Klasör yapısı

```
cengel-bulmaca/
  index.html          -> tüm sayfa iskeleti (isim ekranı + oyun ekranı)
  style.css            -> kağıt/mürekkep temalı görünüm
  js/
    firebase-config.js -> Firebase bağlantı ayarları (SEN DOLDURACAKSIN)
    puzzle-data.js      -> bulmacanın yapısı (şu an yer tutucu örnek veri)
    scoring.js          -> puanlama mantığı
    puzzle-render.js     -> grid'i ekrana çizer
    game.js              -> Firebase senkronizasyonu, kelime doğrulama
    app.js                -> giriş noktası, isim ekranı, popover, skor tablosu
```

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

`js/puzzle-data.js` içindeki `PUZZLE_DATA` objesini kendi bulmacanla
değiştir. Format dosyanın başındaki yorumlarda açıklanıyor. Bir sonraki
adımda görseldeki gerçek bulmacayı bu formata çevireceğiz — muhtemelen
elle yazmak yerine kolaylaştıracak küçük bir yardımcı script de
ekleyebiliriz.

## Akış

1. **Link `?room` parametresi olmadan açılırsa** → Oda Kurulum Ekranı:
   boyut (küçük/orta/büyük), dil (TR/EN), maksimum oyuncu sayısı, opsiyonel
   parola seçilir. "Oda Oluştur" → oda Firebase'e yazılır, URL güncellenir,
   kurucu doğrudan isim ekranına geçer (parola sorulmaz, zaten kendisi
   belirledi) ve linki kopyalayabileceği bir banner görür.

2. **Link `?room=XXXXXX` ile açılırsa** → oda ayarları Firebase'den
   okunur. Oda bulunamazsa hata + "yeni oda kur" linki gösterilir.
   Odada parola varsa isim ekranına parola alanı da eklenir. Oda doluysa
   ("maksimum oyuncu" sınırına ulaşılmışsa) katılım reddedilir.

3. İsim (+ gerekirse parola) girilip "Bulmacaya Katıl" ile onaylanınca
   oyun ekranına geçilir.

Sağ üstteki küçük gösterge (● Bağlı / ● Bağlantı yok) Firebase
bağlantısının o an çalışıp çalışmadığını gösterir — "Onayla" butonuna
basınca hiçbir şey olmuyorsa önce burayı kontrol et.

## Şu ana kadar çalışan mekanikler

- Oda kurulum ekranı: boyut / dil / max oyuncu / parola seçimi
- Link ile katılım, lobi yok (`?room=xxxx` URL parametresi)
- Parola korumalı ve/veya kapasiteli odalar
- İsim girişi ve oyuncu kimliğinin cihazda kalıcı tutulması
- İpucuna tıklayınca kelime giriş kutusunun açılması
- Kesişen hücrelerin, çözülmüş başka bir kelimeden otomatik dolu gelmesi
- Doğru/yanlış kontrolü (yanlışta kutu boş kalır, tekrar denenebilir)
- Kesişimden zaten dolu olan harfleri hariç tutan puanlama
- Gerçek zamanlı skor tablosu ve ilerleme çubuğu
- Bağlantı durumu göstergesi + Firebase isteklerinde 8 saniyelik timeout
  (böylece yanlış/eksik Firebase ayarında "Onayla" sonsuza dek asılı kalmaz,
  hata mesajı gösterir)

## "Onayla" çalışmıyordu — neden ve ne değişti

En olası sebep: `js/firebase-config.js` içindeki `FIREBASE_CONFIG` hâlâ
yer tutucu (placeholder) değerlerdeyse, Firebase'e yazma isteği hiç
cevap vermez ve `await` satırında sonsuza dek bekler — hata da
göstermez, konsolda bile bir şey görünmeyebilir. Şimdi:

- İsteklere 8 saniyelik zaman aşımı eklendi, süre dolunca kullanıcıya
  "Sunucudan yanıt gelmedi, firebase-config.js ayarlarını kontrol et"
  mesajı gösteriliyor.
- Sağ üstte sürekli görünen bağlantı göstergesi eklendi.
- `submitAnswer` artık try/catch ile sarılı; hata olursa buton eski
  haline dönüyor ve mesaj popover'da gösteriliyor.

Yani buton hâlâ tepki vermiyorsa, önce `firebase-config.js`'i gerçek
proje bilgilerinle doldurduğundan ve Realtime Database kurallarının
`.read`/`.write: true` (test aşaması için) olduğundan emin ol.

## Sırada ne var

- Gerçek bulmaca verisinin `puzzle-data.js` / `PUZZLE_CATALOG` formatına
  işlenmesi (şu an tüm boyutlar kesişimsiz, otomatik üretilmiş yer tutucu)
- Bulmaca bitince ("tüm kelimeler çözüldü") bir final ekranı
- Oyuncu sayısı / aktif olma göstergesi (kim şu an bağlı)
- Parolanın düz metin yerine hash'lenmesi (şu an basit karşılaştırma,
  arkadaş grubu kullanımı için yeterli ama güvenli şifreleme değil)
