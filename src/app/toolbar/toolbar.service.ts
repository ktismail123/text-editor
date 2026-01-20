import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToolbarPosition {
  top: number;
  left: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToolbarService {
  // Angular 15: Use BehaviorSubject instead of Signals
  isVisible = new BehaviorSubject<boolean>(false);
  position = new BehaviorSubject<ToolbarPosition>({ top: 0, left: 0 });
  isUpdating = new BehaviorSubject<boolean>(false);
  
  activeStates = new BehaviorSubject<{ [key: string]: boolean | string | number }>({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    fontSize: 12 
  });

  private savedRange: Range | null = null;

  show(selectionRect: DOMRect, containerRect: DOMRect) {
    const top = containerRect.top + window.scrollY; 
    const left = containerRect.left + window.scrollX;
    
    this.position.next({ top, left });
    this.isVisible.next(true);
    this.updateActiveStates();
  }

  hide() {
    this.isVisible.next(false);
  }

  saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      
      if (this.isContentEditable(container)) {
        this.savedRange = range.cloneRange();
      }
    }
  }

  private isContentEditable(node: Node | null): boolean {
    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.getAttribute('contenteditable') === 'true') {
          return true;
        }
        if (el.getAttribute('contenteditable') === 'false') {
          return false;
        }
        if (el.classList.contains('floating-toolbar')) {
            return false;
        }
      }
      node = node.parentNode;
    }
    return false;
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

  updateActiveStates() {
    let currentFontSize = 12;
    const sel = window.getSelection();
    if (sel && sel.anchorNode && this.isContentEditable(sel.anchorNode)) {
        const span = sel.anchorNode.parentElement;
        if (span) {
            const computed = window.getComputedStyle(span).fontSize;
            const parsed = parseFloat(computed);
            if (!isNaN(parsed)) {
                currentFontSize = parseFloat(parsed.toFixed(1));
            }
        }
        
        this.activeStates.next({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          justifyLeft: document.queryCommandState('justifyLeft'),
          justifyCenter: document.queryCommandState('justifyCenter'),
          justifyRight: document.queryCommandState('justifyRight'),
          fontSize: currentFontSize
        });
    }
  }

  executeCommand(command: string, value: string = '') {
    this.isUpdating.next(true);
    try {
      this.restoreSelection();
      // Use CSS styles instead of semantic tags if possible
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand(command, false, value);
      this.saveSelection(); 
      this.updateActiveStates();
    } finally {
      this.isUpdating.next(false);
    }
  }

  // Precise font size setter using Font Name Marker strategy
  setFontSize(size: number) {
    this.isUpdating.next(true);
    const markerFont = 'cdk-marker-font'; // Unique font name

    try {
      this.restoreSelection();
      
      // Force styleWithCSS OFF to ensure <font face="..."> generation for the marker
      document.execCommand('styleWithCSS', false, 'false');
      
      // Use fontName which is distinct and guaranteed to wrap
      document.execCommand('fontName', false, markerFont);
      
      // Switch back to CSS mode preferably
      document.execCommand('styleWithCSS', false, 'true');
      
      // Scope search to container
      let container: Element = document.body;
      if (this.savedRange && this.savedRange.commonAncestorContainer) {
          const node = this.savedRange.commonAncestorContainer;
          container = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as Element;
      }

      // Robust Search: Look for BOTH <font> tags AND <span> tags with the marker font.
      // Some browsers might insist on spans even with styleWithCSS=false.
      const fontTags = container.querySelectorAll(`font[face="${markerFont}"]`);
      // Note: quotes in style attribute might vary, so checking strict string presence is safest via filter if needed, 
      // but querySelector is faster. We try standard patterns.
      const spanTags = container.querySelectorAll(`span[style*="${markerFont}"]`);
      
      const toReplace: HTMLElement[] = [
          ...Array.from(fontTags) as HTMLElement[], 
          ...Array.from(spanTags) as HTMLElement[]
      ];
      
      const newSpans: HTMLElement[] = [];

      toReplace.forEach(el => {
          // 1. Clean Inner Styles (as before, to handle partial overlap)
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
          // If this marker is the only child of a span that defines font-size,
          // we should update that parent instead of nesting a new span inside.
          const parent = el.parentElement;
          const isParentFontSpan = parent && 
                                   parent.tagName === 'SPAN' && 
                                   parent.style.fontSize &&
                                   parent.childNodes.length === 1; // Strictly only child

          if (isParentFontSpan) {
              // OPTIMIZATION: Reuse parent span
              parent.style.fontSize = `${size}px`;
              // Unwrap the <font> marker (move children to parent)
              while (el.firstChild) {
                  parent.insertBefore(el.firstChild, el);
              }
              el.remove();
              // Track the parent as the "new" span for selection
              newSpans.push(parent);
          } else {
              // Standard Case: Create new span
              const span = document.createElement('span');
              span.style.fontSize = `${size}px`;
              span.innerHTML = el.innerHTML;
              el.replaceWith(span);
              newSpans.push(span);
          }
      });

      // Re-establish selection
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
      
      // OPTIMIZED: Force-set the state with the known size immediately.
      const current = this.activeStates.value;
      this.activeStates.next({
          ...current,
          fontSize: size
      });
      
    } finally {
      this.isUpdating.next(false);
    }
  }
}
