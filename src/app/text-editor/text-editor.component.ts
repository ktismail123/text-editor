import { Component, ElementRef, ViewChild, forwardRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './text-editor.component.html',
  styleUrls: ['./text-editor.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextEditorComponent),
      multi: true
    }
  ]
})
export class TextEditorComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  @ViewChild('editor', { static: true }) editorRef!: ElementRef<HTMLDivElement>;

  content: string = '';
  isDisabled: boolean = false;
  private savedRange: Range | null = null;
  
  // Toolbar state
  toolbarState: { [key: string]: boolean | string | number } = {
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    fontSize: 12 // Default px
  };

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private selectionChangeHandler = () => this.updateToolbarState();

  ngAfterViewInit() {
    document.addEventListener('selectionchange', this.selectionChangeHandler);
  }

  ngOnDestroy() {
    document.removeEventListener('selectionchange', this.selectionChangeHandler);
  }

  // --- ControlValueAccessor Implementation ---
  writeValue(value: string): void {
    this.content = value || '';
    if (this.editorRef && this.editorRef.nativeElement.innerHTML !== this.content) {
      this.editorRef.nativeElement.innerHTML = this.content;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    if (this.editorRef) {
      this.editorRef.nativeElement.contentEditable = isDisabled ? 'false' : 'true';
    }
  }

  // --- event Handlers ---
  onInput(): void {
    const html = this.editorRef.nativeElement.innerHTML;
    // Clean up empty lines if needed before emitting
    this.content = this.cleanupEmptyLines(html);
    this.onChange(this.content);
    this.saveSelection();
    this.updateToolbarState();
  }

  cleanupEmptyLines(html: string): string {
    // 1. Create a temp div to parse HTML
    const div = document.createElement('div');
    div.innerHTML = html;

    // 2. Remove empty block elements (p, div) that just contain <br>, whitespace or nothing
    // We iterate in reverse to handle nesting safely if needed, though simpler is likely fine via QuerySelector
    const blocks = div.querySelectorAll('p, div');
    blocks.forEach(block => {
        const text = block.textContent || '';
        // If it strictly contains only whitespace/br/empty
        if (!text.trim() && block.innerHTML.trim().replace(/<br\s*\/?>/gi, '') === '') {
            block.remove();
        }
    });

    // 3. Remove standalone <br> tags at the root level if they are just creating noise?
    // User requested "remove all empty lines". Usually this means empty paragraphs or just <br>s.
    // If we just want to TRIM leading/trailing empty lines, that's one thing. 
    // If we want to remove ALL empty lines between paragraphs:
    
    // Let's implement a 'compact' cleanup:
    // Remove all <br> that are not significant?
    // Or just simple regex for simpler inputs:
    
    let cleanHtml = div.innerHTML;
    // Regex strategy for simple recurring empty lines:
    // Replace multiple <br> with single or remove empty p?
    
    // Re-read user request: "click that submit button, these dat i need to remove all empty lines"
    // Usually means trimming start/end and collapsing multiple newlines.
    
    // Simple heuristic: 
    // 1. Replace <p><br></p> or <div><br></div> with empty
    cleanHtml = cleanHtml.replace(/<(p|div)>\s*<br\s*\/?>\s*<\/\1>/gi, '');
    // 2. Remove standalone <br>
    // cleanHtml = cleanHtml.replace(/<br\s*\/?>/gi, ''); // Too aggressive? contenteditable uses <br> for newlines.
    
    // User Update: "Remove all empty lines". 
    // If the editor creates <div><br></div> for a new line, removing that collapses the text. 
    // I will assume they want to remove TRAILING/LEADING whitespace or "blank" blocks primarily.
    
    // Let's stick to the DOM removal of empty blocks we did above (step 2), and then just trim.
    
    return div.innerHTML.trim(); 
  }

  onBlur(): void {
    this.onTouched();
  }

  onFocus(): void {
    this.updateToolbarState();
  }

  handleMousedown(event: MouseEvent) {
    if ((event.target as HTMLElement).tagName !== 'INPUT') {
      event.preventDefault();
    }
  }

  // --- Formatting logic ---
  execCommand(command: string, value: string = ''): void {
    if (this.isDisabled) return;
    
    this.restoreSelection();
    this.editorRef.nativeElement.focus();
    // Use CSS styles instead of semantic tags if possible ("appending styles")
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, value);
    this.saveSelection();
    this.updateToolbarState();
    this.onInput();
  }

  execWithPrompt(command: string, message: string) {
    const value = prompt(message);
    if (value) {
      this.execCommand(command, value);
    }
  }

  // Handle +/- clicks
  changeFontSize(delta: number) {
    const current = this.getCurrentFontSize();
    const newSize = current + delta;
    if (newSize >= 1) {
      this.setFontSize(newSize);
    }
  }

  // Handle Input manual entry
  setManualFontSize(value: string) {
    const newSize = parseFloat(value);
    if (!isNaN(newSize) && newSize >= 1) {
        this.setFontSize(newSize);
    }
  }
  
  private getCurrentFontSize(): number {
    const size = this.toolbarState['fontSize'];
    return typeof size === 'number' ? size : 12;
  }

  // Precise font size setter using Font Marker Strategy
  setFontSize(size: number) {
     this.restoreSelection();
     const markerFont = 'cdk-marker-font';

     // CRITICAL: Force styleWithCSS OFF to guarantee <font> tags logic
     document.execCommand('styleWithCSS', false, 'false');
     
     // Use fontName 'cdk-marker-font' as a unique ID
     document.execCommand('fontName', false, markerFont);
 
     // Robust Search: Look for BOTH <font> tags AND <span> tags
     const fontTags = this.editorRef.nativeElement.querySelectorAll(`font[face="${markerFont}"]`);
     const spanTags = this.editorRef.nativeElement.querySelectorAll(`span[style*="${markerFont}"]`);
     
     const toReplace: HTMLElement[] = [
         ...Array.from(fontTags) as HTMLElement[], 
         ...Array.from(spanTags) as HTMLElement[]
     ];
     
     const newSpans: HTMLElement[] = [];

     toReplace.forEach(el => {
         // 1. Clean Inner Styles
         const descendants = el.querySelectorAll('*');
         descendants.forEach((node) => {
             if (node instanceof HTMLElement) {
                 node.style.fontSize = '';
                 if (node.tagName === 'FONT') {
                     node.removeAttribute('size');
                     node.removeAttribute('face');
                 }
             }
         });

         // 2. Parent Flattening Check
         const parent = el.parentElement;
         const isParentFontSpan = parent && 
                                  parent.tagName === 'SPAN' && 
                                  parent.style.fontSize &&
                                  parent.childNodes.length === 1;

         if (isParentFontSpan) {
              // OPTIMIZATION: Reuse parent span
              parent.style.fontSize = `${size}px`;
              // Unwrap marker
              while (el.firstChild) {
                  parent.insertBefore(el.firstChild, el);
              }
              el.remove();
              newSpans.push(parent);
         } else {
             // Standard Create
             const span = document.createElement('span');
             span.style.fontSize = `${size}px`;
             span.innerHTML = el.innerHTML;
             el.replaceWith(span);
             newSpans.push(span);
         }
     });

     if (newSpans.length > 0) {
         const sel = window.getSelection();
         if (sel) {
             sel.removeAllRanges();
             const range = document.createRange();
             range.setStartBefore(newSpans[0]);
             range.setEndAfter(newSpans[newSpans.length - 1]);
             sel.addRange(range);
         }
     }
 
     this.saveSelection();
     
     // OPTIMIZED: Update state directly to avoid display lag
     this.updateToolbarState(); // Updates other buttons (bold/italic)
     this.toolbarState['fontSize'] = size; // Force correct size override
     
     this.onInput();
  }

  saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      if (this.editorRef.nativeElement.contains(sel.anchorNode)) {
         this.savedRange = sel.getRangeAt(0).cloneRange();
      }
    }
  }

  restoreSelection() {
    if (this.savedRange) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(this.savedRange);
      }
    }
  }
  
  saveRange() {
      this.saveSelection();
  }

  updateToolbarState(): void {
    if (!this.editorRef) return;
    
    // Check if focus is inside the editor
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode || !this.editorRef.nativeElement.contains(selection.anchorNode)) {
        return; 
    }

    // Get computed font size
    let currentFontSize = 12;
    if (selection.anchorNode) {
        const span = selection.anchorNode.parentElement;
        if (span) {
            const computed = window.getComputedStyle(span).fontSize;
            const parsed = parseFloat(computed);
            if (!isNaN(parsed)) {
                currentFontSize = parseFloat(parsed.toFixed(1));
            }
        }
    }

    this.toolbarState['bold'] = document.queryCommandState('bold');
    this.toolbarState['italic'] = document.queryCommandState('italic');
    this.toolbarState['underline'] = document.queryCommandState('underline');
    this.toolbarState['justifyLeft'] = document.queryCommandState('justifyLeft');
    this.toolbarState['justifyCenter'] = document.queryCommandState('justifyCenter');
    this.toolbarState['justifyRight'] = document.queryCommandState('justifyRight');
    this.toolbarState['fontSize'] = currentFontSize;
  }
}
