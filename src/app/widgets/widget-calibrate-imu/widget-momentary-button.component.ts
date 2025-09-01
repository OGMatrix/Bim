import { Component, inject, OnInit } from '@angular/core';
import { SvgBooleanButtonComponent } from '../svg-boolean-button/svg-boolean-button.component';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import type { IDynamicControl, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ControlType } from '../../core/interfaces/widgets-interface';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';

@Component({
  selector: 'widget-momentary-button',
  templateUrl: './widget-momentary-button.component.html',
  styleUrl: './widget-momentary-button.component.scss',
  standalone: true,
  imports: [WidgetHostComponent, WidgetTitleComponent]
})
export class WidgetMomentaryButtonComponent extends BaseWidgetComponent implements OnInit {
  public dynamicControl: IDynamicControl;
  private signalkRequestsService = inject(SignalkRequestsService);
  protected labelColor: string | undefined = undefined;
  protected accentColor: string | undefined = undefined;

  constructor() {
    super();
    // Set up default configuration
    this.defaultConfig = {
      displayName: "Calibrate IMU",
      paths: {
        "valuePath": {
          description: 'Calibrate (number)',
          path: 'electrical.switches.bank.107.initPitchRoll.state',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: null,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: null,
          supportsPut: true,
          sampleTime: 500,
        }
      },
      putEnable: true,
      color: "contrast"
    };
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  protected startWidget(): void {
    this.injectControlData();
    this.createDataObservable();
  }

  ngAfterViewInit(): void {
    this.injectControlData();
    this.createDataObservable();
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
      this.widgetProperties.config = config;
      this.startWidget();
    }

  injectControlData() {
    this.dynamicControl = {
      type: String(ControlType.push),
      pathID: "valuePath",
      isNumeric: true,
      ctrlLabel: this.widgetProperties.config.displayName,
      color: this.widgetProperties.config.color,
      value: false
    };
  }

  public handleButtonToggle(): void {
    console.log('Button toggle event:');
    const valuePath = this.defaultConfig.paths["valuePath"];
      console.log(this.defaultConfig)
    const uuid = this.widgetProperties.uuid;
    if (valuePath?.path) {
      this.signalkRequestsService.putRequest(valuePath.path, 1, uuid);
    }
  }

  private setColors(color: string): void {
    switch (color) {
      case 'contrast':
        this.labelColor = this.theme().cardColor;
        break;
      case 'blue':
        this.labelColor = this.theme().blueDim;
        break;
      case 'green':
        this.labelColor = this.theme().greenDim;
        break;
      case 'pink':
        this.labelColor = this.theme().pinkDim;
        break;
      case 'orange':
        this.labelColor = this.theme().orangeDim;
        break;
      case 'purple':
        this.labelColor = this.theme().purpleDim;
        break;
      case 'grey':
        this.labelColor = this.theme().greyDim;
        break;
      case 'yellow':
        this.labelColor = this.theme().yellowDim;
        break;
      default:
        this.labelColor = this.theme().cardColor;
        break;
    }

    // Use alarm color as the active accent (red-ish)
    this.accentColor = this.theme().zoneAlarm;
  }
}
