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
        tx.oncomplete = () => {
          db.close();
          resolve(request ? request.result : undefined);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error("IndexedDB: transaction échouée"));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error || new Error("IndexedDB: transaction abandonnée"));
        };
      }),
  );
}

/**
 * Sauvegarde un fichier le temps de l'envoi.
 * On stocke un ArrayBuffer + métadonnées plutôt que l'objet File :
 * Safari iOS gère mal les File/Blob dans IndexedDB.
 */
export async function savePendingFile(slot, file) {
  const buffer = await file.arrayBuffer();
  const record = {
    buffer,
    name: file.name || "",
    type: file.type || "",
    lastModified: file.lastModified || Date.now(),
  };
  return runTransaction("readwrite", (store) => store.put(record, slot));
}

/** @returns {Promise<File | undefined>} */
export function getPendingFile(slot) {
  return runTransaction("readonly", (store) => store.get(slot)).then((saved) => {
    if (!saved) return undefined;

    // Ancien format (File/Blob stocké directement).
    if (typeof Blob !== "undefined" && saved instanceof Blob) {
      if (saved instanceof File) return saved;
      return new File([saved], `fichier-${Date.now()}`, { type: saved.type || "" });
    }

    // Nouveau format.
    if (saved.buffer instanceof ArrayBuffer) {
      return new File([saved.buffer], saved.name || `fichier-${Date.now()}`, {
        type: saved.type || "",
        lastModified: saved.lastModified || Date.now(),
      });
    }

    return undefined;
  });
}

export function clearPendingFile(slot) {
  return runTransaction("readwrite", (store) => store.delete(slot)).catch(() => undefined);
}