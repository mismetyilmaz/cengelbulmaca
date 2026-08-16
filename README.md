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

## Şu ana kadar çalışan mekanikler

- Link ile katılım, lobi yok (`?room=xxxx` URL parametresi)
- İsim girişi ve oyuncu kimliğinin cihazda kalıcı tutulması
- İpucuna tıklayınca kelime giriş kutusunun açılması
- Kesişen hücrelerin, çözülmüş başka bir kelimeden otomatik dolu gelmesi
- Doğru/yanlış kontrolü (yanlışta kutu boş kalır, tekrar denenebilir)
- Kesişimden zaten dolu olan harfleri hariç tutan puanlama
- Gerçek zamanlı skor tablosu ve ilerleme çubuğu

## Sırada ne var

- Gerçek bulmaca verisinin `puzzle-data.js` formatına işlenmesi
- Bulmaca bitince ("tüm kelimeler çözüldü") bir final ekranı
- Oyuncu sayısı / aktif olma göstergesi (kim şu an bağlı)
