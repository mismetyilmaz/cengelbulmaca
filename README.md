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
    reports.js                       -> oyun içi rapor kaydı + moderasyon gruplaması
    app.js                           -> oyun ekranının giriş noktası
    admin.js                          -> Bulmaca Stüdyosu'nun tüm mantığı
```

## Bulmaca Stüdyosu — nasıl çalışır

`admin.html`'i aç (yerelde `http://localhost:5500/admin.html`):

1. **Kurulum**: Zorluk (A / B / C), çeviri yönü (TR→EN / EN→TR), başlık,
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
4. **Taslağı Kaydet**, tamamlanmamış hibrit çalışmayı oyunculardan ayrı
   `puzzleDrafts/` alanında saklar. **Yayınla** ise seçtiğin seviye+yön için
   boş olan ilk slotu otomatik bulur ve yalnız doğrulanmış bulmacayı Firebase'e yazar.
5. Yayınladıktan sonra bulmaca **anında oynanabilir** hâle gelir —
   index.html'de o seviye+yönü seçen biri, oda kurduğunda rastgele
   seçilebilecek bulmacalar arasına girer.

### Kelime havuzundan otomatik bulmaca

Stüdyoda iki otomatik üretim seçeneği vardır. **Hibrit Taslak Oluştur**
varsayılan 10×12 ölçüde uzun ve doğal cevaplardan bir iskelet kurar. Kaliteli
bir kısa cevap bulunamayan slotu elementle zorlamak yerine editör boşluğu olarak bırakır.
**Az Boşluklu Otomatik Oluştur** ise daha serbest, kesişim öncelikli bir taslak
hazırlar. Her iki sonuç da Firebase veri formatıyla uyumludur ve kaydetmeden önce
normal editörde elle düzenlenebilir.

Yeni zorluk eşlemesi şöyledir: **A = A1+A2**, **B = B1+B2**,
**C = C1+C2**. Ana uzun cevaplar seçilen zorluktan gelir; 1–4 harfli kısa
dolgular zorluk fark etmeksizin tüm havuzlardan kullanılabilir. Eski A1–C2
bulmacaları yönetim kitaplığından açılmaya devam eder.

Otomatik üretim varsayılan olarak **kontrollü boşluklu, kesişim öncelikli**
moddadır. Tercih edilen hedef yaklaşık `%65–70` doluluktur; havuz veya grid
geometrisi buna izin vermediğinde yanlış bir kelimeyi zorlamak yerine daha
fazla siyah hücre bırakılır. Her yeni cevap mevcut ağa en az bir harften
bağlanır, büyük boş bölgeler puanlamada cezalandırılır ve yan yana bağımsız
cevapların ipucusuz sahte harf dizileri oluşturmasına izin verilmez. Ortak ipucu
kutuları sayesinde `→`, `↓`, `⤷` ve `⤵` yönlerinin tamamı kullanılabilir.

Hibrit üretici önce en uzun cevaplardan birkaçını rastgele yatay ve dikey
koridorlara yerleştirir. Ardından orta uzunluktaki cevaplara, son aşamada da
1–4 harfli kısa kesişimlere iner. Doğal/alfabe niteliğinde uygun bir cevap
bulunamazsa en fazla dört harfli slot `gap` olarak editöre bırakılır; uzun
iskelet cevaplar gap olamaz. Başlangıç bölümleri 2 ve 3 hücrelik farklı
genişliklerde karıştırılır; ipucu konumları çözülebilir kaldığı sürece ayrıca
kaydırılır. Gridde yatay veya dikey görünen iki ve daha uzun her kesintisiz harf
dizisi, taslakta bir cevap veya kayıtlı gap ile birebir eşleşmek zorundadır;
`M + AMONG = MAMONG` gibi izlenmeyen birleşmeler üretim hatası sayılır. Gap paneli
öneri seçmeye, serbest cevap/ipuçu girmeye ve ilgili hücreleri vurgulamaya izin
verir. Gap kalmış taslaklar yayınlanamaz. Önerilen ve tüm zorluk/yön
kombinasyonlarıyla test edilen ölçü **10×12**'dir.

Boşluksuz üretici için CEFR seviyelerinden bağımsız, çift yönlü kısa dolgu
havuzu `data/word-banks/short-fillers.json` dosyasındadır. İngiliz ve Türk
alfabelerinden 32 tek harfli cevap ile 988 iki harfli cevap içerir. Element
simgeleri ve gerçek kısa kayıtlar kullanılabilir; genel alfabe çiftleri üretim
otomatik yerleştirme havuzundan çıkarılmıştır; element ve alfabe çiftleri yalnız
gap önerilerinde teknik/son çare seçenekleri olarak gösterilebilir. İpuçları
Türkçe ve İngilizce ayrı tutulur; bu kayıtlar normal çeviri
kelimesi değil, yalnızca tam dolu gridin son kısa slotlarında kullanılacak
insan-onaylı bulmaca dolgularıdır.

```bash
node tools/build-short-fillers.mjs
node tests/short-fillers.test.js
```

- Hazinede 824 insan onaylı A1 kaydı ve 3.000'den fazla AI inceleme adayı vardır.
- `approved` (insan onaylı) ve `ai_approved` kayıtlar varsayılan olarak
  kullanılabilir. `candidate` / `needs_review` kayıtlarını kullanmak için ilgili
  kutunun özellikle işaretlenmesi gerekir; `ai_rejected` kayıtlar kullanılmaz.
