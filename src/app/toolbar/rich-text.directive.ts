import { Directive, ElementRef, HostListener, forwardRef, inject, OnDestroy, AfterViewInit } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ToolbarService } from './toolbar.service';

@Directive({
  selector: '[appRichText]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextDirective),
      multi: true
    }
  ],
  host: {
    '[contentEditable]': 'isDisabled ? "false" : "true"',
    '[style.outline]': '"none"',
    '[style.min-height]': '"1em"',
    '[style.cursor]': '"text"'
  }
})
export class RichTextDirective implements ControlValueAccessor, AfterViewInit, OnDestroy {
  private el = inject(ElementRef);
  private toolbarService = inject(ToolbarService);
  
  isDisabled = false;
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  private selectionHandler = () => this.checkSelection();

  ngAfterViewInit() {
    document.addEventListener('selectionchange', this.selectionHandler);
  }

  ngOnDestroy() {
    document.removeEventListener('selectionchange', this.selectionHandler);
  }

  @HostListener('input')
  onInput() {
    this.onChange(this.el.nativeElement.innerHTML);
    // Don't save selection here during typing if toolbar is updating something else
    // But normally we do want to known where caret is.
    if (!this.toolbarService.isUpdating.value) {
        this.toolbarService.saveSelection(); 
    }
  }

  @HostListener('blur')
  onBlur() {
    this.onTouched();
    // Don't auto-hide here; let checkSelection handle it, or timeout.
  }

  @HostListener('mouseup')
  @HostListener('keyup')
  checkSelection() {
    // CRITICAL FIX: If toolbar is performing an operation (like font size change), 
    // it triggers selection changes (sometimes collapsing them). We must IGNORE these.
    if (this.toolbarService.isUpdating.value) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    // Check ownership
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    // If selection is not inside THIS editor, we generally ignore it or hide.
    // NOTE: If user clicks the Toolbar Input, selection moves THERE. 
    // contains() will be false. So we return. We do NOT hide.
    if (!this.el.nativeElement.contains(container)) {
      return; 
    }

    if (selection.isCollapsed) {
       // If caret only, we usually hide.
       this.toolbarService.hide();
    } else {
      const selectionRect = range.getBoundingClientRect();
      const containerRect = this.el.nativeElement.getBoundingClientRect();
      
      this.toolbarService.saveSelection(); 
      
      if (selectionRect.width > 0) {
        this.toolbarService.show(selectionRect, containerRect);
      }
    }
  }

  writeValue(value: string): void {
    this.el.nativeElement.innerHTML = value || '';
  }
  
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  
  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }
}
