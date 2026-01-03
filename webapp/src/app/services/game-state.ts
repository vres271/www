import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Player {
  id: string;
  name: string;
  city: string;
  photoIds: string[];
  questionCount: number;
}

export interface GameState {
  players: Player[];
  knowledgeScore: number;
  viewerScore: number;
  currentPlayerId: string | null;
  currentPlayerPhotoId: string | null;
  timerActive: boolean;
  timerRemaining: number; // в секундах
}

export const initialGameState: GameState = {
  players: [],
  knowledgeScore: 0,
  viewerScore: 0,
  currentPlayerId: null,
  currentPlayerPhotoId: null,
  timerActive: false,
  timerRemaining: 60
};


@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  private gameStateSubject = new BehaviorSubject<GameState>(this.getInitialState());
  public gameState$ = this.gameStateSubject.asObservable();

  constructor() {
    this.loadFromStorage();
    
    // Слушаем изменения localStorage от других вкладок/окон
    window.addEventListener('storage', (event) => {
      if (event.key === 'gameState' && event.newValue) {
        try {
          const newState = JSON.parse(event.newValue);
          this.gameStateSubject.next(newState);
          // console.log('Storage updated from other tab:', newState);
        } catch (e) {
          console.error('Error parsing storage event:', e);
        }
      }
    });
  }

  private getInitialState(): GameState {
    return initialGameState;
  }

  loadFromStorage(): void {
    const saved = localStorage.getItem('gameState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.gameStateSubject.next(parsed);
        // console.log('Loaded from storage:', parsed);
      } catch (e) {
        console.error('Error loading game state', e);
      }
    }
  }

  updateGameState(state: Partial<GameState>): void {
    const current = this.getGameState(); // ← Всегда читаем свежее значение
    const updated = { ...current, ...state };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
    // console.log('Updated game state:', updated);
  }

  /**
   * Получить текущее состояние из localStorage (не из кэша)
   */
  getGameState(): GameState {
    const saved = localStorage.getItem('gameState');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Синхронизируем с Subject если значение отличается
        if (JSON.stringify(parsed) !== JSON.stringify(this.gameStateSubject.value)) {
          this.gameStateSubject.next(parsed);
        }
        // console.log('getGameState (from localStorage):', parsed);
        return parsed;
      } catch (e) {
        console.error('Error parsing stored game state:', e);
        return this.gameStateSubject.value;
      }
    }
    return this.gameStateSubject.value;
  }

  // Методы для работы с игроками
  addPlayer(name: string, city: string = '', photoIds: string[] = [], questionCount: number = 0): void {
    const current = this.getGameState();
    const newPlayer: Player = {
      id: this.generateId(),
      name,
      city,
      photoIds,
      questionCount
    };
    const updated = { ...current, players: [...current.players, newPlayer] };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
    console.log('Added player:', newPlayer);
  }

  updatePlayer(playerId: string, name: string, city: string, photoIds: string[], questionCount: number = 0): void {
    const current = this.getGameState();
    const updated = {
      ...current,
      players: current.players.map(p =>
        p.id === playerId ? { ...p, name, city, photoIds, questionCount } : p
      )
    };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
    console.log('Updated player:', playerId);
  }

  deletePlayer(playerId: string): void {
    const current = this.getGameState();
    const updated = {
      ...current,
      players: current.players.filter(p => p.id !== playerId)
    };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
    console.log('Deleted player:', playerId);
  }

  // Уменьшить количество вопросов игрока
  decrementPlayerQuestions(playerId: string): void {
    const current = this.getGameState();
    const updated = {
      ...current,
      players: current.players.map(p => {
        if (p.id === playerId && p.questionCount > 0) {
          return { ...p, questionCount: p.questionCount - 1 };
        }
        return p;
      })
    };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
    console.log('Decremented questions for player:', playerId, 'New count:', updated.players.find(p => p.id === playerId)?.questionCount);
  }

  setCurrentPlayer(playerId: string | null, photoId: string | null = null): void {
    const current = this.getGameState();
    const updated = { ...current, currentPlayerId: playerId, currentPhotoId: photoId };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
    console.log('Set current player:', playerId);
  }

  resetGame(): void {
    const initial = this.getInitialState();
    this.gameStateSubject.next(initial);
    localStorage.removeItem('gameState');
    console.log('Game reset');
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
