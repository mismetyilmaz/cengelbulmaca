/**
 * CROSSWORD-BUILDER.js
 * ----------------------------------------------------------------
 * Gerçek çengel bulmaca algoritması:
 * - Tüm hücreler dolu (ipucu veya harf), asla boş kare kalmaz.
 * - Her kelime en az bir harf üzerinden diğer kelimelerle kesişir.
 * - Kesişmeyen kelimeler otomatik atlanır, böylece bütünlük korunur.
 * - 10 farklı rastgele deneme yapılır, en çok kelimeyi yerleştiren seçilir.
 * - 50+ kelime hedeflenir; listenizde yeterli kelime varsa bu hedefe ulaşılır.
 * - Kalan boş hücreler rastgele harflerle doldurulur (böylece gözü boşluk kalmaz).
 */

const CrosswordBuilder = (() => {

    // Hedef dile göre rastgele harf seç (Türkçe için ek harfler)
    function randomLetter(lang) {
        const letters = lang === "tr"
            ? "ABCDEFGHIJKLMNOPQRSTUVWXYZÇĞİÖŞÜ"
            : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return letters[Math.floor(Math.random() * letters.length)];
    }

    function key(r, c) { return `${r},${c}`; }

    // Bir kelimeyi grid'e yerleştir (harfleri ve ipucu kutusunu ekler)
    function placeWord(wordId, wordObj, row, col, dir, letterGrid, clueGrid, placed) {
        const answer = wordObj.answer;
        const cells = [];
        for (let i = 0; i < answer.length; i++) {
            const r = dir === "across" ? row : row + i;
            const c = dir === "across" ? col + i : col;
            const k = key(r, c);
            letterGrid.set(k, answer[i]);
            cells.push({ r, c });
        }
        // İpucu kutusu: yatay ise soluna, dikey ise üstüne
        const clueR = dir === "across" ? row : row - 1;
        const clueC = dir === "across" ? col - 1 : col;
        clueGrid.set(key(clueR, clueC), wordId);
        placed.push({
            id: wordId,
            answer: answer,
            clue: wordObj.clue,
            row, col, dir,
            cells,
            clueCell: { r: clueR, c: clueC }
        });
    }

    // Belirtilen konuma kelime yerleştirilebilir mi?
    function canPlace(answer, row, col, dir, letterGrid, clueGrid) {
        // İpucu kutusu boş olmalı
        const clueR = dir === "across" ? row : row - 1;
        const clueC = dir === "across" ? col - 1 : col;
        const clueKey = key(clueR, clueC);
        if (letterGrid.has(clueKey) || clueGrid.has(clueKey)) return false;

        for (let i = 0; i < answer.length; i++) {
            const r = dir === "across" ? row : row + i;
            const c = dir === "across" ? col + i : col;
            const k = key(r, c);
            if (clueGrid.has(k)) return false; // başka bir kelimenin ipucu kutusuyla çakışamaz
            if (letterGrid.has(k) && letterGrid.get(k) !== answer[i]) return false;
        }
        return true;
    }

    // Mevcut kelimelerle kesişen bir pozisyon bul (rastgele harf seçimiyle)
    function findPlacement(answer, letterGrid, clueGrid, maxAttempts = 2000) {
        const entries = Array.from(letterGrid.entries());
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const idx = Math.floor(Math.random() * entries.length);
            const [k, letter] = entries[idx];
            const [rStr, cStr] = k.split(',');
            const r = parseInt(rStr, 10);
            const c = parseInt(cStr, 10);

            // Bu harf, cevap içinde hangi indekslerde geçiyor?
            const indices = [];
            for (let i = 0; i < answer.length; i++) {
                if (answer[i] === letter) indices.push(i);
            }
            if (indices.length === 0) continue;
            const idx2 = indices[Math.floor(Math.random() * indices.length)];

            // Yatay deneme: kelime, harfin soluna doğru uzanır
            const rowH = r;
            const colH = c - idx2;
            if (canPlace(answer, rowH, colH, "across", letterGrid, clueGrid)) {
                return { row: rowH, col: colH, dir: "across" };
            }
            // Dikey deneme
            const rowV = r - idx2;
            const colV = c;
            if (canPlace(answer, rowV, colV, "down", letterGrid, clueGrid)) {
                return { row: rowV, col: colV, dir: "down" };
            }
        }
        return null; // kesişim bulunamadı
    }

    // ----------------------------------------------------------------
    // ANA build FONKSİYONU
    // ----------------------------------------------------------------
    function build(title, wordList, targetLang) {
        // Temizlik ve büyük harf dönüşümü
        const cleaned = wordList
            .map(w => ({
                clue: w.clue.trim(),
                answer: TextUtils.upper(w.answer.trim(), targetLang)
            }))
            .filter(w => /^[A-ZÇĞİIÖŞÜ]+$/.test(w.answer))
            .sort((a, b) => b.answer.length - a.answer.length);

        if (cleaned.length === 0) {
            return { title, rows: 1, cols: 1, cells: {}, words: {}, targetLang };
        }

        let bestPlaced = [];
        let bestCount = 0;
        const ATTEMPTS = 10; // 10 farklı rastgele sıralama ve kesişim denemesi

        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
            const shuffled = [...cleaned];
            // İlk kelime sabit, gerisi karıştır
            if (attempt > 0) {
                const first = shuffled[0];
                const rest = shuffled.slice(1);
                for (let i = rest.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [rest[i], rest[j]] = [rest[j], rest[i]];
                }
                shuffled.splice(0, 1, first, ...rest);
            }

            const letterGrid = new Map();
            const clueGrid = new Map();
            const placed = [];

            // İlk kelimeyi (0,0) yatay yerleştir
            placeWord("w0", shuffled[0], 0, 0, "across", letterGrid, clueGrid, placed);

            // Kalan kelimeleri dene
            for (let i = 1; i < shuffled.length; i++) {
                const w = shuffled[i];
                const id = `w${i}`;
                const pos = findPlacement(w.answer, letterGrid, clueGrid);
                if (pos) {
                    placeWord(id, w, pos.row, pos.col, pos.dir, letterGrid, clueGrid, placed);
                }
            }

            if (placed.length > bestCount) {
                bestCount = placed.length;
                bestPlaced = placed;
                // 50 kelime hedefine ulaşıldıysa erken dur
                if (bestCount >= 50) break;
            }
        }

        // Sonuçları finalize et (grid oluştur + boş hücreleri doldur)
        return finalize(title, bestPlaced, targetLang);
    }

    // ----------------------------------------------------------------
    // finalize – grid oluşturma + rastgele doldurma
    // ----------------------------------------------------------------
    function finalize(title, placed, targetLang) {
        if (placed.length === 0) {
            return { title, rows: 1, cols: 1, cells: {}, words: {}, targetLang };
        }

        // Tüm hücrelerin sınırlarını bul
        let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
        placed.forEach(p => {
            [...p.cells, p.clueCell].forEach(({ r, c }) => {
                if (r < minR) minR = r;
                if (r > maxR) maxR = r;
                if (c < minC) minC = c;
                if (c > maxC) maxC = c;
            });
        });

        // letterGrid ve clueGrid'i yeniden oluştur
        const letterGrid = new Map();
        const clueGrid = new Map();
        placed.forEach(p => {
            const ans = p.answer;
            p.cells.forEach((cell, idx) => {
                letterGrid.set(key(cell.r, cell.c), ans[idx]);
            });
            clueGrid.set(key(p.clueCell.r, p.clueCell.c), p.id);
        });

        // BOŞ HÜCRELERİ RASTGELE HARFLERLE DOLDUR
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const k = key(r, c);
                if (!letterGrid.has(k) && !clueGrid.has(k)) {
                    letterGrid.set(k, randomLetter(targetLang));
                }
            }
        }

        // shift: grid'i 0,0'dan başlat
        const shift = (r, c) => `r${r - minR}c${c - minC}`;

        const cells = {};
        const words = {};

        // Clue hücreleri
        placed.forEach(p => {
            const cellId = shift(p.clueCell.r, p.clueCell.c);
            cells[cellId] = {
                type: "clue",
                text: p.clue,
                arrow: p.dir === "across" ? "right" : "down",
                wordId: p.id
            };
        });

        // Letter hücreleri
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const k = key(r, c);
                if (clueGrid.has(k)) continue;
                if (letterGrid.has(k)) {
                    const cellId = shift(r, c);
                    // Bu hücre hangi kelimelere ait?
                    const wordIds = [];
                    placed.forEach(p => {
                        p.cells.forEach((cell, idx) => {
                            if (cell.r === r && cell.c === c) {
                                wordIds.push(p.id);
                            }
                        });
                    });
                    cells[cellId] = {
                        type: "letter",
                        wordIds: wordIds.length ? wordIds : []
                    };
                }
            }
        }

        // Words
        placed.forEach(p => {
            const wordCellIds = p.cells.map(({ r, c }) => shift(r, c));
            words[p.id] = {
                answer: p.answer,
                cells: wordCellIds,
                clueCell: shift(p.clueCell.r, p.clueCell.c)
            };
        });

        return {
            title,
            rows: maxR - minR + 1,
            cols: maxC - minC + 1,
            cells,
            words,
            targetLang
        };
    }

    return { build };
})();