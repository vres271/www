import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GameStateService, Player } from '../../services/game-state';
import { IndexedDbService, PhotoRecord } from '../../services/indexed-db';
import { forkJoin, from, Subject } from 'rxjs';
import { takeUntil, debounceTime, map } from 'rxjs/operators';


@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Settings implements OnInit, OnDestroy {
  players: Player[] = [];
  playerPhotoUrls: { [photoId: string]: string } = {};
  playerPhotosData: { [playerId: string]: PhotoRecord[] } = {};
  
  editingPlayerId: string | null = null;
  editingPlayerName = '';
  editingPlayerCity = '';
  editingPlayerQuestionCount = 0;
  editingPlayerPhotoFiles: File[] = [];
  editingPlayerPhotosPreviews: string[] = [];
  
  showAddPlayer = false;
  expandedPlayerId: string | null = null;
  dbReady = false;
  
  private destroy$ = new Subject<void>();
  private playerDataChange$ = new Subject<void>();


  constructor(
    private gameStateService: GameStateService,
    private indexedDbService: IndexedDbService,
    private cd: ChangeDetectorRef,
  ) {}


  ngOnInit(): void {
    // Подписываемся на изменения данных игроков с debounce
    this.playerDataChange$
      .pipe(
        debounceTime(100),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.dbReady) {
          this.loadAllPlayerPhotos();
        }
      });
    // Ждём пока БД инициализируется
    this.indexedDbService.dbReady$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ready => {
        this.dbReady = ready;
        if (ready) {
          this.subscribeToGameState();
        }
      });
  }


  private subscribeToGameState(): void {
    this.gameStateService.gameState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.players = state.players;
        // Инициализируем playerPhotosData для всех игроков
        this.players.forEach(player => {
          if (!this.playerPhotosData[player.id]) {
            this.playerPhotosData[player.id] = [];
          }
        });

        // Триггерим загрузку фото с задержкой
        this.playerDataChange$.next();
      });
  }


  ngOnDestroy(): void {
    Object.values(this.playerPhotoUrls).forEach(url => {
      URL.revokeObjectURL(url);
    });
    
    this.destroy$.next();
    this.destroy$.complete();
  }


  private loadAllPlayerPhotos(): void {
    if (!this.dbReady) return;
    this.players.forEach(player => {
      this.loadPlayerPhotos(player.id);
    });
  }


  private loadPlayerPhotos(playerId: string): void {
    this.indexedDbService.getPlayerPhotos(playerId)
      .then(photos => {
        this.playerPhotosData[playerId] = photos;
        this.playerPhotosData = { ...this.playerPhotosData };

        // Загружаем все фото параллельно
        if (photos.length > 0) {
          const photoObservables = photos.map(photo =>
            from(this.indexedDbService.getPhoto(photo.photoId)).pipe(
              map(blob => ({ photoId: photo.photoId, blob }))
            )
          );

          forkJoin(photoObservables).subscribe(results => {
            results.forEach(({ photoId, blob }) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                this.playerPhotoUrls[photoId] = url;
              }
            });
            
            this.playerPhotoUrls = { ...this.playerPhotoUrls };
            this.cd.markForCheck();
          });
        }
      })
      .catch(error => {
        console.error('Error loading player photos:', error);
        this.playerPhotosData[playerId] = [];
      });
  }


  private loadPhotoUrl(photoId: string): void {
    // Если URL уже загружен, пропускаем
    if (this.playerPhotoUrls[photoId]) return;

    this.indexedDbService.getPhoto(photoId)
      .then(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          // Обновляем объект чтобы Angular заметил изменение
          this.playerPhotoUrls = {
            ...this.playerPhotoUrls,
            [photoId]: url
          };
          this.cd.markForCheck();
        }
      })
      .catch(error => {
        console.error('Error loading photo blob:', error);
      });
  }


  startEditPlayer(player: Player): void {
    this.editingPlayerId = player.id;
    this.editingPlayerName = player.name;
    this.editingPlayerCity = player.city;
    this.editingPlayerQuestionCount = player.questionCount;
    this.editingPlayerPhotoFiles = [];
    this.editingPlayerPhotosPreviews = [];
  }


  cancelEditPlayer(): void {
    this.editingPlayerId = null;
    this.editingPlayerName = '';
    this.editingPlayerCity = '';
    this.editingPlayerQuestionCount = 0;
    this.editingPlayerPhotoFiles = [];
    this.editingPlayerPhotosPreviews = [];
  }


  async saveEditPlayer(): Promise<void> {
    if (!this.editingPlayerId || !this.dbReady) return;
    if (!this.editingPlayerName.trim()) {
      alert('Введите имя игрока');
      return;
    }

    const player = this.players.find(p => p.id === this.editingPlayerId);
    if (!player) return;

    const newPhotoIds: string[] = player.photoIds && Array.isArray(player.photoIds) 
      ? [...player.photoIds] 
      : [];
    
    for (const file of this.editingPlayerPhotoFiles) {
      try {
        const photoId = await this.indexedDbService.savePhoto(this.editingPlayerId, file);
        newPhotoIds.push(photoId);
        // Загружаем URL нового фото
        this.loadPhotoUrl(photoId);
      } catch (error) {
        console.error('Error saving photo:', error);
        alert('Ошибка при сохранении фото');
        return;
      }
    }

    this.gameStateService.updatePlayer(
      this.editingPlayerId,
      this.editingPlayerName,
      this.editingPlayerCity,
      newPhotoIds,
      this.editingPlayerQuestionCount
    );

    this.cancelEditPlayer();
  }


  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      Array.from(input.files).forEach(file => {
        this.editingPlayerPhotoFiles.push(file);

        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          this.editingPlayerPhotosPreviews.push(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      });
    }
  }


  removePhotoPreview(index: number): void {
    this.editingPlayerPhotoFiles.splice(index, 1);
    this.editingPlayerPhotosPreviews.splice(index, 1);
  }


  async deletePhoto(playerId: string, photoId: string): Promise<void> {
    if (!this.dbReady) return;
    
    if (confirm('Удалить это фото?')) {
      try {
        await this.indexedDbService.deletePhoto(photoId);

        const player = this.players.find(p => p.id === playerId);
        if (player && player.photoIds && Array.isArray(player.photoIds)) {
          const newPhotoIds = player.photoIds.filter(id => id !== photoId);
          this.gameStateService.updatePlayer(
            playerId, 
            player.name, 
            player.city, 
            newPhotoIds,
            player.questionCount
          );
        }

        if (this.playerPhotoUrls[photoId]) {
          URL.revokeObjectURL(this.playerPhotoUrls[photoId]);
          delete this.playerPhotoUrls[photoId];
        }

        if (this.playerPhotosData[playerId]) {
          this.playerPhotosData[playerId] = this.playerPhotosData[playerId].filter(
            p => p.photoId !== photoId
          );
        }
      } catch (error) {
        console.error('Error deleting photo:', error);
        alert('Ошибка при удалении фото');
      }
    }
  }


  toggleAddPlayer(): void {
    this.showAddPlayer = !this.showAddPlayer;
    if (this.showAddPlayer) {
      this.editingPlayerId = null;
      this.editingPlayerName = '';
      this.editingPlayerCity = '';
      this.editingPlayerQuestionCount = 0;
      this.editingPlayerPhotoFiles = [];
      this.editingPlayerPhotosPreviews = [];
    }
  }


  async onAddPlayer(): Promise<void> {
    if (!this.editingPlayerName.trim() || !this.dbReady) {
      alert('Введите имя игрока');
      return;
    }

    // Сначала добавляем игрока БЕЗ фото
    this.gameStateService.addPlayer(
      this.editingPlayerName, 
      this.editingPlayerCity, 
      [],
      this.editingPlayerQuestionCount
    );
    
    // Получаем ID только что добавленного игрока
    const addedPlayer = this.gameStateService.getGameState().players.slice(-1)[0];
    const playerId = addedPlayer.id;

    // Сохраняем фото с РЕАЛЬНЫМ ID игрока
    const photoIds: string[] = [];

    for (const file of this.editingPlayerPhotoFiles) {
      try {
        const photoId = await this.indexedDbService.savePhoto(playerId, file);
        photoIds.push(photoId);
        // Загружаем URL нового фото
        this.loadPhotoUrl(photoId);
      } catch (error) {
        console.error('Error saving photo:', error);
        alert('Ошибка при сохранении фото');
        // Откатываем - удаляем игрока если ошибка
        this.gameStateService.deletePlayer(playerId);
        return;
      }
    }

    // Обновляем игрока с фото
    this.gameStateService.updatePlayer(
      playerId, 
      this.editingPlayerName, 
      this.editingPlayerCity, 
      photoIds,
      this.editingPlayerQuestionCount
    );

    // Очищаем форму
    this.editingPlayerName = '';
    this.editingPlayerCity = '';
    this.editingPlayerQuestionCount = 0;
    this.editingPlayerPhotoFiles = [];
    this.editingPlayerPhotosPreviews = [];
    this.showAddPlayer = false;
  }


  async onDeletePlayer(playerId: string): Promise<void> {
    if (!this.dbReady) return;
    
    if (confirm('Вы уверены, что хотите удалить игрока? Это удалит все его фото!')) {
      try {
        await this.indexedDbService.deletePlayerPhotos(playerId);
      } catch (error) {
        console.error('Error deleting player photos:', error);
      }

      const player = this.players.find(p => p.id === playerId);
      if (player && player.photoIds && Array.isArray(player.photoIds)) {
        player.photoIds.forEach(photoId => {
          if (this.playerPhotoUrls[photoId]) {
            URL.revokeObjectURL(this.playerPhotoUrls[photoId]);
            delete this.playerPhotoUrls[photoId];
          }
        });
      }

      delete this.playerPhotosData[playerId];
      this.gameStateService.deletePlayer(playerId);
    }
  }


  async onResetGame(): Promise<void> {
    if (!this.dbReady) return;
    
    if (confirm('Сбросить всю игру? Это удалит всех игроков и их фото!')) {
      try {
        await this.indexedDbService.clear();
      } catch (error) {
        console.error('Error clearing database:', error);
      }

      Object.values(this.playerPhotoUrls).forEach(url => {
        URL.revokeObjectURL(url);
      });
      this.playerPhotoUrls = {};
      this.playerPhotosData = {};

      this.gameStateService.resetGame();
    }
  }


  toggleExpanded(playerId: string): void {
    this.expandedPlayerId = this.expandedPlayerId === playerId ? null : playerId;
  }


  isEditing(playerId: string): boolean {
    return this.editingPlayerId === playerId;
  }


  getPlayerPhotos(playerId: string): PhotoRecord[] {
    return this.playerPhotosData[playerId] || [];
  }
}
