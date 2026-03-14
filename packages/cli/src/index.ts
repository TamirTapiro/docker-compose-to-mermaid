#!/usr/bin/env node
import { program } from 'commander';
import { buildGenerateCommand } from './commands/generate.js';
import { buildValidateCommand } from './commands/validate.js';
import { buildInitCommand } from './commands/init.js';

program
  .name('dc2mermaid')
  .description('Convert docker-compose.yml to Mermaid diagrams')
  .version('0.1.0');

program.addCommand(buildGenerateCommand());
program.addCommand(buildValidateCommand());
program.addCommand(buildInitCommand());

program.parse();
