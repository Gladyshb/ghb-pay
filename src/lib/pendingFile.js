const DB_NAME = "ghb-pay-uploads";
const STORE = "files";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB introuvable"));
  });
}

function runTransaction(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const request = fn(store);
        tx.oncomplete = () => resolve(request ? request.result : undefined);
        tx.onerror = () => reject(tx.error || new Error("IndexedDB: transaction échouée"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB: transaction abandonnée"));
      })
  );
}

/** Guard a File/Blob across a page reload while the upload is in flight. */
export function savePendingFile(slot, file) {
  return runTransaction("readwrite", (store) => store.put(file, slot));
}

/** @returns {Promise<File | undefined>} */
export function getPendingFile(slot) {
  return runTransaction("readonly", (store) => store.get(slot)).then(
    (saved) => (saved instanceof File ? saved : undefined)
  );
}

export function clearPendingFile(slot) {
  return runTransaction("readwrite", (store) => store.delete(slot)).catch(() => undefined);
}
