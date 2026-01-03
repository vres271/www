import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Player {
  id: string;
  name: string;
  city: string;
  photoIds: string[];
}


export interface GameState {
  gameActive: boolean;
  currentPlayerId: string | null;
  timeRemaining: number;
  knowledgeScore: number;
  viewerScore: number;
  players: Player[];
}

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  private gameStateSubject = new BehaviorSubject<GameState>(this.getInitialState());
  public gameState$ = this.gameStateSubject.asObservable();

  constructor() {
    this.loadFromStorage();
  }

  private getInitialState(): GameState {
    return {
      gameActive: false,
      currentPlayerId: null,
      timeRemaining: 0,
      knowledgeScore: 0,
      viewerScore: 0,
      players: []
    };
  }

  loadFromStorage(): void {
    const saved = localStorage.getItem('gameState');
    if (saved) {
      try {
        this.gameStateSubject.next(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading game state', e);
      }
    }
  }

  updateGameState(state: Partial<GameState>): void {
    const current = this.gameStateSubject.value;
    const updated = { ...current, ...state };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
  }

  getGameState(): GameState {
    return this.gameStateSubject.value;
  }

  // Методы для работы с игроками
  addPlayer(name: string, city: string = '', photoIds: string[] = []): void {
    const current = this.gameStateSubject.value;
    const newPlayer: Player = {
      id: this.generateId(),
      name,
      city,
      photoIds
    };
    const updated = { ...current, players: [...current.players, newPlayer] };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
  }

  updatePlayer(playerId: string, name: string, city: string, photoIds: string[]): void {
    const current = this.gameStateSubject.value;
    const updated = {
      ...current,
      players: current.players.map(p =>
        p.id === playerId ? { ...p, name, city, photoIds } : p
      )
    };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
  }

  deletePlayer(playerId: string): void {
    const current = this.gameStateSubject.value;
    const updated = {
      ...current,
      players: current.players.filter(p => p.id !== playerId)
    };
    this.gameStateSubject.next(updated);
    localStorage.setItem('gameState', JSON.stringify(updated));
  }

  resetGame(): void {
    this.gameStateSubject.next(this.getInitialState());
    localStorage.removeItem('gameState');
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
