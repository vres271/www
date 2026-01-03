import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService, Player } from '../../services/game-state';
import { IndexedDbService } from '../../services/indexed-db';
import { AudioService } from '../../services/audio';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';



@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './players.html',
  styleUrl: './players.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Players implements OnInit, OnDestroy {
  players: Player[] = [];
  activePlayerIndices: number[] = [];
  currentPlayer: Player | null = null;
  currentPlayerPhoto: string | null = null;
  knowledgeScore = 0;
  viewerScore = 0;

  // Таймер
  timerActive = false;
  timerRemaining = 60;
  timerTotal = 60;

  playerPhotoUrls: { [photoId: string]: string } = {};
  isSpinning = false;
  wheelRotation = 0;
  
  private destroy$ = new Subject<void>();
  private wasSpinning = false;



  constructor(
    private gameStateService: GameStateService,
    private indexedDbService: IndexedDbService,
    private audioService: AudioService,
    private cd: ChangeDetectorRef
  ) {}



  ngOnInit(): void {
    this.gameStateService.gameState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.updateGameState(state);
      });



    interval(300)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const currentState = this.gameStateService.getGameState();
        this.updateGameState(currentState);
      });
  }



  private updateGameState(state: any): void {
    this.players = state.players;
    this.knowledgeScore = state.knowledgeScore;  
    this.viewerScore = state.viewerScore;

    // Таймер
    this.timerActive = state.timerActive;
    this.timerRemaining = state.timerRemaining;

    this.activePlayerIndices = this.players
      .map((p, i) => ({ player: p, index: i }))
      .filter(({ player }) => player.questionCount > 0)
      .map(({ index }) => index);
    
    const isCurrentlySpinning = state.currentPlayerId !== null && state.currentPlayerId !== undefined;
    
    // СОБЫТИЕ: Барабан начал вращаться
    if (isCurrentlySpinning && !this.wasSpinning) {
      console.log('🔄 Wheel started spinning');
      this.wasSpinning = true;
      this.isSpinning = true;
      
      // Включаем звук волчка
      this.audioService.play('wheel', 0.8);
      
      this.startWheelAnimation(state.currentPlayerId, state.currentPhotoId);
    }
    
    // СОБЫТИЕ: Барабан перестал вращаться
    if (!isCurrentlySpinning && this.wasSpinning) {
      console.log('⏹️ Wheel stopped spinning');
      this.wasSpinning = false;
      
      // Выключаем звук
      this.audioService.stop();
      
      this.currentPlayer = null;
      this.currentPlayerPhoto = null;
    }
    
    this.cd.markForCheck();
  }



  private startWheelAnimation(selectedPlayerId: string, photoId: string | null): void {
    if (this.activePlayerIndices.length === 0) return;


    const selectedPlayer = this.players.find(p => p.id === selectedPlayerId);
    if (!selectedPlayer) return;


    const selectedIndex = this.activePlayerIndices.indexOf(
      this.players.indexOf(selectedPlayer)
    );
    
    if (selectedIndex === -1) return;


    const spinDuration = 20000;
    const fullRotations = 8;
    const totalSegments = this.activePlayerIndices.length;
    const anglePerSegment = 360 / totalSegments;
    
    // Центр сегмента
    const selectedSegmentCenter = selectedIndex * anglePerSegment + (anglePerSegment / 2);
    
    // Добавляем смещение на один полный сегмент
    const offset = anglePerSegment / 2;
    
    // Поворачиваем так, чтобы центр был под указателем
    const finalAngle = fullRotations * 360 + (360 - selectedSegmentCenter) + offset;


    console.log(`Index: ${selectedIndex}, Segment center: ${selectedSegmentCenter}°, Offset: ${offset}°, Final angle: ${finalAngle}°`);


    const wheelElement = document.querySelector('.wheel') as HTMLElement;
    if (wheelElement) {
      wheelElement.style.transition = `transform ${spinDuration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      wheelElement.style.transform = `rotate(${finalAngle}deg)`;
    }


    setTimeout(() => {
      this.cd.markForCheck();
      this.audioService.stop();


      setTimeout(() => {
        this.currentPlayer = selectedPlayer;
        if (photoId) {
          this.loadPhotoUrl(photoId);
        }
        this.cd.markForCheck();
      }, 3000);
    }, spinDuration);
  }

  /**
   * Получить процент времени для прогресс-бара
   */
  getTimerPercentage(): number {
    return (this.timerRemaining / this.timerTotal) * 100;
  }

  /**
   * Форматирует время в MM:SS
   */
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }



  ngOnDestroy(): void {
    Object.values(this.playerPhotoUrls).forEach(url => {
      URL.revokeObjectURL(url);
    });
    
    this.wasSpinning = false;
    this.audioService.stop();
    
    this.destroy$.next();
    this.destroy$.complete();
  }



  private loadPhotoUrl(photoId: string): void {
    if (this.playerPhotoUrls[photoId]) {
      this.currentPlayerPhoto = this.playerPhotoUrls[photoId];
      return;
    }


    this.indexedDbService.getPhoto(photoId)
      .then(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          this.playerPhotoUrls[photoId] = url;
          this.currentPlayerPhoto = url;
          this.cd.markForCheck();
        }
      })
      .catch(error => console.error('Error loading photo:', error));
  }
}
