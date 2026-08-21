import { cloneKnowledgeState, isKnowledgeState } from "./bundle";
import { EMPTY_KNOWLEDGE_STATE, type KnowledgeState } from "./types";

const DATABASE_NAME = "idhelper";
const DATABASE_VERSION = 1;
const STORE_NAME = "knowledge";
const STATE_KEY = "current";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open IDHelper storage."));
  });
}

export async function loadKnowledgeState(): Promise<KnowledgeState> {
  const db = await openDatabase();
  try {
    return await new Promise<KnowledgeState>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess = () => resolve(isKnowledgeState(request.result) ? cloneKnowledgeState(request.result) : cloneKnowledgeState(EMPTY_KNOWLEDGE_STATE));
      request.onerror = () => reject(request.error ?? new Error("Could not read IDHelper storage."));
    });
  } finally {
    db.close();
  }
}

/** Replaces local knowledge only after an import has been parsed and confirmed by the UI. */
export async function saveKnowledgeState(state: KnowledgeState): Promise<void> {
  if (!isKnowledgeState(state)) throw new TypeError("Cannot save invalid knowledge state.");
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(cloneKnowledgeState(state), STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Could not save IDHelper storage."));
    });
  } finally {
    db.close();
  }
}

export async function resetKnowledgeState(): Promise<void> {
  await saveKnowledgeState(EMPTY_KNOWLEDGE_STATE);
}
