import { Component, Input, Renderer, ViewChild, ElementRef, Output, EventEmitter, Type, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { ImageCropper } from './imageCropper';
import { CropperSettings } from './cropperSettings';
import { Bounds } from './model/bounds';
import { CropPosition } from './model/cropPosition';

@Component({
    selector: 'img-cropper',
    template: `
        <span class="ng2-imgcrop">
          <input *ngIf="!settings.noFileInput" type="file" accept="image/*" (change)="fileChangeListener($event)">
          <canvas #cropcanvas
                  (mousedown)="onMouseDown($event)"
                  (mouseup)="onMouseUp($event)"
                  (mousemove)="onMouseMove($event)"
                  (mouseleave)="onMouseUp($event)"
                  (touchmove)="onTouchMove($event)"
                  (touchend)="onTouchEnd($event)"
                  (touchstart)="onTouchStart($event)">
          </canvas>
        </span>
      `
})
export class ImageCropperComponent implements AfterViewInit, OnChanges {

    @ViewChild('cropcanvas', undefined) cropcanvas:ElementRef;

    @Input('settings') public settings:CropperSettings;
    @Input('image') public image:any;
    @Input() public cropper:ImageCropper;
    @Input() public cropPosition:CropPosition;
    @Output() public cropPositionChange:EventEmitter<CropPosition> = new EventEmitter<CropPosition>();

    @Output() public onCrop:EventEmitter<any> = new EventEmitter();

    public croppedWidth:number;
    public croppedHeight:number;
    public intervalRef:number;
    public renderer:Renderer;

    private isCropPositionUpdateNeeded:boolean;

    constructor(renderer:Renderer) {
        this.renderer = renderer;
    }

    public ngAfterViewInit():void {
        let canvas:HTMLCanvasElement = this.cropcanvas.nativeElement;

        if (!this.settings) {
            this.settings = new CropperSettings();
        }

        this.renderer.setElementAttribute(canvas, 'class', this.settings.cropperClass);

        if (!this.settings.dynamicSizing) {
            this.renderer.setElementAttribute(canvas, 'width', this.settings.canvasWidth.toString());
            this.renderer.setElementAttribute(canvas, 'height', this.settings.canvasHeight.toString());
        } else {
            window.addEventListener('resize', () => {
                this.settings.canvasWidth = canvas.offsetWidth;
                this.settings.canvasHeight = canvas.offsetHeight;
                this.cropper.resizeCanvas(canvas.offsetWidth, canvas.offsetHeight, true);
            });
        }

        if (!this.cropper) {
            this.cropper = new ImageCropper(this.settings);
        }

        this.cropper.prepare(canvas);
    }

    public ngOnChanges(changes:SimpleChanges):void {
        if (this.isCropPositionChanged(changes)) {
            this.cropper.updateCropPosition(this.cropPosition.toBounds());
            if (this.cropper.isImageSet()) {
                let bounds = this.cropper.getCropBounds();
                this.image.image = this.cropper.getCroppedImage().src;
                this.onCrop.emit(bounds);
            }
            this.updateCropBounds();
        }
    }

    public onTouchMove(event:TouchEvent):void {
        this.cropper.onTouchMove(event);
    }

    public onTouchStart(event:TouchEvent):void {
        this.cropper.onTouchStart(event);
    }

    public onTouchEnd(event:TouchEvent):void {
        this.cropper.onTouchEnd(event);
        if (this.cropper.isImageSet()) {
            this.image.image = this.cropper.getCroppedImage().src;
            this.onCrop.emit(this.cropper.getCropBounds());
            this.updateCropBounds();
        }
    }

    public onMouseDown(event:MouseEvent):void {
        this.cropper.onMouseDown(event);
    }

    public onMouseUp(event:MouseEvent):void {
        if (this.cropper.isImageSet()) {
            this.cropper.onMouseUp(event);
            this.image.image = this.cropper.getCroppedImage().src;
            this.onCrop.emit(this.cropper.getCropBounds());
            this.updateCropBounds();
        }
    }

    public onMouseMove(event:MouseEvent):void {
        this.cropper.onMouseMove(event);
    }

    public fileChangeListener($event:any) {
        if($event.target.files.length === 0) return;

        let file:File = $event.target.files[0];
        if (this.settings.allowedFilesRegex.test(file.name)) {
            let image:any = new Image();
            let fileReader:FileReader = new FileReader();
            let that = this;

            fileReader.addEventListener('loadend', function (loadEvent:any) {
                image.src = loadEvent.target.result;
                that.setImage(image);
            });

            fileReader.readAsDataURL(file);
        }
    }

    public reset():void {
        this.cropper.reset();
        this.renderer.setElementAttribute(this.cropcanvas.nativeElement, 'class', this.settings.cropperClass);
        this.image.image = this.cropper.getCroppedImage().src;
    }

    public setImage(image:HTMLImageElement, newBounds:any = null) {
        let self = this;
        this.renderer.setElementAttribute(this.cropcanvas.nativeElement, 'class', `${this.settings.cropperClass} ${this.settings.croppingClass}`);
        this.intervalRef = window.setInterval(() => {
            if (self.intervalRef) {
                clearInterval(self.intervalRef);
            }
            if (image.naturalHeight > 0 && image.naturalWidth > 0) {


                image.height = image.naturalHeight;
                image.width = image.naturalWidth;

                clearInterval(self.intervalRef);
                    if (this.settings.dynamicSizing) {
                        let canvas:HTMLCanvasElement = this.cropcanvas.nativeElement;
                        this.settings.canvasWidth = canvas.offsetWidth;
                        this.settings.canvasHeight = canvas.offsetHeight;
                        this.cropper.resizeCanvas(canvas.offsetWidth, canvas.offsetHeight, false);
                    }


                self.cropper.setImage(image);
                if (self.cropPosition && self.cropPosition.isInitialized()) {
                    self.cropper.updateCropPosition(self.cropPosition.toBounds());
                }
                self.image.original = image;
                let bounds = self.cropper.getCropBounds();
                self.image.image = self.cropper.getCroppedImage().src;
                if (newBounds != null) {
                    bounds = newBounds;
                    self.cropper.setBounds(bounds);
                }
                self.onCrop.emit(bounds);
            }
        }, 30);
    }

    private isCropPositionChanged(changes:SimpleChanges):boolean {
        if (this.cropper && changes['cropPosition'] && this.isCropPositionUpdateNeeded) {
            return true;
        } else {
            this.isCropPositionUpdateNeeded = true;
            return false;
        }
    }

    private updateCropBounds():void {
        let cropBound:Bounds = this.cropper.getCropBounds();
        this.cropPositionChange.emit(new CropPosition(cropBound.left, cropBound.top, cropBound.width, cropBound.height));
        this.isCropPositionUpdateNeeded = false;
    }

}
