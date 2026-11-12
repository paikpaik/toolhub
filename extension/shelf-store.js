/**
 * 이미지 모음 저장소 (background·패널 공용). 장수가 늘어도 느려지지 않게 둘로 나눈다.
 * - 원본·미리보기: IndexedDB에 한 장씩 Blob으로 (담을 때 그 한 장만 쓴다)
 * - 순서 목록: storage.local의 shelfIndex에 작은 정보만 (바뀌면 패널이 onChanged로 가볍게 받는다)
 * 패널과 background가 동시에 써도 빠지지 않게, 고치는 일은 모두 Web Locks로 차례로 한다
 */
globalThis.ToolhubShelf = (() => {
  const DB_NAME = "toolhub-shelf";
  const STORE = "images";
  const INDEX_KEY = "shelfIndex";
  /** 예전 저장 방식 (data URL 배열). 처음 켤 때 새 방식으로 옮긴다 */
  const LEGACY_KEY = "shelf";
  /** 패널 칸에 보여 줄 미리보기 너비 (고해상도 화면에서도 흐리지 않게 칸보다 크게) */
  const THUMB_WIDTH = 400;

  let opening = null;
  function db() {
    opening ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((e) => {
      opening = null;
      throw e;
    });
    return opening;
  }

  const result = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  /** 쓰기는 트랜잭션이 끝날(디스크에 남을) 때까지 기다린다 */
  async function write(fn) {
    const tx = (await db()).transaction(STORE, "readwrite");
    fn(tx.objectStore(STORE));
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("이미지를 저장하지 못했어요"));
    });
  }

  /** { id, image: Blob, thumb: Blob | null }. 없으면 undefined */
  async function getRecord(id) {
    return result((await db()).transaction(STORE).objectStore(STORE).get(id));
  }

  const locked = (fn) => navigator.locks.request("toolhub-shelf", fn);

  async function readIndex() {
    return (await chrome.storage.local.get(INDEX_KEY))[INDEX_KEY] ?? [];
  }

  async function hashOf(blob) {
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /** 작은 미리보기. 움직이는 GIF·SVG나 이미 작은 이미지는 원본을 그대로 보여 주므로 null */
  async function makeThumb(blob) {
    if (!/^image\/(png|jpeg|webp|avif)$/.test(blob.type)) return null;
    try {
      const bitmap = await createImageBitmap(blob);
      if (bitmap.width <= THUMB_WIDTH) {
        bitmap.close();
        return null;
      }
      const height = Math.round((bitmap.height * THUMB_WIDTH) / bitmap.width);
      const canvas = new OffscreenCanvas(THUMB_WIDTH, height);
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, THUMB_WIDTH, height);
      bitmap.close();
      return await canvas.convertToBlob({ type: "image/webp", quality: 0.85 });
    } catch {
      return null;
    }
  }

  /** 목록에서 빠진 이미지의 원본·미리보기를 지운다 */
  async function dropRecords(prev, next) {
    const ids = ToolhubLib.removedShelfIds(prev, next);
    if (ids.length) await write((store) => ids.forEach((id) => store.delete(id)));
  }

  /** 새 이미지를 맨 앞에 담는다. 같은 이미지(내용이나 원래 주소가 같은 것)는 앞으로 옮기고, 최대 장수를 넘으면 오래된 것부터 지운다 */
  async function addImage(blob, { from, source } = {}) {
    if (!blob?.type?.startsWith("image/")) throw new Error("이미지 파일이 아니에요");
    const [hash, thumb] = await Promise.all([hashOf(blob), makeThumb(blob)]);
    await locked(async () => {
      const index = await readIndex();
      const id = ToolhubLib.nextShelfId(index, Date.now());
      const next = ToolhubLib.addToShelf(index, { id, from, source, hash, type: blob.type, addedAt: new Date().toISOString() });
      // 원본을 먼저 저장하고 목록에 올린다 (중간에 멈춰도 목록에 원본 없는 칸이 생기지 않게)
      await write((store) => store.put({ id, image: blob, thumb }));
      await chrome.storage.local.set({ [INDEX_KEY]: next });
      await dropRecords(index, next);
    });
  }

  async function removeImages(ids) {
    await locked(async () => {
      const index = await readIndex();
      const next = index.filter((item) => !ids.includes(item.id));
      await chrome.storage.local.set({ [INDEX_KEY]: next });
      await dropRecords(index, next);
    });
  }

  async function clearImages() {
    await locked(async () => {
      await chrome.storage.local.set({ [INDEX_KEY]: [] });
      await write((store) => store.clear());
    });
  }

  /**
   * 예전 방식(storage.local의 shelf, data URL 배열)을 새 방식으로 옮기고, 목록에 없는 원본(중간에 멈춰 남은 것)을 치운다.
   * 옮기지 못한 이미지는 지우지 않고 shelf에 남겨 다음에 다시 시도한다
   */
  async function migrate() {
    await locked(async () => {
      const { [LEGACY_KEY]: legacy } = await chrome.storage.local.get(LEGACY_KEY);
      let index = await readIndex();
      if (Array.isArray(legacy)) {
        const moved = [];
        const failed = [];
        for (const old of legacy) {
          if (index.some((item) => item.id === old.id)) continue;
          try {
            const blob = await (await fetch(old.src)).blob();
            if (!blob.type.startsWith("image/")) throw new Error("이미지가 아니에요");
            const [hash, thumb] = await Promise.all([hashOf(blob), makeThumb(blob)]);
            await write((store) => store.put({ id: old.id, image: blob, thumb }));
            moved.push({ id: old.id, from: old.from, source: old.source, hash, type: blob.type, addedAt: old.addedAt });
          } catch {
            failed.push(old);
          }
        }
        if (moved.length) {
          index = ToolhubLib.mergeShelf(index, moved);
          await chrome.storage.local.set({ [INDEX_KEY]: index });
        }
        if (failed.length) await chrome.storage.local.set({ [LEGACY_KEY]: failed });
        else await chrome.storage.local.remove(LEGACY_KEY);
      }
      const keys = await result((await db()).transaction(STORE).objectStore(STORE).getAllKeys());
      const kept = new Set(index.map((item) => item.id));
      const orphans = keys.filter((id) => !kept.has(id));
      if (orphans.length) await write((store) => orphans.forEach((id) => store.delete(id)));
    });
  }

  return { INDEX_KEY, readIndex, getRecord, addImage, removeImages, clearImages, migrate };
})();
