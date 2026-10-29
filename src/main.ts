import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app/app-shell.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppShellComponent, { providers: [provideRouter(routes)] }).catch(console.error);
