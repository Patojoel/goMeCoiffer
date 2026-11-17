import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { loadLocalEnvFile } from './database/load-env.js';
import { loadConfig } from './shared/infrastructure/config/app-config.module.js';

loadLocalEnvFile();
const config = loadConfig();
const app = await NestFactory.create(AppModule.forRoot(config), { bufferLogs: true });
configureApp(app, config);
await app.listen(config.PORT);
