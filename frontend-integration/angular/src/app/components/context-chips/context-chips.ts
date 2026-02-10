/**
 * Context Chips Component
 *
 * Quick action chips for common analysis operations.
 * Provides one-click shortcuts for frequently used prompts.
 */

import {
  Component,
  Output,
  EventEmitter,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SEMANTIC_CONFIG } from '../../config/semantic-config';

export interface ChipAction {
  id: string;
  label: string;
  prompt: string;
}

@Component({
  selector: 'app-context-chips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './context-chips.html',
  styleUrl: './context-chips.css',
})
export class ContextChipsComponent {
  @Input() disabled = false;
  @Input() visible = true;
  @Output() chipClick = new EventEmitter<ChipAction>();

  chips: ChipAction[] = SEMANTIC_CONFIG.quickChips;

  handleChipClick(chip: ChipAction): void {
    if (!this.disabled) {
      this.chipClick.emit(chip);
    }
  }
}
