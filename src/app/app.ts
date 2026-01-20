import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TextEditorComponent } from './text-editor/text-editor.component';
import { FloatingToolbarComponent } from './toolbar/floating-toolbar.component';
import { RichTextDirective } from './toolbar/rich-text.directive';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule, TextEditorComponent, FloatingToolbarComponent, RichTextDirective],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('angular-text-editor');
  editorContent = '<b>Hello</b>, start editing!';
  
  // Demo fields for floating toolbar
  titleText = 'Article Title';
  bodyText = 'Select this text to see the floating toolbar appear!';
  noteText = 'Even small notes work.';
}