- TR→EN yönünde havuz doğrudan, EN→TR yönünde ters çevrilerek kullanılır.
- Algoritma grid sınırlarını, kesişen harfleri, kelime yollarını ve ipucu
  hücresi başına en fazla iki ipucu kuralını doğrular.
- Otomatik sonuç taslaktır; çeviri ve ipuçları yayınlanmadan önce gözden
  geçirilmelidir.

Havuzlar FreeDict, Kelly ve FrequencyWords kaynaklarının kesişiminden tekrar
üretilebilir. Sürüm ve lisans bilgileri `data/word-banks/ATTRIBUTION.md`
dosyasındadır.

```bash
node tools/build-word-banks.mjs
```

#### AI ön incelemesi

AI kararları `data/word-banks/ai-reviews.json` dosyasında ayrı bir denetim
defterinde tutulur. Böylece model kararı insan onayı gibi gösterilmez ve havuzlar
yeniden üretildiğinde kaybolmaz. Araç varsayılan olarak bilgisayardaki Ollama
API'sini kullanır; API anahtarı veya dış servis gerekmez.

Kurulu bir Ollama modeliyle önce yazmadan deneme:

```powershell
node tools/ai-review-word-banks.mjs --model gemma4:12b --level A2 --limit 5 --dry-run
```

Sonuç uygunsa gerçek inceleme:

```powershell
node tools/ai-review-word-banks.mjs --model gemma4:12b --level A2 --limit 100
```

İstenirse OpenAI sağlayıcısı da kullanılabilir; anahtar yalnızca terminal ortam
değişkeninden okunur, HTML/JS istemci koduna yazılmaz:

```powershell
$env:OPENAI_API_KEY="kendi-api-anahtarin"
$env:OPENAI_REVIEW_MODEL="kullanacagin-model-kimligi"
node tools/ai-review-word-banks.mjs --provider openai --level A2 --limit 100
```

`--limit` maliyet kontrolü için zorunludur. Araç kararları her paket sonunda
kaydeder, ardından havuz JSON dosyalarını yeniden üretir. Karar durumları:

- `ai_approved`: yüksek güvenle uygun bulundu; otomatik üretimde kullanılabilir.
- `needs_review`: anlam, sözcük türü veya CEFR seviyesi insan incelemesi istiyor.
- `ai_rejected`: açıkça yanlış/uygunsuz bulundu; üretime alınmaz.

#### Oyun içi raporlar

Oyuncu herhangi bir ipucuna (çözülmüş olsa bile) tıklayıp **Kelime / ipucu
hatası bildir** seçeneğini kullanabilir. Raporlar
`wordReports/{puzzleId}/{wordId}/{playerId}` yoluna yazılır. Aynı oyuncunun aynı
kelime için ikinci gönderimi yeni bir spam kaydı açmak yerine önceki raporunu
günceller. Stüdyo raporları kelime bazında gruplar; bulmacayı açma, incelendi
olarak kapatma ve geçersiz sayma işlemleri sunar. **Hatalı: Havuzdan Çıkar**
kararı `wordBankOverrides/{level}/{answer}` altında bir engelleme kaydı açar;
sonraki otomatik bulmacalar bu kelimeyi kullanmaz. Kayıtlı mevcut bulmaca ayrı
olarak Stüdyo'da açılıp düzeltilmelidir.

Üretici testini çalıştırmak için:

```bash
node tests/auto-puzzle-generator.test.js
node tests/word-banks.test.js
node tests/reports.test.js
```

### 4 ok yönünün anlamı

- **→ sağa**: cevap, ipucu kutusunun SAĞINDAKİ hücreden başlar, sağa okunur
- **↓ aşağı**: cevap, ipucu kutusunun ALTINDAKİ hücreden başlar, aşağı okunur
- **⤷ alt kutudan sağa**: cevap ALTTAKİ hücreden başlar ama SAĞA okunur
  (kutunun hemen altı boşsa ve cevap yana doğru devam edecekse kullanılır)
- **⤵ sağ kutudan aşağıya**: cevap SAĞDAKİ hücreden başlar ama AŞAĞI okunur

İki ipuculu bir kutuda referans çengel bulmaca düzeni korunur: sağ kenardan
çıkan okun ipucu üst satırda, alt kenardan çıkan okun ipucu ikinci satırda
gösterilir. Okların üst üste binmemesi için aynı kutunun aynı kenarından iki
farklı cevap başlatılmaz.

Bu 4 yön sayesinde gerçek çengel bulmacalardaki gibi farklı başlangıç
geometrileri kurulabilir. Elle düzenlemede boşluksuz tasarım mümkündür;
otomatik üretici ise kelime ve ok doğruluğunu koruyabilmek için kontrollü
oranda siyah hücre bırakabilir.

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
- **Kelime kalite akışı**: AI ön inceleme durumları, oyun içi hata raporu ve
  Stüdyo moderasyon kuyruğu
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
- Bulmaca bitince ("tüm kelimeler çözüldü") bir final ekranı
- Oyuncu sayısı / aktif olma göstergesi (kim şu an bağlı)
- Parolanın düz metin yerine hash'lenmesi
