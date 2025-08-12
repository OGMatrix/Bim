/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { ViewChild, Component, OnInit, OnDestroy, AfterViewInit, ElementRef, effect } from '@angular/core';
import { Subscription } from 'rxjs';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CommonModule } from '@angular/common';

import { IDataHighlight } from '../../core/interfaces/widgets-interface';
import { LinearGaugeOptions, LinearGauge, GaugesModule, RadialGaugeOptions } from '@godind/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ISkZone, States } from '../../core/interfaces/signalk-interfaces';
import { adjustLinearScaleAndMajorTicks } from '../../core/utils/dataScales';

@Component({
    selector: 'widget-gauge-ng-linear',
    templateUrl: './widget-gauge-ng-linear.component.html',
    styleUrls: ['./widget-gauge-ng-linear.component.scss'],
    standalone: true,
    imports: [CommonModule, WidgetHostComponent, NgxResizeObserverModule, GaugesModule]
})

export class WidgetGaugeNgLinearComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  // Gauge text value for value box rendering
  public textValue: string = "--";
  // Gauge value
  public value: number = 0;
  private lastValue: number = 0;
  private lastTimestamp: number = Date.now();
  public shadowStrength: number = 0.2; // 0.2 to 1.0
  public simulate: boolean = false; // set to true to enable simulation
  private simInterval: any;

  // Gauge options
  public gaugeOptions = {} as LinearGaugeOptions;
  private isGaugeVertical: Boolean = true;

  // Zones support
  private metaSub: Subscription;
  private state: string = States.Normal;

  // SVG Gauge Properties for viewBox 0 0 300 60 (horizontal) or 0 0 60 300 (vertical)
  get isHorizontal(): boolean {
    return (this.widgetProperties?.config?.gauge?.subType ?? 'horizontal') === 'horizontal';
  }

  get svgWidth(): number {
    return this.isHorizontal ? 500 : 60;
  }
  get svgHeight(): number {
    return this.isHorizontal ? 60 : 400;
  }

  get barProps() {
    if (this.isHorizontal) {
      // Horizontal bar
      return {
        barSlant: 25,
        barMargin: 5,
        barX0: 25 + 5,
        barX1: 500 - 5 - 25,
        barY: 15,
        barHeight: 30
      };
    } else {
      // Vertical bar: use full height, centered horizontally, never overflow left
      const svgW = 60, svgH = 400;
      const barWidth = 30;
      const barSlant = 25;
      // Clamp barX so barX - barSlant >= 0 and barX + barWidth <= svgW
      let barX = (svgW - barWidth) / 2;
      if (barX - barSlant < 0) barX = barSlant;
      if (barX + barWidth > svgW) barX = svgW - barWidth;
      return {
        barSlant,
        barMargin: 0,
        barY0: 0,
        barY1: svgH,
        barX,
        barWidth
      };
    }
  }

  get backgroundPoints(): string {
    if (this.isHorizontal) {
      const { barSlant, barX0, barX1, barY, barHeight } = this.barProps;
      if (!this.mirror) {
        const x0 = barX0, y0 = barY;
        const x1 = barX1, y1 = barY;
        const x2 = barX1 - barSlant, y2 = barY + barHeight;
        const x3 = barX0 - barSlant, y3 = barY + barHeight;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      } else {
        const x0 = barX1, y0 = barY;
        const x1 = barX0, y1 = barY;
        const x2 = barX0 + barSlant, y2 = barY + barHeight;
        const x3 = barX1 + barSlant, y3 = barY + barHeight;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      }
    } else {
      // Vertical: parallelogram fits SVG exactly
      const { barSlant, barY0, barY1, barX, barWidth } = this.barProps;
      if (!this.mirror) {
        // Bottom-left, bottom-right, top-right, top-left
        const bl_x = barX - barSlant, bl_y = barY1;
        const br_x = barX + barWidth - barSlant, br_y = barY1;
        const tr_x = barX + barWidth, tr_y = barY0;
        const tl_x = barX, tl_y = barY0;
        return `${bl_x},${bl_y} ${br_x},${br_y} ${tr_x},${tr_y} ${tl_x},${tl_y}`;
      } else {
        // Mirrored: slant on the other side
        const bl_x = barX + barWidth + barSlant, bl_y = barY1;
        const br_x = barX + barSlant, br_y = barY1;
        const tr_x = barX, tr_y = barY0;
        const tl_x = barX + barWidth, tl_y = barY0;
        return `${bl_x},${bl_y} ${br_x},${br_y} ${tr_x},${tr_y} ${tl_x},${tl_y}`;
      }
    }
  }

  get progressPoints(): string {
    const min = this.widgetProperties?.config?.displayScale?.lower ?? 0;
    const max = this.widgetProperties?.config?.displayScale?.upper ?? 100;
    const percent = Math.max(0, Math.min(1, (this.value - min) / (max - min)));
    if (percent === 0) return '';
    if (this.isHorizontal) {
      const { barSlant, barX0, barX1, barY, barHeight } = this.barProps;
      const fillLen = (barX1 - barX0) * percent;
      if (!this.mirror) {
        const x0 = barX0 - barSlant, y0 = barY + barHeight;
        const x1 = barX0, y1 = barY;
        const x2 = barX0 + fillLen, y2 = barY;
        const x3 = (fillLen < barSlant)
          ? barX0 - barSlant + fillLen
          : barX0 + fillLen - barSlant, y3 = barY + barHeight;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      } else {
        const x0 = barX1 + barSlant, y0 = barY + barHeight;
        const x1 = barX1, y1 = barY;
        const x2 = barX1 - fillLen, y2 = barY;
        const x3 = (fillLen < barSlant)
          ? barX1 + barSlant - fillLen
          : barX1 - fillLen + barSlant, y3 = barY + barHeight;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      }
    } else {
      // Vertical: always fill bottom to top, but parallelogram shape is mirrored if mirror is true
      const { barSlant, barY0, barY1, barX, barWidth } = this.barProps;
      if (!this.mirror) {
        // Bottom edge (background parallelogram)
        const bx0 = barX - barSlant, by0 = barY1;
        const bx1 = barX + barWidth - barSlant, by1 = barY1;
        // Top edge (background parallelogram)
        const tx0 = barX, ty0 = barY0;
        const tx1 = barX + barWidth, ty1 = barY0;
        // Interpolate fill front (top) between bottom and top
        const fy0 = by0 - (by0 - ty0) * percent;
        const fy1 = by1 - (by1 - ty1) * percent;
        const fx0 = bx0 + (tx0 - bx0) * percent;
        const fx1 = bx1 + (tx1 - bx1) * percent;
        return `${bx0},${by0} ${bx1},${by1} ${fx1},${fy1} ${fx0},${fy0}`;
      } else {
        // Mirrored parallelogram, but fill still bottom to top
        const bx0 = barX + barWidth + barSlant, by0 = barY1;
        const bx1 = barX + barSlant, by1 = barY1;
        const tx0 = barX + barWidth, ty0 = barY0;
        const tx1 = barX, ty1 = barY0;
        // Interpolate fill front (top) between bottom and top
        const fy0 = by0 - (by0 - ty0) * percent;
        const fy1 = by1 - (by1 - ty1) * percent;
        const fx0 = bx0 + (tx0 - bx0) * percent;
        const fx1 = bx1 + (tx1 - bx1) * percent;
        return `${bx0},${by0} ${bx1},${by1} ${fx1},${fy1} ${fx0},${fy0}`;
      }
    }
  }

  get cursorPoints(): string {
    const min = this.widgetProperties?.config?.displayScale?.lower ?? 0;
    const max = this.widgetProperties?.config?.displayScale?.upper ?? 100;
    const percent = Math.max(0, Math.min(1, (this.value - min) / (max - min)));
    if (percent === 0) return '';
    if (this.isHorizontal) {
      const { barSlant, barX0, barX1, barY, barHeight } = this.barProps;
      const fillLen = (barX1 - barX0) * percent;
      const cursorWidth = 4;
      if (!this.mirror) {
        const x0 = barX0 + fillLen - cursorWidth / 2;
        const y0 = barY;
        const x1 = barX0 + fillLen + cursorWidth / 2;
        const y1 = barY;
        const x2 = barX0 + fillLen + cursorWidth / 2 - barSlant;
        const y2 = barY + barHeight;
        const x3 = barX0 + fillLen - cursorWidth / 2 - barSlant;
        const y3 = barY + barHeight;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      } else {
        const x0 = barX1 - fillLen + cursorWidth / 2;
        const y0 = barY;
        const x1 = barX1 - fillLen - cursorWidth / 2;
        const y1 = barY;
        const x2 = barX1 - fillLen - cursorWidth / 2 + barSlant;
        const y2 = barY + barHeight;
        const x3 = barX1 - fillLen + cursorWidth / 2 + barSlant;
        const y3 = barY + barHeight;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      }
    } else {
      // Vertical: always fill bottom to top, but parallelogram shape is mirrored if mirror is true
      const { barSlant, barY0, barY1, barX, barWidth } = this.barProps;
      const cursorHeight = 4;
      if (!this.mirror) {
        // Bottom edge (background parallelogram)
        const bx0 = barX - barSlant, by0 = barY1;
        const bx1 = barX + barWidth - barSlant, by1 = barY1;
        // Top edge (background parallelogram)
        const tx0 = barX, ty0 = barY0;
        const tx1 = barX + barWidth, ty1 = barY0;
        // Interpolate fill front (top) between bottom and top
        const fy0 = by0 - (by0 - ty0) * percent;
        const fy1 = by1 - (by1 - ty1) * percent;
        const fx0 = bx0 + (tx0 - bx0) * percent;
        const fx1 = bx1 + (tx1 - bx1) * percent;
        // Cursor parallelogram at fill front
        const cy0 = fy0;
        const cy1 = fy1;
        const cy2 = fy1 + cursorHeight;
        const cy3 = fy0 + cursorHeight;
        return `${fx0},${cy0} ${fx1},${cy1} ${fx1},${cy2} ${fx0},${cy3}`;
      } else {
        // Mirrored parallelogram, but fill still bottom to top
        const bx0 = barX + barWidth + barSlant, by0 = barY1;
        const bx1 = barX + barSlant, by1 = barY1;
        const tx0 = barX + barWidth, ty0 = barY0;
        const tx1 = barX, ty1 = barY0;
        // Interpolate fill front (top) between bottom and top
        const fy0 = by0 - (by0 - ty0) * percent;
        const fy1 = by1 - (by1 - ty1) * percent;
        const fx0 = bx0 + (tx0 - bx0) * percent;
        const fx1 = bx1 + (tx1 - bx1) * percent;
        // Cursor parallelogram at fill front
        const cy0 = fy0;
        const cy1 = fy1;
        const cy2 = fy1 + cursorHeight;
        const cy3 = fy0 + cursorHeight;
        return `${fx0},${cy0} ${fx1},${cy1} ${fx1},${cy2} ${fx0},${cy3}`;
      }
    }
  }

  get shadowPoints(): string {
    const min = this.widgetProperties?.config?.displayScale?.lower ?? 0;
    const max = this.widgetProperties?.config?.displayScale?.upper ?? 100;
    const percent = Math.max(0, Math.min(1, (this.value - min) / (max - min)));
    if (percent === 0) return '';
    if (this.isHorizontal) {
      const { barSlant, barX0, barX1, barY, barHeight } = this.barProps;
      const fillLen = (barX1 - barX0) * percent;
      const shadowLen = Math.max(8, 40 * this.shadowStrength);
      if (!this.mirror) {
        const start = barX0 + fillLen;
        const end = Math.max(barX0, start - shadowLen);
        const x0 = end, y0 = barY;
        const x1 = start, y1 = barY;
        const x2 = start - barSlant, y2 = barY + barHeight;
        const x3 = end - barSlant, y3 = barY + barHeight;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      } else {
        const start = barX1 - fillLen;
        const end = Math.min(barX1, start + shadowLen);
        const x0 = end, y0 = barY;
        const x1 = start, y1 = barY;
        const x2 = start + barSlant, y2 = barY + barHeight;
        const x3 = end + barSlant, y3 = barY + barHeight;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      }
    } else {
      // Vertical
      const { barSlant, barMargin, barY0, barY1, barX, barWidth } = this.barProps;
      const fillLen = (barY1 - barY0) * percent;
      const shadowLen = Math.max(8, 40 * this.shadowStrength);
      if (!this.mirror) {
        const start = barY1 - fillLen;
        const end = Math.max(barY0, start - shadowLen);
        const y0 = end, x0 = barX;
        const y1 = start, x1 = barX;
        const y2 = start - barSlant, x2 = barX - barSlant;
        const y3 = end - barSlant, x3 = barX - barSlant;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      } else {
        const start = barY0 + fillLen;
        const end = Math.min(barY1, start + shadowLen);
        const y0 = end, x0 = barX + barWidth;
        const y1 = start, x1 = barX + barWidth;
        const y2 = start + barSlant, x2 = barX + barWidth + barSlant;
        const y3 = end + barSlant, x3 = barX + barWidth + barSlant;
        return `${x0},${y0} ${x1},${y1} ${x2},${y2} ${x3},${y3}`;
      }
    }
  }

  get valueLabelFormat(): string {
    // Returns a format string like '1.0-2' for Angular number pipe
    const int = this.widgetProperties?.config?.numInt ?? 1;
    const dec = this.widgetProperties?.config?.numDecimal ?? 0;
    return `${int}.${dec}-${dec}`;
  }

  public mirror: boolean = false; // set to true to enable mirroring

  get units(): string {
    return this.widgetProperties?.config?.paths?.['gaugePath']?.convertUnitTo || '';
  }

  get valueLabelX(): number {
    if (this.isHorizontal) {
      // Compute the midpoint between the two bottom corners of the filled progress parallelogram
      const { barSlant, barX0, barX1, barY, barHeight } = this.barProps;
      const min = this.widgetProperties?.config?.displayScale?.lower ?? 0;
      const max = this.widgetProperties?.config?.displayScale?.upper ?? 100;
      const percent = Math.max(0, Math.min(1, (this.value - min) / (max - min)));
      const fillLen = (barX1 - barX0) * percent;
      if (!this.mirror) {
        // Not mirrored
        const x0 = barX0 - barSlant;
        const x1 = (fillLen < barSlant)
          ? barX0 - barSlant + fillLen
          : barX0 + fillLen - barSlant;
        return (x0 + x1) / 2;
      } else {
        // Mirrored
        const x0 = barX1 + barSlant;
        const x1 = (fillLen < barSlant)
          ? barX1 + barSlant - fillLen
          : barX1 - fillLen + barSlant;
        return (x0 + x1) / 2;
      }
    } else {
      // Existing vertical logic
      const { barSlant, barY0, barY1, barX, barWidth } = this.barProps;
      const min = this.widgetProperties?.config?.displayScale?.lower ?? 0;
      const max = this.widgetProperties?.config?.displayScale?.upper ?? 100;
      const percent = Math.max(0, Math.min(1, (this.value - min) / (max - min)));
      if (!this.mirror) {
        const bx0 = barX - barSlant, by0 = barY1;
        const bx1 = barX + barWidth - barSlant, by1 = barY1;
        const tx0 = barX, ty0 = barY0;
        const tx1 = barX + barWidth, ty1 = barY0;
        let x0 = bx0, x1 = bx1, y0 = by0;
        if (percent === 1) { x0 = tx0; x1 = tx1; y0 = ty0; }
        return (x0 + x1) / 2;
      } else {
        const bx0 = barX + barWidth + barSlant, by0 = barY1;
        const bx1 = barX + barSlant, by1 = barY1;
        const tx0 = barX + barWidth, ty0 = barY0;
        const tx1 = barX, ty1 = barY0;
        let x0 = bx0, x1 = bx1, y0 = by0;
        if (percent === 1) { x0 = tx0; x1 = tx1; y0 = ty0; }
        return (x0 + x1) / 2;
      }
    }
  }

  get valueLabelY(): number {
    if (this.isHorizontal) {
      // Place label just below the bottom edge of the filled progress parallelogram
      const { barY, barHeight } = this.barProps;
      return barY + barHeight + 18;
    } else {
      // Existing vertical logic
      const { barSlant, barY0, barY1, barX, barWidth } = this.barProps;
      const min = this.widgetProperties?.config?.displayScale?.lower ?? 0;
      const max = this.widgetProperties?.config?.displayScale?.upper ?? 100;
      const percent = Math.max(0, Math.min(1, (this.value - min) / (max - min)));
      if (!this.mirror) {
        const by0 = barY1, ty0 = barY0;
        let y0 = by0;
        if (percent === 1) y0 = ty0;
        return y0 + 18;
      } else {
        const by0 = barY1, ty0 = barY0;
        let y0 = by0;
        if (percent === 1) y0 = ty0;
        return y0 + 18;
      }
    }
  }

  constructor() {
    super();

    this.defaultConfig = {
      displayName: "Gauge Label",
      filterSelfPaths: true,
      paths: {
        "gaugePath": {
          description: "Numeric Data",
          path: null,
          source: null,
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          convertUnitTo: "unitless",
          sampleTime: 500
        }
      },
      displayScale: {
        lower: 0,
        upper: 100,
        type: "linear"
      },
      gauge: {
        type: 'ngLinear',
        subType: 'horizontal',
        enableTicks: false,
        highlightsWidth: 5,
        useNeedle: false,
        mirror: false
      },
      numInt: 1,
      numDecimal: 0,
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    };

    effect(() => {
      if (this.theme()) {
       this.startWidget();
      }
    });
  }

  ngOnInit() {
    this.validateConfig();
    if (this.widgetProperties?.config?.gauge?.mirror !== undefined) {
      this.mirror = this.widgetProperties.config.gauge.mirror;
    }
    if (this.simulate) {
      this.startSimulation();
    } else {
      this.observeDataStream('gaugePath', newValue => {
        if (!newValue || !newValue.data) {
          newValue = {
            data: {
              value: 0,
              timestamp: new Date(),
            },
            state: States.Normal
          };
        }
        const now = Date.now();
        const newVal = Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);
        // Calculate speed
        const deltaValue = Math.abs(newVal - this.lastValue);
        const deltaTime = (now - this.lastTimestamp) / 1000; // seconds
        let speed = deltaTime > 0 ? deltaValue / deltaTime : 0;
        // Normalize speed to [0.2, 1.0] for shadow strength
        speed = Math.min(1, Math.max(0.2, speed * 2));
        this.shadowStrength = speed;
        this.lastValue = newVal;
        this.lastTimestamp = now;
        this.value = newVal;
      });
      if (!this.widgetProperties.config.ignoreZones) {
        this.observeMetaStream();
        this.metaSub = this.zones$.subscribe();
      }
    }
  }

  protected startWidget(): void {
    this.setGaugeConfig();
    //this.ngGauge.update(this.gaugeOptions);

    this.unsubscribeDataStream();
    this.unsubscribeMetaStream();
    this.metaSub?.unsubscribe();

    this.observeDataStream('gaugePath', newValue => {
      if (!newValue || !newValue.data) {
        newValue = {
          data: {
            value: 0,
            timestamp: new Date(),
          },
          state: States.Normal // Default state
        };
      }

      // Validate and handle `newValue.state`
      if (newValue.state == null) {
        newValue.state = States.Normal; // Provide a default value for state
      }

      // Compound value to displayScale
      this.value = Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);

      if (this.state !== newValue.state) {
        this.state = newValue.state;
        //@ts-ignore
        let option: LinearGaugeOptions = {};
        // Set value color: reduce color changes to only warn & alarm states else it too much flickering and not clean
        if (!this.widgetProperties.config.ignoreZones) {
          switch (newValue.state) {
            case States.Emergency:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.theme().zoneEmergency;
                option.colorValueText = this.theme().zoneEmergency;
              } else {
                option.colorNeedle = this.theme().zoneEmergency;
                option.colorValueText = this.theme().zoneEmergency;
              }
              break;
            case States.Alarm:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.theme().zoneAlarm;
                option.colorValueText = this.theme().zoneAlarm;
              } else {
                option.colorNeedle = this.theme().zoneAlarm;
                option.colorValueText = this.theme().zoneAlarm;
              }
              break;
            case States.Warn:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.theme().zoneWarn;
                option.colorValueText = this.theme().zoneWarn;
              } else {
                option.colorNeedle = this.theme().zoneWarn;
                option.colorValueText = this.theme().zoneWarn;
              }
              break;
            case States.Alert:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.theme().zoneAlert;
                option.colorValueText = this.theme().zoneAlert;
              } else {
                option.colorNeedle = this.theme().zoneAlert;
                option.colorValueText = this.theme().zoneAlert;
              }
              break;
            default:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.getColors(this.widgetProperties.config.color).color;
                option.colorValueText = this.getColors(this.widgetProperties.config.color).color;
              } else {
                option.colorNeedle = this.getColors(this.widgetProperties.config.color).color;
                option.colorValueText = this.getColors(this.widgetProperties.config.color).color;
              }
          }
        }
        //this.ngGauge.update(option);
      }
    });
    if (!this.widgetProperties.config.ignoreZones) {
      this.observeMetaStream();
      this.metaSub = this.zones$.subscribe(zones => {
        if (zones && zones.length > 0) {
          this.setHighlights(zones);
        }
      });
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    if (config?.gauge?.mirror !== undefined) {
      this.mirror = config.gauge.mirror;
    }
    this.ngOnInit();
  }

  ngAfterViewInit() {
    this.startWidget();
  }

  public onResized(event: ResizeObserverEntry) {
    //@ts-ignore
    let resize: LinearGaugeOptions = {};
    const aspectRatio = 0.3; // Aspect ratio to maintain (e.g., height/width or width/height)

    if (this.widgetProperties.config.gauge.subType === 'vertical') {
        // Enforce vertical orientation: Height is the primary dimension, width is 30% less
        resize.height = event.contentRect.height;
        resize.width = resize.height * aspectRatio;

        // Ensure the canvas fits within the parent dimensions
        if (resize.width > event.contentRect.width) {
            resize.width = event.contentRect.width;
            resize.height = resize.width / aspectRatio;
        }
    } else {
        // Enforce horizontal orientation: Width is the primary dimension, height is 30% less
        resize.width = event.contentRect.width;
        resize.height = resize.width * aspectRatio;

        // Ensure the canvas fits within the parent dimensions
        if (resize.height > event.contentRect.height) {
            resize.height = event.contentRect.height;
            resize.width = resize.height / aspectRatio;
        }
    }
    resize.height -= 10; // Adjust height to account for margin-top

    // Apply the calculated dimensions to the canvas
    //this.ngGauge.update(resize);
  }

  private setGaugeConfig() {
    const isVertical = this.widgetProperties.config.gauge.subType === 'vertical';
    const isNeedle = this.widgetProperties.config.gauge.useNeedle;
    const isTicks = this.widgetProperties.config.gauge.enableTicks;
    let scale = {
      min: this.widgetProperties.config.displayScale.lower,
      max: this.widgetProperties.config.displayScale.upper,
      majorTicks: []
    };

    //const rect = this.gauge.nativeElement.getBoundingClientRect();
    let height: number = null;
    let width: number = null;

    if (isTicks) {
      scale = adjustLinearScaleAndMajorTicks(this.widgetProperties.config.displayScale.lower, this.widgetProperties.config.displayScale.upper);
    }

    const defaultOptions = {
      height: height,
      width: width,
      minValue: scale.min,
      maxValue: scale.max,

      valueInt: this.widgetProperties.config.numInt !== undefined && this.widgetProperties.config.numInt !== null ? this.widgetProperties.config.numInt : 1,
      valueDec: this.widgetProperties.config.numDecimal !== undefined && this.widgetProperties.config.numDecimal !== null ? this.widgetProperties.config.numDecimal : 2,

      title: this.widgetProperties.config.displayName,
      fontTitleSize: 40,
      fontTitle: "Roboto",
      fontTitleWeight: "bold",

      barLength: isVertical ? 80 : 90,
      barWidth: isTicks ? 30 : 60,
      barProgress: true,
      barBeginCircle: 0,
      barStrokeWidth: 0,
      barShadow: 0,

      needle: isNeedle,
      needleType: this.widgetProperties.config.gauge.useNeedle ? "arrow" : "line",
      needleShadow: false,
      needleSide: "both",
      needleStart: this.widgetProperties.config.gauge.useNeedle ? 22 : -45,
      needleEnd: this.widgetProperties.config.gauge.useNeedle ? 120 : 55,

      colorNeedleEnd: "",
      colorNeedleShadowUp: "",
      colorNeedleShadowDown: "black",

      units: this.widgetProperties.config.paths['gaugePath'].convertUnitTo,
      fontUnits: "Roboto",
      fontUnitsWeight: "normal",
      borders: false,
      borderOuterWidth: 0,
      colorBorderOuter: "red",
      colorBorderOuterEnd: "red",
      borderMiddleWidth: 0,
      colorBorderMiddle: "#63afdf",
      colorBorderMiddleEnd: "#63afdf",
      borderInnerWidth: 0,
      colorBorderInner: "red",
      colorBorderInnerEnd: "#121212",
      borderShadowWidth: 0,
      borderRadius: 0,

      colorBarEnd: "",
      colorBarStroke: "0",
      valueBoxStroke: 0,
      colorValueBoxRect: "",
      colorValueBoxRectEnd: "",
      colorValueBoxBackground: this.theme().background,
      fontValueSize: 50,
      fontValue: "Roboto",
      fontValueWeight: "bold",
      valueTextShadow: false,

      colorValueBoxShadow: "",
      fontNumbers: "Roboto",
      fontNumbersWeight: "normal",
      fontUnitsSize: this.isGaugeVertical ? 40 : 35,

      colorTitle: this.getColors('contrast').dim,
      colorUnits: this.getColors('contrast').dim,
      colorValueText: this.getColors(this.widgetProperties.config.color).color,
      colorPlate: this.theme().cardColor,
      colorBar: this.theme().background,

      colorMajorTicks: this.getColors('contrast').dim,
      colorMinorTicks: this.getColors('contrast').dim,
      colorNumbers: this.getColors('contrast').dim,

      majorTicks:  isTicks ? scale.majorTicks : [],

      majorTicksInt: this.widgetProperties.config.numInt !== undefined && this.widgetProperties.config.numInt !== null ? this.widgetProperties.config.numInt : 1,
      majorTicksDec: this.widgetProperties.config.numDecimal !== undefined && this.widgetProperties.config.numDecimal !== null ? this.widgetProperties.config.numDecimal : 2,
      numberSide: "left",
      fontNumbersSize: isTicks ? 25 : 0,
      numbersMargin: isVertical ? -3 : -5,
      tickSide: "left",
      ticksWidth: isTicks ? 10 : 0,
      ticksPadding: isTicks ? isVertical ? 5 : 8 : 0,
      strokeTicks: isTicks,
      minorTicks: isTicks ? 2 : 0,
      ticksWidthMinor: isTicks ? 6 : 0,

      valueBox: true,
      valueBoxWidth: 35,
      valueBoxBorderRadius: 10,

      highlights: [],
      highlightsWidth: this.widgetProperties.config.gauge.highlightsWidth,

      animation: true,
      animationRule: "linear",
      animatedValue: false,
      animateOnInit: false,
      animationDuration: this.widgetProperties.config.paths['gaugePath'].sampleTime - 25,
    };

    Object.assign(this.gaugeOptions, defaultOptions);

    this.setThemePaletteColor();
  }

  private setThemePaletteColor() {
    let themePaletteColor = "";
    let themePaletteDarkColor = "";

    switch (this.widgetProperties.config.color) {
      case "contrast":
        themePaletteColor = this.theme().contrast;
        themePaletteDarkColor = this.theme().contrastDim;
        break;
      case "blue":
        themePaletteColor = this.theme().blue;
        themePaletteDarkColor = this.theme().blueDim;
        break;
      case "green":
        themePaletteColor = this.theme().green;
        themePaletteDarkColor = this.theme().greenDim;
        break;
      case "pink":
        themePaletteColor = this.theme().pink;
        themePaletteDarkColor = this.theme().pinkDim;
        break;
      case "orange":
        themePaletteColor = this.theme().orange;
        themePaletteDarkColor = this.theme().orangeDim;
        break;
      case "purple":
        themePaletteColor = this.theme().purple;
        themePaletteDarkColor = this.theme().purpleDim;
        break;
      case "grey":
        themePaletteColor = this.theme().grey;
        themePaletteDarkColor = this.theme().greyDim;
        break;
      case "yellow":
        themePaletteColor = this.theme().yellow;
        themePaletteDarkColor = this.theme().yellowDim;
        break;
      default:
        themePaletteColor = this.theme().contrast;
        themePaletteDarkColor = this.theme().contrastDim;
        break;
    }

    Object.assign(this.gaugeOptions, {
      colorBarProgress: this.widgetProperties.config.gauge.useNeedle ? "" : themePaletteColor,
      colorBarProgressEnd: '',
      colorNeedle: this.widgetProperties.config.gauge.useNeedle ? themePaletteColor : themePaletteDarkColor,
      needleWidth: this.widgetProperties.config.gauge.useNeedle ? 20 : 0,
    });
  }

  private getColors(color: string): { color: string, dim: string, dimmer: string } {
    const themePalette = {
      "contrast": { color: this.theme().contrast, dim: this.theme().contrastDim, dimmer: this.theme().contrastDimmer },
      "blue": { color: this.theme().blue, dim: this.theme().blueDim, dimmer: this.theme().blueDimmer },
      "green": { color: this.theme().green, dim: this.theme().greenDim, dimmer: this.theme().greenDimmer },
      "pink": { color: this.theme().pink, dim: this.theme().pinkDim, dimmer: this.theme().pinkDimmer },
      "orange": { color: this.theme().orange, dim: this.theme().orangeDim, dimmer: this.theme().orangeDimmer },
      "purple": { color: this.theme().purple, dim: this.theme().purpleDim, dimmer: this.theme().purpleDimmer },
      "yellow": { color: this.theme().yellow, dim: this.theme().yellowDim, dimmer: this.theme().yellowDimmer },
      "grey": { color: this.theme().grey, dim: this.theme().greyDim, dimmer: this.theme().yellowDimmer }
    };
    return themePalette[color];
  }

  private setHighlights(zones: ISkZone[]): void {
    const gaugeZonesHighlight: IDataHighlight[] = [];
    // Sort zones based on lower value
    const sortedZones = [...zones].sort((a, b) => a.lower - b.lower);
    for (const zone of sortedZones) {
      let lower: number = null;
      let upper: number = null;

      let color: string;
      switch (zone.state) {
        case States.Emergency:
          color = this.theme().zoneEmergency;
          break;
        case States.Alarm:
          color = this.theme().zoneAlarm;
          break;
        case States.Warn:
          color = this.theme().zoneWarn;
          break;
        case States.Alert:
          color = this.theme().zoneAlert;
          break;
        case States.Nominal:
          color = this.theme().zoneNominal;
          break;
        default:
          color = "rgba(0,0,0,0)";
      }

      lower = this.unitsService.convertToUnit(this.widgetProperties.config.paths['gaugePath'].convertUnitTo, zone.lower);
      upper =this.unitsService.convertToUnit(this.widgetProperties.config.paths['gaugePath'].convertUnitTo, zone.upper);

      // Skip zones that are completely outside the gauge range
      if (upper < this.widgetProperties.config.displayScale.lower || lower > this.widgetProperties.config.displayScale.upper) {
        continue;
      }

      // If lower or upper are null, set them to displayScale min or max
      lower = lower !== null ? lower : this.widgetProperties.config.displayScale.lower;
      upper = upper !== null ? upper : this.widgetProperties.config.displayScale.upper;

      // Ensure lower does not go below min
      lower = Math.max(lower, this.widgetProperties.config.displayScale.lower);

      // Ensure upper does not exceed max
      if (upper > this.widgetProperties.config.displayScale.upper) {
        upper = this.widgetProperties.config.displayScale.upper;
        gaugeZonesHighlight.push({from: lower, to: upper, color: color});
        break;
      }

      gaugeZonesHighlight.push({from: lower, to: upper, color: color});
    };
    //@ts-ignore
    let highlights: LinearGaugeOptions = {};
    highlights.highlightsWidth = this.widgetProperties.config.gauge.highlightsWidth;
    //@ts-ignore - bug in highlights property definition
    highlights.highlights = JSON.stringify(gaugeZonesHighlight, null, 1);
    //this.ngGauge.update(highlights);
  }

  ngOnDestroy() {
    if (this.simInterval) {
      clearTimeout(this.simInterval);
    }
    this.destroyDataStreams();
    this.metaSub?.unsubscribe();
  }

  startSimulation() {
    const minV = 0.5;
    const maxV = 14.8;
    const smallStep = 0.01 + Math.random() * 0.04; // 0.01-0.05V
    const bigStep = 0.1 + Math.random() * 2; // 0.1-0.3V
    let nextValue = this.value;
    // 90% chance small step, 10% chance big step
    if (Math.random() < 0.9) {
      nextValue += (Math.random() < 0.5 ? -1 : 1) * smallStep;
    } else {
      nextValue += (Math.random() < 0.5 ? -1 : 1) * bigStep;
    }
    // Clamp
    nextValue = Math.max(minV, Math.min(maxV, nextValue));
    // Simulate a rare "jump" (e.g., alternator on/off)
    if (Math.random() < 0.01) {
      nextValue = minV + Math.random() * (maxV - minV);
    }
    // Update value and shadow
    const now = Date.now();
    const deltaValue = Math.abs(nextValue - this.lastValue);
    const deltaTime = (now - this.lastTimestamp) / 1000;
    let speed = deltaTime > 0 ? deltaValue / deltaTime : 0;
    speed = Math.min(1, Math.max(0.2, speed * 2));
    this.shadowStrength = speed;
    this.lastValue = nextValue;
    this.lastTimestamp = now;
    this.value = nextValue;
    // Next update in 60-180ms
    this.simInterval = setTimeout(() => this.startSimulation(), 60 + Math.random() * 120);
  }
}
