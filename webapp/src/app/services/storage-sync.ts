import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StorageSyncService {
  private storageChangeSubject = new BehaviorSubject<any>(null);
  public storageChange$ = this.storageChangeSubject.asObservable();

  constructor() {
    this.setupStorageListener();
  }

  private setupStorageListener(): void {
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === 'gameState' && event.newValue) {
        try {
          this.storageChangeSubject.next(JSON.parse(event.newValue));
        } catch (e) {
          console.error('Error parsing storage change', e);
        }
      }
    });
  }
}
