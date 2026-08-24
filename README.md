# Çengel Bulmaca — Co-op

Linkle katılınan, birden fazla oyuncunun aynı çengel bulmacayı birlikte
çözdüğü, puan tablolu web tabanlı bulmaca oyunu. Bulmacalar **Bulmaca
Stüdyosu**'nda (admin.html) elle tasarlanır, Firebase'e kaydedilir ve
oyun ekranından (index.html) oynanır.

## Klasör yapısı

```
cengel-bulmaca/
  index.html          -> OYUN ekranı (oda kurulumu + bulmaca çözme)
  admin.html            -> BULMACA STÜDYOSU (bulmaca tasarlama + kaydetme)
  style.css              -> ortak kağıt/mürekkep teması (ikisi de kullanır)
  admin.css               -> sadece stüdyoya özel stiller
  js/
    firebase-config.js   -> Firebase bağlantı ayarları (SEN DOLDURACAKSIN)
    room.js                -> oda oluşturma, parola/kapasite kontrolü, bağlantı durumu
    text-utils.js            -> TR/EN'e duyarlı büyük harf dönüşümü
    puzzle-library.js          -> Firebase'den bulmaca okuma/yazma yardımcıları
    puzzle-render.js             -> grid'i ekrana çizer (oyun VE stüdyo ortak kullanır)
    scoring.js                     -> puanlama mantığı
    game.js                         -> Firebase senkronizasyonu, kelime doğrulama (SADECE oyun)
    app.js                           -> oyun ekranının giriş noktası
    admin.js                          -> Bulmaca Stüdyosu'nun tüm mantığı
```

## Bulmaca Stüdyosu — nasıl çalışır

`admin.html`'i aç (yerelde `http://localhost:5500/admin.html`):

1. **Kurulum**: Seviye (A1-C2), çeviri yönü (TR→EN / EN→TR), başlık,
   satır × sütun sayısı seç (örn. 10×12). "Grid Oluştur"a bas.
2. Karşına boş bir grid çıkar. **Herhangi bir hücreye tıkla** — sağ
   panelde o hücre için bir ipucu editörü açılır:
   - **Yön seç** (4 buton): → sağa · ↓ aşağı · ⤷ alt kutudan sağa ·
     ⤵ sağ kutudan aşağıya
   - **İpucu metni** yaz
   - **Cevap** yaz (boşluksuz, tek kelime)
   - **Kaydet**'e bas — cevap otomatik olarak ilgili hücrelere
     yerleşir, kesişen başka bir kelime varsa (ortak harf) otomatik
     doğrulanır; harfler çakışırsa hata mesajı gösterilir, kaydetmez.
   - Aynı hücreye **ikinci bir ipucu** da ekleyebilirsin (görseldeki
     gibi üst üste iki ipucu, örn. "Gönüllü oldu / Atlı spor").
3. Gridi tamamen doldurana kadar hücre hücre devam et. İstediğin an
   bir kelimeyi silip (Sil butonu) yeniden yazabilirsin.
4. Sağ altta **"Bulmacayı Kaydet"** — seçtiğin seviye+yön için boş
   olan ilk slotu otomatik bulur (0-19 arası, her seviye+yön için 20
   slot var) ve Firebase'e yazar.
5. Kaydettikten sonra bulmaca **anında oynanabilir** hâle gelir —
   index.html'de o seviye+yönü seçen biri, oda kurduğunda rastgele
   seçilebilecek bulmacalar arasına girer.

### 4 ok yönünün anlamı

- **→ sağa**: cevap, ipucu kutusunun SAĞINDAKİ hücreden başlar, sağa okunur
- **↓ aşağı**: cevap, ipucu kutusunun ALTINDAKİ hücreden başlar, aşağı okunur
- **⤷ alt kutudan sağa**: cevap ALTTAKİ hücreden başlar ama SAĞA okunur
  (kutunun hemen altı boşsa ve cevap yana doğru devam edecekse kullanılır)
- **⤵ sağ kutudan aşağıya**: cevap SAĞDAKİ hücreden başlar ama AŞAĞI okunur

Bu 4 yön sayesinde gerçek çengel bulmacalardaki gibi **hiç boş/siyah
kare olmadan**, tamamen dolu bir dikdörtgen bulmaca tasarlayabilirsin —
otomatik üretim algoritmalarının veremediği yoğunluk bu şekilde elde
ediliyor.

## 1) Firebase kurulumu

1. https://console.firebase.google.com adresinden yeni proje oluştur.
2. **Build > Realtime Database > Create Database** ile bir Realtime
   Database oluştur.
3. Test aşamasında kuralları geçici olarak aç:
   ```json
   { "rules": { ".read": true, ".write": true } }
   ```
   Değiştirdikten sonra **Publish**'e basmayı unutma.
4. **Project settings > General > Your apps** kısmından bir Web App
   ekle, config objesini `js/firebase-config.js` içine yapıştır.

## 2) Yerelde test etme

```bash
cd cengel-bulmaca
npx serve .
```

- `http://localhost:5500/admin.html` → bulmaca tasarla, kaydet
- `http://localhost:5500/` → oyunu aç, aynı seviye+yönü seçip test et

İki oyuncuyla test etmek için ikinci bir sekmede, ilk sekmenin
paylaşım linkini (`?room=xxxx` içeren URL) aç.

## 3) GitHub Pages'e yayınlama

```bash
git init
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin <repo-url>
git push -u origin main
```

GitHub repo ayarlarında **Settings > Pages > Source: main branch /
(root)**. Birkaç dakika içinde
`https://<kullanici-adin>.github.io/<repo-adi>/` üzerinden erişilebilir
olur; stüdyo ise `.../admin.html` adresinde.

⚠️ `admin.html` şu an herkese açık — internete koyarsan, linkini
bilen herkes bulmaca ekleyebilir/oda ayarlarını değiştirebilir. Sadece
sen kullanacaksan bunu bilerek ilerle; ileride basit bir şifre koruması
eklenebilir.

## Şu ana kadar çalışan mekanikler

- **Oyuncu renkleri**: odaya katılma sırasına göre her oyuncuya sabit
  bir renk atanır; doğru cevaplanan harfler o oyuncunun renginde
  grid'e işlenir, skor tablosunda da isminin yanında aynı renkte bir
  nokta gösterilir — kimin hangi harfi yazdığı görülebilir

- **Sohbet**: sağ altta sabit balon (her zaman erişilebilir), tıklayınca
  açılan panel, oda içi gerçek zamanlı mesajlaşma, panel kapalıyken
  gelen yeni mesajlar için kırmızı sayı rozeti

- **Bulmaca Stüdyosu**: satır×sütun seçimi, hücre bazlı ipucu/cevap/yön
  ekleme, hücre başına 2 ipucu, kesişim doğrulama (çakışan harfleri
  reddeder), Firebase'e kaydetme
- Oda kurulum ekranı: çeviri yönü / seviye / max oyuncu / parola seçimi
  — o seviye+yönde Firebase'de kayıtlı bulmacalardan rastgele biri seçilir
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

- Bulmaca Stüdyosu'na basit bir giriş şifresi (herkes bulmaca eklemesin diye)
- Kayıtlı bulmacaları listeleyip düzenleme/silme ekranı (şu an sadece yeni ekleme var)
- Bulmaca bitince ("tüm kelimeler çözüldü") bir final ekranı
- Oyuncu sayısı / aktif olma göstergesi (kim şu an bağlı)
- Parolanın düz metin yerine hash'lenmesi
