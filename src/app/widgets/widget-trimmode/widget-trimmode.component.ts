import { AfterViewInit, Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { AppService } from '../../core/services/app-service';
import { Subscription } from 'rxjs';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';

type TrimMode = 'n' | 't' | 'w' | null;

@Component({
  selector: 'widget-trimmode',
  standalone: true,
  imports: [
    WidgetHostComponent,
    WidgetTitleComponent,
    MatButtonToggleModule,
    MatButtonModule,
    NgxResizeObserverModule,
  ],
  templateUrl: './widget-trimmode.component.html',
  styleUrl: './widget-trimmode.component.scss',
})
export class WidgetTrimmodeComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private signalkRequestsService = inject(SignalkRequestsService);
  private appService = inject(AppService);

  protected labelColor: string | undefined = undefined;
  protected accentColor: string | undefined = undefined;
  protected activeMode = signal<TrimMode>(null);
  private skRequestSub: Subscription = new Subscription();

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Trim Mode',
      filterSelfPaths: true,
      paths: {
        modePath: {
          description: 'Trim mode (string)',
          path: 'self.propulsion.trimm.mode',
          source: 'default',
          pathType: 'string',
          isPathConfigurable: true,
          // String path; unit conversion not applicable
          convertUnitTo: null,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: null,
          supportsPut: true,
          sampleTime: 500,
        },
      },
      enableTimeout: false,
      dataTimeout: 5,
      color: 'contrast',
      putEnable: true,
    };

    effect(() => {
      if (this.theme()) {
        this.setColors(this.widgetProperties?.config?.color);
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.startWidget();
  }

  protected startWidget(): void {
    // Observe current mode path to reflect selection
    this.unsubscribeDataStream();
    this.observeDataStream('modePath', (update) => {
      const val = update?.data?.value;
      if (val === 'n' || val === 't' || val === 'w') {
        this.activeMode.set(val as TrimMode);
      } else {
        this.activeMode.set("n");
      }
    });

    // Listen to PUT response messages
    this.skRequestSub?.unsubscribe();
    this.subscribeSKRequest();
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.setColors(this.widgetProperties.config.color);
    this.startWidget();
  }

  protected onResized(_event?: ResizeObserverEntry): void {
    // No-op for now; layout is responsive via CSS
  }

  onModeChange(event: MatButtonToggleChange): void {
    const mode = event.value as TrimMode;
    this.sendMode(mode);
  }

  selectMode(mode: TrimMode): void {
    this.sendMode(mode);
  }

  private sendMode(mode: TrimMode): void {
    if (!mode) { return; }
    const path = this.widgetProperties.config.paths['modePath'].path;
    if (!path) {
      this.appService.sendSnackbarNotification('Trim Mode Widget: Signal K path is not configured.', 5000, true);
      return;
    }
    this.signalkRequestsService.putRequest(path, mode, this.widgetProperties.uuid);
  }

  private subscribeSKRequest(): void {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe((requestResult) => {
      if (requestResult.widgetUUID === this.widgetProperties.uuid) {
        let errMsg = `Trim Mode Widget ${this.widgetProperties.config.displayName}: `;
        if (requestResult.statusCode !== 200) {
          if (requestResult.message) {
            errMsg += requestResult.message;
          } else {
            errMsg += requestResult.statusCode + ' - ' + requestResult.statusCodeDescription;
          }
          this.appService.sendSnackbarNotification(errMsg, 0);
        }
      }
    });
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

  ngOnDestroy(): void {
    this.destroyDataStreams();
    this.skRequestSub?.unsubscribe();
  }
}


