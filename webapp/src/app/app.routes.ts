import { Routes } from '@angular/router';
import { Home } from './features/home/home';
import { Players } from './features/players/players';
import { Settings } from './features/settings/settings';
import { Host } from './features/host/host';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'host', component: Host },
  { path: 'players', component: Players },
  { path: 'settings', component: Settings },
  { path: '**', redirectTo: '' }
];
