/**
 * MOVELOG.js
 * ------------------------------------------------------------------
 * Oyun boyunca yapılan doğru cevapların (kim, hangi ipucu, hangi cevap,
 * kaç puan) log'unu tutar. Yazma işlemi game.js'te (bir kelime
 * çözülünce) yapılır; bu modül sadece OKUMA/DİNLEME tarafını yönetir.
 *
 * chat.js ile aynı desen: önce geçmiş tek seferlik "once" ile yüklenir
 * (isNew=false), sonra sadece o andan sonraki hamleler için canlı
 * dinleyici kurulur (isNew=true) — böylece popup'ı ilk açtığında tüm
 * geçmiş görünür, ama "yeni hamle" bildirimi sadece gerçekten yeni
 * olanlar için tetiklenir.
 */

const MoveLog = (() => {
  let roomRef = null;

  function init(roomId, callbacks) {
    roomRef = db.ref(`rooms/${roomId}/moveLog`);
    const onMove = callbacks.onMove;

    roomRef.limitToLast(200).once("value").then(snap => {
      let lastKey = null;
      snap.forEach(child => {
        onMove(child.val(), false);
        lastKey = child.key;
      });

      const liveQuery = lastKey ? roomRef.orderByKey().startAfter(lastKey) : roomRef;
      liveQuery.on("child_added", child => {
        onMove(child.val(), true);
      });
    });
  }

  return { init };
})();
