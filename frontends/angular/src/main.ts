import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import './styles/index.css';

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
