import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolbarService } from './toolbar.service';

@Component({
  selector: 'app-floating-toolbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './floating-toolbar.component.html',
  styleUrls: ['./floating-toolbar.component.scss']
})
export class FloatingToolbarComponent {
  private toolbarService = inject(ToolbarService);

  isVisible = this.toolbarService.isVisible;
  position = this.toolbarService.position;
  activeStates = this.toolbarService.activeStates;

  handleMousedown(event: MouseEvent) {
    if ((event.target as HTMLElement).tagName !== 'INPUT') {
      event.preventDefault(); 
    } 
  }

  exec(command: string, value: string = '') {
    this.toolbarService.executeCommand(command, value);
  }
  
  execWithPrompt(command: string, message: string) {
    const value = prompt(message);
    if (value) {
      this.exec(command, value);
    }
  }

  // Handle +/- clicks
  changeFontSize(delta: number) {
    const current = this.getCurrentFontSize();
    const newSize = current + delta;
    if (newSize >= 1) {
      this.toolbarService.setFontSize(newSize);
    }
  }

  // Handle Input manual entry
  setManualFontSize(value: string) {
    const newSize = parseFloat(value);
    if (!isNaN(newSize) && newSize >= 1) {
        this.toolbarService.setFontSize(newSize);
    }
  }

  private getCurrentFontSize(): number {
    const state = this.activeStates.value;
    // Safely cast or parse, fallback to 12
    const size = state['fontSize'];
    return typeof size === 'number' ? size : 12;
  }

  saveRange() {
    this.toolbarService.saveSelection();
  }

  close() {
    this.toolbarService.hide();
  }
}
