import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService, Player } from '../../services/game-state';
import { AudioService } from '../../services/audio';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';


@Component({
  selector: 'app-host',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './host.html',
  styleUrl: './host.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Host implements OnInit, OnDestroy {
  players: Player[] = [];
  activePlayerIndices: number[] = [];
  currentPlayer: Player | null = null;
  
  knowledgeScore = 0;
  viewerScore = 0;
  isSpinning = false;
  
  // Таймер
  timerActive = false;
  timerRemaining = 60;
  timerTotal = 60;
  private timerInterval: any = null;
  private prefinishPlayed = false;
  
  // Список доступных звуков с красивыми названиями
  soundTracks = [
    { key: 'wheel', label: '🎡 Волчок' },
    { key: 'chto_nasha_zizhn_voice', label: '📻 Что наша жизнь' },
    { key: 'chto_nasha_zjizn', label: '🎵 Мелодия' },
    { key: 'fanfaryt', label: '🎺 Фанфара' },
    { key: 'gong1', label: '🔔 Гонг 1' },
    { key: 'gong2', label: '🔔 Гонг 2' },
    { key: 'pause1', label: '⏸️ Пауза 1' },
    { key: 'pause2', label: '⏸️ Пауза 2' },
    { key: 'pause3', label: '⏸️ Пауза 3' },
    { key: 'pause4', label: '⏸️ Пауза 4' },
    { key: 'predstavlenie_igrokov', label: '👥 Представление' },
    { key: 'timer_finished', label: '⏱️ Время вышло' },
    { key: 'timer_prefinished', label: '⏱️ Последняя минута' },
    { key: 'timer_start', label: '⏱️ Начало времени' },
    { key: 'yashik', label: '📦 Ящик' },
    { key: 'yes1', label: '✅ Да 1' },
    { key: 'yes2', label: '✅ Да 2' },
    { key: 'yes3', label: '✅ Да 3' },
    { key: 'yes4', label: '✅ Да 4' },
    { key: 'znatoki_error', label: '❌ Ошибка' }
  ];

  // Отслеживаем какой звук играет
  playingTrack: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private gameStateService: GameStateService,
    private audioService: AudioService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.gameStateService.gameState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.players = state.players;
        this.knowledgeScore = state.knowledgeScore;
        this.viewerScore = state.viewerScore;
        
        this.activePlayerIndices = this.players
          .map((p, i) => ({ player: p, index: i }))
          .filter(({ player }) => player.questionCount > 0)
          .map(({ index }) => index);
        
        if (state.currentPlayerId) {
          this.currentPlayer = this.players.find(p => p.id === state.currentPlayerId) || null;
        } else {
          this.currentPlayer = null;
        }
        
        this.isSpinning = state.currentPlayerId !== null && state.currentPlayerId !== undefined;
        this.timerActive = state.timerActive;
        this.timerRemaining = state.timerRemaining;
        
        this.cd.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  /**
   * Вращает барабан
   */
  spinWheel(): void {
    if (this.activePlayerIndices.length === 0) {
      alert('Нет игроков с вопросами!');
      return;
    }

    if (this.isSpinning) return;

    this.isSpinning = true;

    // Выбираем случайного игрока из активных
    const randomIndex = Math.floor(Math.random() * this.activePlayerIndices.length);
    const selectedPlayerIndex = this.activePlayerIndices[randomIndex];
    const selectedPlayer = this.players[selectedPlayerIndex];

    // Сохраняем текущего игрока в состояние
    const photoId = selectedPlayer.photoIds && selectedPlayer.photoIds.length > 0
      ? selectedPlayer.photoIds[Math.floor(Math.random() * selectedPlayer.photoIds.length)]
      : null;
    
    this.gameStateService.setCurrentPlayer(selectedPlayer.id, photoId);

    // Уменьшаем количество вопросов
    this.gameStateService.decrementPlayerQuestions(selectedPlayer.id);

    // После 25 секунд можно вращать снова
    setTimeout(() => {
      this.isSpinning = false;
      this.cd.markForCheck();
    }, 25000);
  }

  /**
   * Запускает таймер
   */
  startTimer(): void {
    if (this.timerActive) return;

    this.timerRemaining = this.timerTotal;
    this.prefinishPlayed = false;

    // Обновляем состояние
    const current = this.gameStateService.getGameState();
    this.gameStateService.updateGameState({
      timerActive: true,
      timerRemaining: this.timerRemaining
    });

    // Играем звук старта
    this.audioService.play('timer_start', 0.8);

    // Стартуем таймер
    this.timerInterval = setInterval(() => {
      this.timerRemaining--;

      // Звук предфиниша за 10 секунд
      if (this.timerRemaining === 10 && !this.prefinishPlayed) {
        this.prefinishPlayed = true;
        this.audioService.play('timer_prefinished', 0.8);
      }

      // Время вышло
      if (this.timerRemaining <= 0) {
        clearInterval(this.timerInterval);
        this.timerRemaining = 0;
        this.audioService.play('timer_finished', 0.8);

        // Выключаем таймер через 1 секунду
        setTimeout(() => {
          const current = this.gameStateService.getGameState();
          this.gameStateService.updateGameState({
            timerActive: false,
            timerRemaining: 0
          });
          this.timerActive = false;
          this.cd.markForCheck();
        }, 1000);

        return;
      }

      // Обновляем состояние
      const current = this.gameStateService.getGameState();
      this.gameStateService.updateGameState({
        timerRemaining: this.timerRemaining
      });

      this.cd.markForCheck();
    }, 1000);
  }

  /**
   * Останавливает таймер
   */
  stopTimer(): void {
    if (!this.timerActive) return;

    clearInterval(this.timerInterval);
    this.timerActive = false;
    this.timerRemaining = 0;

    const current = this.gameStateService.getGameState();
    this.gameStateService.updateGameState({
      timerActive: false,
      timerRemaining: 0
    });

    this.cd.markForCheck();
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

  /**
   * Включить/выключить звук
   */
  toggleSound(trackKey: string): void {
    // Если этот звук уже играет, выключаем его
    if (this.playingTrack === trackKey) {
      this.audioService.stop();
      this.playingTrack = null;
      this.cd.markForCheck();
      return;
    }

    // Иначе включаем новый звук
    this.playingTrack = trackKey;
    this.audioService.play(trackKey, 0.8);
    this.cd.markForCheck();

    // Когда звук закончится, обновляем состояние
    const audio = this.audioService.getCurrentTrack();
    if (audio) {
      audio.onended = () => {
        this.playingTrack = null;
        this.cd.markForCheck();
      };
      audio.onerror = () => {
        this.playingTrack = null;
        this.cd.markForCheck();
      };
    }
  }

  /**
   * Проверить играет ли конкретный звук
   */
  isSoundPlaying(trackKey: string): boolean {
    return this.playingTrack === trackKey;
  }

  /**
   * Увеличивает очки знатоков
   */
  addKnowledgeScore(n: number): void {
    const current = this.gameStateService.getGameState();
    this.gameStateService.updateGameState({
      knowledgeScore: current.knowledgeScore + n
    });
  }

  /**
   * Увеличивает очки телезрителей
   */
  addViewerScore(n: number): void {
    const current = this.gameStateService.getGameState();
    this.gameStateService.updateGameState({
      viewerScore: current.viewerScore + n
    });
  }

  /**
   * Сбросить счёт
   */
  resetScores(): void {
    if (confirm('Сбросить счёт?')) {
      this.gameStateService.updateGameState({
        knowledgeScore: 0,
        viewerScore: 0
      });
    }
  }

  /**
   * Скрыть текущего игрока
   */
  clearCurrentPlayer(): void {
    this.currentPlayer = null;
    this.isSpinning = false;
    this.gameStateService.setCurrentPlayer(null, null);
  }
}
