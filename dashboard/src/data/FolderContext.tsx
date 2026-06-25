import React, { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'lodestone_folders';

/**
 * Generate a unique id. crypto.randomUUID() only exists in a secure
 * context (HTTPS or localhost); over plain HTTP on a LAN IP it is
 * undefined and throws, so fall back to a manual generator.
 */
function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  return (
    'f-' +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10)
  );
}

export interface Folder {
  id: string;
  name: string;
  instanceUuids: string[];
}

interface FolderContextValue {
  folders: Record<string, Folder>;
  createFolder: (name: string) => void;
  deleteFolder: (id: string) => void;
  renameFolder: (id: string, name: string) => void;
  moveToFolder: (instanceUuid: string, folderId: string | null) => void;
  getFolderForInstance: (instanceUuid: string) => Folder | null;
}

export const FolderContext = createContext<FolderContextValue>({
  folders: {},
  createFolder: () => undefined,
  deleteFolder: () => undefined,
  renameFolder: () => undefined,
  moveToFolder: () => undefined,
  getFolderForInstance: () => null,
});

export function FolderProvider({ children }: { children: React.ReactNode }) {
  const [folders, setFolders] = useState<Record<string, Folder>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  }, [folders]);

  function createFolder(name: string) {
    const id = genId();
    setFolders((prev) => ({ ...prev, [id]: { id, name, instanceUuids: [] } }));
  }

  function deleteFolder(id: string) {
    setFolders((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function renameFolder(id: string, name: string) {
    setFolders((prev) => ({
      ...prev,
      [id]: { ...prev[id], name },
    }));
  }

  function moveToFolder(instanceUuid: string, folderId: string | null) {
    setFolders((prev) => {
      const next: Record<string, Folder> = {};
      for (const [k, f] of Object.entries(prev)) {
        next[k] = {
          ...f,
          instanceUuids: f.instanceUuids.filter((u) => u !== instanceUuid),
        };
      }
      if (folderId && next[folderId]) {
        next[folderId] = {
          ...next[folderId],
          instanceUuids: [...next[folderId].instanceUuids, instanceUuid],
        };
      }
      return next;
    });
  }

  function getFolderForInstance(instanceUuid: string): Folder | null {
    return (
      Object.values(folders).find((f) =>
        f.instanceUuids.includes(instanceUuid)
      ) ?? null
    );
  }

  return (
    <FolderContext.Provider
      value={{
        folders,
        createFolder,
        deleteFolder,
        renameFolder,
        moveToFolder,
        getFolderForInstance,
      }}
    >
      {children}
    </FolderContext.Provider>
  );
}

export function useFolders() {
  return useContext(FolderContext);
}
