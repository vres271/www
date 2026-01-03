import { Injectable } from '@angular/core';
import { from, Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

export interface PhotoRecord {
  photoId: string;
  playerId: string;
  file: Blob;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class IndexedDbService {
  private dbName = 'WhatWhereWhenDB';
  private storeName = 'playerPhotos';
  private db: IDBDatabase | null = null;
  private dbReadySubject = new BehaviorSubject<boolean>(false);
  public dbReady$ = this.dbReadySubject.asObservable();

  constructor() {
    this.initDb();
  }

  private initDb(): void {
    const request = indexedDB.open(this.dbName, 1);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      this.dbReadySubject.next(false);
    };

    request.onsuccess = () => {
      this.db = request.result;
      this.dbReadySubject.next(true);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(this.storeName)) {
        const objectStore = db.createObjectStore(this.storeName, { keyPath: 'photoId' });
        objectStore.createIndex('playerId', 'playerId', { unique: false });
      }
    };
  }

  /**
   * Проверить, готова ли БД
   */
  isReady(): boolean {
    return this.db !== null;
  }

  /**
   * Сохранить фото игрока
   */
  savePhoto(playerId: string, file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject('Database not initialized');
        return;
      }

      try {
        const photoId = `${playerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const photoData: PhotoRecord = {
          photoId,
          playerId,
          file,
          timestamp: Date.now()
        };

        const request = store.add(photoData);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(photoId);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Получить фото по ID
   */
  getPhoto(photoId: string): Promise<Blob | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject('Database not initialized');
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(photoId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          resolve(result ? result.file : null);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Получить все фото игрока
   */
  getPlayerPhotos(playerId: string): Promise<PhotoRecord[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject('Database not initialized');
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('playerId');
        const request = index.getAll(playerId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Получить URL для отображения фото
   */
  getPhotoUrl(photoId: string): Observable<string | null> {
    return from(this.getPhoto(photoId)).pipe(
      map(blob => (blob ? URL.createObjectURL(blob) : null))
    );
  }

  /**
   * Удалить фото по ID
   */
  deletePhoto(photoId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject('Database not initialized');
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(photoId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Удалить все фото игрока
   */
  deletePlayerPhotos(playerId: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const photos = await this.getPlayerPhotos(playerId);
        await Promise.all(photos.map(p => this.deletePhoto(p.photoId)));
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Очистить всё
   */
  clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject('Database not initialized');
        return;
      }

      try {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      } catch (error) {
        reject(error);
      }
    });
  }
}
