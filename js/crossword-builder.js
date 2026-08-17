/**
 * CROSSWORD-BUILDER.js
 * ------------------------------------------------------------------
 * Gerçek çengel bulmaca mantığı:
 * - Tüm kelimeler birbirleriyle kesişir.
 * - Boş (block) hücre kalmaz; boş kalan hücreler rastgele harflerle doldurulur.
 * - Kesişim bulamayan kelimeler otomatik olarak atlanır (liste büyük olduğu için 50+ kelime hedeflenir).
 * - 5 farklı deneme yaparak en çok kelimeyi kesiştiren sonuç seçilir.
 */

const CrosswordBuilder = (() => {

    // Rastgele harf seçimi (hedef dile göre)
    function randomLetter(lang) {
        const letters = lang === "tr"
            ? "ABCDEFGHIJKLMNOPQRSTUVWXYZÇĞİÖŞÜ"
            : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        return letters[Math.floor(Math.random() * letters.length)];
    }

    // Hücre anahtarı
    function key(r, c) { return `${r},${c}`; }

    // Bir kelimeyi grid'e yerleştir
    function placeWord(wordId, wordObj, row, col, dir, letterGrid, clueGrid, placed) {
        const answer = wordObj.answer;
        const cellIds = [];
        for (let i = 0; i < answer.length; i++) {
            const r = dir === "across" ? row : row + i;
            const c = dir === "across" ? col + i : col;
            const k = key(r, c);
            letterGrid.set(k, answer[i]);
            cellIds.push({ r, c });
        }
        // İpucu kutusu, kelimenin soluna (yatay) veya üstüne (dikey) yerleştirilir
        const clueR = dir === "across" ? row : row - 1;
        const clueC = dir === "across" ? col - 1 : col;
        clueGrid.set(key(clueR, clueC), wordId);
        placed.push({
            id: wordId,
            answer: answer,
            clue: wordObj.clue,
            row, col, dir,
            cellIds,
            clueCell: { r: clueR, c: clueC }
        });
    }

    // Verilen pozisyona kelime sığar mı?
    function canPlace(answer, row, col, dir, letterGrid, clueGrid) {
        const clueR = dir === "across" ? row : row - 1;
        const clueC = dir === "across" ? col - 1 : col;
        const clueKey = key(clueR, clueC);
        if (letterGrid.has(clueKey) || clueGrid.has(clueKey)) return false;

        for (let i = 0; i < answer.length; i++) {
            const r = dir === "across" ? row : row + i;
            const c = dir === "across" ? col + i : col;
            const k = key(r, c);
            if (clueGrid.has(k)) return false;
            if (letterGrid.has(k) && letterGrid.get(k) !== answer[i]) return false;
        }
        return true;
    }

    // Mevcut grid ile kesişen bir yer bul
    function findPlacement(answer, letterGrid, clueGrid) {
        for (const [k, letter] of letterGrid) {
            const [rStr, cStr] = k.split(',');
            const r = parseInt(rStr, 10);
            const c = parseInt(cStr, 10);
            // Bu harf, cevap içinde kaçıncı indekste?
            const indices = [];
            for (let i = 0; i < answer.length; i++) {
                if (answer[i] === letter) indices.push(i);
            }
            for (const idx of indices) {
                // Yatay deneme
                const rowH = r;
                const colH = c - idx;
                if (canPlace(answer, rowH, colH, "across", letterGrid, clueGrid)) {
                    return { row: rowH, col: colH, dir: "across" };
                }
                // Dikey deneme
                const rowV = r - idx;
                const colV = c;
                if (canPlace(answer, rowV, colV, "down", letterGrid, clueGrid)) {
                    return { row: rowV, col: colV, dir: "down" };
                }
            }
        }
        return null; // kesişim bulunamadı
    }

    // ------------------------------------------------------------------
    // ANA build FONKSİYONU
    // ------------------------------------------------------------------
    function build(title, wordList, targetLang) {
        // 1. Temizlik ve büyük harf dönüşümü
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
        const ATTEMPTS = 5; // 5 farklı rastgele sıralama dene

        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
            // Kelime sırasını karıştır (ilk kelime sabit)
            const shuffled = [...cleaned];
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

            // Geri kalan kelimeleri dene
            for (let i = 1; i < shuffled.length; i++) {
                const w = shuffled[i];
                const id = `w${i}`;
                const pos = findPlacement(w.answer, letterGrid, clueGrid);
                if (pos) {
                    placeWord(id, w, pos.row, pos.col, pos.dir, letterGrid, clueGrid, placed);
                }
            }

            // En iyisini sakla
            if (placed.length > bestCount) {
                bestCount = placed.length;
                bestPlaced = placed;
                if (bestCount >= 50) break; // 50 kelime hedefe ulaşıldı
            }
        }

        // finalize: grid'i oluştur ve boş hücreleri rastgele harflerle doldur
        return finalize(title, bestPlaced, targetLang);
    }

    // ------------------------------------------------------------------
    // finalize – grid oluşturma + rastgele doldurma
    // ------------------------------------------------------------------
    function finalize(title, placed, targetLang) {
        if (placed.length === 0) {
            return { title, rows: 1, cols: 1, cells: {}, words: {}, targetLang };
        }

        // Tüm hücrelerin sınırlarını hesapla
        let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
        placed.forEach(p => {
            [...p.cellIds, p.clueCell].forEach(({ r, c }) => {
                minR = Math.min(minR, r); maxR = Math.max(maxR, r);
                minC = Math.min(minC, c); maxC = Math.max(maxC, c);
            });
        });

        // letterGrid ve clueGrid'i placed'den yeniden oluştur
        const letterGrid = new Map();
        const clueGrid = new Map();

        placed.forEach(p => {
            const answer = p.answer;
            p.cellIds.forEach((cell, idx) => {
                letterGrid.set(key(cell.r, cell.c), answer[idx]);
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

        // shift: grid'i 0,0'dan başlatmak için
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
                if (clueGrid.has(k)) continue; // clue zaten eklendi
                if (letterGrid.has(k)) {
                    const cellId = shift(r, c);
                    // Bu hücre hangi kelimelere ait?
                    const wordIds = [];
                    placed.forEach(p => {
                        p.cellIds.forEach((cell, idx) => {
                            if (cell.r === r && cell.c === c) {
                                wordIds.push(p.id);
                            }
                        });
                    });
                    cells[cellId] = {
                        type: "letter",
                        wordIds: wordIds.length ? wordIds : [] // rastgele harfler boş liste alır
                    };
                }
            }
        }

        // Words
        placed.forEach(p => {
            const wordCellIds = p.cellIds.map(({ r, c }) => shift(r, c));
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