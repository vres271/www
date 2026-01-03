import { Injectable } from '@angular/core';

export interface AudioTrack {
  name: string;
  path: string;
  volume?: number; // 0-1
}

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private currentAudio: HTMLAudioElement | null = null;
  private audioTracks: { [key: string]: string } = {
    // Определяем доступные звуки
    wheel: 'sounds/wheel.mp3',
    chto_nasha_zizhn_voice: 'sounds/chto_nasha_zizhn_voice.mp3',
    chto_nasha_zjizn: 'sounds/chto_nasha_zjizn.mp3',
    fanfaryt: 'sounds/fanfaryt.mp3',
    gong1: 'sounds/gong1.mp3',
    gong2: 'sounds/gong2.mp3',
    pause1: 'sounds/pause1.mp3',
    pause2: 'sounds/pause2.mp3',
    pause3: 'sounds/pause3.mp3',
    pause4: 'sounds/pause4.mp3',
    predstavlenie_igrokov: 'sounds/predstavlenie_igrokov.mp3',
    timer_finished: 'sounds/timer_finished.mp3',
    timer_prefinished: 'sounds/timer_prefinished.mp3',
    timer_start: 'sounds/timer_start.mp3',
    yashik: 'sounds/yashik.mp3',
    yes1: 'sounds/yes1.mp3',
    yes2: 'sounds/yes2.mp3',
    yes3: 'sounds/yes3.mp3',
    yes4: 'sounds/yes4.mp3',
    znatoki_error: 'sounds/znatoki_error.mp3',


  };

  constructor() {}

  /**
   * Проиграть звук по имени
   * @param trackName Имя трека (ключ из audioTracks)
   * @param volume Громкость 0-1 (опционально)
   */
  play(trackName: string, volume: number = 1): void {
    const path = this.audioTracks[trackName];
    
    if (!path) {
      console.warn(`Audio track "${trackName}" not found`);
      return;
    }

    // Если что-то уже играет, останавливаем
    this.stop();

    // Создаём новый элемент audio
    this.currentAudio = new Audio(path);
    this.currentAudio.volume = Math.max(0, Math.min(1, volume)); // Клампуем значение 0-1
    this.currentAudio.play().catch(error => {
      console.error(`Error playing audio "${trackName}":`, error);
    });

    console.log(`Playing audio: ${trackName}`);
  }

  /**
   * Проиграть звук с полным путём
   */
  playFromPath(path: string, volume: number = 1): void {
    this.stop();

    this.currentAudio = new Audio(path);
    this.currentAudio.volume = Math.max(0, Math.min(1, volume));
    this.currentAudio.play().catch(error => {
      console.error(`Error playing audio from path:`, error);
    });

    console.log(`Playing audio from path: ${path}`);
  }

  /**
   * Проиграть звук с ожиданием до завершения
   */
  async playAsync(trackName: string, volume: number = 1): Promise<void> {
    return new Promise((resolve) => {
      const path = this.audioTracks[trackName];
      
      if (!path) {
        console.warn(`Audio track "${trackName}" not found`);
        resolve();
        return;
      }

      this.stop();

      this.currentAudio = new Audio(path);
      this.currentAudio.volume = Math.max(0, Math.min(1, volume));

      // Когда звук закончился
      this.currentAudio.onended = () => {
        this.currentAudio = null;
        resolve();
      };

      // Если произойдёт ошибка
      this.currentAudio.onerror = () => {
        this.currentAudio = null;
        resolve();
      };

      this.currentAudio.play().catch(() => {
        this.currentAudio = null;
        resolve();
      });

      console.log(`Playing audio (async): ${trackName}`);
    });
  }

  /**
   * Остановить текущее воспроизведение
   */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      console.log('Audio stopped');
    }
  }

  /**
   * Проверить играет ли звук
   */
  isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }

  /**
   * Получить текущий трек
   */
  getCurrentTrack(): HTMLAudioElement | null {
    return this.currentAudio;
  }

  /**
   * Зарегистрировать новый трек
   */
  registerTrack(name: string, path: string): void {
    this.audioTracks[name] = path;
    console.log(`Registered audio track: ${name}`);
  }

  /**
   * Получить все зарегистрированные треки
   */
  getTracks(): string[] {
    return Object.keys(this.audioTracks);
  }

  /**
   * Установить громкость текущего трека
   */
  setVolume(volume: number): void {
    if (this.currentAudio) {
      this.currentAudio.volume = Math.max(0, Math.min(1, volume));
    }
  }
}
